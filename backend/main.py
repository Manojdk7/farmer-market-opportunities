import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta, timezone
import logging
import math
import os
import secrets
import statistics

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from auth import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UserResponse,
    authenticate_user,
    check_login_allowed,
    cleanup_expired_sessions,
    create_session,
    create_user,
    get_current_user,
    invalidate_session,
    record_failed_attempt,
    reset_login_attempts,
    validate_session,
)
from calculator import calculate_net_proceeds
from database import Base, SessionLocal, engine, get_db
from freshness import RECENT_CALENDAR_DAYS, SUPPORTED_PRICE_UNITS, observation_freshness
from migrations import migrate_auth_tables, migrate_price_observations
from models import (
    BuyerRequirement,
    Comparison,
    Market,
    PriceObservation,
    SellingOption,
    TransportQuote,
    User,
    UserSession,
)
from schemas import CalculateRequest, ComparisonRequest, PriceObservationCreate
from seed_data import seed_sample_data
from agmarknet_sync import sync_agmarknet_prices, ensure_district_markets, LAST_SYNC_STATUS
from karnataka_metadata import (
    KARNATAKA_DISTRICTS,
    KARNATAKA_CROPS,
    find_district_by_name_or_alias,
    find_crop_by_name_or_alias,
)

logger = logging.getLogger("main")

PRICE_FRESHNESS_DAYS = 7
CLOSE_THRESHOLD_PERCENT = 2
SYNC_STATUS = {
    "configured": False,
    "available": False,
    "last_successful_sync_at": None,
    "status": "not_configured",
    "message": "No remote market-data synchronization provider is configured. Stored observations may be outdated.",
}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    migrate_price_observations(engine)
    migrate_auth_tables(engine)
    if os.getenv("SEED_DEMO_DATA") == "1":
        with SessionLocal() as db:
            seed_sample_data(db)

    # Ensure verified APMC markets for all Karnataka districts exist
    try:
        with SessionLocal() as db:
            for d in KARNATAKA_DISTRICTS:
                ensure_district_markets(db, d["name"])
    except Exception as exc:
        logger.warning("Could not pre-populate district markets: %s", exc)

    async def _daily_agmarknet_sync():
        await asyncio.sleep(1)
        while True:
            try:
                with SessionLocal() as db:
                    sync_agmarknet_prices(db, "Davanagere", "Maize")
            except Exception as exc:
                logger.warning("AGMARKNET background sync exception: %s", exc)
            await asyncio.sleep(86400)

    sync_task = asyncio.create_task(_daily_agmarknet_sync())
    try:
        yield
    finally:
        sync_task.cancel()


app = FastAPI(title="Farmer Market Opportunities API", lifespan=lifespan)
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").strip().lower() == "true"
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def round_money(value: float) -> float:
    return round(value + 1e-10, 2)

# ===========================================================================
# Authentication Endpoints
# ===========================================================================


@app.post("/api/auth/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Register a new farmer account and automatically establish a session."""
    if payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match.",
        )

    try:
        user = create_user(
            db=db,
            username=payload.username,
            password=payload.password,
            role="farmer",  # Public registration strictly assigns farmer role
            full_name=payload.full_name,
            mobile_number=payload.mobile_number,
            email=payload.email,
            district=payload.district,
            preferred_language=payload.preferred_language,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # Automatically log the user in by creating a session cookie
    session = create_session(db, user.id)
    response.set_cookie(
        key="session_token",
        value=session.session_token,
        httponly=True,
        samesite="lax",
        secure=SESSION_COOKIE_SECURE,
        max_age=86400,
        path="/",
    )

    return RegisterResponse(
        username=user.username,
        role=user.role,
        message="Account created successfully",
    )



@app.post("/api/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Authenticate user and establish an HttpOnly session cookie."""
    username = payload.username.strip()
    if not check_login_allowed(username):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again later.",
        )

    user = authenticate_user(db, username, payload.password)
    if user is None:
        record_failed_attempt(username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    reset_login_attempts(username)
    session = create_session(db, user.id)

    response.set_cookie(
        key="session_token",
        value=session.session_token,
        httponly=True,
        samesite="lax",
        secure=SESSION_COOKIE_SECURE,
        max_age=86400,
        path="/",
    )

    return LoginResponse(
        username=user.username,
        role=user.role,
        message="Login successful",
    )


@app.post("/api/auth/logout")
async def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """Terminate the current session and clear the session cookie."""
    token = request.cookies.get("session_token")
    if token:
        invalidate_session(db, token)
    response.delete_cookie(
        key="session_token",
        path="/",
        httponly=True,
        samesite="lax",
        secure=SESSION_COOKIE_SECURE,
    )
    return {"message": "Logged out successfully"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_me(
    request: Request,
    db: Session = Depends(get_db),
):
    """Return the currently authenticated user based on session cookie."""
    token = request.cookies.get("session_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    user = validate_session(db, token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )
    return UserResponse(
        id=user.id,
        username=user.username,
        role=user.role,
        created_at=user.created_at,
    )



def calculate_breakdown(inputs: CalculateRequest) -> dict:
    result = calculate_net_proceeds(
        inputs.q,
        inputs.p,
        inputs.l,
        inputs.d,
        inputs.ct,
        inputs.ch,
        inputs.cp,
        inputs.cm,
        inputs.co,
    )
    saleable_quantity = inputs.q * (1 - inputs.l)
    effective_price = max(0, inputs.p - inputs.d)
    total_costs = inputs.ct + inputs.ch + inputs.cp + inputs.cm + inputs.co
    return {
        "quantity": inputs.q,
        "quantity_unit": inputs.quantity_unit,
        "physical_loss_percent": inputs.l * 100,
        "saleable_quantity": saleable_quantity,
        "gross": round_money(inputs.q * inputs.p),
        "quality_deduction": round_money(saleable_quantity * (inputs.p - effective_price)),
        "adjusted_sale_value": round_money(saleable_quantity * effective_price),
        "packaging_cost": inputs.cp,
        "transport_cost": inputs.ct,
        "handling_cost": inputs.ch,
        "commission_cost": inputs.cm,
        "other_costs": inputs.co,
        "total_costs": total_costs,
        "net_proceeds": round_money(result),
        "price_unit": inputs.price_unit,
    }


def market_dict(market: Market) -> dict:
    return {
        "id": market.id,
        "name": market.name,
        "location": market.location,
        "district": market.district,
        "state": market.state,
        "is_active": market.is_active,
        "is_sample": market.is_sample,
        "created_at": market.created_at.isoformat(),
    }


def observation_dict(observation: PriceObservation) -> dict:
    freshness = observation_freshness(observation.observation_date)
    eligibility_reasons = []
    if observation.data_type == "demo":
        eligibility_reasons.append("Demo data cannot be used as a real market-price ranking.")
    if observation.observation_date is None:
        eligibility_reasons.append("Observation date unavailable.")
    elif freshness == "stale":
        eligibility_reasons.append("Stale price; verify before deciding.")
    elif freshness == "unknown":
        eligibility_reasons.append("Observation date is invalid or in the future.")
    if not observation.source_name or not observation.source_name.strip():
        eligibility_reasons.append("Source unavailable.")
    if not observation.unit or not observation.unit.strip():
        eligibility_reasons.append("Price unit unavailable.")
    elif observation.unit not in SUPPORTED_PRICE_UNITS:
        eligibility_reasons.append("Price unit is unsupported for comparable market ranking.")
    if not observation.commodity or not observation.commodity.strip():
        eligibility_reasons.append("Commodity unavailable.")
    if observation.market is None or not observation.market.name.strip():
        eligibility_reasons.append("Market unavailable.")
    if not isinstance(observation.price, (int, float)) or not math.isfinite(observation.price) or observation.price <= 0:
        eligibility_reasons.append("Price is invalid.")

    return {
        "id": observation.id,
        "market_id": observation.market_id,
        "market_name": observation.market.name if observation.market else None,
        "market_location": observation.market.location if observation.market else None,
        "market_district": observation.market.district if observation.market else "Davanagere",
        "market_state": observation.market.state if observation.market else "Karnataka",
        "commodity": observation.commodity,
        "variety": observation.variety,
        "price": observation.price,
        "modal_price": getattr(observation, "modal_price", None) or observation.price,
        "min_price": getattr(observation, "min_price", None),
        "max_price": getattr(observation, "max_price", None),
        "unit": observation.unit,
        "arrival_quantity": getattr(observation, "arrival_quantity", None),
        "arrival_unit": getattr(observation, "arrival_unit", None),
        "observation_date": observation.observation_date.isoformat() if observation.observation_date else None,
        "retrieved_at": observation.retrieved_at.isoformat() if observation.retrieved_at else None,
        "created_at": observation.created_at.isoformat() if observation.created_at else None,
        "updated_at": observation.updated_at.isoformat() if observation.updated_at else None,
        "source_name": observation.source_name,
        "source_url": "https://agmarknet.gov.in/" if (not observation.source_url or "api.agmarknet.gov.in" in str(observation.source_url)) else observation.source_url,
        "data_type": observation.data_type,
        "verification_status": observation.verification_status,
        "freshness": freshness,
        "ranking_eligible": not eligibility_reasons,
        "eligibility_reasons": eligibility_reasons,
        "source": observation.source,
        "is_sample": observation.is_sample,
    }


def comparison_dict(comparison: Comparison) -> dict:
    return {
        "id": comparison.id,
        "commodity": comparison.commodity,
        "quantity": comparison.quantity,
        "quantity_unit": comparison.quantity_unit,
        "physical_loss_percent": comparison.physical_loss_percent,
        "status": comparison.status,
        "winner_selling_option_id": comparison.winner_selling_option_id,
        "calculation_inputs": comparison.calculation_inputs,
        "results": comparison.results,
        "is_sample": comparison.is_sample,
        "created_at": comparison.created_at.isoformat(),
    }


@app.get("/api/districts")
def list_districts():
    return {
        "items": [
            {
                "id": d["id"],
                "name": d["name"],
                "name_kn": d["name_kn"],
                "provider_id": d["id"],
                "aliases": d["aliases"],
            }
            for d in KARNATAKA_DISTRICTS
        ],
        "count": len(KARNATAKA_DISTRICTS),
        "default": "Davanagere",
    }


@app.get("/api/crops")
def list_crops():
    return {
        "items": [
            {
                "id": c["id"],
                "key": c["key"],
                "name": c["name"],
                "name_kn": c["name_kn"],
                "agmarknet_name": c["agmarknet_name"],
                "default_unit": c["default_unit"],
                "is_sugarcane": c.get("is_sugarcane", False),
                "frp_reference_per_tonne": c.get("frp_reference_per_tonne"),
                "pricing_types": c.get("pricing_types", ["APMC Modal Price"]),
            }
            for c in KARNATAKA_CROPS
        ],
        "count": len(KARNATAKA_CROPS),
        "default": "Maize",
    }


@app.get("/api/markets")
def list_markets(
    district: str | None = None,
    state: str | None = None,
    include_demo: bool = False,
    db: Session = Depends(get_db),
):
    query = select(Market).where(Market.is_active.is_(True))
    if not include_demo:
        query = query.where(Market.is_sample.is_(False))
    
    # Restrict geographical scope:
    effective_district = district.strip() if district else "Davanagere"
    dist_info = find_district_by_name_or_alias(effective_district)
    canonical_district = dist_info["name"] if dist_info else effective_district

    effective_state = state.strip() if state else "Karnataka"
    query = query.where(Market.district.ilike(f"%{canonical_district}%"))
    query = query.where(Market.state.ilike(f"%{effective_state}%"))

    markets = db.scalars(query.order_by(Market.name)).all()
    return {
        "items": [market_dict(market) for market in markets],
        "count": len(markets),
        "district": canonical_district,
    }


@app.get("/api/price-observations")
def list_price_observations(
    market_id: int | None = None,
    commodity: str | None = None,
    district: str | None = None,
    state: str | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    data_type: str | None = None,
    freshness: str | None = None,
    include_demo: bool = False,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if from_date and to_date and from_date > to_date:
        raise HTTPException(status_code=422, detail="from_date must be on or before to_date.")
    if data_type is not None and data_type not in {"official", "manual", "demo"}:
        raise HTTPException(status_code=422, detail="data_type must be official, manual, or demo.")

    query = select(PriceObservation).join(PriceObservation.market).options(joinedload(PriceObservation.market))

    # Exclude synthetic/demo data from production queries unless explicitly requested
    if data_type == "demo" or include_demo:
        if data_type == "demo":
            query = query.where(PriceObservation.data_type == "demo")
    else:
        query = query.where(PriceObservation.is_sample.is_(False), PriceObservation.data_type != "demo")

    effective_district = district.strip() if district else "Davanagere"
    dist_info = find_district_by_name_or_alias(effective_district)
    canonical_district = dist_info["name"] if dist_info else effective_district

    effective_state = state.strip() if state else "Karnataka"
    query = query.where(Market.district.ilike(f"%{canonical_district}%"))
    query = query.where(Market.state.ilike(f"%{effective_state}%"))
    query = query.where(Market.is_active.is_(True))
    if not include_demo and data_type != "demo":
        query = query.where(Market.is_sample.is_(False))

    if market_id is not None:
        query = query.where(PriceObservation.market_id == market_id)
    if commodity:
        crop_info = find_crop_by_name_or_alias(commodity.strip())
        if crop_info:
            canonical_crop = crop_info["name"]
            crop_patterns = [canonical_crop, crop_info.get("agmarknet_name", canonical_crop)]
            crop_filters = [PriceObservation.commodity.ilike(f"%{pat}%") for pat in crop_patterns]
            query = query.where(or_(*crop_filters))
        else:
            query = query.where(PriceObservation.commodity.ilike(f"%{commodity.strip()}%"))
    if from_date:
        query = query.where(PriceObservation.observation_date >= from_date)
    if to_date:
        query = query.where(PriceObservation.observation_date <= to_date)
    if data_type is not None and data_type != "demo":
        query = query.where(PriceObservation.data_type == data_type)
    today = datetime.now(timezone.utc).date()
    recent_start = today - timedelta(days=RECENT_CALENDAR_DAYS - 1)
    if freshness == "recent":
        query = query.where(PriceObservation.observation_date >= recent_start, PriceObservation.observation_date <= today)
    elif freshness == "stale":
        query = query.where(PriceObservation.observation_date < recent_start)
    elif freshness == "unknown":
        query = query.where(or_(
            PriceObservation.observation_date.is_(None),
            PriceObservation.observation_date > today,
        ))
    limit_val = int(limit.default if hasattr(limit, "default") else limit)
    observations = db.scalars(query.order_by(PriceObservation.observation_date.desc(), PriceObservation.id.desc()).limit(limit_val)).all()
    items = [observation_dict(item) for item in observations]
    comparable_groups = {}
    for item in items:
        if not item["ranking_eligible"]:
            continue
        key = (
            item["commodity"].strip().casefold(),
            (item["variety"] or "").strip().casefold(),
            item["unit"],
        )
        comparable_groups.setdefault(key, set()).add(item["market_id"])
    comparable_group_count = sum(len(market_ids) >= 2 for market_ids in comparable_groups.values())
    return {
        "items": items,
        "count": len(items),
        "limit": limit,
        "ranking_status": "comparable_data_available" if comparable_group_count else "insufficient_reliable_data",
        "ranking_message": (
            "Comparable source-identified, recent observations are available; review provenance before use."
            if comparable_group_count
            else "Insufficient reliable data for ranking."
        ),
    }


def admin_token_is_configured() -> bool:
    token = os.getenv("MARKET_DATA_ADMIN_TOKEN", "")
    return len(token) >= 32


def require_admin(authorization: str | None = Header(default=None)) -> None:
    configured_token = os.getenv("MARKET_DATA_ADMIN_TOKEN", "")
    if len(configured_token) < 32:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Manual market-data entry is disabled; configure MARKET_DATA_ADMIN_TOKEN with at least 32 characters.",
        )
    scheme, separator, supplied_token = (authorization or "").partition(" ")
    if not separator or scheme.lower() != "bearer" or not supplied_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="A valid admin bearer token is required.")
    if not secrets.compare_digest(supplied_token, configured_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin authorization failed.")


@app.get("/api/admin/status")
def admin_status():
    return {"manual_entry_enabled": admin_token_is_configured()}


@app.post(
    "/api/price-observations",
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
def create_price_observation(
    payload: PriceObservationCreate,
    db: Session = Depends(get_db),
):
    market = db.get(Market, payload.market_id)
    if market is None or not market.is_active:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Select an existing active market.")

    source_name = payload.source_name.strip() if payload.source_name else None
    observation = PriceObservation(
        market_id=payload.market_id,
        commodity=payload.commodity,
        variety=payload.variety,
        price=payload.price,
        unit=payload.unit,
        arrival_quantity=payload.arrival_quantity,
        arrival_unit=payload.arrival_unit,
        observation_date=payload.observation_date,
        retrieved_at=None,
        source_name=source_name,
        source_url=str(payload.source_url) if payload.source_url else None,
        data_type="manual",
        verification_status="unverified",
        source=source_name,
        is_sample=False,
    )
    db.add(observation)
    try:
        db.commit()
        db.refresh(observation)
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(status_code=500, detail="Market observation could not be saved.") from error
    return observation_dict(observation)


# ---------------------------------------------------------------------------
# Phase 3, 4, 5: Historical Analytics Endpoints
# ---------------------------------------------------------------------------

PRICE_TREND_THRESHOLD_PERCENT = 2.0
MIN_ARRIVAL_BASELINE_COUNT = 7
ARRIVAL_HIGH_THRESHOLD_RATIO = 1.25
ARRIVAL_LOW_THRESHOLD_RATIO = 0.75


def _classify_price_trend(pct_change: float | None, obs_count: int) -> str:
    if obs_count < 2 or pct_change is None:
        return "INSUFFICIENT_DATA"
    if pct_change > PRICE_TREND_THRESHOLD_PERCENT:
        return "RISING"
    if pct_change < -PRICE_TREND_THRESHOLD_PERCENT:
        return "FALLING"
    return "STABLE"


def _build_price_trend_for_market(
    db: Session,
    district_name: str,
    crop_name: str,
    market_name: str,
    days: int,
    variety: str | None = None,
    include_demo: bool = False,
) -> dict:
    canonical_district = district_name
    dist_info = find_district_by_name_or_alias(district_name)
    if dist_info:
        canonical_district = dist_info["name"]

    canonical_crop = crop_name
    crop_patterns = [crop_name]
    crop_info = find_crop_by_name_or_alias(crop_name)
    if crop_info:
        canonical_crop = crop_info["name"]
        crop_patterns = [canonical_crop, crop_info.get("agmarknet_name", canonical_crop)]

    query = (
        select(PriceObservation)
        .join(PriceObservation.market)
        .options(joinedload(PriceObservation.market))
        .where(Market.name == market_name)
        .where(Market.is_active.is_(True))
    )
    if not include_demo:
        query = query.where(PriceObservation.is_sample.is_(False), PriceObservation.data_type != "demo")

    crop_filters = [PriceObservation.commodity.ilike(f"%{pat}%") for pat in crop_patterns]
    query = query.where(or_(*crop_filters))

    if isinstance(variety, str) and variety.strip():
        query = query.where(PriceObservation.variety.ilike(f"%{variety.strip()}%"))

    today = datetime.now(timezone.utc).date()
    query = query.where(PriceObservation.observation_date.is_not(None))
    query = query.where(PriceObservation.observation_date <= today)

    # Fetch ordered by observation_date desc, deduplicate per date
    raw_observations = db.scalars(
        query.order_by(PriceObservation.observation_date.desc(), PriceObservation.id.desc())
    ).all()

    # Deduplicate: take latest record per distinct reporting date
    seen_dates = set()
    deduped_observations = []
    for obs in raw_observations:
        d = obs.observation_date
        if d and d not in seen_dates:
            # Check price validity (greater than zero)
            val_price = obs.modal_price or obs.price
            if val_price and val_price > 0:
                seen_dates.add(d)
                deduped_observations.append(obs)
                if len(deduped_observations) >= days:
                    break

    # Sort chronological (oldest to newest) for trends and charts
    chronological = sorted(deduped_observations, key=lambda x: x.observation_date)
    count = len(chronological)

    if count == 0:
        return {
            "district": canonical_district,
            "crop": canonical_crop,
            "market": market_name,
            "variety": variety,
            "period_days": days,
            "available_reporting_days": 0,
            "unit": None,
            "trend": "INSUFFICIENT_DATA",
            "first_price": None,
            "latest_price": None,
            "absolute_change": None,
            "percentage_change": None,
            "min_price": None,
            "max_price": None,
            "average_price": None,
            "first_reporting_date": None,
            "latest_reporting_date": None,
            "source": None,
            "observations": [],
            "message": "No historical price observations available for the selected parameters.",
        }

    units = {obs.unit for obs in chronological if obs.unit}
    unit_str = next(iter(units)) if len(units) == 1 else "MIXED"

    price_series = [float(obs.modal_price or obs.price) for obs in chronological]
    first_price = price_series[0]
    latest_price = price_series[-1]
    first_date = chronological[0].observation_date.isoformat()
    latest_date = chronological[-1].observation_date.isoformat()
    source_str = chronological[-1].source_name or chronological[-1].source or "AGMARKNET"

    if first_price > 0:
        abs_change = round_money(latest_price - first_price)
        pct_change = round(((latest_price - first_price) / first_price) * 100, 2)
    else:
        abs_change = None
        pct_change = None

    trend_classification = _classify_price_trend(pct_change, count)

    min_p = round_money(min(price_series))
    max_p = round_money(max(price_series))
    avg_p = round_money(sum(price_series) / len(price_series))

    obs_payload = []
    for obs in chronological:
        obs_payload.append({
            "reporting_date": obs.observation_date.isoformat(),
            "modal_price": float(obs.modal_price or obs.price),
            "min_price": float(obs.min_price) if obs.min_price is not None else None,
            "max_price": float(obs.max_price) if obs.max_price is not None else None,
            "source": obs.source_name or obs.source,
            "unit": obs.unit,
            "freshness": observation_freshness(obs.observation_date),
            "data_type": obs.data_type,
        })

    msg = (
        f"{count} of {days} available reporting days found."
        if count < days
        else f"{count} valid reporting-day observations found."
    )

    return {
        "district": canonical_district,
        "crop": canonical_crop,
        "market": market_name,
        "variety": variety,
        "period_days": days,
        "available_reporting_days": count,
        "unit": unit_str,
        "trend": trend_classification,
        "first_price": first_price,
        "latest_price": latest_price,
        "absolute_change": abs_change,
        "percentage_change": pct_change,
        "min_price": min_p,
        "max_price": max_p,
        "average_price": avg_p,
        "first_reporting_date": first_date,
        "latest_reporting_date": latest_date,
        "source": source_str,
        "observations": obs_payload,
        "message": msg,
    }


@app.get("/api/analytics/price-trend")
def get_price_trend(
    district: str = Query(default="Davanagere"),
    crop: str = Query(default="Maize"),
    market: str = Query(..., description="APMC Market Name"),
    variety: str | None = Query(default=None),
    days: int = Query(default=7, ge=2, le=90),
    include_demo: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        return _build_price_trend_for_market(
            db=db,
            district_name=district,
            crop_name=crop,
            market_name=market,
            days=days,
            variety=variety,
            include_demo=include_demo,
        )
    except Exception as exc:
        logger.exception("Error in price trend calculation: %s", exc)
        raise HTTPException(status_code=500, detail="Could not retrieve historical price trend.")


@app.get("/api/analytics/market-comparison")
def compare_markets_price_trend(
    district: str = Query(default="Davanagere"),
    crop: str = Query(default="Maize"),
    markets: str = Query(..., description="Comma-separated APMC market names"),
    variety: str | None = Query(default=None),
    days: int = Query(default=30, ge=2, le=90),
    include_demo: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    market_list = [m.strip() for m in markets.split(",") if m.strip()]
    if not market_list:
        raise HTTPException(status_code=422, detail="At least one market name must be specified.")

    results = []
    units_seen = set()
    for m_name in market_list:
        res = _build_price_trend_for_market(
            db=db,
            district_name=district,
            crop_name=crop,
            market_name=m_name,
            days=days,
            variety=variety,
            include_demo=include_demo,
        )
        if res.get("unit") and res["unit"] != "MIXED":
            units_seen.add(res["unit"])
        results.append(res)

    comparable = len(units_seen) <= 1
    incomparable_reason = None
    if not comparable:
        incomparable_reason = f"Markets have different price units: {', '.join(sorted(units_seen))}. Comparison cannot be reliably drawn without conversion."

    return {
        "district": district,
        "crop": crop,
        "period_days": days,
        "markets": results,
        "is_comparable": comparable,
        "incomparable_reason": incomparable_reason,
    }


@app.get("/api/analytics/arrivals")
def get_market_arrivals(
    district: str = Query(default="Davanagere"),
    crop: str = Query(default="Maize"),
    market: str = Query(..., description="APMC Market Name"),
    variety: str | None = Query(default=None),
    include_demo: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    canonical_district = district
    dist_info = find_district_by_name_or_alias(district)
    if dist_info:
        canonical_district = dist_info["name"]

    canonical_crop = crop
    crop_patterns = [crop]
    crop_info = find_crop_by_name_or_alias(crop)
    if crop_info:
        canonical_crop = crop_info["name"]
        crop_patterns = [canonical_crop, crop_info.get("agmarknet_name", canonical_crop)]

    query = (
        select(PriceObservation)
        .join(PriceObservation.market)
        .options(joinedload(PriceObservation.market))
        .where(Market.name == market)
        .where(Market.is_active.is_(True))
    )
    if not include_demo:
        query = query.where(PriceObservation.is_sample.is_(False), PriceObservation.data_type != "demo")

    crop_filters = [PriceObservation.commodity.ilike(f"%{pat}%") for pat in crop_patterns]
    query = query.where(or_(*crop_filters))

    if isinstance(variety, str) and variety.strip():
        query = query.where(PriceObservation.variety.ilike(f"%{variety.strip()}%"))

    today = datetime.now(timezone.utc).date()
    query = query.where(PriceObservation.observation_date.is_not(None))
    query = query.where(PriceObservation.observation_date <= today)

    # Filter observations where arrival_quantity is recorded
    query = query.where(PriceObservation.arrival_quantity.is_not(None))
    query = query.where(PriceObservation.arrival_quantity >= 0)

    raw_observations = db.scalars(
        query.order_by(PriceObservation.observation_date.desc(), PriceObservation.id.desc())
    ).all()

    # Deduplicate per observation_date
    seen_dates = set()
    deduped = []
    for obs in raw_observations:
        d = obs.observation_date
        if d and d not in seen_dates:
            seen_dates.add(d)
            deduped.append(obs)

    if not deduped:
        return {
            "available": False,
            "district": canonical_district,
            "crop": canonical_crop,
            "market": market,
            "variety": variety,
            "arrival_quantity": None,
            "arrival_unit": None,
            "reporting_date": None,
            "source": None,
            "freshness": None,
            "previous_arrival_quantity": None,
            "previous_reporting_date": None,
            "arrival_change": None,
            "arrival_percentage_change": None,
            "historical_baseline": {
                "available": False,
                "median_quantity": None,
                "classification": "INSUFFICIENT_HISTORY",
                "sample_count": 0,
            },
            "message": "Arrival data unavailable for this market and crop.",
        }

    latest_obs = deduped[0]
    latest_qty = float(latest_obs.arrival_quantity)
    latest_unit = latest_obs.arrival_unit or "tonnes"
    latest_date_str = latest_obs.observation_date.isoformat()
    source_str = latest_obs.source_name or latest_obs.source or "AGMARKNET"
    freshness_str = observation_freshness(latest_obs.observation_date)

    # Previous reporting day comparison
    prev_qty = None
    prev_date_str = None
    change_qty = None
    pct_change = None

    if len(deduped) >= 2:
        prev_obs = deduped[1]
        # Only compare if units are compatible
        if (prev_obs.arrival_unit or "tonnes").casefold() == latest_unit.casefold():
            prev_qty = float(prev_obs.arrival_quantity)
            prev_date_str = prev_obs.observation_date.isoformat()
            change_qty = round(latest_qty - prev_qty, 2)
            if prev_qty > 0:
                pct_change = round(((latest_qty - prev_qty) / prev_qty) * 100, 2)
            elif latest_qty == 0:
                pct_change = 0.0

    # Historical Baseline (excluding current observation)
    history_obs = [obs for obs in deduped[1:] if (obs.arrival_unit or "tonnes").casefold() == latest_unit.casefold()]
    history_count = len(history_obs)
    baseline_available = history_count >= MIN_ARRIVAL_BASELINE_COUNT
    median_val = None
    classification = "INSUFFICIENT_HISTORY"

    if baseline_available:
        history_vals = [float(obs.arrival_quantity) for obs in history_obs]
        median_val = round(statistics.median(history_vals), 2)
        if median_val > 0:
            if latest_qty > (median_val * ARRIVAL_HIGH_THRESHOLD_RATIO):
                classification = "HIGH"
            elif latest_qty < (median_val * ARRIVAL_LOW_THRESHOLD_RATIO):
                classification = "LOW"
            else:
                classification = "NORMAL"

    return {
        "available": True,
        "district": canonical_district,
        "crop": canonical_crop,
        "market": market,
        "variety": variety,
        "arrival_quantity": latest_qty,
        "arrival_unit": latest_unit,
        "reporting_date": latest_date_str,
        "source": source_str,
        "freshness": freshness_str,
        "previous_arrival_quantity": prev_qty,
        "previous_reporting_date": prev_date_str,
        "arrival_change": change_qty,
        "arrival_percentage_change": pct_change,
        "historical_baseline": {
            "available": baseline_available,
            "median_quantity": median_val,
            "classification": classification,
            "sample_count": history_count,
        },
        "interpretation": "Market arrivals can influence supply and prices, but higher arrivals do not guarantee a price decrease, and lower arrivals do not guarantee a price increase.",
        "message": f"Verified arrival observation found for {latest_date_str}.",
    }


@app.post("/api/calculate")
def calculate(inputs: CalculateRequest):
    breakdown = calculate_breakdown(inputs)
    # Keep the original root-level fields for the existing Phase 1 frontend.
    return {
        "net_proceeds": breakdown["net_proceeds"],
        "gross": breakdown["gross"],
        "breakdown": breakdown,
    }


def comparison_result_payload(request: ComparisonRequest, option: dict, selling_option_id: int | None = None) -> dict:
    shared = request.calculation_inputs
    physical_loss_fraction = request.physical_loss_percent / 100
    effective_price = max(0, option["price"] - shared["d"])
    saleable_quantity = request.quantity * (1 - physical_loss_fraction)
    total_costs = option["transport_cost"] + shared["ch"] + shared["cp"] + shared["cm"] + shared["co"]
    net = calculate_net_proceeds(
        request.quantity,
        option["price"],
        physical_loss_fraction,
        shared["d"],
        option["transport_cost"],
        shared["ch"],
        shared["cp"],
        shared["cm"],
        shared["co"],
    )
    return {
        "client_id": option.get("client_id"),
        "selling_option_id": selling_option_id,
        "name": option["name"],
        "price": option["price"],
        "price_unit": option["price_unit"],
        "price_date": option["price_date"].isoformat() if option.get("price_date") else None,
        "source": option.get("source"),
        "distance_km": option.get("distance_km"),
        "transport_cost": option["transport_cost"],
        "transport_status": option["transport_status"],
        "confirmation_status": option["confirmation_status"],
        "quality_requirements": option.get("quality_requirements"),
        "quality_comparable": option.get("quality_comparable", False),
        "payment_terms": option.get("payment_terms"),
        "saleable_quantity": saleable_quantity,
        "gross": round_money(request.quantity * option["price"]),
        "quality_deduction": round_money(saleable_quantity * (option["price"] - effective_price)),
        "total_costs": total_costs,
        "net_proceeds": round_money(net),
    }


def evaluate_comparison(request: ComparisonRequest, results: list[dict]) -> tuple[str, int | None, dict]:
    missing: list[str] = []
    expected_price_unit = f"INR/{request.quantity_unit}"
    for result in results:
        if result["price_unit"] != expected_price_unit:
            missing.append(f"{result['name']}: price unit is not comparable ({expected_price_unit} required)")
        if result["price_date"] is None:
            missing.append(f"{result['name']}: missing price date")
        else:
            price_date = date.fromisoformat(result["price_date"])
            age_days = (date.today() - price_date).days
            if age_days < 0 or age_days > PRICE_FRESHNESS_DAYS:
                missing.append(f"{result['name']}: price date is outside the {PRICE_FRESHNESS_DAYS}-day freshness window")
        if not result["source"]:
            missing.append(f"{result['name']}: missing price source")
        if result["distance_km"] is None:
            missing.append(f"{result['name']}: missing distance")
        if not result["quality_requirements"] or not result.get("quality_comparable"):
            missing.append(f"{result['name']}: quality requirements/comparability are incomplete")
        if not result["payment_terms"]:
            missing.append(f"{result['name']}: missing payment terms")
        if result["transport_status"] == "expired":
            missing.append(f"{result['name']}: transport quote is expired")

    snapshot = {
        "items": results,
        "missing_information": missing,
        "freshness_days": PRICE_FRESHNESS_DAYS,
        "close_threshold_percent": CLOSE_THRESHOLD_PERCENT,
        "sample_notice": None,
    }
    if missing:
        return "incomplete", None, snapshot

    ranked = sorted(results, key=lambda item: item["net_proceeds"], reverse=True)
    if all(item["net_proceeds"] < 0 for item in ranked):
        return "all_negative", None, snapshot

    best, second = ranked[0], ranked[1]
    difference = best["net_proceeds"] - second["net_proceeds"]
    difference_percent = difference / best["net_proceeds"] * 100 if best["net_proceeds"] > 0 else None
    snapshot["difference"] = round_money(difference)
    snapshot["difference_percent"] = difference_percent
    if best["net_proceeds"] <= 0 or difference_percent <= CLOSE_THRESHOLD_PERCENT:
        return "no_clear_advantage", None, snapshot
    return "winner", best["selling_option_id"], snapshot


@app.post("/api/comparisons", status_code=status.HTTP_201_CREATED)
def create_comparison(request: ComparisonRequest, db: Session = Depends(get_db)):
    for option in request.options:
        if option.market_id is not None and db.get(Market, option.market_id) is None:
            raise HTTPException(status_code=422, detail=f"Unknown market_id for option {option.name}.")

    created_options = []
    for option in request.options:
        selling_option = SellingOption(
            name=option.name,
            market_id=option.market_id,
            buyer_name=option.buyer_name,
            distance_km=option.distance_km,
            transport_cost=option.transport_cost,
            payment_terms=option.payment_terms,
            confirmation_status=option.confirmation_status,
        )
        selling_option.transport_quotes.append(TransportQuote(
            distance_km=option.distance_km,
            estimated_cost=option.transport_cost,
            source=option.transport_source,
            status=option.transport_status,
            quote_date=datetime.now(timezone.utc),
        ))
        selling_option.buyer_requirements.append(BuyerRequirement(
            commodity=request.commodity,
            minimum_quantity=None,
            quantity_unit=request.quantity_unit,
            quality_requirements=option.quality_requirements,
            packaging_requirements=option.packaging_requirements,
            payment_terms=option.payment_terms,
        ))
        db.add(selling_option)
        created_options.append(selling_option)
    db.flush()

    results = [
        comparison_result_payload(
            request,
            option.model_dump(),
            selling_option_id=selling_option.id,
        )
        for option, selling_option in zip(request.options, created_options)
    ]
    comparison_status, winner_id, results_snapshot = evaluate_comparison(request, results)
    comparison = Comparison(
        commodity=request.commodity,
        quantity=request.quantity,
        quantity_unit=request.quantity_unit,
        physical_loss_percent=request.physical_loss_percent,
        calculation_inputs={
            **request.calculation_inputs,
            "options": [option.model_dump(mode="json") for option in request.options],
        },
        results={**results_snapshot, "status": comparison_status},
        winner_selling_option_id=winner_id,
        status=comparison_status,
    )
    db.add(comparison)
    db.commit()
    db.refresh(comparison)
    return comparison_dict(comparison)


@app.get("/api/comparisons")
def list_comparisons(limit: int = Query(default=50, ge=1, le=100), db: Session = Depends(get_db)):
    comparisons = db.scalars(select(Comparison).order_by(Comparison.created_at.desc(), Comparison.id.desc()).limit(limit)).all()
    return {"items": [comparison_dict(item) for item in comparisons], "count": len(comparisons)}


@app.get("/api/comparisons/{comparison_id}")
def get_comparison(comparison_id: int, db: Session = Depends(get_db)):
    comparison = db.get(Comparison, comparison_id)
    if comparison is None:
        raise HTTPException(status_code=404, detail="Comparison not found.")
    return comparison_dict(comparison)


@app.get("/api/sync")
def sync_status():
    status_data = dict(SYNC_STATUS)
    status_data["agmarknet"] = LAST_SYNC_STATUS
    if LAST_SYNC_STATUS.get("success"):
        status_data["status"] = "synced"
        status_data["available"] = True
        status_data["configured"] = True
        status_data["last_successful_sync_at"] = LAST_SYNC_STATUS.get("last_synced_at")
        status_data["message"] = f"AGMARKNET 2.0 active. {LAST_SYNC_STATUS.get('records_synced', 0)} records synchronized."
    return status_data


@app.get("/api/sync/status")
def agmarknet_sync_status():
    return LAST_SYNC_STATUS


@app.post("/api/market-prices/sync")
@app.post("/api/sync/agmarknet")
def trigger_agmarknet_sync(
    district: str = Query(default="Davanagere"),
    commodity: str = Query(default="Maize"),
    db: Session = Depends(get_db),
):
    result = sync_agmarknet_prices(db, district_name=district, crop_name=commodity)
    return result

from __future__ import annotations

from datetime import date, datetime, timezone
import json
import logging
from pathlib import Path
import ssl
from typing import Any
import urllib.error
import urllib.request

from sqlalchemy import select
from sqlalchemy.orm import Session

from karnataka_metadata import (
    KARNATAKA_CROPS,
    KARNATAKA_DISTRICTS,
    KARNATAKA_STATE_ID,
    find_crop_by_name_or_alias,
    find_district_by_name_or_alias,
)
from models import Market, PriceObservation

logger = logging.getLogger("agmarknet_sync")

AGMARKNET_BASE_URL = "https://api.agmarknet.gov.in/v1"
AGMARKNET_PORTAL_URL = "https://agmarknet.gov.in/"
HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://agmarknet.gov.in",
    "Referer": "https://agmarknet.gov.in/",
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}

MANDIS_CACHE_FILE = Path(__file__).parent / "karnataka_mandis.json"

# In-memory record of the last sync execution
LAST_SYNC_STATUS: dict[str, Any] = {
    "last_synced_at": None,
    "success": False,
    "records_synced": 0,
    "latest_observation_date": None,
    "district": "Davanagere",
    "commodity": "Maize",
    "error": None,
}


def _http_get(url: str, timeout: int = 15) -> dict[str, Any]:
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def load_verified_mandis_data() -> list[dict[str, Any]]:
    """Loads verified Karnataka APMC markets from local cache or live API."""
    if MANDIS_CACHE_FILE.exists():
        try:
            with open(MANDIS_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("markets", [])
        except Exception as exc:
            logger.warning("Could not read local mandis cache: %s", exc)

    try:
        url = f"{AGMARKNET_BASE_URL}/daily-price-arrival/filters"
        payload = _http_get(url, timeout=15)
        raw_data = payload.get("data", {})
        k_districts = {
            d["id"]: d["district_name"]
            for d in raw_data.get("district_data", [])
            if d.get("state_id") == KARNATAKA_STATE_ID
        }
        markets = [
            {
                "id": m["id"],
                "name": m["mkt_name"],
                "district_id": m["district_id"],
                "district_name": k_districts.get(m["district_id"], "Unknown"),
            }
            for m in raw_data.get("market_data", [])
            if m.get("state_id") == KARNATAKA_STATE_ID
        ]
        return markets
    except Exception as exc:
        logger.warning("Failed to fetch fresh filters from AGMARKNET: %s", exc)
        return []


def ensure_district_markets(db: Session, district_name: str | None = None) -> list[Market]:
    """
    Ensures that verified APMC mandis for the requested district (or all districts if None)
    are present in the database with their verified canonical district.
    """
    all_mandis = load_verified_mandis_data()
    now_utc = datetime.now(timezone.utc)
    target_district_meta = find_district_by_name_or_alias(district_name) if district_name else None

    matching_mandis = []
    for m in all_mandis:
        m_dist = find_district_by_name_or_alias(m.get("district_name"))
        if not m_dist:
            continue
        if target_district_meta and m_dist["name"] != target_district_meta["name"]:
            continue
        matching_mandis.append((m["id"], m["name"], m_dist["name"]))

    created_or_updated = []
    for mkt_id, mkt_name, canonical_dist in matching_mandis:
        market_record = db.scalar(select(Market).where(Market.name == mkt_name))
        if market_record is None:
            market_record = Market(
                name=mkt_name,
                location=f"{canonical_dist}, Karnataka",
                district=canonical_dist,
                state="Karnataka",
                is_active=True,
                is_sample=False,
                created_at=now_utc,
            )
            db.add(market_record)
            created_or_updated.append(market_record)
        else:
            if market_record.district != canonical_dist or market_record.state != "Karnataka":
                market_record.district = canonical_dist
                market_record.state = "Karnataka"
            created_or_updated.append(market_record)

    db.commit()
    return created_or_updated


def sync_agmarknet_prices(
    db: Session,
    district_name: str = "Davanagere",
    crop_name: str = "Maize",
) -> dict[str, Any]:
    """
    Fetches real-time market prices from AGMARKNET 2.0 for the requested district and crop,
    upserts markets and observations into SQLite, and returns execution summary.
    Never fabricates dummy prices if data is missing or unavailable.
    """
    now_utc = datetime.now(timezone.utc)
    district_meta = find_district_by_name_or_alias(district_name) or KARNATAKA_DISTRICTS[12]  # Default Davanagere
    crop_meta = find_crop_by_name_or_alias(crop_name) or KARNATAKA_CROPS[0]  # Default Maize

    canonical_district = district_meta["name"]
    canonical_crop = crop_meta["name"]
    cmdt_id = crop_meta["id"]

    # Pre-populate / ensure verified mandis exist for this district
    ensure_district_markets(db, canonical_district)

    # Find markets belonging to this district
    district_mandis = [
        m for m in load_verified_mandis_data()
        if find_district_by_name_or_alias(m.get("district_name", ""))
        and find_district_by_name_or_alias(m["district_name"])["name"] == canonical_district
    ]

    records_added = 0
    records_updated = 0
    latest_date: date | None = None
    fetch_errors: list[str] = []

    for m in district_mandis:
        market_id = m["id"]
        market_name = m["name"]
        url = (
            f"{AGMARKNET_BASE_URL}/prices-and-arrivals/commodity-price/lastweek"
            f"?marketId={market_id}&stateId={KARNATAKA_STATE_ID}&commodityId={cmdt_id}&includeExcel=false"
        )
        try:
            res = _http_get(url, timeout=12)
        except Exception as exc:
            fetch_errors.append(f"{market_name}: {exc}")
            continue

        raw_data = res.get("data", [])
        if not raw_data:
            continue

        market_record = db.scalar(select(Market).where(Market.name == market_name))
        if market_record is None:
            market_record = Market(
                name=market_name,
                location=f"{canonical_district}, Karnataka",
                district=canonical_district,
                state="Karnataka",
                is_active=True,
                is_sample=False,
                created_at=now_utc,
            )
            db.add(market_record)
            db.flush()

        for row in raw_data:
            variety = row.get("variety")
            if variety and " - " in variety:
                variety_name = variety.split(" - ", 1)[1]
            else:
                variety_name = variety or "Common"

            unit = row.get("unitOfPrice", "Rs./Quintal")
            db_unit = "INR/quintal"
            if "tonne" in unit.lower() or "ton" in unit.lower():
                db_unit = "INR/tonne"
            elif "kg" in unit.lower():
                db_unit = "INR/kg"

            # Parse date columns
            for col_key, col_val in row.items():
                if col_key in ("variety", "unitOfPrice"):
                    continue
                try:
                    obs_date = date.fromisoformat(col_key)
                except ValueError:
                    continue

                if not isinstance(col_val, (int, float)) or col_val <= 0:
                    continue

                price_float = float(col_val)

                if latest_date is None or obs_date > latest_date:
                    latest_date = obs_date

                # Deduplicate: check if this observation already exists
                existing_obs = db.scalar(
                    select(PriceObservation).where(
                        PriceObservation.market_id == market_record.id,
                        PriceObservation.commodity == canonical_crop,
                        PriceObservation.observation_date == obs_date,
                        PriceObservation.variety == variety_name,
                    )
                )

                pricing_source_name = "AGMARKNET 2.0"
                if crop_meta.get("is_sugarcane"):
                    pricing_source_name = "AGMARKNET 2.0 (APMC Cane Rate)"

                if existing_obs:
                    existing_obs.price = price_float
                    existing_obs.modal_price = price_float
                    existing_obs.min_price = price_float
                    existing_obs.max_price = price_float
                    existing_obs.unit = db_unit
                    existing_obs.retrieved_at = now_utc
                    existing_obs.data_type = "official"
                    existing_obs.verification_status = "verified"
                    existing_obs.source_name = pricing_source_name
                    existing_obs.source_url = AGMARKNET_PORTAL_URL
                    existing_obs.is_sample = False
                    records_updated += 1
                else:
                    new_obs = PriceObservation(
                        market_id=market_record.id,
                        commodity=canonical_crop,
                        variety=variety_name,
                        price=price_float,
                        modal_price=price_float,
                        min_price=price_float,
                        max_price=price_float,
                        unit=db_unit,
                        observation_date=obs_date,
                        retrieved_at=now_utc,
                        source_name=pricing_source_name,
                        source_url=AGMARKNET_PORTAL_URL,
                        data_type="official",
                        verification_status="verified",
                        source="AGMARKNET 2.0 official portal",
                        is_sample=False,
                        created_at=now_utc,
                    )
                    db.add(new_obs)
                    records_added += 1

    db.commit()

    total_synced = records_added + records_updated
    LAST_SYNC_STATUS.update(
        {
            "last_synced_at": now_utc.isoformat(),
            "success": True,
            "records_synced": total_synced,
            "latest_observation_date": latest_date.isoformat() if latest_date else None,
            "district": canonical_district,
            "commodity": canonical_crop,
            "error": "; ".join(fetch_errors) if fetch_errors else None,
        }
    )

    logger.info(
        "AGMARKNET sync completed for %s / %s: %d records (%d added, %d updated). Latest date: %s",
        canonical_district,
        canonical_crop,
        total_synced,
        records_added,
        records_updated,
        latest_date,
    )

    return {
        "success": True,
        "records_synced": total_synced,
        "records_added": records_added,
        "records_updated": records_updated,
        "district": canonical_district,
        "commodity": canonical_crop,
        "latest_observation_date": latest_date.isoformat() if latest_date else None,
        "errors": fetch_errors if fetch_errors else None,
    }

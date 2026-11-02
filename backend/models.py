from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Market(Base):
    __tablename__ = "markets"
    __table_args__ = (Index("ix_markets_district_state", "district", "state"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    location: Mapped[str] = mapped_column(String(240), nullable=False)
    district: Mapped[str | None] = mapped_column(String(120))
    state: Mapped[str | None] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    observations: Mapped[list["PriceObservation"]] = relationship(back_populates="market")
    selling_options: Mapped[list["SellingOption"]] = relationship(back_populates="market")


class PriceObservation(Base):
    __tablename__ = "price_observations"
    __table_args__ = (
        Index("ix_price_observations_market_date", "market_id", "observation_date"),
        Index("ix_price_observations_commodity_date", "commodity", "observation_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    market_id: Mapped[int] = mapped_column(ForeignKey("markets.id"), nullable=False)
    commodity: Mapped[str] = mapped_column(String(120), nullable=False)
    variety: Mapped[str | None] = mapped_column(String(120))
    price: Mapped[float] = mapped_column(Float, nullable=False)
    modal_price: Mapped[float | None] = mapped_column(Float)
    min_price: Mapped[float | None] = mapped_column(Float)
    max_price: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str] = mapped_column(String(80), nullable=False)
    arrival_quantity: Mapped[float | None] = mapped_column(Float, nullable=True)
    arrival_unit: Mapped[str | None] = mapped_column(String(80), nullable=True)
    observation_date: Mapped[date | None] = mapped_column(Date)
    retrieved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source_name: Mapped[str | None] = mapped_column(String(240))
    source_url: Mapped[str | None] = mapped_column(String(1000))
    data_type: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)
    verification_status: Mapped[str] = mapped_column(String(24), default="unverified", nullable=False)
    source: Mapped[str | None] = mapped_column(String(240))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), onupdate=utc_now)

    market: Mapped[Market] = relationship(back_populates="observations")


class SellingOption(Base):
    __tablename__ = "selling_options"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    market_id: Mapped[int | None] = mapped_column(ForeignKey("markets.id"))
    buyer_name: Mapped[str | None] = mapped_column(String(160))
    distance_km: Mapped[float | None] = mapped_column(Float)
    transport_cost: Mapped[float | None] = mapped_column(Float)
    payment_terms: Mapped[str | None] = mapped_column(Text)
    confirmation_status: Mapped[str] = mapped_column(String(24), default="unconfirmed", nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    market: Mapped[Market | None] = relationship(back_populates="selling_options")
    transport_quotes: Mapped[list["TransportQuote"]] = relationship(back_populates="selling_option", cascade="all, delete-orphan")
    buyer_requirements: Mapped[list["BuyerRequirement"]] = relationship(back_populates="selling_option", cascade="all, delete-orphan")


class TransportQuote(Base):
    __tablename__ = "transport_quotes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    selling_option_id: Mapped[int] = mapped_column(ForeignKey("selling_options.id"), nullable=False)
    provider: Mapped[str | None] = mapped_column(String(160))
    distance_km: Mapped[float | None] = mapped_column(Float)
    estimated_cost: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    quote_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    source: Mapped[str] = mapped_column(String(240), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="estimated", nullable=False)

    selling_option: Mapped[SellingOption] = relationship(back_populates="transport_quotes")


class BuyerRequirement(Base):
    __tablename__ = "buyer_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    selling_option_id: Mapped[int] = mapped_column(ForeignKey("selling_options.id"), nullable=False)
    commodity: Mapped[str] = mapped_column(String(120), nullable=False)
    minimum_quantity: Mapped[float | None] = mapped_column(Float)
    quantity_unit: Mapped[str | None] = mapped_column(String(40))
    quality_requirements: Mapped[str | None] = mapped_column(Text)
    packaging_requirements: Mapped[str | None] = mapped_column(Text)
    payment_terms: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    selling_option: Mapped[SellingOption] = relationship(back_populates="buyer_requirements")


class Comparison(Base):
    __tablename__ = "comparisons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    commodity: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    quantity_unit: Mapped[str] = mapped_column(String(40), nullable=False)
    physical_loss_percent: Mapped[float] = mapped_column(Float, nullable=False)
    calculation_inputs: Mapped[dict] = mapped_column(JSON, nullable=False)
    results: Mapped[dict] = mapped_column(JSON, nullable=False)
    winner_selling_option_id: Mapped[int | None] = mapped_column(ForeignKey("selling_options.id"))
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    winner: Mapped[SellingOption | None] = relationship(foreign_keys=[winner_selling_option_id])


class SaleOutcome(Base):
    __tablename__ = "sale_outcomes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comparison_id: Mapped[int | None] = mapped_column(ForeignKey("comparisons.id"))
    selling_option_id: Mapped[int | None] = mapped_column(ForeignKey("selling_options.id"))
    commodity: Mapped[str] = mapped_column(String(120), nullable=False)
    quantity_sold: Mapped[float | None] = mapped_column(Float)
    actual_sale_price: Mapped[float | None] = mapped_column(Float)
    actual_transport_cost: Mapped[float | None] = mapped_column(Float)
    other_actual_costs: Mapped[float | None] = mapped_column(Float)
    actual_net_proceeds: Mapped[float | None] = mapped_column(Float)
    sale_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    mobile_number: Mapped[str | None] = mapped_column(String(15), unique=True, index=True, nullable=True)
    email: Mapped[str | None] = mapped_column(String(120), unique=True, index=True, nullable=True)
    district: Mapped[str | None] = mapped_column(String(80), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="kn", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="farmer", nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_token: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User] = relationship()

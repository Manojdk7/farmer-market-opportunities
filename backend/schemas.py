from datetime import date, datetime, timezone
from typing import Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator, model_validator


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class CalculateRequest(APIModel):
    q: float = Field(gt=0)
    p: float = Field(gt=0)
    l: float = Field(ge=0, le=1, description="Physical loss fraction; 0.05 means 5%.")
    d: float = Field(ge=0, default=0)
    ct: float = Field(ge=0, default=0)
    ch: float = Field(ge=0, default=0)
    cp: float = Field(ge=0, default=0)
    cm: float = Field(ge=0, default=0)
    co: float = Field(ge=0, default=0)
    quantity_unit: str = Field(default="kg", min_length=1, max_length=40)
    price_unit: str = Field(default="INR/kg", min_length=1, max_length=40)


class CalculationBreakdown(BaseModel):
    quantity: float
    quantity_unit: str
    physical_loss_percent: float
    saleable_quantity: float
    gross: float
    quality_deduction: float
    adjusted_sale_value: float
    packaging_cost: float
    transport_cost: float
    handling_cost: float
    commission_cost: float
    other_costs: float
    total_costs: float
    net_proceeds: float
    price_unit: str


class MarketResponse(BaseModel):
    id: int
    name: str
    location: str
    district: str | None
    state: str | None
    is_active: bool
    is_sample: bool

    model_config = ConfigDict(from_attributes=True)


class PriceObservationResponse(BaseModel):
    id: int
    market_id: int
    market_name: str
    market_location: str
    commodity: str
    variety: str | None
    price: float
    modal_price: float | None = None
    min_price: float | None = None
    max_price: float | None = None
    unit: str
    observation_date: date | None
    retrieved_at: str | None
    source_name: str | None
    source_url: str | None
    data_type: Literal["official", "manual", "demo"]
    verification_status: Literal["verified", "unverified", "not_applicable"]
    freshness: Literal["recent", "stale", "unknown"]
    ranking_eligible: bool
    eligibility_reasons: list[str]
    source: str | None
    is_sample: bool


class PriceObservationCreate(APIModel):
    market_id: int = Field(gt=0)
    commodity: str = Field(min_length=1, max_length=120)
    variety: str | None = Field(default=None, max_length=120)
    price: float = Field(gt=0)
    unit: Literal["INR/kg", "INR/quintal", "INR/tonne"]
    observation_date: date | None = None
    source_name: str | None = Field(default=None, max_length=240)
    source_url: AnyHttpUrl | None = None
    arrival_quantity: float | None = Field(default=None, ge=0)
    arrival_unit: str | None = Field(default=None, max_length=80)

    @field_validator("commodity", "unit", "variety", "source_name", mode="before")
    @classmethod
    def trim_text_fields(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("variety", "source_name")
    @classmethod
    def empty_optional_text_is_missing(cls, value):
        return value or None

    @field_validator("observation_date")
    @classmethod
    def reject_future_observation_date(cls, value):
        if value is not None and value > datetime.now(timezone.utc).date():
            raise ValueError("observation_date cannot be in the future.")
        return value


class ComparisonOptionInput(APIModel):
    client_id: str | None = None
    name: str = Field(min_length=1, max_length=160)
    market_id: int | None = None
    buyer_name: str | None = Field(default=None, max_length=160)
    price: float = Field(gt=0)
    price_unit: str = Field(min_length=1, max_length=40)
    price_date: date | None = None
    source: str | None = Field(default=None, max_length=240)
    distance_km: float | None = Field(default=None, ge=0)
    transport_cost: float = Field(ge=0)
    transport_source: str = Field(min_length=1, max_length=240)
    transport_status: Literal["estimated", "confirmed", "expired"] = "estimated"
    quality_requirements: str | None = None
    quality_comparable: bool = False
    packaging_requirements: str | None = None
    payment_terms: str | None = None
    confirmation_status: Literal["unconfirmed", "contacted", "confirmed", "unavailable"] = "unconfirmed"


class ComparisonRequest(APIModel):
    commodity: str = Field(min_length=1, max_length=120)
    quantity: float = Field(gt=0)
    quantity_unit: str = Field(default="kg", min_length=1, max_length=40)
    physical_loss_percent: float = Field(ge=0, le=100)
    calculation_inputs: dict[str, float] = Field(description="Shared d, ch, cp, cm, co costs.")
    options: list[ComparisonOptionInput] = Field(min_length=2, max_length=3)

    @model_validator(mode="after")
    def validate_shared_inputs(self):
        required = {"d", "ch", "cp", "cm", "co"}
        if set(self.calculation_inputs) != required:
            raise ValueError(f"calculation_inputs must contain exactly: {', '.join(sorted(required))}")
        if any(value < 0 for value in self.calculation_inputs.values()):
            raise ValueError("Shared costs and quality deduction must be non-negative.")
        return self


class ComparisonResponse(BaseModel):
    id: int
    commodity: str
    quantity: float
    quantity_unit: str
    physical_loss_percent: float
    status: str
    winner_selling_option_id: int | None
    calculation_inputs: dict
    results: dict
    is_sample: bool
    created_at: str

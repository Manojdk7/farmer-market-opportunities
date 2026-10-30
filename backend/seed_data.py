import os
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from models import (
    BuyerRequirement,
    Comparison,
    Market,
    PriceObservation,
    SellingOption,
    TransportQuote,
)

SAMPLE_SOURCE = "SYNTHETIC DEMO SAMPLE — not an actual market quote"


def seed_sample_data(db: Session, force: bool = False) -> None:
    # Do not inject synthetic/demo data in production unless explicitly enabled
    if not force and os.getenv("SEED_DEMO_DATA") != "1":
        return
    market_specs = [
        ("SAMPLE Davanagere APMC", "Davanagere, Karnataka", "Davanagere"),
        ("SAMPLE Hubballi Market", "Hubballi, Karnataka", "Dharwad"),
        ("SAMPLE Mysuru Market", "Mysuru, Karnataka", "Mysuru"),
    ]
    markets = {}
    for name, location, district in market_specs:
        market = db.scalar(select(Market).where(Market.name == name))
        if market is None:
            market = Market(name=name, location=location, district=district, state="Karnataka", is_sample=True)
            db.add(market)
            db.flush()
        markets[name] = market

    sample_observations = [
        ("SAMPLE Davanagere APMC", "Maize", 2200.0, "INR/quintal"),
        ("SAMPLE Davanagere APMC", "Maize", 2150.0, "INR/quintal"),
        ("SAMPLE Hubballi Market", "Maize", 2280.0, "INR/quintal"),
        ("SAMPLE Hubballi Market", "Groundnut", 6100.0, "INR/quintal"),
        ("SAMPLE Mysuru Market", "Maize", 2180.0, "INR/quintal"),
    ]
    for market_name, commodity, price, unit in sample_observations:
        market = markets[market_name]
        exists = db.scalar(select(PriceObservation.id).where(
            PriceObservation.market_id == market.id,
            PriceObservation.commodity == commodity,
            PriceObservation.price == price,
            PriceObservation.unit == unit,
            PriceObservation.data_type == "demo",
            PriceObservation.is_sample.is_(True),
        ))
        if exists is None:
            db.add(PriceObservation(
                market_id=market.id,
                commodity=commodity,
                variety=None,
                price=price,
                unit=unit,
                observation_date=None,
                retrieved_at=None,
                source_name=SAMPLE_SOURCE,
                source_url=None,
                data_type="demo",
                verification_status="not_applicable",
                source=SAMPLE_SOURCE,
                is_sample=True,
            ))

    option_specs = [
        ("SAMPLE Local APMC", "SAMPLE Davanagere APMC", 5.0, 500.0, "Sample payment terms; not an offer."),
        ("SAMPLE Nearby Market", "SAMPLE Hubballi Market", 18.0, 900.0, "Sample payment terms; not an offer."),
    ]
    options = []
    for name, market_name, distance, cost, terms in option_specs:
        option = db.scalar(select(SellingOption).where(SellingOption.name == name))
        if option is None:
            option = SellingOption(
                name=name,
                market_id=markets[market_name].id,
                buyer_name=None,
                distance_km=distance,
                transport_cost=cost,
                payment_terms=terms,
                confirmation_status="unconfirmed",
                is_sample=True,
            )
            option.transport_quotes.append(TransportQuote(
                distance_km=distance,
                estimated_cost=cost,
                currency="INR",
                quote_date=datetime.now(timezone.utc),
                source=SAMPLE_SOURCE,
                status="estimated",
            ))
            option.buyer_requirements.append(BuyerRequirement(
                commodity="Maize",
                minimum_quantity=None,
                quantity_unit="quintal",
                quality_requirements="Synthetic example only; confirm actual requirements.",
                packaging_requirements=None,
                payment_terms=terms,
            ))
            db.add(option)
            db.flush()
        options.append(option)

    sample_comparison = db.scalar(select(Comparison).where(Comparison.is_sample.is_(True)))
    if sample_comparison is None:
        inputs = {
            "q": 10.0,
            "quantity_unit": "quintal",
            "physical_loss_percent": 2.0,
            "calculation_inputs": {"d": 0.0, "ch": 0.0, "cp": 0.0, "cm": 0.0, "co": 0.0},
            "options": [
                {"selling_option_id": options[0].id, "name": options[0].name, "price": 2200.0, "unit": "INR/quintal", "transport_cost": 500.0},
                {"selling_option_id": options[1].id, "name": options[1].name, "price": 2280.0, "unit": "INR/quintal", "transport_cost": 900.0},
            ],
        }
        results = [
            {"selling_option_id": options[0].id, "name": options[0].name, "estimated_net_proceeds": 21060.0, "is_sample": True},
            {"selling_option_id": options[1].id, "name": options[1].name, "estimated_net_proceeds": 21444.0, "is_sample": True},
        ]
        db.add(Comparison(
            commodity="Maize",
            quantity=10.0,
            quantity_unit="quintal",
            physical_loss_percent=2.0,
            calculation_inputs=inputs,
            results={"status": "no_clear_advantage", "items": results, "sample_notice": SAMPLE_SOURCE},
            winner_selling_option_id=None,
            status="no_clear_advantage",
            is_sample=True,
        ))
    db.commit()

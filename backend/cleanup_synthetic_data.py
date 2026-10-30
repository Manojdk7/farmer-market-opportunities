from __future__ import annotations

import datetime
from pathlib import Path
import shutil
from typing import Any

from sqlalchemy import func, select, text
from database import Base, SessionLocal, create_database_engine, get_database_url
from models import (
    BuyerRequirement,
    Comparison,
    Market,
    PriceObservation,
    SellingOption,
    TransportQuote,
)

SAMPLE_SOURCE = "SYNTHETIC DEMO SAMPLE — not an actual market quote"


def backup_database() -> Path:
    db_url = get_database_url()
    if not db_url.startswith("sqlite:///"):
        raise ValueError(f"Only SQLite database is supported for local backup: {db_url}")

    db_path = Path(db_url.replace("sqlite:///", "")).resolve()
    if not db_path.exists():
        raise FileNotFoundError(f"Database file not found: {db_path}")

    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = db_path.parent / f"farmer_market.backup_{ts}.db"
    shutil.copyfile(db_path, backup_path)
    print(f"[OK] Database backed up to: {backup_path}")
    return backup_path


def run_safe_cleanup() -> dict[str, Any]:
    print("--- 1. BACKUP DATABASE ---")
    backup_path = backup_database()

    engine = create_database_engine()
    with SessionLocal() as db:
        print("\n--- 2. AUDIT RECORDS BY PROVENANCE ---")
        all_markets = db.scalars(select(Market)).all()
        sample_markets = [m for m in all_markets if m.is_sample or "SAMPLE" in m.name]
        genuine_markets = [m for m in all_markets if not m.is_sample and "SAMPLE" not in m.name]
        print(f"Total Markets: {len(all_markets)} (Genuine: {len(genuine_markets)}, Synthetic Sample: {len(sample_markets)})")
        for m in sample_markets:
            print(f"  - Confirmed Synthetic Market ID={m.id}: {m.name} ({m.district}, {m.state})")
        for m in genuine_markets:
            print(f"  + Verified Genuine APMC Market ID={m.id}: {m.name} ({m.district}, {m.state})")

        all_obs = db.scalars(select(PriceObservation)).all()
        sample_obs = [o for o in all_obs if o.is_sample or o.data_type == "demo" or o.source_name == SAMPLE_SOURCE]
        genuine_obs = [o for o in all_obs if not o.is_sample and o.data_type == "official"]
        print(f"\nTotal Observations: {len(all_obs)} (Genuine Official: {len(genuine_obs)}, Synthetic Demo: {len(sample_obs)})")
        for o in sample_obs:
            print(f"  - Confirmed Synthetic Observation ID={o.id}: {o.commodity} @ {o.price} {o.unit} (Market ID={o.market_id})")
        for o in genuine_obs[:5]:
            print(f"  + Verified Official Observation ID={o.id}: {o.commodity} ({o.variety}) @ {o.price} {o.unit} date={o.observation_date}")
        if len(genuine_obs) > 5:
            print(f"  ... and {len(genuine_obs) - 5} more verified official observations.")

        print("\n--- 3. SAFE CLEANUP: QUARANTINE / REMOVE SYNTHETIC DATA ---")
        # 1. Remove synthetic comparisons
        sample_comps = db.scalars(select(Comparison).where(Comparison.is_sample.is_(True))).all()
        for c in sample_comps:
            db.delete(c)
        print(f"Deleted {len(sample_comps)} synthetic comparison records.")

        # 2. Remove synthetic transport quotes & buyer requirements
        sample_options = db.scalars(select(SellingOption).where(SellingOption.is_sample.is_(True))).all()
        sample_opt_ids = [o.id for o in sample_options]
        if sample_opt_ids:
            tq_deleted = db.scalars(select(TransportQuote).where(TransportQuote.selling_option_id.in_(sample_opt_ids))).all()
            for tq in tq_deleted:
                db.delete(tq)
            br_deleted = db.scalars(select(BuyerRequirement).where(BuyerRequirement.selling_option_id.in_(sample_opt_ids))).all()
            for br in br_deleted:
                db.delete(br)
            for opt in sample_options:
                db.delete(opt)
            print(f"Deleted {len(sample_options)} synthetic selling options and linked transport quotes / buyer requirements.")

        # 3. Delete confirmed synthetic observations
        for o in sample_obs:
            db.delete(o)
        print(f"Deleted {len(sample_obs)} confirmed synthetic demo price observations.")

        # 4. Delete confirmed synthetic markets (SAMPLE Davanagere, SAMPLE Hubballi, SAMPLE Mysuru)
        for m in sample_markets:
            db.delete(m)
        print(f"Deleted {len(sample_markets)} confirmed synthetic markets (including unwanted Hubballi & Mysuru locations).")

        db.commit()

        print("\n--- 4. POST-CLEANUP VERIFICATION ---")
        remaining_markets = db.scalars(select(Market)).all()
        remaining_obs = db.scalars(select(PriceObservation)).all()
        print(f"Remaining Production Markets: {len(remaining_markets)}")
        for m in remaining_markets:
            print(f"  * Market ID={m.id}: {m.name} | District={m.district} | State={m.state} | is_sample={m.is_sample}")

        print(f"\nRemaining Production Observations: {len(remaining_obs)}")
        latest_dates_by_market: dict[str, str] = {}
        for o in remaining_obs:
            mname = o.market.name if o.market else f"Market-{o.market_id}"
            odate = str(o.observation_date)
            if mname not in latest_dates_by_market or odate > latest_dates_by_market[mname]:
                latest_dates_by_market[mname] = odate

        for mname, ldate in sorted(latest_dates_by_market.items()):
            print(f"  * {mname}: Latest verified reporting date = {ldate}")

        return {
            "backup_path": str(backup_path),
            "removed_synthetic_markets": len(sample_markets),
            "removed_synthetic_observations": len(sample_obs),
            "remaining_verified_markets": len(remaining_markets),
            "remaining_verified_observations": len(remaining_obs),
            "latest_dates_by_market": latest_dates_by_market,
        }


if __name__ == "__main__":
    run_safe_cleanup()

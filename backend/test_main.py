import unittest
import os
from datetime import date, datetime, timedelta, timezone
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from database import Base
from main import (
    calculate,
    create_comparison,
    create_price_observation,
    list_markets,
    list_price_observations,
    require_admin,
    sync_status,
    get_price_trend,
    compare_markets_price_trend,
    get_market_arrivals,
)
from freshness import observation_freshness
from migrations import migrate_price_observations
from models import Comparison, Market, PriceObservation, SellingOption
from schemas import CalculateRequest, ComparisonRequest, PriceObservationCreate
from seed_data import seed_sample_data


class BackendAPITests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine, expire_on_commit=False)

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def make_comparison(self, prices):
        options = [
            {
                "client_id": f"client-{index}",
                "name": f"Option {index}",
                "price": price,
                "price_unit": "INR/kg",
                "price_date": date.today(),
                "source": "Farmer-provided quote",
                "distance_km": 10 + index,
                "transport_cost": 50,
                "transport_source": "User-entered transport quote",
                "transport_status": "estimated",
                "quality_requirements": "Same grade",
                "quality_comparable": True,
                "payment_terms": "Cash",
                "confirmation_status": "unconfirmed",
            }
            for index, price in enumerate(prices, start=1)
        ]
        return ComparisonRequest(
            commodity="Maize",
            quantity=100,
            quantity_unit="kg",
            physical_loss_percent=5,
            calculation_inputs={"d": 0, "ch": 0, "cp": 20, "cm": 0, "co": 0},
            options=options,
        )

    def test_seed_is_repeatable_and_marks_synthetic_records(self):
        seed_sample_data(self.db, force=True)
        seed_sample_data(self.db, force=True)

        self.assertEqual(self.db.scalar(select(func.count()).select_from(Market)), 3)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(PriceObservation)), 5)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(SellingOption)), 2)
        sample_comparisons = self.db.scalars(select(Comparison).where(Comparison.is_sample.is_(True))).all()
        self.assertEqual(len(sample_comparisons), 1)
        self.assertIn("SYNTHETIC", sample_comparisons[0].results["sample_notice"])

    def test_market_and_observation_listing(self):
        seed_sample_data(self.db, force=True)
        # In production by default, demo markets and observations are excluded
        clean_markets = list_markets(district="Davanagere", state=None, include_demo=False, db=self.db)
        clean_observations = list_price_observations(commodity="Maize", include_demo=False, db=self.db)
        self.assertEqual(clean_markets["count"], 0)
        self.assertEqual(clean_observations["count"], 0)

        # When explicitly querying demo mode, demo records are accessible
        markets = list_markets(district="Davanagere", state=None, include_demo=True, db=self.db)
        observations = list_price_observations(
            market_id=None,
            commodity="Maize",
            from_date=None,
            to_date=None,
            include_demo=True,
            limit=2,
            db=self.db,
        )

        self.assertEqual(markets["count"], 1)
        self.assertEqual(markets["items"][0]["state"], "Karnataka")
        self.assertEqual(observations["count"], 2)
        self.assertTrue(observations["items"][0]["is_sample"])
        self.assertIn("SYNTHETIC", observations["items"][0]["source"])
        self.assertEqual(observations["items"][0]["data_type"], "demo")
        self.assertFalse(observations["items"][0]["ranking_eligible"])
        self.assertIsNone(observations["items"][0]["retrieved_at"])
        self.assertEqual(observations["items"][0]["freshness"], "unknown")
        self.assertEqual(observations["ranking_status"], "insufficient_reliable_data")

    def test_freshness_uses_observation_date_not_retrieval_date(self):
        # RECENT_CALENDAR_DAYS=7: observations ≤6 days old are "recent"; ≥7 days old are "stale"
        today = date(2026, 10, 29)
        self.assertEqual(observation_freshness(today, today), "recent")          # same day → recent
        self.assertEqual(observation_freshness(today - timedelta(days=1), today), "recent")  # 1 day old → recent (within 7-day window)
        self.assertEqual(observation_freshness(today - timedelta(days=6), today), "recent")  # 6 days old → still recent
        self.assertEqual(observation_freshness(today - timedelta(days=7), today), "stale")   # 7 days old → stale
        self.assertEqual(observation_freshness(today - timedelta(days=8), today), "stale")   # 8 days old → stale
        self.assertEqual(observation_freshness(None, today), "unknown")                       # no date → unknown
        self.assertEqual(observation_freshness(today + timedelta(days=1), today), "unknown")  # future date → unknown

    def test_manual_observation_is_unverified_and_requires_traceable_fields_for_eligibility(self):
        market = Market(name="Test Market", location="Karnataka", is_active=True)
        self.db.add(market)
        self.db.commit()
        payload = PriceObservationCreate(
            market_id=market.id,
            commodity="Maize",
            variety=None,
            price=22,
            unit="INR/kg",
            observation_date=datetime.now(timezone.utc).date(),
            source_name="Farmer-provided receipt",
        )
        response = create_price_observation(payload, db=self.db)
        self.assertEqual(response["data_type"], "manual")
        self.assertEqual(response["verification_status"], "unverified")
        self.assertTrue(response["ranking_eligible"])
        self.assertIsNone(response["retrieved_at"])

        payload_without_source = PriceObservationCreate(
            market_id=market.id,
            commodity="Maize",
            price=22,
            unit="INR/kg",
            observation_date=None,
            source_name=None,
        )
        incomplete = create_price_observation(payload_without_source, db=self.db)
        self.assertFalse(incomplete["ranking_eligible"])
        self.assertIn("Observation date unavailable.", incomplete["eligibility_reasons"])
        self.assertIn("Source unavailable.", incomplete["eligibility_reasons"])

    def test_manual_observation_schema_rejects_bad_price_unit_and_future_date(self):
        valid = {
            "market_id": 1,
            "commodity": "Maize",
            "price": 25,
            "unit": "INR/kg",
            "observation_date": datetime.now(timezone.utc).date().isoformat(),
        }
        for invalid in (
            {**valid, "price": 0},
            {**valid, "price": float("inf")},
            {**valid, "unit": "bags"},
            {**valid, "observation_date": (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()},
        ):
            with self.subTest(invalid=invalid), self.assertRaises(ValidationError):
                PriceObservationCreate.model_validate(invalid)

    def test_unknown_units_are_excluded_from_comparable_market_data(self):
        market = Market(name="Unknown Unit Market", location="Davanagere, Karnataka", district="Davanagere", state="Karnataka", is_active=True)
        self.db.add(market)
        self.db.flush()
        self.db.add(PriceObservation(
            market_id=market.id,
            commodity="Maize",
            price=25,
            unit="bags",
            observation_date=datetime.now(timezone.utc).date(),
            source_name="Market board",
            source="Market board",
            data_type="manual",
            verification_status="unverified",
            is_sample=False,
        ))
        self.db.commit()
        response = list_price_observations(
            market_id=None, commodity="Maize", from_date=None, to_date=None, limit=10, db=self.db,
        )
        self.assertFalse(response["items"][0]["ranking_eligible"])
        self.assertIn(
            "Price unit is unsupported for comparable market ranking.",
            response["items"][0]["eligibility_reasons"],
        )

    def test_admin_write_requires_configured_strong_bearer_token(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as disabled:
                require_admin(None)
            self.assertEqual(disabled.exception.status_code, 503)
        secret = "local-development-secret-with-at-least-32-chars"
        with patch.dict(os.environ, {"MARKET_DATA_ADMIN_TOKEN": secret}, clear=True):
            with self.assertRaises(HTTPException) as missing:
                require_admin(None)
            self.assertEqual(missing.exception.status_code, 401)
            with self.assertRaises(HTTPException) as rejected:
                require_admin("Bearer incorrect")
            self.assertEqual(rejected.exception.status_code, 403)
            self.assertIsNone(require_admin(f"Bearer {secret}"))

    def test_migration_preserves_existing_rows_and_adds_nullable_provenance_fields(self):
        legacy_engine = create_engine("sqlite://")
        with legacy_engine.begin() as connection:
            connection.execute(text("""
                CREATE TABLE markets (
                    id INTEGER PRIMARY KEY,
                    name VARCHAR(160) NOT NULL,
                    location VARCHAR(240) NOT NULL
                )
            """))
            connection.execute(text("""
                CREATE TABLE price_observations (
                    id INTEGER PRIMARY KEY,
                    market_id INTEGER NOT NULL REFERENCES markets(id),
                    commodity VARCHAR(120) NOT NULL,
                    price FLOAT NOT NULL,
                    unit VARCHAR(80) NOT NULL,
                    observation_date DATE NOT NULL,
                    source VARCHAR(240) NOT NULL,
                    is_sample BOOLEAN NOT NULL,
                    created_at DATETIME NOT NULL
                )
            """))
            connection.execute(text("INSERT INTO markets (id, name, location) VALUES (7, 'Old Market', 'Karnataka')"))
            connection.execute(text("""
                INSERT INTO price_observations
                    (id, market_id, commodity, price, unit, observation_date, source, is_sample, created_at)
                VALUES (9, 7, 'Maize', 2100, 'INR/quintal', '2026-10-28', 'SYNTHETIC DEMO SAMPLE', 1, '2026-10-28 10:00:00')
            """))
            connection.execute(text("""
                INSERT INTO price_observations
                    (id, market_id, commodity, price, unit, observation_date, source, is_sample, created_at)
                VALUES (10, 7, 'Groundnut', 6000, 'INR/quintal', '2026-10-28', 'Local receipt', 0, '2026-10-28 10:01:00')
            """))
            connection.execute(text("""
                INSERT INTO price_observations
                    (id, market_id, commodity, price, unit, observation_date, source, is_sample, created_at)
                VALUES (11, 7, 'Maize', 2100, 'INR/quintal', '2026-10-27', 'SYNTHETIC DEMO SAMPLE', 1, '2026-10-27 10:00:00')
            """))

        migrate_price_observations(legacy_engine)
        migrate_price_observations(legacy_engine)
        with legacy_engine.connect() as connection:
            migrated = connection.execute(text("""
                SELECT id, market_id, commodity, price, unit, observation_date,
                    retrieved_at, source_name, data_type, verification_status, created_at
                FROM price_observations WHERE id=9
            """)).one()
            self.assertEqual(migrated[:5], (9, 7, "Maize", 2100.0, "INR/quintal"))
            self.assertIsNone(migrated[5])
            self.assertIsNone(migrated.retrieved_at)
            self.assertEqual(migrated.source_name, "SYNTHETIC DEMO SAMPLE")
            self.assertEqual(migrated.data_type, "demo")
            self.assertEqual(migrated.verification_status, "not_applicable")
            self.assertEqual(migrated.created_at, "2026-10-28 10:00:00")
            real_observation = connection.execute(text("""
                SELECT observation_date, source_name, data_type, verification_status
                FROM price_observations WHERE id=10
            """)).one()
            self.assertEqual(real_observation, ("2026-10-28", "Local receipt", "manual", "unverified"))
            self.assertEqual(connection.execute(text("SELECT COUNT(*) FROM price_observations")).scalar_one(), 2)
            columns = {column["name"]: column for column in inspect(connection).get_columns("price_observations")}
            self.assertTrue(columns["observation_date"]["nullable"])
            self.assertTrue(columns["source"]["nullable"])
        legacy_engine.dispose()

    def test_calculation_returns_legacy_fields_and_full_breakdown(self):
        response = calculate(CalculateRequest(
            q=100, p=22, l=0.05, d=0, ct=50, ch=10, cp=20, cm=5, co=15,
        ))

        self.assertEqual(response["gross"], 2200)
        self.assertEqual(response["net_proceeds"], 1990)
        self.assertEqual(response["breakdown"]["saleable_quantity"], 95)
        self.assertEqual(response["breakdown"]["total_costs"], 100)

    def test_calculation_schema_rejects_invalid_values_and_non_finite(self):
        for values in (
            {"q": 0, "p": 22, "l": 0, "d": 0},
            {"q": 100, "p": -1, "l": 0, "d": 0},
            {"q": 100, "p": 22, "l": 1.01, "d": 0},
            {"q": 100, "p": 22, "l": 0, "d": 0, "cp": -1},
            {"q": 100, "p": float("nan"), "l": 0, "d": 0},
        ):
            with self.subTest(values=values), self.assertRaises(ValidationError):
                CalculateRequest.model_validate(values)

    def test_comparison_persists_relationships_and_no_clear_advantage(self):
        response = create_comparison(self.make_comparison([22, 22.1]), db=self.db)
        self.assertEqual(response["status"], "no_clear_advantage")
        self.assertIsNone(response["winner_selling_option_id"])
        self.assertEqual(len(response["results"]["items"]), 2)
        self.assertEqual(self.db.scalar(select(func.count()).select_from(SellingOption)), 2)

    def test_comparison_selects_a_defensible_winner(self):
        response = create_comparison(self.make_comparison([22, 28]), db=self.db)
        self.assertEqual(response["status"], "winner")
        self.assertIsNotNone(response["winner_selling_option_id"])

    def test_comparison_missing_critical_details_is_incomplete(self):
        request = self.make_comparison([22, 28])
        request.options[0].source = None
        response = create_comparison(request, db=self.db)
        self.assertEqual(response["status"], "incomplete")
        self.assertIsNone(response["winner_selling_option_id"])
        self.assertTrue(response["results"]["missing_information"])

    def test_comparison_persists_selected_apmc_observation_provenance(self):
        market = Market(name="Comparison APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(market)
        self.db.commit()
        observation = PriceObservation(
            market_id=market.id,
            commodity="Maize",
            price=2400,
            modal_price=2400,
            unit="INR/quintal",
            observation_date=date.today(),
            source_name="AGMARKNET 2.0",
            data_type="official",
            verification_status="verified",
            is_sample=False,
        )
        self.db.add(observation)
        self.db.commit()

        request = self.make_comparison([24, 28])
        request.options[0].market_id = market.id
        request.options[0].price_observation_id = observation.id
        request.options[0].price = 24
        response = create_comparison(request, db=self.db)

        self.assertEqual(response["calculation_inputs"]["options"][0]["price_observation_id"], observation.id)
        self.assertEqual(response["results"]["items"][0]["price_observation_id"], observation.id)

    def test_comparison_rejects_mismatched_apmc_observation(self):
        market = Market(name="Mismatched APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(market)
        self.db.commit()
        observation = PriceObservation(
            market_id=market.id,
            commodity="Maize",
            price=2400,
            modal_price=2400,
            unit="INR/quintal",
            observation_date=date.today(),
            data_type="official",
            verification_status="verified",
            is_sample=False,
        )
        self.db.add(observation)
        self.db.commit()

        request = self.make_comparison([25, 28])
        request.options[0].market_id = market.id
        request.options[0].price_observation_id = observation.id
        with self.assertRaises(HTTPException) as error:
            create_comparison(request, db=self.db)
        self.assertEqual(error.exception.status_code, 422)

    def test_sync_endpoint_does_not_claim_a_fake_sync(self):
        response = sync_status()
        self.assertIn("agmarknet", response)

    def test_districts_endpoint_returns_31_districts(self):
        from main import list_districts
        res = list_districts()
        self.assertEqual(res["count"], 31)
        self.assertEqual(len(res["items"]), 31)
        self.assertEqual(res["default"], "Davanagere")
        names = [d["name"] for d in res["items"]]
        self.assertIn("Davanagere", names)
        self.assertIn("Belagavi", names)
        self.assertIn("Mysuru", names)
        self.assertIn("Yadgir", names)

    def test_crops_endpoint_returns_7_crops_with_sugarcane_frp(self):
        from main import list_crops
        res = list_crops()
        self.assertEqual(res["count"], 7)
        self.assertEqual(len(res["items"]), 7)
        self.assertEqual(res["default"], "Maize")
        crops = {c["name"]: c for c in res["items"]}
        self.assertIn("Maize", crops)
        self.assertIn("Paddy (Common)", crops)
        self.assertIn("Red Gram / Arhar / Tur (Whole)", crops)
        self.assertIn("Groundnut", crops)
        self.assertIn("Ragi / Finger Millet", crops)
        self.assertIn("Soybean", crops)
        self.assertIn("Sugarcane", crops)
        sugarcane = crops["Sugarcane"]
        self.assertTrue(sugarcane["is_sugarcane"])
        self.assertEqual(sugarcane["default_unit"], "INR/tonne")
        self.assertEqual(sugarcane["frp_reference_per_tonne"], 3400.0)

    def test_district_alias_resolution_in_market_listing(self):
        # Add a market in Belagavi
        market = Market(name="Belgaum APMC", location="Belagavi, Karnataka", district="Belagavi", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(market)
        self.db.commit()
        # Query using alias 'belgaum'
        res = list_markets(district="belgaum", db=self.db)
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["items"][0]["name"], "Belgaum APMC")
        self.assertEqual(res["district"], "Belagavi")



    # -------------------------------------------------------------------------
    # Phase 3 & 4: Historical APMC Price Trend Tests
    # -------------------------------------------------------------------------
    def test_price_trend_seven_valid_observations_and_rising_trend(self):
        m = Market(name="Davanagere APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m)
        self.db.commit()

        base_d = date(2026, 10, 20)
        prices = [2000.0, 2050.0, 2100.0, 2150.0, 2200.0, 2250.0, 2300.0]
        for i, p in enumerate(prices):
            obs = PriceObservation(
                market_id=m.id,
                commodity="Maize",
                variety="Local",
                price=p,
                modal_price=p,
                unit="INR/quintal",
                observation_date=base_d + timedelta(days=i),
                data_type="official",
                verification_status="verified",
                is_sample=False,
            )
            self.db.add(obs)
        self.db.commit()

        res = get_price_trend(district="Davanagere", crop="Maize", market="Davanagere APMC", days=7, db=self.db)
        self.assertEqual(res["available_reporting_days"], 7)
        self.assertEqual(res["first_price"], 2000.0)
        self.assertEqual(res["latest_price"], 2300.0)
        self.assertEqual(res["absolute_change"], 300.0)
        self.assertEqual(res["percentage_change"], 15.0)
        self.assertEqual(res["trend"], "RISING")
        self.assertEqual(res["unit"], "INR/quintal")
        self.assertEqual(len(res["observations"]), 7)

    def test_price_trend_falling_and_stable(self):
        m = Market(name="Harihara APMC", location="Harihara", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m)
        self.db.commit()

        d1 = date(2026, 10, 21)
        d2 = date(2026, 10, 22)
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2500.0, modal_price=2500.0, unit="INR/quintal", observation_date=d1, data_type="official", verification_status="verified", is_sample=False))
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2300.0, modal_price=2300.0, unit="INR/quintal", observation_date=d2, data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        res_fall = get_price_trend(district="Davanagere", crop="Maize", market="Harihara APMC", days=7, db=self.db)
        self.assertEqual(res_fall["trend"], "FALLING")
        self.assertEqual(res_fall["percentage_change"], -8.0)

        m_stable = Market(name="Channagiri APMC", location="Channagiri", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m_stable)
        self.db.commit()
        self.db.add(PriceObservation(market_id=m_stable.id, commodity="Maize", price=2000.0, modal_price=2000.0, unit="INR/quintal", observation_date=d1, data_type="official", verification_status="verified", is_sample=False))
        self.db.add(PriceObservation(market_id=m_stable.id, commodity="Maize", price=2010.0, modal_price=2010.0, unit="INR/quintal", observation_date=d2, data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        res_stable = get_price_trend(district="Davanagere", crop="Maize", market="Channagiri APMC", days=7, db=self.db)
        self.assertEqual(res_stable["trend"], "STABLE")
        self.assertEqual(res_stable["percentage_change"], 0.5)

    def test_price_trend_insufficient_or_no_observations(self):
        m = Market(name="Empty APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m)
        self.db.commit()

        res_empty = get_price_trend(district="Davanagere", crop="Maize", market="Empty APMC", days=7, db=self.db)
        self.assertEqual(res_empty["available_reporting_days"], 0)
        self.assertEqual(res_empty["trend"], "INSUFFICIENT_DATA")
        self.assertIsNone(res_empty["first_price"])

        d1 = date(2026, 10, 25)
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2100.0, modal_price=2100.0, unit="INR/quintal", observation_date=d1, data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        res_one = get_price_trend(district="Davanagere", crop="Maize", market="Empty APMC", days=7, db=self.db)
        self.assertEqual(res_one["available_reporting_days"], 1)
        self.assertEqual(res_one["trend"], "INSUFFICIENT_DATA")

    def test_price_trend_handles_missing_calendar_dates_and_duplicates(self):
        m = Market(name="Honnali APMC", location="Honnali", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m)
        self.db.commit()

        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2100.0, modal_price=2100.0, unit="INR/quintal", observation_date=date(2026, 10, 20), data_type="official", verification_status="verified", is_sample=False))
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2150.0, modal_price=2150.0, unit="INR/quintal", observation_date=date(2026, 10, 23), data_type="official", verification_status="verified", is_sample=False))
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2180.0, modal_price=2180.0, unit="INR/quintal", observation_date=date(2026, 10, 23), data_type="official", verification_status="verified", is_sample=False))
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2300.0, modal_price=2300.0, unit="INR/quintal", observation_date=date(2026, 10, 27), data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        res = get_price_trend(district="Davanagere", crop="Maize", market="Honnali APMC", days=7, db=self.db)
        self.assertEqual(res["available_reporting_days"], 3)
        obs_dates = [o["reporting_date"] for o in res["observations"]]
        self.assertEqual(obs_dates, ["2026-10-20", "2026-10-23", "2026-10-27"])

    def test_thirty_day_statistics_and_market_comparison(self):
        m1 = Market(name="M1 APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        m2 = Market(name="M2 APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add_all([m1, m2])
        self.db.commit()

        for i in range(10):
            d = date(2026, 10, 1) + timedelta(days=i)
            self.db.add(PriceObservation(market_id=m1.id, commodity="Maize", price=2000.0 + i*10, modal_price=2000.0 + i*10, unit="INR/quintal", observation_date=d, data_type="official", verification_status="verified", is_sample=False))
            self.db.add(PriceObservation(market_id=m2.id, commodity="Maize", price=2100.0 + i*5, modal_price=2100.0 + i*5, unit="INR/quintal", observation_date=d, data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        res30 = get_price_trend(district="Davanagere", crop="Maize", market="M1 APMC", days=30, db=self.db)
        self.assertEqual(res30["available_reporting_days"], 10)
        self.assertEqual(res30["min_price"], 2000.0)
        self.assertEqual(res30["max_price"], 2090.0)
        self.assertEqual(res30["average_price"], 2045.0)

        comp = compare_markets_price_trend(district="Davanagere", crop="Maize", markets="M1 APMC, M2 APMC", days=30, db=self.db)
        self.assertTrue(comp["is_comparable"])
        self.assertEqual(len(comp["markets"]), 2)

    def test_market_comparison_rejects_incompatible_units(self):
        m1 = Market(name="Qtl APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        m2 = Market(name="Tonne APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add_all([m1, m2])
        self.db.commit()

        d = date(2026, 10, 25)
        self.db.add(PriceObservation(market_id=m1.id, commodity="Maize", price=2200.0, modal_price=2200.0, unit="INR/quintal", observation_date=d, data_type="official", verification_status="verified", is_sample=False))
        self.db.add(PriceObservation(market_id=m2.id, commodity="Maize", price=22000.0, modal_price=22000.0, unit="INR/tonne", observation_date=d, data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        comp = compare_markets_price_trend(district="Davanagere", crop="Maize", markets="Qtl APMC, Tonne APMC", days=30, db=self.db)
        self.assertFalse(comp["is_comparable"])
        self.assertIn("different price units", comp["incomparable_reason"].lower())

    # -------------------------------------------------------------------------
    # Phase 5: APMC Arrival Quantity Tracking Tests
    # -------------------------------------------------------------------------
    def test_arrival_unavailable_when_no_records_exist(self):
        m = Market(name="No Arrival APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m)
        self.db.commit()

        res = get_market_arrivals(district="Davanagere", crop="Maize", market="No Arrival APMC", db=self.db)
        self.assertFalse(res["available"])
        self.assertIsNone(res["arrival_quantity"])
        self.assertIn("unavailable", res["message"].lower())

    def test_arrival_previous_day_comparison_and_percentage_change(self):
        m = Market(name="Arrival APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m)
        self.db.commit()

        d_prev = date(2026, 10, 27)
        d_latest = date(2026, 10, 28)
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2200.0, modal_price=2200.0, unit="INR/quintal", arrival_quantity=100.0, arrival_unit="tonnes", observation_date=d_prev, data_type="official", verification_status="verified", is_sample=False))
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2250.0, modal_price=2250.0, unit="INR/quintal", arrival_quantity=125.0, arrival_unit="tonnes", observation_date=d_latest, data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        res = get_market_arrivals(district="Davanagere", crop="Maize", market="Arrival APMC", db=self.db)
        self.assertTrue(res["available"])
        self.assertEqual(res["arrival_quantity"], 125.0)
        self.assertEqual(res["previous_arrival_quantity"], 100.0)
        self.assertEqual(res["arrival_change"], 25.0)
        self.assertEqual(res["arrival_percentage_change"], 25.0)
        self.assertEqual(res["reporting_date"], "2026-10-28")
        self.assertEqual(res["previous_reporting_date"], "2026-10-27")

    def test_arrival_historical_median_baseline_and_classification(self):
        m = Market(name="Baseline APMC", location="Davanagere", district="Davanagere", state="Karnataka", is_active=True, is_sample=False)
        self.db.add(m)
        self.db.commit()

        for i in range(7):
            d = date(2026, 10, 10) + timedelta(days=i)
            self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2200.0, modal_price=2200.0, unit="INR/quintal", arrival_quantity=100.0, arrival_unit="tonnes", observation_date=d, data_type="official", verification_status="verified", is_sample=False))

        d_latest = date(2026, 10, 17)
        self.db.add(PriceObservation(market_id=m.id, commodity="Maize", price=2200.0, modal_price=2200.0, unit="INR/quintal", arrival_quantity=140.0, arrival_unit="tonnes", observation_date=d_latest, data_type="official", verification_status="verified", is_sample=False))
        self.db.commit()

        res_high = get_market_arrivals(district="Davanagere", crop="Maize", market="Baseline APMC", db=self.db)
        self.assertTrue(res_high["historical_baseline"]["available"])
        self.assertEqual(res_high["historical_baseline"]["median_quantity"], 100.0)
        self.assertEqual(res_high["historical_baseline"]["classification"], "HIGH")

        latest_obs = self.db.query(PriceObservation).filter(PriceObservation.observation_date == d_latest).first()
        latest_obs.arrival_quantity = 60.0
        self.db.commit()

        res_low = get_market_arrivals(district="Davanagere", crop="Maize", market="Baseline APMC", db=self.db)
        self.assertEqual(res_low["historical_baseline"]["classification"], "LOW")


if __name__ == "__main__":
    unittest.main()

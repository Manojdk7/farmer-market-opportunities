import unittest
from unittest.mock import patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from agmarknet_sync import sync_agmarknet_prices
from database import Base


class AgmarknetSyncTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.mandis = [
            {"id": 1, "name": "Test Mandi A", "district_name": "Davanagere"},
            {"id": 2, "name": "Test Mandi B", "district_name": "Davanagere"},
        ]

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(self.engine)
        self.engine.dispose()

    def test_no_price_rows_is_successful_empty_sync(self):
        with (
            patch("agmarknet_sync.ensure_district_markets"),
            patch("agmarknet_sync.load_verified_mandis_data", return_value=self.mandis),
            patch("agmarknet_sync._http_get", return_value={"data": []}),
        ):
            result = sync_agmarknet_prices(self.db, "Davanagere", "Maize")

        self.assertTrue(result["success"])
        self.assertEqual(result["records_synced"], 0)
        self.assertIsNone(result["errors"])

    def test_upstream_errors_are_reported_as_failed_sync(self):
        with (
            patch("agmarknet_sync.ensure_district_markets"),
            patch("agmarknet_sync.load_verified_mandis_data", return_value=self.mandis),
            patch("agmarknet_sync._http_get", side_effect=OSError("upstream unavailable")),
        ):
            result = sync_agmarknet_prices(self.db, "Davanagere", "Maize")

        self.assertFalse(result["success"])
        self.assertEqual(result["records_synced"], 0)
        self.assertEqual(len(result["errors"]), 2)
        self.assertEqual(result["markets_checked"], 0)
        self.assertEqual(result["markets_total"], 2)

    def test_missing_market_list_is_not_reported_as_empty_price_data(self):
        with (
            patch("agmarknet_sync.ensure_district_markets"),
            patch("agmarknet_sync.load_verified_mandis_data", return_value=[]),
        ):
            result = sync_agmarknet_prices(self.db, "Davanagere", "Maize")

        self.assertFalse(result["success"])
        self.assertEqual(result["markets_checked"], 0)
        self.assertEqual(result["markets_total"], 0)
        self.assertTrue(result["errors"])

    def test_partial_upstream_failure_reports_successfully_checked_markets(self):
        with (
            patch("agmarknet_sync.ensure_district_markets"),
            patch("agmarknet_sync.load_verified_mandis_data", return_value=self.mandis),
            patch(
                "agmarknet_sync._http_get",
                side_effect=[{"data": []}, OSError("market unavailable")],
            ),
        ):
            result = sync_agmarknet_prices(self.db, "Davanagere", "Maize")

        self.assertFalse(result["success"])
        self.assertEqual(result["markets_checked"], 1)
        self.assertEqual(result["markets_total"], 2)
        self.assertEqual(len(result["errors"]), 1)


if __name__ == "__main__":
    unittest.main()

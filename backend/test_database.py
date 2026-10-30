import os
import unittest
from unittest.mock import patch

from database import get_database_url


class DatabaseUrlTests(unittest.TestCase):
    def test_normalizes_postgres_urls_for_psycopg(self):
        test_urls = (
            ("postgres://db.example/app", "postgresql+psycopg://db.example/app"),
            ("postgresql://db.example/app", "postgresql+psycopg://db.example/app"),
        )

        for configured_url, expected_url in test_urls:
            with self.subTest(configured_url=configured_url):
                with patch.dict(os.environ, {"DATABASE_URL": configured_url}):
                    self.assertEqual(get_database_url(), expected_url)

    def test_preserves_non_postgres_database_urls(self):
        with patch.dict(os.environ, {"DATABASE_URL": "sqlite:///local.db"}):
            self.assertEqual(get_database_url(), "sqlite:///local.db")


if __name__ == "__main__":
    unittest.main()

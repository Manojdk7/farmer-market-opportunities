"""Tests for the Agro Mitra authentication system."""
import unittest
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import auth
from database import Base
from models import User, UserSession


class AuthTestCase(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, expire_on_commit=False)
        self.db = self.Session()
        # Reset attempt tracking between tests
        auth._login_attempts.clear()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)
        self.engine.dispose()
        auth._login_attempts.clear()

    def test_create_user_success(self):
        user = auth.create_user(self.db, "farmer_raju", "securepass123", role="farmer")
        self.assertEqual(user.username, "farmer_raju")
        self.assertEqual(user.role, "farmer")
        self.assertTrue(user.is_active)
        self.assertNotEqual(user.password_hash, "securepass123")
        self.assertTrue(user.password_hash.startswith("scrypt:") or user.password_hash.startswith("pbkdf2:"))

    def test_create_user_duplicate_username_fails(self):
        auth.create_user(self.db, "kavitha", "password123")
        with self.assertRaises(ValueError) as ctx:
            auth.create_user(self.db, "kavitha", "anotherpass123")
        self.assertIn("already taken", str(ctx.exception))

    def test_create_user_short_inputs_fail(self):
        with self.assertRaises(ValueError):
            auth.create_user(self.db, "ab", "password123")
        with self.assertRaises(ValueError):
            auth.create_user(self.db, "valid_user", "12345")

    def test_authenticate_user_valid(self):
        auth.create_user(self.db, "basavaraj", "harvest2026")
        user = auth.authenticate_user(self.db, "basavaraj", "harvest2026")
        self.assertIsNotNone(user)
        self.assertEqual(user.username, "basavaraj")

    def test_authenticate_user_invalid_password(self):
        auth.create_user(self.db, "basavaraj", "harvest2026")
        user = auth.authenticate_user(self.db, "basavaraj", "wrongpass")
        self.assertIsNone(user)

    def test_authenticate_nonexistent_user(self):
        user = auth.authenticate_user(self.db, "nobody", "anypass123")
        self.assertIsNone(user)

    def test_authenticate_inactive_user(self):
        user = auth.create_user(self.db, "inactive_user", "pass123456")
        user.is_active = False
        self.db.commit()

        authed = auth.authenticate_user(self.db, "inactive_user", "pass123456")
        self.assertIsNone(authed)

    def test_session_lifecycle(self):
        user = auth.create_user(self.db, "session_user", "pass123456")
        session = auth.create_session(self.db, user.id, duration_hours=12)

        self.assertIsNotNone(session.session_token)
        self.assertTrue(session.is_active)

        # Validate session
        validated_user = auth.validate_session(self.db, session.session_token)
        self.assertIsNotNone(validated_user)
        self.assertEqual(validated_user.id, user.id)

        # Invalidate session
        auth.invalidate_session(self.db, session.session_token)
        revalidated = auth.validate_session(self.db, session.session_token)
        self.assertIsNone(revalidated)

    def test_session_expiration(self):
        user = auth.create_user(self.db, "expiring_user", "pass123456")
        session = auth.create_session(self.db, user.id, duration_hours=1)

        # Artificially expire the session
        session.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        self.db.commit()

        validated = auth.validate_session(self.db, session.session_token)
        self.assertIsNone(validated)

    def test_invalidate_all_user_sessions(self):
        user = auth.create_user(self.db, "multi_session_user", "pass123456")
        s1 = auth.create_session(self.db, user.id)
        s2 = auth.create_session(self.db, user.id)

        auth.invalidate_all_user_sessions(self.db, user.id)

        self.assertIsNone(auth.validate_session(self.db, s1.session_token))
        self.assertIsNone(auth.validate_session(self.db, s2.session_token))

    def test_login_rate_limiting_lockout(self):
        username = "brute_force_target"
        self.assertTrue(auth.check_login_allowed(username))

        for _ in range(auth.MAX_LOGIN_ATTEMPTS - 1):
            auth.record_failed_attempt(username)
            self.assertTrue(auth.check_login_allowed(username))

        # 5th attempt triggers lockout
        auth.record_failed_attempt(username)
        self.assertFalse(auth.check_login_allowed(username))

        # Resetting restores access
        auth.reset_login_attempts(username)
        self.assertTrue(auth.check_login_allowed(username))

    def test_cleanup_expired_sessions(self):
        user = auth.create_user(self.db, "cleanup_user", "pass123456")
        s = auth.create_session(self.db, user.id)
        s.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        self.db.commit()

        auth.cleanup_expired_sessions(self.db)
        remaining = self.db.query(UserSession).filter(UserSession.id == s.id).first()
        self.assertIsNone(remaining)

    def test_farmer_registration_success(self):
        user = auth.create_user(
            self.db,
            username="shiva_farmer",
            password="strongpassword123",
            role="farmer",
            full_name="Shivanna K",
            mobile_number="9876543210",
            email="shiva@example.com",
            district="Mandya",
            preferred_language="kn",
        )
        self.assertEqual(user.username, "shiva_farmer")
        self.assertEqual(user.full_name, "Shivanna K")
        self.assertEqual(user.mobile_number, "9876543210")
        self.assertEqual(user.district, "Mandya")
        self.assertEqual(user.preferred_language, "kn")
        self.assertEqual(user.role, "farmer")

    def test_registration_duplicate_mobile_fails(self):
        auth.create_user(
            self.db,
            username="user_one",
            password="password123",
            mobile_number="9888877777",
        )
        with self.assertRaises(ValueError) as ctx:
            auth.create_user(
                self.db,
                username="user_two",
                password="password123",
                mobile_number="9888877777",
            )
        self.assertIn("already registered", str(ctx.exception))

    def test_registration_invalid_mobile_fails(self):
        with self.assertRaises(ValueError):
            auth.create_user(
                self.db,
                username="bad_mobile",
                password="password123",
                mobile_number="12345",  # Invalid prefix and length
            )

    def test_registration_invalid_email_fails(self):
        with self.assertRaises(ValueError):
            auth.create_user(
                self.db,
                username="bad_email",
                password="password123",
                mobile_number="9876543211",
                email="not-an-email",
            )


if __name__ == "__main__":
    unittest.main()

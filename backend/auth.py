"""Authentication module for Agro Mitra.

Provides user registration, session-based authentication, login attempt
tracking with lockout, and a FastAPI dependency for extracting the
current authenticated user from a session cookie.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from database import get_db
from models import User, UserSession

# ---------------------------------------------------------------------------
# Auth Pydantic schemas
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """Request body for the login endpoint."""

    model_config = ConfigDict(extra="forbid")

    username: str
    password: str


class LoginResponse(BaseModel):
    """Response body returned on successful login."""

    username: str
    role: str
    message: str


class UserResponse(BaseModel):
    """Public user information returned by the /me endpoint."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: str
    full_name: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    district: Optional[str] = None
    preferred_language: str = "kn"
    created_at: datetime


class RegisterRequest(BaseModel):
    """Request body for farmer registration."""

    model_config = ConfigDict(extra="forbid")

    full_name: str
    username: str
    mobile_number: str
    password: str
    confirm_password: str
    email: Optional[str] = None
    district: Optional[str] = None
    preferred_language: str = "kn"


class RegisterResponse(BaseModel):
    """Response body returned on successful farmer registration."""

    username: str
    role: str
    message: str


# ---------------------------------------------------------------------------
# Login-attempt tracking (in-memory)
# ---------------------------------------------------------------------------

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

# Maps username -> {"attempts": int, "locked_until": datetime | None}
_login_attempts: dict[str, dict] = {}


def check_login_allowed(username: str) -> bool:
    """Return *True* if the user is allowed to attempt a login.

    A user is locked out after ``MAX_LOGIN_ATTEMPTS`` consecutive failures
    for ``LOCKOUT_DURATION_MINUTES`` minutes.
    """
    record = _login_attempts.get(username)
    if record is None:
        return True
    locked_until = record.get("locked_until")
    if locked_until is not None:
        if datetime.now(timezone.utc) < locked_until:
            return False
        # Lockout expired – reset the record
        _login_attempts.pop(username, None)
    return True


def record_failed_attempt(username: str) -> None:
    """Record a failed login attempt and engage lockout if threshold is reached."""
    record = _login_attempts.setdefault(username, {"attempts": 0, "locked_until": None})
    record["attempts"] += 1
    if record["attempts"] >= MAX_LOGIN_ATTEMPTS:
        record["locked_until"] = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)


def reset_login_attempts(username: str) -> None:
    """Clear the failed-login counter on successful authentication."""
    _login_attempts.pop(username, None)


# ---------------------------------------------------------------------------
# Core auth functions
# ---------------------------------------------------------------------------


import re

MOBILE_REGEX = re.compile(r"^[6-9]\d{9}$")
EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def create_user(
    db: Session,
    username: str,
    password: str,
    role: str = "farmer",
    full_name: Optional[str] = None,
    mobile_number: Optional[str] = None,
    email: Optional[str] = None,
    district: Optional[str] = None,
    preferred_language: str = "kn",
) -> User:
    """Create a new user with a hashed password.

    Args:
        db: Active SQLAlchemy session.
        username: Unique username (minimum 3 characters).
        password: Plain-text password (minimum 6 characters).
        role: User role, defaults to ``"farmer"``.
        full_name: Farmer's full name.
        mobile_number: 10-digit mobile number.
        email: Optional email address.
        district: Karnataka district name.
        preferred_language: 'kn' or 'en'.

    Returns:
        The newly created :class:`User` instance.

    Raises:
        ValueError: If inputs are invalid or username/mobile is already registered.
    """
    clean_username = username.strip() if username else ""
    if not clean_username or len(clean_username) < 3:
        raise ValueError("Username must be at least 3 characters.")
    if not password or len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    # Check username uniqueness
    existing_user = db.query(User).filter(User.username == clean_username).first()
    if existing_user:
        raise ValueError(f"Username '{clean_username}' is already taken.")

    clean_mobile = None
    if mobile_number:
        clean_mobile = mobile_number.strip().replace(" ", "").replace("-", "")
        if clean_mobile.startswith("+91"):
            clean_mobile = clean_mobile[3:]
        elif clean_mobile.startswith("0") and len(clean_mobile) == 11:
            clean_mobile = clean_mobile[1:]

        if not MOBILE_REGEX.match(clean_mobile):
            raise ValueError("Mobile number must be a valid 10-digit Indian mobile number.")

        existing_mobile = db.query(User).filter(User.mobile_number == clean_mobile).first()
        if existing_mobile:
            raise ValueError("Mobile number is already registered.")

    clean_email = None
    if email and email.strip():
        clean_email = email.strip().lower()
        if not EMAIL_REGEX.match(clean_email):
            raise ValueError("Invalid email address format.")
        existing_email = db.query(User).filter(User.email == clean_email).first()
        if existing_email:
            raise ValueError("Email address is already registered.")

    user = User(
        username=clean_username,
        password_hash=generate_password_hash(password),
        full_name=full_name.strip() if full_name else None,
        mobile_number=clean_mobile,
        email=clean_email,
        district=district.strip() if district else None,
        preferred_language="en" if preferred_language == "en" else "kn",
        role=role,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise ValueError("Username or mobile number is already taken.")
    return user


def authenticate_user(db: Session, identifier: str, password: str) -> Optional[User]:
    """Verify credentials and return the user, or ``None`` on failure.

    Supports logging in with:
    1. Username
    2. Email address (case-insensitive)
    3. 10-digit Mobile number (with optional +91 or leading 0 stripped)

    Returns ``None`` when the user does not exist, is inactive, or the
    password does not match.
    """
    clean_id = identifier.strip() if identifier else ""
    if not clean_id:
        return None

    # Check if identifier matches a 10-digit mobile number format
    norm_mobile = clean_id.replace(" ", "").replace("-", "")
    if norm_mobile.startswith("+91"):
        norm_mobile = norm_mobile[3:]
    elif norm_mobile.startswith("0") and len(norm_mobile) == 11:
        norm_mobile = norm_mobile[1:]

    is_mobile = bool(MOBILE_REGEX.match(norm_mobile))
    clean_email = clean_id.lower()

    filter_conditions = [
        User.username == clean_id,
        User.email == clean_email,
    ]
    if is_mobile:
        filter_conditions.append(User.mobile_number == norm_mobile)

    user = db.query(User).filter(or_(*filter_conditions)).first()
    if user is None:
        return None
    if not user.is_active:
        return None
    if not check_password_hash(user.password_hash, password):
        return None
    return user


def create_session(db: Session, user_id: int, duration_hours: int = 24) -> UserSession:
    """Create a new session token for the given user.

    Args:
        db: Active SQLAlchemy session.
        user_id: ID of the authenticated user.
        duration_hours: Session validity in hours (default 24).

    Returns:
        The newly created :class:`UserSession`.
    """
    session = UserSession(
        session_token=secrets.token_hex(32),
        user_id=user_id,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=duration_hours),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def validate_session(db: Session, session_token: str) -> Optional[User]:
    """Look up an active session and return the owning user, or ``None``.

    Expired sessions are automatically marked inactive.
    """
    session = (
        db.query(UserSession)
        .filter(UserSession.session_token == session_token, UserSession.is_active.is_(True))
        .first()
    )
    if session is None:
        return None
    if session.expires_at.tzinfo is None:
        expires_at = session.expires_at.replace(tzinfo=timezone.utc)
    else:
        expires_at = session.expires_at
    if datetime.now(timezone.utc) >= expires_at:
        session.is_active = False
        db.commit()
        return None
    return db.query(User).filter(User.id == session.user_id).first()


def invalidate_session(db: Session, session_token: str) -> None:
    """Mark a single session as inactive (logout)."""
    session = (
        db.query(UserSession)
        .filter(UserSession.session_token == session_token)
        .first()
    )
    if session is not None:
        session.is_active = False
        db.commit()


def invalidate_all_user_sessions(db: Session, user_id: int) -> None:
    """Mark every session for the given user as inactive."""
    db.query(UserSession).filter(
        UserSession.user_id == user_id,
        UserSession.is_active.is_(True),
    ).update({"is_active": False})
    db.commit()


def cleanup_expired_sessions(db: Session) -> None:
    """Delete all sessions that have passed their expiry time."""
    db.query(UserSession).filter(
        UserSession.expires_at < datetime.now(timezone.utc),
    ).delete()
    db.commit()


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """FastAPI dependency that extracts and validates the session cookie.

    Reads the ``session_token`` cookie, validates the session, and returns
    the authenticated :class:`User`.  Raises HTTP 401 if the cookie is
    missing or the session is invalid/expired.
    """
    session_token = request.cookies.get("session_token")
    if not session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    user = validate_session(db, session_token)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid",
        )
    return user

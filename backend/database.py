import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


def get_database_url():
    url = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{(Path(__file__).resolve().parent / 'farmer_market.db').as_posix()}",
    )
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


def create_database_engine(database_url=None):
    url = database_url or get_database_url()
    options = {"connect_args": {"check_same_thread": False}} if url.startswith("sqlite") else {}
    if url in {"sqlite://", "sqlite:///:memory:"}:
        options["poolclass"] = StaticPool
    engine = create_engine(url, **options)

    if url.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _connection_record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


engine = create_database_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

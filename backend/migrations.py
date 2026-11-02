import sqlite3
from pathlib import Path
from sqlalchemy.engine import Engine


def _dedupe_synthetic_demo_observations(cursor) -> None:
    cursor.execute("""
        DELETE FROM price_observations
        WHERE data_type = 'demo'
          AND is_sample = 1
          AND source_name IS NOT NULL
          AND UPPER(source_name) LIKE '%SYNTHETIC%'
          AND id NOT IN (
              SELECT MIN(id)
              FROM price_observations
              WHERE data_type = 'demo'
                AND is_sample = 1
                AND source_name IS NOT NULL
                AND UPPER(source_name) LIKE '%SYNTHETIC%'
              GROUP BY market_id, commodity, COALESCE(variety, ''), price, unit, source_name
          )
    """)


def migrate_price_observations(engine: Engine) -> None:
    if engine.dialect.name != "sqlite":
        return

    connection = engine.raw_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("PRAGMA table_info(price_observations)")
        existing_columns = {row[1]: row for row in cursor.fetchall()}
        if not existing_columns:
            return

        for col in ["modal_price", "min_price", "max_price"]:
            if col not in existing_columns:
                cursor.execute(f"ALTER TABLE price_observations ADD COLUMN {col} FLOAT")
        if "arrival_quantity" not in existing_columns:
            cursor.execute("ALTER TABLE price_observations ADD COLUMN arrival_quantity FLOAT")
        if "arrival_unit" not in existing_columns:
            cursor.execute("ALTER TABLE price_observations ADD COLUMN arrival_unit VARCHAR(80)")
        cursor.execute("PRAGMA table_info(price_observations)")
        existing_columns = {row[1]: row for row in cursor.fetchall()}

        required_columns = {
            "id", "market_id", "commodity", "variety", "price", "unit",
            "observation_date", "retrieved_at", "source_name", "source_url",
            "data_type", "verification_status", "source", "is_sample",
            "created_at", "updated_at",
        }
        date_is_nullable = existing_columns["observation_date"][3] == 0
        source_is_nullable = existing_columns["source"][3] == 0
        if required_columns.issubset(existing_columns) and date_is_nullable and source_is_nullable:
            cursor.execute("""
                UPDATE price_observations
                SET observation_date = NULL
                WHERE data_type = 'demo'
                  AND is_sample = 1
                  AND source_name IS NOT NULL
                  AND UPPER(source_name) LIKE '%SYNTHETIC%'
            """)
            _dedupe_synthetic_demo_observations(cursor)
            connection.commit()
            return

        source_expr = "source" if "source" in existing_columns else "NULL"
        sample_expr = "is_sample" if "is_sample" in existing_columns else "0"
        created_expr = "created_at" if "created_at" in existing_columns else "CURRENT_TIMESTAMP"
        date_expr = "observation_date" if "observation_date" in existing_columns else "NULL"
        if "is_sample" in existing_columns and "source" in existing_columns:
            date_expr = (
                f"CASE WHEN {sample_expr} = 1 AND UPPER({source_expr}) LIKE '%SYNTHETIC%' "
                f"THEN NULL ELSE {date_expr} END"
            )
        source_name_expr = "source_name" if "source_name" in existing_columns else f"NULLIF(TRIM({source_expr}), '')"
        data_type_expr = (
            "data_type" if "data_type" in existing_columns
            else f"CASE WHEN {sample_expr} = 1 THEN 'demo' ELSE 'manual' END"
        )
        verification_expr = (
            "verification_status" if "verification_status" in existing_columns
            else f"CASE WHEN {sample_expr} = 1 THEN 'not_applicable' ELSE 'unverified' END"
        )

        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.execute("BEGIN IMMEDIATE")
        cursor.execute("""
            CREATE TABLE price_observations_phase5 (
                id INTEGER PRIMARY KEY,
                market_id INTEGER NOT NULL REFERENCES markets(id),
                commodity VARCHAR(120) NOT NULL,
                variety VARCHAR(120),
                price FLOAT NOT NULL,
                unit VARCHAR(80) NOT NULL,
                observation_date DATE,
                retrieved_at DATETIME,
                source_name VARCHAR(240),
                source_url VARCHAR(1000),
                data_type VARCHAR(16) NOT NULL DEFAULT 'manual',
                verification_status VARCHAR(24) NOT NULL DEFAULT 'unverified',
                source VARCHAR(240),
                is_sample BOOLEAN NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL,
                updated_at DATETIME
            )
        """)
        cursor.execute(f"""
            INSERT INTO price_observations_phase5 (
                id, market_id, commodity, variety, price, unit, observation_date,
                retrieved_at, source_name, source_url, data_type, verification_status,
                source, is_sample, created_at, updated_at
            )
            SELECT
                id, market_id, commodity,
                {"variety" if "variety" in existing_columns else "NULL"},
                price, unit, {date_expr},
                {"retrieved_at" if "retrieved_at" in existing_columns else "NULL"},
                {source_name_expr},
                {"source_url" if "source_url" in existing_columns else "NULL"},
                {data_type_expr},
                {verification_expr},
                {source_expr}, {sample_expr}, {created_expr},
                {"updated_at" if "updated_at" in existing_columns else "NULL"}
            FROM price_observations
        """)
        cursor.execute("DROP TABLE price_observations")
        cursor.execute("ALTER TABLE price_observations_phase5 RENAME TO price_observations")
        _dedupe_synthetic_demo_observations(cursor)
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_price_observations_market_date "
            "ON price_observations (market_id, observation_date)"
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS ix_price_observations_commodity_date "
            "ON price_observations (commodity, observation_date)"
        )
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        connection.close()


def migrate_auth_tables(engine: Engine) -> None:
    """Ensure users and user_sessions tables exist with proper schema and indexes."""
    if engine.dialect.name != "sqlite":
        return

    connection = engine.raw_connection()
    cursor = connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=OFF")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(80) NOT NULL,
                password_hash VARCHAR(256) NOT NULL,
                full_name VARCHAR(120),
                mobile_number VARCHAR(15),
                email VARCHAR(120),
                district VARCHAR(80),
                preferred_language VARCHAR(10) NOT NULL DEFAULT 'kn',
                created_at DATETIME NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                role VARCHAR(32) NOT NULL DEFAULT 'farmer'
            )
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_username ON users (username)")

        # Migration: check existing columns and safely add any missing farmer registration columns
        cursor.execute("PRAGMA table_info(users)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        columns_to_add = [
            ("full_name", "VARCHAR(120)"),
            ("mobile_number", "VARCHAR(15)"),
            ("email", "VARCHAR(120)"),
            ("district", "VARCHAR(80)"),
            ("preferred_language", "VARCHAR(10) NOT NULL DEFAULT 'kn'"),
        ]
        for col_name, col_type in columns_to_add:
            if col_name not in existing_cols:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")

        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_mobile_number ON users (mobile_number) WHERE mobile_number IS NOT NULL")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON users (email) WHERE email IS NOT NULL")

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_token VARCHAR(128) NOT NULL,
                user_id INTEGER NOT NULL,
                created_at DATETIME NOT NULL,
                expires_at DATETIME NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        """)
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_user_sessions_session_token ON user_sessions (session_token)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions (user_id)")
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
        connection.close()

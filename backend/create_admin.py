"""CLI utility for creating an initial admin user in Agro Mitra."""
import getpass
import sys
from pathlib import Path

# Ensure backend package can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent))

from auth import create_user
from database import Base, SessionLocal, engine
from migrations import migrate_auth_tables


def main() -> None:
    print("========================================")
    print("   Agro Mitra — Admin Account Setup     ")
    print("========================================")

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    migrate_auth_tables(engine)

    username = input("Enter admin username: ").strip()
    if not username or len(username) < 3:
        print("Error: Username must be at least 3 characters long.")
        sys.exit(1)

    password = getpass.getpass("Enter admin password: ")
    if len(password) < 6:
        print("Error: Password must be at least 6 characters long.")
        sys.exit(1)

    confirm_password = getpass.getpass("Confirm admin password: ")
    if password != confirm_password:
        print("Error: Passwords do not match.")
        sys.exit(1)

    with SessionLocal() as db:
        try:
            user = create_user(db, username=username, password=password, role="admin")
            print(f"\n[OK] Admin user '{user.username}' created successfully (ID: {user.id})!")
        except ValueError as exc:
            print(f"\n[Error] Failed to create user: {exc}")
            sys.exit(1)


if __name__ == "__main__":
    main()


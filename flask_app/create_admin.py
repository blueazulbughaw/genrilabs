"""
GENRI LABS — CREATE ADMIN USER

Run once (locally or over SSH on the server) to create your login.
The password is bcrypt-hashed before it touches the database —
the plaintext is never stored anywhere.

Usage:
    python create_admin.py
"""
import getpass

import bcrypt

from db import execute, query
from app import app  # gives us an app context for the DB helpers


def main():
    username = input("Admin username: ").strip()
    password = getpass.getpass("Password (typing is hidden): ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match. Nothing created.")
        return
    if len(password) < 12:
        print("Use at least 12 characters. Nothing created.")
        return

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()

    with app.app_context():
        existing = query(
            "SELECT id FROM admin_users WHERE username = %s", (username,), one=True
        )
        if existing:
            execute(
                "UPDATE admin_users SET password_hash = %s WHERE username = %s",
                (hashed, username),
            )
            print(f"Updated password for '{username}'.")
        else:
            execute(
                "INSERT INTO admin_users (username, password_hash) VALUES (%s, %s)",
                (username, hashed),
            )
            print(f"Created admin user '{username}'.")


if __name__ == "__main__":
    main()

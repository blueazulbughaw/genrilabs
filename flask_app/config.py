"""
GENRI LABS — CONFIGURATION
All secrets come from environment variables (set in cPanel's
Python App > Environment Variables, or a local .env file for dev).
Nothing sensitive is ever committed to the repo.
"""
import os
from datetime import timedelta

# Load .env in local development. On cPanel, Passenger injects
# the env vars you set in the Python App UI, so this is a no-op there.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class Config:
    # --- JWT ---
    # Generate with:  python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET = os.environ["JWT_SECRET"]          # required — app won't start without it
    JWT_ALGORITHM = "HS256"
    JWT_LIFETIME = timedelta(minutes=30)           # session length before auto-logout
    JWT_COOKIE_NAME = "gl_token"

    # --- Redirect target when a JWT is missing/expired ---
    # The requirement: expired sessions land on the public site.
    PUBLIC_SITE_URL = os.environ.get("PUBLIC_SITE_URL", "https://genrilabs.com")

    # --- MySQL (cPanel-created database + user) ---
    DB_HOST = os.environ.get("DB_HOST", "localhost")   # 'localhost' on shared hosting
    DB_NAME = os.environ["DB_NAME"]                     # e.g. cpaneluser_genrilabs
    DB_USER = os.environ["DB_USER"]                     # e.g. cpaneluser_gladmin
    DB_PASSWORD = os.environ["DB_PASSWORD"]

    # --- Login rate limiting ---
    MAX_LOGIN_ATTEMPTS = 5          # failures allowed...
    LOCKOUT_WINDOW_MINUTES = 15     # ...within this window, per IP

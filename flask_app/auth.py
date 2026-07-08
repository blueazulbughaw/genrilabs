"""
GENRI LABS — JWT AUTHENTICATION

How the flow works:
  1. POST /api/login with username+password → verified against the
     bcrypt hash in MySQL → a signed JWT is set as an httpOnly cookie.
  2. Every protected route runs through @login_required, which
     validates the cookie's JWT signature and expiry.
  3. On a missing/expired/invalid token:
       - page routes  → redirect to the PUBLIC landing site (the requirement)
       - /api routes  → 401 JSON (dashboard.js catches this and redirects)

Why httpOnly cookie instead of localStorage: JS can't read it, so a
stray XSS can't exfiltrate the token. The expiry timestamp is exposed
separately in a readable cookie so the dashboard can show a countdown.
"""
import datetime
from functools import wraps

import jwt
from flask import request, redirect, jsonify, make_response

from config import Config


def issue_token(username: str):
    """Create a signed JWT and return (token, expiry_datetime)."""
    now = datetime.datetime.now(datetime.timezone.utc)
    expires = now + Config.JWT_LIFETIME
    payload = {
        "sub": username,
        "iat": now,
        "exp": expires,
    }
    token = jwt.encode(payload, Config.JWT_SECRET, algorithm=Config.JWT_ALGORITHM)
    return token, expires


def set_auth_cookies(response, token, expires):
    """Attach the auth cookie (httpOnly) + a readable expiry cookie."""
    response.set_cookie(
        Config.JWT_COOKIE_NAME,
        token,
        httponly=True,      # JS cannot read the token
        secure=True,        # HTTPS only (cPanel AutoSSL gives you HTTPS free)
        samesite="Lax",
        expires=expires,
    )
    # Non-sensitive: just the expiry epoch, so dashboard.js can count down.
    response.set_cookie(
        "gl_token_exp",
        str(int(expires.timestamp())),
        secure=True,
        samesite="Lax",
        expires=expires,
    )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(Config.JWT_COOKIE_NAME)
    response.delete_cookie("gl_token_exp")
    return response


def _validate_request_token():
    """Return the decoded payload, or None if missing/expired/invalid."""
    token = request.cookies.get(Config.JWT_COOKIE_NAME)
    if not token:
        return None
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=[Config.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def login_required(view):
    """
    Decorator for protected routes.
    Expired/invalid session → public landing page (pages) or 401 (API).
    """
    @wraps(view)
    def wrapped(*args, **kwargs):
        payload = _validate_request_token()
        if payload is None:
            if request.path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            # THE requirement: expired JWT → back to the public site.
            resp = make_response(redirect(Config.PUBLIC_SITE_URL))
            return clear_auth_cookies(resp)
        request.jwt_payload = payload  # available to the view if needed
        return view(*args, **kwargs)
    return wrapped

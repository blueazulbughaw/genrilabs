"""
GENRI LABS — ADMIN APP (Flask)

Route map (paths are relative to wherever Passenger mounts the app —
see DEPLOYMENT.md; e.g. mounting at /gl-admin makes "/" = /gl-admin):

  GET  /              → login page (never linked from the public site)
  POST /api/login     → verify credentials, issue JWT cookie
  GET  /dashboard     → protected dashboard (redirects to public site if JWT invalid)
  GET  /api/metrics   → protected JSON feed for the Chart.js charts
  POST /api/logout    → clear cookies, redirect to public site

Security notes:
  - Passwords are bcrypt-hashed (see create_admin.py to make your user).
  - Login is rate-limited: 5 failures per IP per 15 minutes.
  - The JWT lives in an httpOnly Secure cookie (see auth.py).
"""
import datetime

import bcrypt
from flask import Flask, render_template, request, jsonify, redirect, make_response

from config import Config
from db import query, execute, close_db
from auth import (
    issue_token,
    set_auth_cookies,
    clear_auth_cookies,
    login_required,
)

app = Flask(__name__)
app.teardown_appcontext(close_db)


# ---------------------------------------------------------------
# LOGIN PAGE  (the "hidden" route — never linked anywhere public)
# ---------------------------------------------------------------
@app.route("/")
def login_page():
    return render_template("login.html")


# ---------------------------------------------------------------
# LOGIN API
# ---------------------------------------------------------------
def _too_many_attempts(ip: str) -> bool:
    """True if this IP has exceeded the failure limit inside the window."""
    row = query(
        """
        SELECT COUNT(*) AS n FROM login_attempts
        WHERE ip_address = %s
          AND succeeded = 0
          AND attempted_at > (NOW() - INTERVAL %s MINUTE)
        """,
        (ip, Config.LOCKOUT_WINDOW_MINUTES),
        one=True,
    )
    return row["n"] >= Config.MAX_LOGIN_ATTEMPTS


def _record_attempt(ip: str, succeeded: bool):
    execute(
        "INSERT INTO login_attempts (ip_address, succeeded) VALUES (%s, %s)",
        (ip, int(succeeded)),
    )


@app.route("/api/login", methods=["POST"])
def api_login():
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "?").split(",")[0].strip()

    if _too_many_attempts(ip):
        return jsonify({"error": "Too many attempts. Try again later."}), 429

    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    user = query(
        "SELECT username, password_hash FROM admin_users WHERE username = %s",
        (username,),
        one=True,
    )

    # bcrypt.checkpw runs even shape-wise the same on bad usernames
    # (against a dummy hash) so response timing doesn't reveal
    # whether the username exists.
    dummy = b"$2b$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpQ1sBqzq0aYQ0lZ0aY0aY0aY0aY0"
    stored = user["password_hash"].encode() if user else dummy
    ok = bcrypt.checkpw(password.encode(), stored) and user is not None

    _record_attempt(ip, ok)

    if not ok:
        return jsonify({"error": "Invalid credentials."}), 401

    token, expires = issue_token(username)
    resp = make_response(jsonify({"ok": True, "redirect": "dashboard"}))
    return set_auth_cookies(resp, token, expires)


# ---------------------------------------------------------------
# DASHBOARD  (protected — expired JWT redirects to public site)
# ---------------------------------------------------------------
@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html", public_site=Config.PUBLIC_SITE_URL)


# ---------------------------------------------------------------
# METRICS API  (feeds Chart.js — extensible by design)
# ---------------------------------------------------------------
@app.route("/api/metrics")
@login_required
def api_metrics():
    """
    Returns every metric series grouped by key:
      { "series": { "hours_logged": [{label, value}, ...],
                    "outreach_sent": [...] },
        "totals": { "hours_logged": 37.5, ... } }

    To add a NEW chart later: insert rows with a new metric_key in
    the metrics table — no backend changes needed. dashboard.js
    decides which keys render where.
    """
    rows = query(
        """
        SELECT metric_key, label, value, recorded_at
        FROM metrics
        ORDER BY recorded_at ASC
        """
    )
    series, totals = {}, {}
    for r in rows:
        key = r["metric_key"]
        series.setdefault(key, []).append(
            {"label": r["label"], "value": float(r["value"])}
        )
        totals[key] = totals.get(key, 0) + float(r["value"])
    return jsonify({"series": series, "totals": totals})


# ---------------------------------------------------------------
# LOGOUT
# ---------------------------------------------------------------
@app.route("/api/logout", methods=["POST"])
@login_required
def api_logout():
    resp = make_response(jsonify({"ok": True, "redirect": Config.PUBLIC_SITE_URL}))
    return clear_auth_cookies(resp)


# ---------------------------------------------------------------
# Local development only. On cPanel, Passenger imports `app`
# via passenger_wsgi.py and this block never runs.
# ---------------------------------------------------------------
if __name__ == "__main__":
    app.run(debug=True, port=5000)

"""
GENRI LABS — ADMIN APP (Flask)

Route map (paths are relative to wherever Passenger mounts the app —
see DEPLOYMENT.md; e.g. mounting at /gl-admin makes "/" = /gl-admin):

  GET  /              → login page (never linked from the public site)
  POST /api/login     → verify credentials, issue JWT cookie
  GET  /dashboard     → protected dashboard (redirects to public site if JWT invalid)
  GET  /api/metrics   → protected JSON feed for the Chart.js charts
  GET  /projects      → protected editor for the landing page's "Work" section
  GET/POST /api/projects, PUT/DELETE /api/projects/<id>
                      → project CRUD; every write re-publishes
                        public_html/data/projects.json (see projects.py)
  GET  /worklog       → protected OPT work log (weekly hours vs. the 20-hr minimum)
  GET/POST /api/worklog, PUT/DELETE /api/worklog/<id>
                      → work-session CRUD; saving from the admin approves a row
  GET  /api/worklog/export.xlsx → Excel copy for the OPT evidence folder
  POST /api/worklog/ingest → Claude posts DRAFT entries here with the
                        WORKLOG_API_KEY bearer token (no JWT, no hours)
  POST /api/logout    → clear cookies, redirect to public site

Security notes:
  - Passwords are bcrypt-hashed (see create_admin.py to make your user).
  - Login is rate-limited: 5 failures per IP per 15 minutes.
  - The JWT lives in an httpOnly Secure cookie (see auth.py).
"""
import datetime
import hmac

import bcrypt
from flask import Flask, Response, render_template, request, jsonify, redirect, make_response, url_for

from config import Config
from db import query, execute, close_db
import projects
import worklog
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
    # Absolute path via url_for (honors Passenger's mount prefix) so this
    # works regardless of whether the browser's URL had a trailing slash.
    resp = make_response(jsonify({"ok": True, "redirect": url_for("dashboard")}))
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
# PROJECTS  (edits the public "Real products, shipped" section)
# ---------------------------------------------------------------
@app.route("/projects")
@login_required
def projects_page():
    return render_template("projects.html", public_site=Config.PUBLIC_SITE_URL)


def _publish_response(status=200, **extra):
    """Re-publish the public JSON, then return the fresh list."""
    try:
        published = projects.publish()
    except OSError as e:
        app.logger.exception("projects.json publish failed")
        return jsonify({"error": f"Saved, but publishing to the site failed: {e}"}), 500
    return jsonify({"projects": projects.list_projects(), "published": published, **extra}), status


@app.route("/api/projects", methods=["GET"])
@login_required
def api_projects_list():
    return jsonify({"projects": projects.list_projects()})


@app.route("/api/projects", methods=["POST"])
@login_required
def api_projects_create():
    fields, error = projects.clean(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    new_id = projects.create(fields)
    return _publish_response(201, id=new_id)


@app.route("/api/projects/<int:project_id>", methods=["PUT"])
@login_required
def api_projects_update(project_id):
    fields, error = projects.clean(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    projects.update(project_id, fields)
    return _publish_response()


@app.route("/api/projects/publish", methods=["POST"])
@login_required
def api_projects_publish():
    return _publish_response()


@app.route("/api/projects/<int:project_id>", methods=["DELETE"])
@login_required
def api_projects_delete(project_id):
    projects.delete(project_id)
    return _publish_response()


# ---------------------------------------------------------------
# WORK LOG  (OPT timesheet: weekly hours vs. the 20-hour minimum)
# ---------------------------------------------------------------
@app.route("/worklog")
@login_required
def worklog_page():
    return render_template(
        "worklog.html",
        public_site=Config.PUBLIC_SITE_URL,
        categories=worklog.CATEGORIES,
        minimum=worklog.WEEKLY_MINIMUM,
    )


def _worklog_response(status=200, **extra):
    sessions = worklog.list_sessions()
    return jsonify({"sessions": sessions, "weeks": worklog.weekly_summary(sessions), **extra}), status


@app.route("/api/worklog", methods=["GET"])
@login_required
def api_worklog_list():
    return _worklog_response()


@app.route("/api/worklog", methods=["POST"])
@login_required
def api_worklog_create():
    fields, error = worklog.clean(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    new_id = worklog.create(fields)
    return _worklog_response(201, id=new_id)


@app.route("/api/worklog/<int:session_id>", methods=["PUT"])
@login_required
def api_worklog_update(session_id):
    fields, error = worklog.clean(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    worklog.update(session_id, fields)
    return _worklog_response()


@app.route("/api/worklog/<int:session_id>", methods=["DELETE"])
@login_required
def api_worklog_delete(session_id):
    worklog.delete(session_id)
    return _worklog_response()


@app.route("/api/worklog/export.xlsx")
@login_required
def api_worklog_export():
    filename = f"Genri_Labs_OPT_Work_Log_{datetime.date.today().isoformat()}.xlsx"
    return Response(
        worklog.export_xlsx(),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.route("/api/worklog/ingest", methods=["POST"])
def api_worklog_ingest():
    """
    Machine endpoint for Claude: saves entries as DRAFTS with no hours.
    Auth is a bearer key (WORKLOG_API_KEY), not the admin JWT. With no
    key configured the endpoint doesn't exist.
    """
    if not Config.WORKLOG_API_KEY:
        return jsonify({"error": "not found"}), 404
    sent = request.headers.get("Authorization", "")
    sent = sent[len("Bearer "):].strip() if sent.startswith("Bearer ") else ""
    if not hmac.compare_digest(sent.encode(), Config.WORKLOG_API_KEY.encode()):
        return jsonify({"error": "unauthorized"}), 401

    data = request.get_json(silent=True) or {}
    entries = data.get("entries") if isinstance(data.get("entries"), list) else [data]
    if not 1 <= len(entries) <= 20:
        return jsonify({"error": "Send 1 to 20 entries."}), 400

    cleaned = []
    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            return jsonify({"error": f"Entry {i + 1} must be an object."}), 400
        entry = {**entry, "hours": None}  # hours only ever come from Glad
        fields, error = worklog.clean(entry, require_hours=False)
        if error:
            return jsonify({"error": f"Entry {i + 1}: {error}"}), 400
        cleaned.append(fields)
    ids = [worklog.create(f, status="draft", source="claude") for f in cleaned]
    return jsonify({"ok": True, "ids": ids, "status": "draft"}), 201


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

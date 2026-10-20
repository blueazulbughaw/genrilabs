"""
GENRI LABS — PROJECTS (the "Real products, shipped" section)

The admin edits projects in MySQL; every change re-publishes a static
JSON file into the public site (PUBLIC_HTML_DIR/data/projects.json)
that landing.js renders. The public site never calls this app, so the
admin path stays unlinked from public_html.

The table creates (and seeds) itself on first use, so deploying this
needs no manual phpMyAdmin step. schema.sql carries the same DDL.
"""
import json
import os
import tempfile
from urllib.parse import urlparse

from config import Config
from db import query, execute

KINDS = ("client", "lab")

_CREATE_SQL = """
CREATE TABLE IF NOT EXISTS projects (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(120)  NOT NULL,
    url         VARCHAR(255)  NOT NULL,
    domain      VARCHAR(120)  NOT NULL DEFAULT '',
    description VARCHAR(600)  NOT NULL DEFAULT '',
    kind        VARCHAR(16)   NOT NULL DEFAULT 'client',
    sort_order  INT           NOT NULL DEFAULT 0,
    is_visible  TINYINT(1)    NOT NULL DEFAULT 1,
    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
"""

# What the landing page showed before the admin existed.
_SEED = [
    ("Shiloh Living App", "https://shilohliving.app/", "shilohliving.app",
     "A property management platform for landlords and tenants — properties, leases, "
     "bills, payments, and tenant communication in one place.", "client", 10),
    ("Secret Santa", "https://secretsanta.glad.codes/", "secretsanta.glad.codes",
     "A family gift-exchange app built for every age — wish lists, name draws, and "
     "sign-in by text code, installable on any phone.", "lab", 20),
    ("AI Ecosystem", "https://aiecosystem.gladgallivants.com/", "aiecosystem.gladgallivants.com",
     "A searchable intelligence database tracking AI companies, models, benchmarks, "
     "and research for professionals and builders.", "lab", 30),
]

_ready = False


def ensure_table():
    """Create + seed the projects table once per process."""
    global _ready
    if _ready:
        return
    execute(_CREATE_SQL)
    if query("SELECT COUNT(*) AS n FROM projects", one=True)["n"] == 0:
        for row in _SEED:
            execute(
                "INSERT INTO projects (title, url, domain, description, kind, sort_order) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                row,
            )
    _ready = True


def list_projects(visible_only=False):
    ensure_table()
    sql = ("SELECT id, title, url, domain, description, kind, sort_order, is_visible "
           "FROM projects")
    if visible_only:
        sql += " WHERE is_visible = 1"
    return query(sql + " ORDER BY sort_order ASC, id ASC")


def clean(data):
    """Validate a project payload. Returns (fields, error_message)."""
    title = (data.get("title") or "").strip()
    url = (data.get("url") or "").strip()
    domain = (data.get("domain") or "").strip()
    description = (data.get("description") or "").strip()
    kind = (data.get("kind") or "client").strip().lower()

    if not title:
        return None, "Title is required."
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None, "URL must start with http:// or https://."
    if kind not in KINDS:
        return None, "Type must be client or lab."
    try:
        sort_order = int(data.get("sort_order") or 0)
    except (TypeError, ValueError):
        return None, "Order must be a whole number."
    if len(title) > 120 or len(url) > 255 or len(domain) > 120 or len(description) > 600:
        return None, "One of the fields is too long."

    return {
        "title": title,
        "url": url,
        "domain": domain or parsed.netloc,
        "description": description,
        "kind": kind,
        "sort_order": sort_order,
        "is_visible": 1 if data.get("is_visible", True) else 0,
    }, None


def create(fields):
    ensure_table()
    return execute(
        "INSERT INTO projects (title, url, domain, description, kind, sort_order, is_visible) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s)",
        (fields["title"], fields["url"], fields["domain"], fields["description"],
         fields["kind"], fields["sort_order"], fields["is_visible"]),
    )


def update(project_id, fields):
    ensure_table()
    execute(
        "UPDATE projects SET title = %s, url = %s, domain = %s, description = %s, "
        "kind = %s, sort_order = %s, is_visible = %s WHERE id = %s",
        (fields["title"], fields["url"], fields["domain"], fields["description"],
         fields["kind"], fields["sort_order"], fields["is_visible"], project_id),
    )


def delete(project_id):
    ensure_table()
    execute("DELETE FROM projects WHERE id = %s", (project_id,))


def publish():
    """Write the visible projects to the public site's JSON file (atomically)."""
    items = [
        {k: p[k] for k in ("title", "url", "domain", "description", "kind")}
        for p in list_projects(visible_only=True)
    ]
    out_dir = os.path.join(Config.PUBLIC_HTML_DIR, "data")
    os.makedirs(out_dir, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=out_dir, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump({"projects": items}, f, ensure_ascii=False, indent=2)
    os.chmod(tmp, 0o644)  # mkstemp creates 0600; the web server must read it
    os.replace(tmp, os.path.join(out_dir, "projects.json"))
    return len(items)

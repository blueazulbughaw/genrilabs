"""
GENRI LABS — DATABASE HELPER
Uses PyMySQL (pure Python — no compiled extensions, which matters
on shared hosting where you can't install system packages).

Pattern: open a connection per request via get_db(), Flask tears
it down automatically. Every query goes through parameterized
statements — never string-format SQL.
"""
import pymysql
from flask import g
from config import Config


def get_db():
    """Return the request-scoped DB connection, creating it if needed."""
    if "db" not in g:
        g.db = pymysql.connect(
            host=Config.DB_HOST,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD,
            database=Config.DB_NAME,
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor,  # rows come back as dicts
            autocommit=True,
        )
    return g.db


def close_db(_exc=None):
    """Registered with Flask's teardown — closes the connection after each request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def query(sql, params=None, one=False):
    """Convenience wrapper: run a SELECT, return rows (or a single row)."""
    with get_db().cursor() as cur:
        cur.execute(sql, params or ())
        rows = cur.fetchall()
    return (rows[0] if rows else None) if one else rows


def execute(sql, params=None):
    """Convenience wrapper: run an INSERT/UPDATE/DELETE."""
    with get_db().cursor() as cur:
        cur.execute(sql, params or ())
        return cur.lastrowid

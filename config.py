import os
from dotenv import load_dotenv
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

load_dotenv()

# --- Environment ---
# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/ai_lead_machine")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "hello@youragency.com")
FROM_NAME = os.getenv("FROM_NAME", "Web Agency")
BASE_URL = os.getenv("BASE_URL", "http://localhost:3000")
PORT = int(os.getenv("PORT", "3000"))
DAILY_EMAIL_LIMIT = int(os.getenv("DAILY_EMAIL_LIMIT", "30"))

# --- Database Pool ---
# db_pool = pool.ThreadedConnectionPool(1, 10, DATABASE_URL)

db_pool = pool.ThreadedConnectionPool(
    minconn=1,
    maxconn=10,
    dsn=DATABASE_URL,
)

@contextmanager
def get_db():
    """Get a database connection from the pool."""
    conn = db_pool.getconn()
    conn.autocommit = True
    try:
        yield conn
    finally:
        db_pool.putconn(conn)


def query(sql, params=None):
    """Execute a query and return all rows."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            if cur.description:
                columns = [d[0] for d in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
            return []


def query_one(sql, params=None):
    """Execute a query and return one row."""
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql, params=None):
    """Execute a query without returning rows."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)

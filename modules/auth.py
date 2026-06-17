import os
import hashlib
import secrets
import json
import time
import base64
from config import query, execute

# Simple JWT-like token (no external dependency needed)
SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
TOKEN_EXPIRY = 7 * 24 * 3600  # 7 days


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}:{hashed.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split(":")
        check = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
        return check.hex() == hashed
    except Exception:
        return False


def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": int(time.time()) + TOKEN_EXPIRY,
    }
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig = hashlib.sha256((data + SECRET_KEY).encode()).hexdigest()[:32]
    return f"{data}.{sig}"


def verify_token(token: str) -> dict | None:
    try:
        data, sig = token.rsplit(".", 1)
        expected = hashlib.sha256((data + SECRET_KEY).encode()).hexdigest()[:32]
        if sig != expected:
            return None
        payload = json.loads(base64.urlsafe_b64decode(data))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


def get_user_by_email(email: str) -> dict | None:
    users = query("SELECT * FROM users WHERE email = %s", (email,))
    return users[0] if users else None


def create_user(email: str, password: str, name: str = "") -> dict:
    hashed = hash_password(password)
    execute("""
        INSERT INTO users (email, password_hash, name)
        VALUES (%s, %s, %s)
        ON CONFLICT (email) DO NOTHING
    """, (email, hashed, name))
    return get_user_by_email(email)


def setup_default_admin():
    """Create default admin if no users exist."""
    users = query("SELECT count(*) as cnt FROM users")
    if users and int(users[0]["cnt"]) == 0:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@leadmachine.ai")
        admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
        admin_name = os.getenv("ADMIN_NAME", "Admin")
        create_user(admin_email, admin_pass, admin_name)
        print(f"  ✓ Default admin created: {admin_email} / {admin_pass}")
        print(f"    Change these in .env: ADMIN_EMAIL, ADMIN_PASSWORD")

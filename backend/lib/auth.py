"""Auth primitives: password hashing, httpOnly cookie sessions and RBAC dependencies."""

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from fastapi import Depends, HTTPException, Request, Response

from lib.db import db

SESSION_COOKIE = "lany_session"
SESSION_DAYS = 7
_ITERATIONS = 120_000

ROLE_ADMIN = "admin"
ROLE_STAFF = "funcionario"
ROLE_CUSTOMER = "cliente"
STAFF_ROLES = (ROLE_ADMIN, ROLE_STAFF)


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS).hex()
    return f"pbkdf2_sha256${_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(iterations)).hex()
        return hmac.compare_digest(check, digest)
    except Exception:
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def create_session(response: Response, user: dict[str, Any]) -> str:
    token = secrets.token_urlsafe(32)
    await db["sessions"].insert_one(
        {
            "id": str(uuid.uuid4()),
            "token": token,
            "user_id": user["id"],
            "created_at": _now(),
            "expires_at": _now() + timedelta(days=SESSION_DAYS),
        }
    )
    secure = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=SESSION_DAYS * 86400,
        path="/",
    )
    return token


async def destroy_session(request: Request, response: Response) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        await db["sessions"].delete_many({"token": token})
    response.delete_cookie(SESSION_COOKIE, path="/")


def public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "customer_id": user.get("customer_id"),
        "active": user.get("active", True),
        "created_at": user.get("created_at"),
    }


async def optional_user(request: Request) -> dict[str, Any] | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    session = await db["sessions"].find_one({"token": token})
    if not session:
        return None
    expires = session.get("expires_at")
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < _now():
            await db["sessions"].delete_many({"token": token})
            return None
    user = await db["users"].find_one({"id": session["user_id"]}, {"_id": 0})
    if not user or not user.get("active", True):
        return None
    return user


async def current_user(request: Request) -> dict[str, Any]:
    user = await optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return user


def require_roles(*roles: str):
    allowed: Iterable[str] = roles

    async def _dep(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail="Permissão insuficiente")
        return user

    return _dep


require_staff = require_roles(ROLE_ADMIN, ROLE_STAFF)
require_admin = require_roles(ROLE_ADMIN)

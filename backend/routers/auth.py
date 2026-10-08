"""Auth routes — httpOnly cookie sessions, registration and password recovery."""

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import (
    ROLE_CUSTOMER,
    create_session,
    current_user,
    destroy_session,
    hash_password,
    public_user,
    require_admin,
    verify_password,
)
from lib.db import db
from models.schemas import (
    Customer,
    LoginInput,
    OkResponse,
    PasswordResetConfirm,
    PasswordResetInput,
    RegisterInput,
    User,
    UserCreate,
    UserUpdate,
)
from services.notification_service import log_audit

router = APIRouter(prefix="/auth", tags=["auth"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/login", response_model=User)
async def login(payload: LoginInput, request: Request, response: Response):
    user = await db["users"].find_one({"email": payload.email.lower()}, {"_id": 0})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Usuário desativado")
    await create_session(response, user)
    await log_audit(
        user=user,
        action="login",
        entity="user",
        entity_id=user["id"],
        ip=request.client.host if request.client else "",
    )
    return User(**public_user(user))


@router.post("/register", response_model=User)
async def register(payload: RegisterInput, request: Request, response: Response):
    email = payload.email.lower()
    if await db["users"].find_one({"email": email}):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")

    customer = Customer(
        name=payload.name,
        email=email,
        phone=payload.phone,
        whatsapp=payload.phone,
        document=payload.document,
    )
    await db["customers"].insert_one(customer.model_dump())

    user = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": ROLE_CUSTOMER,
        "customer_id": customer.id,
        "active": True,
        "created_at": _now(),
    }
    await db["users"].insert_one(dict(user))
    await create_session(response, user)
    await log_audit(user=user, action="register", entity="user", entity_id=user["id"])
    return User(**public_user(user))


@router.post("/logout", response_model=OkResponse)
async def logout(request: Request, response: Response):
    await destroy_session(request, response)
    return OkResponse(message="Sessão encerrada")


@router.get("/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    return User(**public_user(user))


@router.post("/password-reset", response_model=OkResponse)
async def password_reset(payload: PasswordResetInput):
    """Issues a recovery token. Never reveals whether the e-mail exists."""
    user = await db["users"].find_one({"email": payload.email.lower()}, {"_id": 0})
    if user:
        token = secrets.token_urlsafe(24)
        await db["users"].update_one(
            {"id": user["id"]},
            {"$set": {"reset_token": token, "reset_expires": _now() + timedelta(hours=1)}},
        )
        await log_audit(user=user, action="password_reset_request", entity="user", entity_id=user["id"])
        return OkResponse(
            message="Se o e-mail existir, enviaremos as instruções de recuperação.",
        )
    return OkResponse(message="Se o e-mail existir, enviaremos as instruções de recuperação.")


@router.post("/password-reset/confirm", response_model=OkResponse)
async def password_reset_confirm(payload: PasswordResetConfirm):
    user = await db["users"].find_one({"reset_token": payload.token}, {"_id": 0})
    expires = user.get("reset_expires") if user else None
    if expires is not None and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not user or not expires or expires < _now():
        raise HTTPException(status_code=400, detail="Token inválido ou expirado")
    await db["users"].update_one(
        {"id": user["id"]},
        {
            "$set": {"password_hash": hash_password(payload.password)},
            "$unset": {"reset_token": "", "reset_expires": ""},
        },
    )
    await log_audit(user=user, action="password_reset", entity="user", entity_id=user["id"])
    return OkResponse(message="Senha redefinida com sucesso")


# ------------------------------------------------------------------ user admin
@router.get("/users", response_model=list[User])
async def list_users(_: dict = Depends(require_admin)):
    users = await db["users"].find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [User(**public_user(u)) for u in users]


@router.post("/users", response_model=User)
async def create_user(payload: UserCreate, admin: dict = Depends(require_admin)):
    if await db["users"].find_one({"email": payload.email.lower()}):
        raise HTTPException(status_code=409, detail="E-mail já cadastrado")
    user = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "customer_id": None,
        "active": True,
        "created_at": _now(),
    }
    await db["users"].insert_one(dict(user))
    await log_audit(
        user=admin, action="create", entity="user", entity_id=user["id"], details=payload.email
    )
    return User(**public_user(user))


@router.patch("/users/{user_id}", response_model=User)
async def update_user(user_id: str, payload: UserUpdate, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items() if k != "password"}
    if payload.password:
        update["password_hash"] = hash_password(payload.password)
    if update:
        await db["users"].update_one({"id": user_id}, {"$set": update})
    user = await db["users"].find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    await log_audit(user=admin, action="update", entity="user", entity_id=user_id)
    return User(**public_user(user))

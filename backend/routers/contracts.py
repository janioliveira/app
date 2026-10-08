"""Contracts — listing, viewing and the customer's digital acceptance."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from lib.auth import ROLE_CUSTOMER, current_user, optional_user, require_staff
from lib.db import db
from models.schemas import Contract, ContractAcceptInput
from services.contract_service import generate_for_reservation
from services.notification_service import log_audit, notify

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("", response_model=list[Contract])
async def list_contracts(user: dict = Depends(current_user)):
    query: dict = {}
    if user["role"] == ROLE_CUSTOMER:
        query["customer_id"] = user.get("customer_id")
    docs = await db["contracts"].find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Contract(**d) for d in docs]


@router.get("/{contract_id}", response_model=Contract)
async def get_contract(contract_id: str, user: dict | None = Depends(optional_user)):
    doc = await db["contracts"].find_one({"id": contract_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    if user and user["role"] == ROLE_CUSTOMER and doc["customer_id"] != user.get("customer_id"):
        raise HTTPException(status_code=403, detail="Acesso negado ao contrato de outro cliente")
    return Contract(**doc)


@router.post("/reservation/{reservation_id}", response_model=Contract)
async def generate_contract(reservation_id: str, user: dict = Depends(require_staff)):
    reservation = await db["reservations"].find_one({"id": reservation_id}, {"_id": 0})
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva não encontrada")
    if reservation["status"] not in ("confirmada", "finalizada"):
        raise HTTPException(
            status_code=409, detail="O contrato é gerado após a confirmação do pagamento PIX"
        )
    customer = await db["customers"].find_one({"id": reservation["customer_id"]}, {"_id": 0}) or {}
    doc = await generate_for_reservation(reservation, customer)
    await log_audit(user=user, action="generate", entity="contract", entity_id=doc["id"])
    return Contract(**doc)


@router.post("/{contract_id}/accept", response_model=Contract)
async def accept_contract(
    contract_id: str,
    payload: ContractAcceptInput,
    request: Request,
    user: dict | None = Depends(optional_user),
):
    doc = await db["contracts"].find_one({"id": contract_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")
    if user and user["role"] == ROLE_CUSTOMER and doc["customer_id"] != user.get("customer_id"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    if doc["status"] == "aceito":
        return Contract(**doc)  # idempotent
    if not payload.agreed:
        raise HTTPException(status_code=422, detail="É necessário concordar com os termos")

    ip = request.client.host if request.client else ""
    now = datetime.now(timezone.utc)
    await db["contracts"].update_one(
        {"id": contract_id},
        {
            "$set": {
                "status": "aceito",
                "accepted_at": now,
                "accepted_by": (user or {}).get("name") or payload.signature_name,
                "accepted_ip": ip,
                "signature_name": payload.signature_name,
            }
        },
    )
    await db["reservations"].update_one(
        {"id": doc["reservation_id"]}, {"$set": {"status": "finalizada", "updated_at": now}}
    )
    await notify(
        title="Contrato aceito",
        message=f"Contrato {doc['number']} assinado por {payload.signature_name}.",
        kind="success",
        event="contrato_aceito",
        reservation_id=doc["reservation_id"],
        customer_id=doc["customer_id"],
        dedupe_key=f"contrato_aceito:{contract_id}",
    )
    await log_audit(
        user=user,
        action="accept",
        entity="contract",
        entity_id=contract_id,
        details=f"assinado por {payload.signature_name} versão {doc['version']}",
        ip=ip,
    )
    updated = await db["contracts"].find_one({"id": contract_id}, {"_id": 0})
    return Contract(**updated)

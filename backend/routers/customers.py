"""Customers — staff CRUD plus history. Customers can only ever see their own record."""

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import ROLE_CUSTOMER, current_user, require_staff
from lib.db import db
from models.schemas import Customer, CustomerInput, OkResponse
from services.notification_service import log_audit
from services.whatsapp_service import normalize_br_phone

router = APIRouter(prefix="/customers", tags=["customers"])


def _normalize(payload: CustomerInput) -> dict:
    data = payload.model_dump()
    for field in ("phone", "whatsapp"):
        if data.get(field):
            data[field] = normalize_br_phone(data[field]) or data[field]
    return data


@router.get("", response_model=list[Customer])
async def list_customers(
    search: str = Query(default=""), user: dict = Depends(current_user)
):
    if user["role"] == ROLE_CUSTOMER:
        docs = await db["customers"].find({"id": user.get("customer_id")}, {"_id": 0}).to_list(1)
        return [Customer(**d) for d in docs]
    query: dict = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"document": {"$regex": search, "$options": "i"}},
            {"whatsapp": {"$regex": search, "$options": "i"}},
        ]
    docs = await db["customers"].find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    return [Customer(**d) for d in docs]


@router.post("", response_model=Customer)
async def create_customer(payload: CustomerInput, user: dict = Depends(require_staff)):
    customer = Customer(**_normalize(payload))
    await db["customers"].insert_one(customer.model_dump())
    await log_audit(
        user=user, action="create", entity="customer", entity_id=customer.id, details=customer.name
    )
    return customer


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(customer_id: str, user: dict = Depends(current_user)):
    if user["role"] == ROLE_CUSTOMER and user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Acesso negado aos dados de outro cliente")
    doc = await db["customers"].find_one({"id": customer_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return Customer(**doc)


@router.get("/{customer_id}/history")
async def customer_history(customer_id: str, user: dict = Depends(current_user)):
    if user["role"] == ROLE_CUSTOMER and user.get("customer_id") != customer_id:
        raise HTTPException(status_code=403, detail="Acesso negado aos dados de outro cliente")
    reservations = (
        await db["reservations"]
        .find({"customer_id": customer_id}, {"_id": 0})
        .sort("event_date", -1)
        .to_list(200)
    )
    payments = (
        await db["payments"]
        .find({"customer_id": customer_id}, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    total_spent = round(sum(p["amount"] for p in payments if p["status"] == "approved"), 2)
    return {
        "reservations": reservations,
        "payments": payments,
        "total_reservations": len(reservations),
        "total_spent": total_spent,
    }


@router.put("/{customer_id}", response_model=Customer)
async def update_customer(
    customer_id: str, payload: CustomerInput, user: dict = Depends(require_staff)
):
    result = await db["customers"].update_one({"id": customer_id}, {"$set": _normalize(payload)})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    doc = await db["customers"].find_one({"id": customer_id}, {"_id": 0})
    await log_audit(user=user, action="update", entity="customer", entity_id=customer_id)
    return Customer(**doc)


@router.delete("/{customer_id}", response_model=OkResponse)
async def delete_customer(customer_id: str, user: dict = Depends(require_staff)):
    active = await db["reservations"].count_documents(
        {"customer_id": customer_id, "status": {"$in": ["pre_reserva", "aguardando_pagamento", "confirmada"]}}
    )
    if active:
        raise HTTPException(status_code=409, detail="Cliente possui reservas ativas")
    result = await db["customers"].delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    await log_audit(user=user, action="delete", entity="customer", entity_id=customer_id)
    return OkResponse(message="Cliente removido")

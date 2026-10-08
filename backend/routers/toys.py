"""Toys catalog — public read for the storefront, staff write."""

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import require_staff
from lib.db import db
from models.schemas import OkResponse, Toy, ToyInput
from services.notification_service import log_audit

router = APIRouter(prefix="/toys", tags=["toys"])


@router.get("", response_model=list[Toy])
async def list_toys(category: str = Query(default=""), only_available: bool = Query(default=False)):
    query: dict = {}
    if category:
        query["category"] = category
    if only_available:
        query["status"] = "disponivel"
    docs = await db["toys"].find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return [Toy(**d) for d in docs]


@router.get("/categories", response_model=list[str])
async def list_categories():
    return sorted(await db["toys"].distinct("category"))


@router.get("/{toy_id}", response_model=Toy)
async def get_toy(toy_id: str):
    doc = await db["toys"].find_one({"id": toy_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Brinquedo não encontrado")
    return Toy(**doc)


@router.post("", response_model=Toy)
async def create_toy(payload: ToyInput, user: dict = Depends(require_staff)):
    toy = Toy(**payload.model_dump())
    await db["toys"].insert_one(toy.model_dump())
    await log_audit(user=user, action="create", entity="toy", entity_id=toy.id, details=toy.name)
    return toy


@router.put("/{toy_id}", response_model=Toy)
async def update_toy(toy_id: str, payload: ToyInput, user: dict = Depends(require_staff)):
    result = await db["toys"].update_one({"id": toy_id}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Brinquedo não encontrado")
    doc = await db["toys"].find_one({"id": toy_id}, {"_id": 0})
    await log_audit(user=user, action="update", entity="toy", entity_id=toy_id)
    return Toy(**doc)


@router.delete("/{toy_id}", response_model=OkResponse)
async def delete_toy(toy_id: str, user: dict = Depends(require_staff)):
    booked = await db["reservations"].count_documents(
        {
            "items.toy_id": toy_id,
            "status": {"$in": ["pre_reserva", "aguardando_pagamento", "confirmada"]},
        }
    )
    if booked:
        raise HTTPException(status_code=409, detail="Brinquedo possui reservas ativas")
    result = await db["toys"].delete_one({"id": toy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Brinquedo não encontrado")
    await log_audit(user=user, action="delete", entity="toy", entity_id=toy_id)
    return OkResponse(message="Brinquedo removido")

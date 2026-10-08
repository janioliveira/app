"""Quotes (orçamentos) — lifecycle and conversion into a reservation."""

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import ROLE_CUSTOMER, current_user, require_staff
from lib.db import db
from models.schemas import OkResponse, Quote, QuoteInput, QuoteStatusInput, Reservation
from services import whatsapp_service as wa
from services.notification_service import log_audit, notify
from services.reservation_service import (
    check_availability,
    compute_totals,
    hydrate_items,
    next_code,
)

router = APIRouter(prefix="/quotes", tags=["quotes"])


@router.get("", response_model=list[Quote])
async def list_quotes(status: str = Query(default=""), user: dict = Depends(current_user)):
    query: dict = {}
    if user["role"] == ROLE_CUSTOMER:
        query["customer_id"] = user.get("customer_id")
    if status:
        query["status"] = status
    docs = await db["quotes"].find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Quote(**d) for d in docs]


@router.post("", response_model=Quote)
async def create_quote(payload: QuoteInput, user: dict = Depends(require_staff)):
    if not payload.customer_id:
        raise HTTPException(status_code=422, detail="Selecione um cliente")
    customer = await db["customers"].find_one({"id": payload.customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    try:
        items = await hydrate_items(payload.items)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    subtotal, total = compute_totals(items, payload.discount, payload.delivery_fee)
    count = await db["quotes"].count_documents({})
    quote = Quote(
        number=f"ORC-{count + 1:04d}",
        customer_id=customer["id"],
        customer_name=customer["name"],
        items=items,
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        address=payload.address,
        subtotal=subtotal,
        discount=payload.discount,
        delivery_fee=payload.delivery_fee,
        total=total,
        valid_until=payload.valid_until,
        notes=payload.notes,
    )
    await db["quotes"].insert_one(quote.model_dump())
    await log_audit(user=user, action="create", entity="quote", entity_id=quote.id, details=quote.number)
    return quote


@router.get("/{quote_id}", response_model=Quote)
async def get_quote(quote_id: str, user: dict = Depends(current_user)):
    doc = await db["quotes"].find_one({"id": quote_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    if user["role"] == ROLE_CUSTOMER and doc["customer_id"] != user.get("customer_id"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    return Quote(**doc)


@router.patch("/{quote_id}/status", response_model=Quote)
async def update_quote_status(
    quote_id: str, payload: QuoteStatusInput, user: dict = Depends(require_staff)
):
    doc = await db["quotes"].find_one({"id": quote_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    await db["quotes"].update_one({"id": quote_id}, {"$set": {"status": payload.status}})
    await log_audit(
        user=user,
        action="status_change",
        entity="quote",
        entity_id=quote_id,
        details=f"{doc['status']} → {payload.status}",
    )
    updated = await db["quotes"].find_one({"id": quote_id}, {"_id": 0})
    return Quote(**updated)


@router.post("/{quote_id}/convert", response_model=Reservation)
async def convert_to_reservation(quote_id: str, user: dict = Depends(require_staff)):
    quote = await db["quotes"].find_one({"id": quote_id}, {"_id": 0})
    if not quote:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    if quote.get("reservation_id"):
        existing = await db["reservations"].find_one({"id": quote["reservation_id"]}, {"_id": 0})
        if existing:
            return Reservation(**existing)  # idempotent conversion

    result = await check_availability(
        toy_ids=[i["toy_id"] for i in quote["items"]],
        event_date=quote["event_date"],
        start_time=quote["start_time"],
        end_time=quote["end_time"],
        requested={i["toy_id"]: int(i.get("quantity", 1)) for i in quote["items"]},
    )
    if not result.available:
        blocked = ", ".join(f"{i.toy_name}: {i.reason}" for i in result.items if not i.available)
        raise HTTPException(status_code=409, detail=f"Conflito de agenda — {blocked}")

    customer = await db["customers"].find_one({"id": quote["customer_id"]}, {"_id": 0}) or {}
    reservation = Reservation(
        code=await next_code("RES", "reservations", "code"),
        customer_id=quote["customer_id"],
        customer_name=quote.get("customer_name", ""),
        customer_whatsapp=customer.get("whatsapp", ""),
        items=quote["items"],
        event_date=quote["event_date"],
        start_time=quote["start_time"],
        end_time=quote["end_time"],
        address=quote.get("address", ""),
        city=customer.get("city", ""),
        district=customer.get("district", ""),
        subtotal=quote["subtotal"],
        discount=quote["discount"],
        delivery_fee=quote["delivery_fee"],
        total=quote["total"],
        status="pre_reserva",
        notes=quote.get("notes", ""),
    )
    await db["reservations"].insert_one(reservation.model_dump())
    await db["quotes"].update_one(
        {"id": quote_id}, {"$set": {"status": "convertido", "reservation_id": reservation.id}}
    )
    await notify(
        title="Orçamento convertido",
        message=f"Orçamento {quote['number']} virou a reserva {reservation.code}.",
        kind="success",
        event="nova_reserva",
        reservation_id=reservation.id,
        dedupe_key=f"convertido:{quote_id}",
    )
    await wa.send_event(
        event="nova_reserva",
        customer=customer,
        reservation=reservation.model_dump(),
        dedupe_key=f"nova_reserva:{reservation.id}",
    )
    await log_audit(user=user, action="convert", entity="quote", entity_id=quote_id)
    return reservation


@router.delete("/{quote_id}", response_model=OkResponse)
async def delete_quote(quote_id: str, user: dict = Depends(require_staff)):
    result = await db["quotes"].delete_one({"id": quote_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    await log_audit(user=user, action="delete", entity="quote", entity_id=quote_id)
    return OkResponse(message="Orçamento removido")

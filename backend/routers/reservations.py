"""Reservations — availability check, lifecycle and the public booking entry point."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from lib.auth import ROLE_CUSTOMER, current_user, optional_user, require_staff
from lib.db import db
from models.schemas import (
    AvailabilityInput,
    AvailabilityResult,
    Customer,
    OkResponse,
    Reservation,
    ReservationInput,
    ReservationStatusInput,
)
from services import whatsapp_service as wa
from services.notification_service import log_audit, notify
from services.reservation_service import (
    check_availability,
    compute_totals,
    expire_stale_reservations,
    hydrate_items,
    next_code,
)
from services.whatsapp_service import normalize_br_phone

router = APIRouter(prefix="/reservations", tags=["reservations"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.post("/availability", response_model=AvailabilityResult)
async def availability(payload: AvailabilityInput):
    await expire_stale_reservations()
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=422, detail="Horário final deve ser após o inicial")
    toy_ids = payload.toy_ids
    if not toy_ids:
        toy_ids = [t["id"] for t in await db["toys"].find({}, {"id": 1, "_id": 0}).to_list(500)]
    return await check_availability(
        toy_ids=toy_ids,
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
    )


@router.get("", response_model=list[Reservation])
async def list_reservations(
    status: str = Query(default=""),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    user: dict = Depends(current_user),
):
    await expire_stale_reservations()
    query: dict = {}
    if user["role"] == ROLE_CUSTOMER:
        query["customer_id"] = user.get("customer_id")
    if status:
        query["status"] = status
    if date_from or date_to:
        query["event_date"] = {}
        if date_from:
            query["event_date"]["$gte"] = date_from
        if date_to:
            query["event_date"]["$lte"] = date_to
    docs = await db["reservations"].find(query, {"_id": 0}).sort("event_date", -1).to_list(1000)
    return [Reservation(**d) for d in docs]


@router.post("", response_model=Reservation)
async def create_reservation(
    payload: ReservationInput, request: Request, user: dict | None = Depends(optional_user)
):
    """Public endpoint: the storefront flow creates a pré-reserva without a login."""
    if payload.start_time >= payload.end_time:
        raise HTTPException(status_code=422, detail="Horário final deve ser após o inicial")

    try:
        items = await hydrate_items(payload.items)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # Resolve the customer: logged-in customer > explicit id > inline payload.
    customer_id = payload.customer_id
    if user and user["role"] == ROLE_CUSTOMER:
        customer_id = user.get("customer_id")

    if customer_id:
        customer = await db["customers"].find_one({"id": customer_id}, {"_id": 0})
        if not customer:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
    elif payload.customer:
        data = payload.customer.model_dump()
        for field in ("phone", "whatsapp"):
            if data.get(field):
                data[field] = normalize_br_phone(data[field]) or data[field]
        new_customer = Customer(**data)
        await db["customers"].insert_one(new_customer.model_dump())
        customer = new_customer.model_dump()
    else:
        raise HTTPException(status_code=422, detail="Informe os dados do cliente")

    result = await check_availability(
        toy_ids=[i.toy_id for i in items],
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        requested={i.toy_id: i.quantity for i in items},
    )
    if not result.available:
        blocked = ", ".join(f"{i.toy_name}: {i.reason}" for i in result.items if not i.available)
        raise HTTPException(status_code=409, detail=f"Conflito de agenda — {blocked}")

    subtotal, total = compute_totals(items, payload.discount, payload.delivery_fee)
    reservation = Reservation(
        code=await next_code("RES", "reservations", "code"),
        customer_id=customer["id"],
        customer_name=customer["name"],
        customer_whatsapp=customer.get("whatsapp", ""),
        items=items,
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        address=payload.address or customer.get("street", ""),
        city=payload.city or customer.get("city", ""),
        district=payload.district or customer.get("district", ""),
        subtotal=subtotal,
        discount=payload.discount,
        delivery_fee=payload.delivery_fee,
        total=total,
        status="pre_reserva",
        notes=payload.notes,
    )
    await db["reservations"].insert_one(reservation.model_dump())

    await notify(
        title="Nova reserva",
        message=f"Pré-reserva {reservation.code} de {customer['name']} para {reservation.event_date}.",
        kind="info",
        event="nova_reserva",
        reservation_id=reservation.id,
        customer_id=customer["id"],
        dedupe_key=f"nova_reserva:{reservation.id}",
    )
    await wa.send_event(
        event="nova_reserva",
        customer=customer,
        reservation=reservation.model_dump(),
        dedupe_key=f"nova_reserva:{reservation.id}",
    )
    await log_audit(
        user=user,
        action="create",
        entity="reservation",
        entity_id=reservation.id,
        details=reservation.code,
        ip=request.client.host if request.client else "",
    )
    return reservation


@router.get("/{reservation_id}", response_model=Reservation)
async def get_reservation(reservation_id: str, user: dict | None = Depends(optional_user)):
    doc = await db["reservations"].find_one({"id": reservation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Reserva não encontrada")
    if user and user["role"] == ROLE_CUSTOMER and doc["customer_id"] != user.get("customer_id"):
        raise HTTPException(status_code=403, detail="Acesso negado à reserva de outro cliente")
    return Reservation(**doc)


@router.patch("/{reservation_id}/status", response_model=Reservation)
async def update_status(
    reservation_id: str, payload: ReservationStatusInput, user: dict = Depends(require_staff)
):
    doc = await db["reservations"].find_one({"id": reservation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Reserva não encontrada")
    await db["reservations"].update_one(
        {"id": reservation_id}, {"$set": {"status": payload.status, "updated_at": _now()}}
    )
    if payload.status == "cancelada":
        customer = await db["customers"].find_one({"id": doc["customer_id"]}, {"_id": 0})
        await notify(
            title="Reserva cancelada",
            message=f"Reserva {doc['code']} cancelada. {payload.reason}".strip(),
            kind="warning",
            event="reserva_cancelada",
            reservation_id=reservation_id,
            dedupe_key=f"reserva_cancelada:{reservation_id}",
        )
        await wa.send_event(
            event="cancelamento",
            customer=customer,
            reservation=doc,
            dedupe_key=f"cancelamento:{reservation_id}",
        )
    await log_audit(
        user=user,
        action="status_change",
        entity="reservation",
        entity_id=reservation_id,
        details=f"{doc['status']} → {payload.status} {payload.reason}".strip(),
    )
    updated = await db["reservations"].find_one({"id": reservation_id}, {"_id": 0})
    return Reservation(**updated)


@router.put("/{reservation_id}", response_model=Reservation)
async def update_reservation(
    reservation_id: str, payload: ReservationInput, user: dict = Depends(require_staff)
):
    doc = await db["reservations"].find_one({"id": reservation_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Reserva não encontrada")
    try:
        items = await hydrate_items(payload.items)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    result = await check_availability(
        toy_ids=[i.toy_id for i in items],
        event_date=payload.event_date,
        start_time=payload.start_time,
        end_time=payload.end_time,
        exclude_reservation_id=reservation_id,
        requested={i.toy_id: i.quantity for i in items},
    )
    if not result.available:
        blocked = ", ".join(f"{i.toy_name}: {i.reason}" for i in result.items if not i.available)
        raise HTTPException(status_code=409, detail=f"Conflito de agenda — {blocked}")

    subtotal, total = compute_totals(items, payload.discount, payload.delivery_fee)
    await db["reservations"].update_one(
        {"id": reservation_id},
        {
            "$set": {
                "items": [i.model_dump() for i in items],
                "event_date": payload.event_date,
                "start_time": payload.start_time,
                "end_time": payload.end_time,
                "address": payload.address,
                "city": payload.city,
                "district": payload.district,
                "subtotal": subtotal,
                "discount": payload.discount,
                "delivery_fee": payload.delivery_fee,
                "total": total,
                "notes": payload.notes,
                "updated_at": _now(),
            }
        },
    )
    await log_audit(user=user, action="update", entity="reservation", entity_id=reservation_id)
    updated = await db["reservations"].find_one({"id": reservation_id}, {"_id": 0})
    return Reservation(**updated)


@router.delete("/{reservation_id}", response_model=OkResponse)
async def delete_reservation(reservation_id: str, user: dict = Depends(require_staff)):
    result = await db["reservations"].delete_one({"id": reservation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reserva não encontrada")
    await log_audit(user=user, action="delete", entity="reservation", entity_id=reservation_id)
    return OkResponse(message="Reserva removida")

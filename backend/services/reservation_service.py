"""ReservationService — totals, codes and the authoritative availability/conflict check."""

from datetime import datetime, timezone
from typing import Any

from lib.db import db
from models.schemas import AvailabilityItem, AvailabilityResult, LineItem

# A reservation in one of these states holds the equipment slot.
BLOCKING_STATUSES = ("pre_reserva", "aguardando_pagamento", "confirmada", "finalizada")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def overlaps(start_a: str, end_a: str, start_b: str, end_b: str) -> bool:
    """HH:MM strings compare lexicographically, so plain string comparison is correct."""
    return start_a < end_b and start_b < end_a


async def next_code(prefix: str, collection: str, field: str) -> str:
    year = _now().year
    count = await db[collection].count_documents({})
    return f"{prefix}-{year}-{count + 1:04d}"


def compute_totals(
    items: list[LineItem], discount: float, delivery_fee: float
) -> tuple[float, float]:
    subtotal = round(sum(i.unit_price * i.quantity for i in items), 2)
    total = round(max(subtotal - (discount or 0) + (delivery_fee or 0), 0), 2)
    return subtotal, total


async def hydrate_items(items: list[LineItem]) -> list[LineItem]:
    """Fill toy_name and fall back to the catalog price — the client never sets the price."""
    hydrated: list[LineItem] = []
    for item in items:
        toy = await db["toys"].find_one({"id": item.toy_id}, {"_id": 0})
        if not toy:
            raise ValueError(f"Brinquedo não encontrado: {item.toy_id}")
        hydrated.append(
            LineItem(
                toy_id=item.toy_id,
                toy_name=toy["name"],
                quantity=item.quantity,
                unit_price=item.unit_price if item.unit_price > 0 else float(toy["daily_price"]),
            )
        )
    return hydrated


async def check_availability(
    *,
    toy_ids: list[str],
    event_date: str,
    start_time: str,
    end_time: str,
    exclude_reservation_id: str | None = None,
    requested: dict[str, int] | None = None,
) -> AvailabilityResult:
    """Server-side conflict detection: same toy, same date, overlapping time window.

    `requested` carries the quantities the caller wants to book, so an order larger
    than the remaining stock is rejected even when nothing is booked yet.
    """
    query: dict[str, Any] = {"event_date": event_date, "status": {"$in": BLOCKING_STATUSES}}
    if exclude_reservation_id:
        query["id"] = {"$ne": exclude_reservation_id}
    same_day = await db["reservations"].find(query, {"_id": 0}).to_list(2000)

    results: list[AvailabilityItem] = []
    for toy_id in toy_ids:
        toy = await db["toys"].find_one({"id": toy_id}, {"_id": 0})
        if not toy:
            results.append(
                AvailabilityItem(
                    toy_id=toy_id, toy_name="", available=False, reason="Brinquedo não encontrado"
                )
            )
            continue
        if toy.get("status") != "disponivel":
            results.append(
                AvailabilityItem(
                    toy_id=toy_id,
                    toy_name=toy["name"],
                    available=False,
                    reason="Em manutenção ou inativo",
                )
            )
            continue

        booked = 0
        for reservation in same_day:
            if not overlaps(
                start_time, end_time, reservation["start_time"], reservation["end_time"]
            ):
                continue
            for item in reservation.get("items", []):
                if item["toy_id"] == toy_id:
                    booked += int(item.get("quantity", 1))

        stock = int(toy.get("quantity", 1))
        wanted = int((requested or {}).get(toy_id, 0))
        remaining = stock - booked
        if booked + max(wanted, 1) > stock:
            reason = (
                f"Já reservado neste horário ({booked}/{stock})"
                if remaining <= 0
                else f"Apenas {remaining} disponível(is) neste horário — {wanted} solicitado(s)"
            )
            results.append(
                AvailabilityItem(
                    toy_id=toy_id, toy_name=toy["name"], available=False, reason=reason
                )
            )
        else:
            results.append(
                AvailabilityItem(
                    toy_id=toy_id,
                    toy_name=toy["name"],
                    available=True,
                    reason=f"{remaining} disponível(is)",
                )
            )

    return AvailabilityResult(
        available=all(r.available for r in results) and bool(results), items=results
    )


async def expire_stale_reservations() -> int:
    """Release equipment whose PIX window elapsed. Called on read paths — no cron needed."""
    from services.payment_service import expire_payment

    stale = await db["payments"].find(
        {"status": "pending", "expires_at": {"$lt": _now()}}, {"_id": 0}
    ).to_list(500)
    for payment in stale:
        await expire_payment(payment)
    return len(stale)

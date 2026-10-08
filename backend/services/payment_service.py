"""PaymentService — PIX lifecycle orchestration. Every transition is idempotent."""

from datetime import datetime, timezone
from typing import Any

from lib.db import db
from models.schemas import FinancialEntry, Payment
from services import mercadopago_service as mp
from services import whatsapp_service as wa
from services.contract_service import generate_for_reservation
from services.notification_service import notify
from services.settings_service import get_company, get_mercadopago_config

APPROVED_MP_STATUSES = ("approved",)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: Any) -> datetime | None:
    """Motor returns naive datetimes — normalize before any comparison."""
    if not isinstance(value, datetime):
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


async def create_pix_for_reservation(
    reservation: dict[str, Any], customer: dict[str, Any], amount: float | None = None
) -> dict[str, Any]:
    """Reuse a live pending charge instead of creating a duplicate one."""
    existing = await db["payments"].find_one(
        {"reservation_id": reservation["id"], "status": "pending"}, {"_id": 0}
    )
    if existing:
        expires = _aware(existing.get("expires_at"))
        if expires is None or expires > _now():
            return existing
        await expire_payment(existing)

    company = await get_company()
    config = await get_mercadopago_config()
    charge = await mp.create_pix_charge(
        amount=float(amount or reservation["total"]),
        description=f"Reserva {reservation['code']} — Lany Infláveis",
        payer_email=customer.get("email", ""),
        external_reference=reservation["id"],
        expiration_minutes=config["pix_expiration_minutes"],
        pix_key=company.pix_key,
        merchant=company.trade_name or "Lany Inflaveis",
        city=company.city or "Sao Paulo",
    )

    payment = Payment(
        reservation_id=reservation["id"],
        customer_id=reservation["customer_id"],
        customer_name=reservation.get("customer_name", ""),
        amount=round(float(amount or reservation["total"]), 2),
        status="pending",
        status_detail=charge["status_detail"],
        mp_payment_id=charge["mp_payment_id"],
        qr_code=charge["qr_code"],
        qr_code_base64=charge["qr_code_base64"],
        ticket_url=charge["ticket_url"],
        simulation=charge["simulation"],
        expires_at=charge["expires_at"],
    )
    doc = payment.model_dump()
    await db["payments"].insert_one(dict(doc))
    await db["reservations"].update_one(
        {"id": reservation["id"]},
        {
            "$set": {
                "payment_id": payment.id,
                "status": "aguardando_pagamento",
                "updated_at": _now(),
            }
        },
    )

    await notify(
        title="PIX gerado",
        message=f"Cobrança PIX criada para a reserva {reservation['code']}.",
        kind="info",
        event="pix_criado",
        reservation_id=reservation["id"],
        customer_id=reservation["customer_id"],
        dedupe_key=f"pix_criado:{payment.id}",
    )
    await wa.send_event(
        event="pix_gerado",
        customer=customer,
        reservation=reservation,
        dedupe_key=f"pix_gerado:{payment.id}",
    )
    doc.pop("_id", None)
    return doc


async def approve_payment(payment: dict[str, Any], *, source: str = "webhook") -> dict[str, Any]:
    """The single approval path: webhook, manual sync and simulation all land here."""
    if payment.get("status") == "approved":
        return payment  # idempotent — never duplicate reservation/financial/contract side effects

    now = _now()
    await db["payments"].update_one(
        {"id": payment["id"]},
        {"$set": {"status": "approved", "status_detail": f"approved_via_{source}", "approved_at": now}},
    )
    payment = {**payment, "status": "approved", "approved_at": now}

    reservation = await db["reservations"].find_one(
        {"id": payment["reservation_id"]}, {"_id": 0}
    )
    if not reservation:
        return payment

    await db["reservations"].update_one(
        {"id": reservation["id"]}, {"$set": {"status": "confirmada", "updated_at": now}}
    )
    reservation = {**reservation, "status": "confirmada"}
    customer = await db["customers"].find_one({"id": reservation["customer_id"]}, {"_id": 0})

    # Financial entry — guarded by payment_id so a webhook replay cannot double-book revenue.
    if not await db["financial_entries"].find_one({"payment_id": payment["id"]}):
        entry = FinancialEntry(
            kind="entrada",
            category="PIX Mercado Pago",
            description=f"Pagamento PIX da reserva {reservation['code']}",
            amount=float(payment["amount"]),
            date=now.strftime("%Y-%m-%d"),
            reservation_id=reservation["id"],
            payment_id=payment["id"],
        )
        await db["financial_entries"].insert_one(entry.model_dump())

    contract = await generate_for_reservation(reservation, customer or {})

    await notify(
        title="Pagamento PIX aprovado",
        message=f"Reserva {reservation['code']} confirmada — R$ {payment['amount']:.2f}.",
        kind="success",
        event="pix_aprovado",
        reservation_id=reservation["id"],
        customer_id=reservation["customer_id"],
        dedupe_key=f"pix_aprovado:{payment['id']}",
    )
    await notify(
        title="Contrato gerado",
        message=f"Contrato {contract['number']} aguardando aceite do cliente.",
        kind="info",
        event="contrato_criado",
        reservation_id=reservation["id"],
        customer_id=reservation["customer_id"],
        dedupe_key=f"contrato_criado:{contract['id']}",
    )
    await wa.send_event(
        event="pagamento_confirmado",
        customer=customer,
        reservation=reservation,
        dedupe_key=f"pagamento_confirmado:{payment['id']}",
    )
    await wa.send_event(
        event="contrato",
        customer=customer,
        reservation=reservation,
        dedupe_key=f"contrato:{contract['id']}",
    )
    return payment


async def expire_payment(payment: dict[str, Any]) -> dict[str, Any]:
    if payment.get("status") != "pending":
        return payment
    now = _now()
    await db["payments"].update_one(
        {"id": payment["id"]},
        {"$set": {"status": "expired", "status_detail": "expired_by_timeout"}},
    )
    reservation = await db["reservations"].find_one({"id": payment["reservation_id"]}, {"_id": 0})
    if reservation and reservation["status"] in ("pre_reserva", "aguardando_pagamento"):
        await db["reservations"].update_one(
            {"id": reservation["id"]}, {"$set": {"status": "expirada", "updated_at": now}}
        )
        customer = await db["customers"].find_one({"id": reservation["customer_id"]}, {"_id": 0})
        await notify(
            title="PIX expirado",
            message=f"A cobrança da reserva {reservation['code']} expirou e o brinquedo foi liberado.",
            kind="warning",
            event="pix_expirado",
            reservation_id=reservation["id"],
            customer_id=reservation["customer_id"],
            dedupe_key=f"pix_expirado:{payment['id']}",
        )
        await wa.send_event(
            event="pagamento_expirado",
            customer=customer,
            reservation=reservation,
            dedupe_key=f"pagamento_expirado:{payment['id']}",
        )
    return {**payment, "status": "expired"}


async def sync_payment(payment: dict[str, Any]) -> dict[str, Any]:
    """Pull the authoritative status from Mercado Pago; expire locally when overdue."""
    if payment.get("status") != "pending":
        return payment

    if not mp.is_simulation() and payment.get("mp_payment_id"):
        try:
            remote = await mp.get_payment(payment["mp_payment_id"])
        except Exception:
            remote = {}
        status = remote.get("status")
        if status in APPROVED_MP_STATUSES:
            return await approve_payment(payment, source="sync")
        if status in ("cancelled", "rejected"):
            await db["payments"].update_one(
                {"id": payment["id"]},
                {"$set": {"status": status, "status_detail": remote.get("status_detail", "")}},
            )
            return {**payment, "status": status}

    expires = _aware(payment.get("expires_at"))
    if expires and expires < _now():
        return await expire_payment(payment)
    return payment


async def cancel_pix(payment: dict[str, Any]) -> dict[str, Any]:
    if payment.get("status") not in ("pending",):
        return payment
    try:
        await mp.cancel_payment(payment.get("mp_payment_id", ""))
    except Exception:
        pass
    await db["payments"].update_one(
        {"id": payment["id"]}, {"$set": {"status": "cancelled", "status_detail": "cancelled_by_admin"}}
    )
    await notify(
        title="PIX cancelado",
        message=f"Cobrança PIX cancelada (R$ {payment['amount']:.2f}).",
        kind="warning",
        event="pix_cancelado",
        reservation_id=payment.get("reservation_id"),
        dedupe_key=f"pix_cancelado:{payment['id']}",
    )
    return {**payment, "status": "cancelled"}


async def refund_pix(payment: dict[str, Any]) -> dict[str, Any]:
    if payment.get("status") != "approved":
        return payment
    try:
        await mp.refund_payment(payment.get("mp_payment_id", ""))
    except Exception:
        pass
    now = _now()
    await db["payments"].update_one(
        {"id": payment["id"]}, {"$set": {"status": "refunded", "status_detail": "refunded"}}
    )
    if not await db["financial_entries"].find_one({"payment_id": f"refund-{payment['id']}"}):
        entry = FinancialEntry(
            kind="saida",
            category="Estorno PIX",
            description=f"Estorno do pagamento {payment['id'][:8]}",
            amount=float(payment["amount"]),
            date=now.strftime("%Y-%m-%d"),
            reservation_id=payment.get("reservation_id"),
            payment_id=f"refund-{payment['id']}",
        )
        await db["financial_entries"].insert_one(entry.model_dump())
    await notify(
        title="PIX estornado",
        message=f"Pagamento estornado (R$ {payment['amount']:.2f}).",
        kind="warning",
        event="pix_estornado",
        reservation_id=payment.get("reservation_id"),
        dedupe_key=f"pix_estornado:{payment['id']}",
    )
    return {**payment, "status": "refunded"}

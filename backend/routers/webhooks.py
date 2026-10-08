"""Mercado Pago webhook — validate, dedupe, confirm against the API, then fan out."""

import logging

from fastapi import APIRouter, Header, Query, Request

from lib.db import db
from models.schemas import OkResponse, utc_now
from services import mercadopago_service as mp
from services import payment_service as ps
from services.notification_service import log_audit

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)


@router.post("/mercadopago", response_model=OkResponse)
async def mercadopago_webhook(
    request: Request,
    data_id: str | None = Query(default=None, alias="data.id"),
    x_signature: str | None = Header(default=None, alias="x-signature"),
    x_request_id: str | None = Header(default=None, alias="x-request-id"),
):
    """Always answers 200 fast; Mercado Pago retries any non-2xx."""
    try:
        payload = await request.json()
    except Exception:
        return OkResponse(ok=True, message="payload ignorado")

    # 1-2. Receive + validate authenticity (enforced whenever a secret is configured).
    if mp.webhook_secret() and not mp.validate_signature(x_signature, x_request_id, data_id):
        logger.warning("webhook mercadopago: assinatura inválida")
        return OkResponse(ok=False, message="assinatura inválida")

    if payload.get("type") not in ("payment", None):
        return OkResponse(ok=True, message="evento ignorado")

    mp_payment_id = str((payload.get("data") or {}).get("id") or data_id or "")
    if not mp_payment_id:
        return OkResponse(ok=True, message="sem data.id")

    # 9/10 + idempotency: one processing per event key.
    event_key = str(payload.get("id") or f"payment:{mp_payment_id}:{payload.get('action', '')}")
    inserted = await db["webhook_events"].update_one(
        {"event_key": event_key},
        {"$setOnInsert": {"event_key": event_key, "received_at": utc_now(), "payload": payload}},
        upsert=True,
    )
    if not inserted.upserted_id:
        return OkResponse(ok=True, message="evento duplicado ignorado")

    # 3-4. Identify the local payment, then confirm the official status upstream.
    payment = await db["payments"].find_one({"mp_payment_id": mp_payment_id}, {"_id": 0})
    if not payment:
        return OkResponse(ok=True, message="pagamento desconhecido")

    status = "approved"
    if not mp.is_simulation():
        try:
            remote = await mp.get_payment(mp_payment_id)
            status = remote.get("status", "")
        except Exception as exc:
            logger.error("webhook mercadopago: consulta falhou: %s", exc)
            return OkResponse(ok=False, message="consulta ao Mercado Pago falhou")

    # 5-8. Apply the transition; approve_payment() handles reservation, financial,
    # contract, notification and WhatsApp in one idempotent pass.
    if status == "approved":
        await ps.approve_payment(payment, source="webhook")
    elif status in ("cancelled", "rejected"):
        await db["payments"].update_one(
            {"id": payment["id"]}, {"$set": {"status": status}}
        )
    elif status == "refunded":
        await ps.refund_pix({**payment, "status": "approved"})

    await log_audit(
        user=None,
        action="webhook_mercadopago",
        entity="payment",
        entity_id=payment["id"],
        details=f"status={status} event={event_key}",
    )
    return OkResponse(ok=True, message=f"processado: {status}")


@router.get("/whatsapp")
async def whatsapp_verify(
    mode: str = Query(default="", alias="hub.mode"),
    token: str = Query(default="", alias="hub.verify_token"),
    challenge: str = Query(default="", alias="hub.challenge"),
):
    import os

    expected = os.environ.get("WHATSAPP_VERIFY_TOKEN", "")
    if mode == "subscribe" and expected and token == expected:
        return int(challenge) if challenge.isdigit() else challenge
    return {"ok": False, "detail": "verification failed"}


@router.post("/whatsapp", response_model=OkResponse)
async def whatsapp_status_webhook(request: Request):
    """Delivery receipts: sent → delivered → read, or failed. Idempotent by wamid."""
    try:
        payload = await request.json()
    except Exception:
        return OkResponse(ok=True)

    status_map = {
        "sent": ("enviado", "sent_at"),
        "delivered": ("entregue", "delivered_at"),
        "read": ("lido", "read_at"),
        "failed": ("falhou", None),
    }
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for st in (change.get("value") or {}).get("statuses", []):
                mapped = status_map.get(st.get("status", ""))
                if not mapped:
                    continue
                label, stamp = mapped
                update: dict = {"status": label, "updated_at": utc_now()}
                if stamp:
                    update[stamp] = utc_now()
                if label == "falhou":
                    update["error"] = str(st.get("errors", ""))[:500]
                await db["whatsapp_messages"].update_one({"wamid": st.get("id")}, {"$set": update})
    return OkResponse(ok=True)

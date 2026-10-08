"""WhatsApp message log + manual send (staff only)."""

from fastapi import APIRouter, Depends, Query

from lib.auth import ROLE_CUSTOMER, current_user, require_staff
from lib.db import db
from models.schemas import WhatsAppMessage, WhatsAppSendInput
from services import whatsapp_service as wa
from services.notification_service import log_audit

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/messages", response_model=list[WhatsAppMessage])
async def list_messages(status: str = Query(default=""), user: dict = Depends(current_user)):
    query: dict = {}
    if user["role"] == ROLE_CUSTOMER:
        query["customer_id"] = user.get("customer_id")
    if status:
        query["status"] = status
    docs = (
        await db["whatsapp_messages"].find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    )
    return [WhatsAppMessage(**d) for d in docs]


@router.post("/send", response_model=WhatsAppMessage)
async def send(payload: WhatsAppSendInput, user: dict = Depends(require_staff)):
    phone = payload.phone
    customer = None
    if payload.customer_id:
        customer = await db["customers"].find_one({"id": payload.customer_id}, {"_id": 0})
        if customer and not phone:
            phone = customer.get("whatsapp") or customer.get("phone", "")

    message = await wa.send_message(
        message=payload.message,
        phone=phone,
        customer_id=payload.customer_id,
        reservation_id=payload.reservation_id,
        message_type=payload.message_type,
    )
    await log_audit(
        user=user,
        action="whatsapp_send",
        entity="whatsapp_message",
        entity_id=message.id,
        details=f"status={message.status}",
    )
    return message

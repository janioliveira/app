"""WhatsAppService — Meta Cloud API sender with wa.me fallback and delivery tracking.

The access token lives only in backend/.env (or the admin-saved settings doc) and is
never returned to the browser.
"""

import os
import re
from datetime import datetime, timezone
from typing import Any

import httpx
from pymongo.errors import DuplicateKeyError

from lib.db import db
from models.schemas import WhatsAppMessage
from services.settings_service import get_whatsapp_config


def normalize_br_phone(value: str) -> str | None:
    """Return an E.164 Brazilian number (+55DDNNNNNNNNN) or None when invalid."""
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("00"):
        digits = digits[2:]
    national = digits[2:] if digits.startswith("55") and len(digits) > 11 else digits
    if len(national) not in (10, 11) or national[0] not in "123456789":
        return None
    return "+55" + national


def render_template(template: str, **values: Any) -> str:
    out = template
    for key, val in values.items():
        out = out.replace("{" + key.upper() + "}", str(val or ""))
    return out


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def send_message(
    *,
    message: str,
    phone: str,
    customer_id: str | None = None,
    reservation_id: str | None = None,
    message_type: str = "custom",
    template: str = "",
    dedupe_key: str | None = None,
) -> WhatsAppMessage:
    """Persist the message then try to deliver it. Always records an auditable row."""
    config = await get_whatsapp_config()
    token = config["access_token"] or os.environ.get("WHATSAPP_ACCESS_TOKEN", "")
    phone_number_id = config["phone_number_id"] or os.environ.get("WHATSAPP_PHONE_NUMBER_ID", "")
    api_url = config["api_url"] or os.environ.get("WHATSAPP_API_URL", "")

    normalized = normalize_br_phone(phone)
    record = WhatsAppMessage(
        customer_id=customer_id,
        reservation_id=reservation_id,
        phone=normalized or phone,
        message_type=message_type,
        template=template,
        message=message,
        status="pendente",
    )
    doc = record.model_dump()
    if dedupe_key:
        doc["dedupe_key"] = dedupe_key

    if not normalized:
        doc.update({"status": "falhou", "error": "Número de WhatsApp inválido"})
    else:
        doc["wa_link"] = f"https://wa.me/{normalized[1:]}?text={httpx.QueryParams({'t': message})['t']}"
        if not config["enabled"]:
            doc.update({"status": "cancelado", "error": "Integração WhatsApp desativada"})
        elif not token or not phone_number_id:
            doc.update(
                {
                    "status": "pendente",
                    "error": "Provedor não configurado — use o link wa.me para envio manual",
                }
            )
        else:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": normalized,
                "type": "text",
                "text": {"preview_url": False, "body": message},
            }
            url = f"{api_url.rstrip('/')}/{phone_number_id}/messages"
            try:
                async with httpx.AsyncClient(timeout=20) as http:
                    resp = await http.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {token}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                data = resp.json()
                if resp.is_success and data.get("messages"):
                    doc.update(
                        {
                            "status": "enviado",
                            "provider_message_id": data["messages"][0]["id"],
                            "wamid": data["messages"][0]["id"],
                            "sent_at": _now(),
                        }
                    )
                else:
                    doc.update({"status": "falhou", "error": str(data.get("error", data))[:500]})
            except Exception as exc:  # network/provider failure is recorded, never fatal
                doc.update({"status": "falhou", "error": str(exc)[:500]})

    try:
        await db["whatsapp_messages"].insert_one(dict(doc))
    except DuplicateKeyError:
        existing = await db["whatsapp_messages"].find_one({"dedupe_key": dedupe_key}, {"_id": 0})
        return WhatsAppMessage(**existing) if existing else WhatsAppMessage(**doc)
    doc.pop("_id", None)
    doc.pop("dedupe_key", None)
    return WhatsAppMessage(**doc)


async def send_event(
    *,
    event: str,
    customer: dict[str, Any] | None,
    reservation: dict[str, Any] | None = None,
    dedupe_key: str | None = None,
) -> WhatsAppMessage | None:
    """Send one of the configurable automatic notifications."""
    if not customer:
        return None
    config = await get_whatsapp_config()
    template = getattr(config["templates"], event, None)
    if not template:
        return None
    message = render_template(
        template,
        nome=customer.get("name", "cliente"),
        data=_fmt_date((reservation or {}).get("event_date", "")),
        horario=(reservation or {}).get("start_time", ""),
    )
    return await send_message(
        message=message,
        phone=customer.get("whatsapp") or customer.get("phone", ""),
        customer_id=customer.get("id"),
        reservation_id=(reservation or {}).get("id"),
        message_type=event,
        template=event,
        dedupe_key=dedupe_key,
    )


def _fmt_date(iso: str) -> str:
    try:
        y, m, d = iso.split("-")
        return f"{d}/{m}/{y}"
    except Exception:
        return iso

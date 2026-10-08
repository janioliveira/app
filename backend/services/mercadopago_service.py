"""MercadoPagoService — PIX only. Access token never leaves the backend.

Without MERCADOPAGO_ACCESS_TOKEN the service runs in simulation mode: it produces a
real, scannable QR image for a BR Code payload so the whole flow (QR, copia e cola,
webhook, expiration, idempotency) is exercisable end to end.
"""

import base64
import hashlib
import hmac
import io
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import qrcode

MP_API = "https://api.mercadopago.com"


def access_token() -> str:
    return os.environ.get("MERCADOPAGO_ACCESS_TOKEN", "").strip()


def webhook_secret() -> str:
    return os.environ.get("MERCADOPAGO_WEBHOOK_SECRET", "").strip()


def is_simulation() -> bool:
    return not access_token()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _crc16(payload: str) -> str:
    crc = 0xFFFF
    for byte in payload.encode():
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return f"{crc:04X}"


def _tlv(tag: str, value: str) -> str:
    return f"{tag}{len(value):02d}{value}"


def build_br_code(*, pix_key: str, amount: float, merchant: str, city: str, txid: str) -> str:
    """Minimal static BR Code (EMV) payload — valid structure for PIX copia e cola."""
    key = (pix_key or "pix@lanyinflaveis.com.br")[:77]
    gui = _tlv("00", "BR.GOV.BCB.PIX") + _tlv("01", key)
    payload = (
        _tlv("00", "01")
        + _tlv("26", gui)
        + _tlv("52", "0000")
        + _tlv("53", "986")
        + _tlv("54", f"{amount:.2f}")
        + _tlv("58", "BR")
        + _tlv("59", (merchant or "LANY INFLAVEIS")[:25].upper())
        + _tlv("60", (city or "SAO PAULO")[:15].upper())
        + _tlv("62", _tlv("05", (txid or "***")[:25]))
    )
    payload += "6304"
    return payload + _crc16(payload)


def qr_png_base64(payload: str) -> str:
    img = qrcode.make(payload)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


async def _mp_request(
    method: str, path: str, *, json: Any = None, idempotency_key: str | None = None
) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {access_token()}", "Content-Type": "application/json"}
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.request(method, MP_API + path, headers=headers, json=json)
    if resp.status_code >= 400:
        raise RuntimeError(f"Mercado Pago {resp.status_code}: {resp.text[:400]}")
    return resp.json()


async def create_pix_charge(
    *,
    amount: float,
    description: str,
    payer_email: str,
    external_reference: str,
    expiration_minutes: int = 30,
    pix_key: str = "",
    merchant: str = "Lany Inflaveis",
    city: str = "Sao Paulo",
) -> dict[str, Any]:
    """Create the PIX charge and return the normalized payment payload."""
    expires_at = _now() + timedelta(minutes=max(30, expiration_minutes))

    if is_simulation():
        txid = uuid.uuid4().hex[:20].upper()
        br_code = build_br_code(
            pix_key=pix_key, amount=amount, merchant=merchant, city=city, txid=txid
        )
        return {
            "mp_payment_id": f"sim-{txid}",
            "status": "pending",
            "status_detail": "pending_waiting_transfer",
            "qr_code": br_code,
            "qr_code_base64": qr_png_base64(br_code),
            "ticket_url": "",
            "simulation": True,
            "expires_at": expires_at,
        }

    body = {
        "transaction_amount": round(float(amount), 2),
        "description": description,
        "payment_method_id": "pix",
        "payer": {"email": payer_email or "cliente@lanyinflaveis.com.br"},
        "external_reference": external_reference,
        "date_of_expiration": expires_at.astimezone(timezone.utc).isoformat(
            timespec="milliseconds"
        ).replace("+00:00", "+00:00"),
    }
    app_url = os.environ.get("APP_URL", "").rstrip("/")
    if app_url:
        body["notification_url"] = f"{app_url}/api/webhooks/mercadopago"

    result = await _mp_request(
        "POST", "/v1/payments", json=body, idempotency_key=external_reference
    )
    data = (result.get("point_of_interaction") or {}).get("transaction_data") or {}
    return {
        "mp_payment_id": str(result.get("id", "")),
        "status": result.get("status", "pending"),
        "status_detail": result.get("status_detail", ""),
        "qr_code": data.get("qr_code", ""),
        "qr_code_base64": data.get("qr_code_base64", ""),
        "ticket_url": data.get("ticket_url", "") or "",
        "simulation": False,
        "expires_at": expires_at,
    }


async def get_payment(mp_payment_id: str) -> dict[str, Any]:
    """Authoritative status straight from Mercado Pago."""
    if is_simulation() or mp_payment_id.startswith("sim-"):
        return {}
    return await _mp_request("GET", f"/v1/payments/{mp_payment_id}")


async def cancel_payment(mp_payment_id: str) -> dict[str, Any]:
    if is_simulation() or mp_payment_id.startswith("sim-"):
        return {"status": "cancelled"}
    return await _mp_request("PUT", f"/v1/payments/{mp_payment_id}", json={"status": "cancelled"})


async def refund_payment(mp_payment_id: str, amount: float | None = None) -> dict[str, Any]:
    if is_simulation() or mp_payment_id.startswith("sim-"):
        return {"status": "refunded"}
    return await _mp_request(
        "POST",
        f"/v1/payments/{mp_payment_id}/refunds",
        json=None if amount is None else {"amount": round(float(amount), 2)},
        idempotency_key=f"refund-{mp_payment_id}-{amount or 'full'}",
    )


def validate_signature(
    x_signature: str | None, x_request_id: str | None, data_id: str | None
) -> bool:
    """HMAC-SHA256 over `id:<data.id>;request-id:<id>;ts:<ts>;` per Mercado Pago docs."""
    secret = webhook_secret()
    if not secret:
        return False
    if not x_signature:
        return False
    parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
    ts, received = parts.get("ts"), parts.get("v1")
    if not ts or not received:
        return False
    try:
        if abs(time.time() - int(ts)) > 300:
            return False
    except ValueError:
        return False
    manifest = f"id:{data_id.lower()};" if data_id else ""
    if x_request_id:
        manifest += f"request-id:{x_request_id};"
    manifest += f"ts:{ts};"
    expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)

"""Settings access helpers — company data + integration config (secrets stay server-side)."""

from typing import Any

from lib.db import db
from models.schemas import (
    CompanySettings,
    IntegrationsSettings,
    MercadoPagoSettings,
    WhatsAppSettings,
    WhatsAppTemplates,
)

COMPANY_DOC = "company"
INTEGRATIONS_DOC = "integrations"


async def get_company() -> CompanySettings:
    doc = await db["settings"].find_one({"_id": COMPANY_DOC}) or {}
    doc.pop("_id", None)
    return CompanySettings(**doc)


async def save_company(data: CompanySettings) -> CompanySettings:
    await db["settings"].update_one(
        {"_id": COMPANY_DOC}, {"$set": data.model_dump()}, upsert=True
    )
    return data


async def _raw_integrations() -> dict[str, Any]:
    doc = await db["settings"].find_one({"_id": INTEGRATIONS_DOC}) or {}
    doc.pop("_id", None)
    return doc


async def get_whatsapp_config() -> dict[str, Any]:
    """Full config INCLUDING the access token — backend use only."""
    raw = await _raw_integrations()
    wa = raw.get("whatsapp", {})
    templates = WhatsAppTemplates(**(wa.get("templates") or {}))
    return {
        "provider": wa.get("provider", "meta_cloud_api"),
        "enabled": wa.get("enabled", True),
        "api_url": wa.get("api_url") or "https://graph.facebook.com/v23.0",
        "phone_number_id": wa.get("phone_number_id", ""),
        "business_phone": wa.get("business_phone", ""),
        "account_id": wa.get("account_id", ""),
        "access_token": wa.get("access_token", ""),
        "templates": templates,
    }


async def get_mercadopago_config() -> dict[str, Any]:
    raw = await _raw_integrations()
    mp = raw.get("mercadopago", {})
    return {
        "environment": mp.get("environment", "sandbox"),
        "pix_expiration_minutes": int(mp.get("pix_expiration_minutes", 30)),
    }


def _mask(token: str) -> str:
    if not token:
        return ""
    return f"{token[:6]}••••{token[-4:]}" if len(token) > 12 else "••••••"


async def public_integrations(mp_token: str, mp_secret: str) -> IntegrationsSettings:
    """Redacted view for the admin panel — never returns a full secret."""
    raw = await _raw_integrations()
    mp = raw.get("mercadopago", {})
    wa = await get_whatsapp_config()
    return IntegrationsSettings(
        mercadopago=MercadoPagoSettings(
            environment=mp.get("environment", "sandbox"),
            configured=bool(mp_token),
            token_preview=_mask(mp_token),
            webhook_secret_configured=bool(mp_secret),
            pix_expiration_minutes=int(mp.get("pix_expiration_minutes", 30)),
        ),
        whatsapp=WhatsAppSettings(
            provider=wa["provider"],
            enabled=wa["enabled"],
            api_url=wa["api_url"],
            phone_number_id=wa["phone_number_id"],
            business_phone=wa["business_phone"],
            account_id=wa["account_id"],
            configured=bool(wa["access_token"]),
            token_preview=_mask(wa["access_token"]),
            templates=wa["templates"],
        ),
    )


async def save_whatsapp(data: dict[str, Any]) -> None:
    update = {f"whatsapp.{k}": v for k, v in data.items() if v is not None}
    if not update:
        return
    await db["settings"].update_one({"_id": INTEGRATIONS_DOC}, {"$set": update}, upsert=True)


async def save_mercadopago(data: dict[str, Any]) -> None:
    update = {f"mercadopago.{k}": v for k, v in data.items() if v is not None}
    if not update:
        return
    await db["settings"].update_one({"_id": INTEGRATIONS_DOC}, {"$set": update}, upsert=True)

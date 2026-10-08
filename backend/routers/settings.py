"""Settings — company data, Mercado Pago and WhatsApp integration config (secrets redacted)."""

from fastapi import APIRouter, Depends

from lib.auth import current_user, require_admin
from models.schemas import (
    CompanySettings,
    IntegrationsSettings,
    OkResponse,
    WhatsAppSettingsInput,
)
from services import mercadopago_service as mp
from services.notification_service import log_audit
from services.settings_service import (
    get_company,
    public_integrations,
    save_company,
    save_mercadopago,
    save_whatsapp,
)

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/company", response_model=CompanySettings)
async def read_company():
    """Public: the storefront shows the company identity (no secrets in this model)."""
    return await get_company()


@router.put("/company", response_model=CompanySettings)
async def update_company(payload: CompanySettings, user: dict = Depends(require_admin)):
    saved = await save_company(payload)
    await log_audit(user=user, action="update", entity="settings", entity_id="company")
    return saved


@router.get("/integrations", response_model=IntegrationsSettings)
async def read_integrations(_: dict = Depends(require_admin)):
    return await public_integrations(mp.access_token(), mp.webhook_secret())


@router.put("/integrations/whatsapp", response_model=IntegrationsSettings)
async def update_whatsapp(payload: WhatsAppSettingsInput, user: dict = Depends(require_admin)):
    data = payload.model_dump(exclude_none=True)
    if data.get("templates"):
        data["templates"] = payload.templates.model_dump() if payload.templates else None
    await save_whatsapp(data)
    await log_audit(
        user=user,
        action="update",
        entity="settings",
        entity_id="whatsapp",
        details="token atualizado" if data.get("access_token") else "configuração atualizada",
    )
    return await public_integrations(mp.access_token(), mp.webhook_secret())


@router.put("/integrations/mercadopago", response_model=IntegrationsSettings)
async def update_mercadopago(
    environment: str = "sandbox",
    pix_expiration_minutes: int = 30,
    user: dict = Depends(require_admin),
):
    await save_mercadopago(
        {
            "environment": environment,
            "pix_expiration_minutes": max(30, min(pix_expiration_minutes, 1440)),
        }
    )
    await log_audit(user=user, action="update", entity="settings", entity_id="mercadopago")
    return await public_integrations(mp.access_token(), mp.webhook_secret())


@router.get("/status", response_model=OkResponse)
async def integration_status(_: dict = Depends(current_user)):
    mode = "produção" if mp.access_token() else "simulação (sem Access Token)"
    return OkResponse(ok=True, message=f"Mercado Pago PIX em modo {mode}")

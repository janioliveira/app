"""Payments — PIX creation, status polling and admin actions (cancel/refund/simulate)."""

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import ROLE_CUSTOMER, current_user, optional_user, require_staff
from lib.db import db
from models.schemas import Payment, PaymentCreateInput
from services import payment_service as ps
from services.notification_service import log_audit
from services.reservation_service import expire_stale_reservations

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=list[Payment])
async def list_payments(status: str = Query(default=""), user: dict = Depends(current_user)):
    await expire_stale_reservations()
    query: dict = {}
    if user["role"] == ROLE_CUSTOMER:
        query["customer_id"] = user.get("customer_id")
    if status:
        query["status"] = status
    docs = await db["payments"].find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Payment(**d) for d in docs]


@router.post("/pix", response_model=Payment)
async def create_pix(payload: PaymentCreateInput, user: dict | None = Depends(optional_user)):
    """Public: the checkout page calls this right after the pré-reserva is created."""
    reservation = await db["reservations"].find_one({"id": payload.reservation_id}, {"_id": 0})
    if not reservation:
        raise HTTPException(status_code=404, detail="Reserva não encontrada")
    if user and user["role"] == ROLE_CUSTOMER and reservation["customer_id"] != user.get("customer_id"):
        raise HTTPException(status_code=403, detail="Acesso negado à reserva de outro cliente")
    if reservation["status"] in ("confirmada", "finalizada"):
        raise HTTPException(status_code=409, detail="Reserva já está paga")
    if reservation["status"] in ("cancelada",):
        raise HTTPException(status_code=409, detail="Reserva cancelada")

    customer = await db["customers"].find_one({"id": reservation["customer_id"]}, {"_id": 0})
    # The amount always comes from the server-side reservation total, never from the client.
    payment = await ps.create_pix_for_reservation(reservation, customer or {})
    return Payment(**payment)


@router.get("/{payment_id}", response_model=Payment)
async def get_payment(payment_id: str, user: dict | None = Depends(optional_user)):
    doc = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if user and user["role"] == ROLE_CUSTOMER and doc["customer_id"] != user.get("customer_id"):
        raise HTTPException(status_code=403, detail="Acesso negado")
    doc = await ps.sync_payment(doc)
    fresh = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    return Payment(**(fresh or doc))


@router.post("/{payment_id}/simulate-approval", response_model=Payment)
async def simulate_approval(payment_id: str, user: dict | None = Depends(optional_user)):
    """Demo/sandbox only: drives the same approval path a real webhook would."""
    from services.mercadopago_service import is_simulation

    if not is_simulation():
        raise HTTPException(
            status_code=403,
            detail="Indisponível: credenciais reais do Mercado Pago estão ativas",
        )
    doc = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if doc["status"] == "approved":
        return Payment(**doc)
    if doc["status"] != "pending":
        raise HTTPException(status_code=409, detail="Cobrança não está mais pendente")
    await ps.approve_payment(doc, source="simulacao")
    fresh = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    await log_audit(user=user, action="pix_simulate_approval", entity="payment", entity_id=payment_id)
    return Payment(**fresh)


@router.post("/{payment_id}/cancel", response_model=Payment)
async def cancel(payment_id: str, user: dict = Depends(require_staff)):
    doc = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    await ps.cancel_pix(doc)
    await log_audit(user=user, action="pix_cancel", entity="payment", entity_id=payment_id)
    fresh = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    return Payment(**fresh)


@router.post("/{payment_id}/refund", response_model=Payment)
async def refund(payment_id: str, user: dict = Depends(require_staff)):
    doc = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    if doc["status"] != "approved":
        raise HTTPException(status_code=409, detail="Somente pagamentos aprovados podem ser estornados")
    await ps.refund_pix(doc)
    await log_audit(user=user, action="pix_refund", entity="payment", entity_id=payment_id)
    fresh = await db["payments"].find_one({"id": payment_id}, {"_id": 0})
    return Payment(**fresh)

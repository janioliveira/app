"""Financial control — PIX revenue, expenses by category and the consolidated summary."""

from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import require_admin
from lib.db import db
from lib.dates import today_iso
from models.schemas import FinancialEntry, FinancialEntryInput, FinancialSummary, OkResponse
from services.notification_service import log_audit
from services.reservation_service import expire_stale_reservations

router = APIRouter(prefix="/financial", tags=["financial"])


@router.get("/entries", response_model=list[FinancialEntry])
async def list_entries(
    kind: str = Query(default=""),
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    _: dict = Depends(require_admin),
):
    query: dict = {}
    if kind:
        query["kind"] = kind
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    docs = await db["financial_entries"].find(query, {"_id": 0}).sort("date", -1).to_list(2000)
    return [FinancialEntry(**d) for d in docs]


@router.post("/entries", response_model=FinancialEntry)
async def create_entry(payload: FinancialEntryInput, user: dict = Depends(require_admin)):
    entry = FinancialEntry(**{**payload.model_dump(), "date": payload.date or today_iso()})
    await db["financial_entries"].insert_one(entry.model_dump())
    await log_audit(
        user=user,
        action="create",
        entity="financial_entry",
        entity_id=entry.id,
        details=f"{entry.kind} {entry.category} {entry.amount}",
    )
    return entry


@router.delete("/entries/{entry_id}", response_model=OkResponse)
async def delete_entry(entry_id: str, user: dict = Depends(require_admin)):
    entry = await db["financial_entries"].find_one({"id": entry_id}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado")
    if entry.get("payment_id"):
        raise HTTPException(
            status_code=409, detail="Lançamentos gerados por pagamento PIX não podem ser excluídos"
        )
    await db["financial_entries"].delete_one({"id": entry_id})
    await log_audit(user=user, action="delete", entity="financial_entry", entity_id=entry_id)
    return OkResponse(message="Lançamento removido")


@router.get("/summary", response_model=FinancialSummary)
async def summary(
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    _: dict = Depends(require_admin),
):
    await expire_stale_reservations()
    query: dict = {}
    if date_from or date_to:
        query["date"] = {}
        if date_from:
            query["date"]["$gte"] = date_from
        if date_to:
            query["date"]["$lte"] = date_to
    entries = await db["financial_entries"].find(query, {"_id": 0}).to_list(5000)
    payments = await db["payments"].find({}, {"_id": 0}).to_list(5000)

    revenue = round(sum(e["amount"] for e in entries if e["kind"] == "entrada"), 2)
    expenses = round(sum(e["amount"] for e in entries if e["kind"] == "saida"), 2)

    by_status: dict[str, float] = defaultdict(float)
    for payment in payments:
        by_status[payment["status"]] += payment["amount"]

    by_category: dict[str, float] = defaultdict(float)
    for entry in entries:
        if entry["kind"] == "saida":
            by_category[entry["category"]] += entry["amount"]

    return FinancialSummary(
        revenue=revenue,
        expenses=expenses,
        net_profit=round(revenue - expenses, 2),
        receivable=round(by_status["pending"], 2),
        received=round(by_status["approved"], 2),
        pix_pending=round(by_status["pending"], 2),
        pix_approved=round(by_status["approved"], 2),
        pix_expired=round(by_status["expired"], 2),
        pix_cancelled=round(by_status["cancelled"], 2),
        pix_refunded=round(by_status["refunded"], 2),
        expenses_by_category=[
            {"category": k, "amount": round(v, 2)}
            for k, v in sorted(by_category.items(), key=lambda kv: -kv[1])
        ],
    )

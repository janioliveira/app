"""Dashboard — KPIs and chart series, all computed server-side against the UTC clock."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from lib.auth import require_staff
from lib.db import db
from lib.dates import today_iso
from models.schemas import DashboardChartPoint, DashboardSummary, Reservation
from services.reservation_service import BLOCKING_STATUSES, expire_stale_reservations

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(_: dict = Depends(require_staff)):
    await expire_stale_reservations()

    today = today_iso()
    now = datetime.now(timezone.utc)
    week_end = (now + timedelta(days=7)).strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    reservations = await db["reservations"].find({}, {"_id": 0}).to_list(5000)
    payments = await db["payments"].find({}, {"_id": 0}).to_list(5000)
    toys = await db["toys"].find({}, {"_id": 0}).to_list(500)
    entries = await db["financial_entries"].find({}, {"_id": 0}).to_list(5000)

    active = [r for r in reservations if r["status"] in BLOCKING_STATUSES]
    today_reservations = [r for r in active if r["event_date"] == today]

    upcoming = sorted(
        [r for r in active if r["event_date"] >= today], key=lambda r: (r["event_date"], r["start_time"])
    )

    rented_today = sum(
        int(item.get("quantity", 1)) for r in today_reservations for item in r.get("items", [])
    )
    available_toys = sum(
        int(t.get("quantity", 1)) for t in toys if t.get("status") == "disponivel"
    )

    # Charts: last 6 months of revenue and reservation counts.
    revenue_by_month: dict[str, float] = defaultdict(float)
    for entry in entries:
        if entry["kind"] == "entrada":
            revenue_by_month[entry["date"][:7]] += entry["amount"]

    reservations_by_month: dict[str, int] = defaultdict(int)
    for reservation in reservations:
        reservations_by_month[reservation["event_date"][:7]] += 1

    months: list[str] = []
    cursor = now.replace(day=1)
    for _offset in range(6):
        months.append(cursor.strftime("%Y-%m"))
        cursor = (cursor - timedelta(days=1)).replace(day=1)
    months.reverse()

    def label(key: str) -> str:
        year, month = key.split("-")
        return f"{MONTHS_PT[int(month) - 1]}/{year[2:]}"

    top_counter: dict[str, int] = defaultdict(int)
    for reservation in reservations:
        if reservation["status"] in ("cancelada", "expirada"):
            continue
        for item in reservation.get("items", []):
            top_counter[item.get("toy_name", "—")] += int(item.get("quantity", 1))

    payments_counter: dict[str, int] = defaultdict(int)
    for payment in payments:
        payments_counter[payment["status"]] += 1

    status_labels = {
        "approved": "Aprovados",
        "pending": "Pendentes",
        "expired": "Expirados",
        "cancelled": "Cancelados",
        "refunded": "Estornados",
        "rejected": "Recusados",
    }

    next_event = Reservation(**upcoming[0]) if upcoming else None

    return DashboardSummary(
        reservations_today=len(today_reservations),
        reservations_week=len([r for r in active if today <= r["event_date"] <= week_end]),
        reservations_month=len([r for r in active if r["event_date"].startswith(month_prefix)]),
        next_event=next_event,
        toys_available=max(available_toys - rented_today, 0),
        toys_rented_today=rented_today,
        payments_pending=payments_counter["pending"],
        payments_approved=payments_counter["approved"],
        amount_received=round(sum(p["amount"] for p in payments if p["status"] == "approved"), 2),
        amount_receivable=round(sum(p["amount"] for p in payments if p["status"] == "pending"), 2),
        revenue_month=round(revenue_by_month.get(month_prefix, 0), 2),
        cancellations_month=len(
            [
                r
                for r in reservations
                if r["status"] in ("cancelada", "expirada")
                and r["event_date"].startswith(month_prefix)
            ]
        ),
        revenue_chart=[
            DashboardChartPoint(label=label(m), value=round(revenue_by_month.get(m, 0), 2))
            for m in months
        ],
        reservations_chart=[
            DashboardChartPoint(label=label(m), value=reservations_by_month.get(m, 0))
            for m in months
        ],
        top_toys=[
            DashboardChartPoint(label=name, value=count)
            for name, count in sorted(top_counter.items(), key=lambda kv: -kv[1])[:6]
        ],
        payments_chart=[
            DashboardChartPoint(label=status_labels.get(k, k), value=v)
            for k, v in payments_counter.items()
        ],
    )

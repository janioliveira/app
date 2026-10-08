"""Reports with CSV export. PDF is produced client-side from the printable report view."""

import csv
import io
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from lib.auth import require_admin
from lib.db import db

router = APIRouter(prefix="/reports", tags=["reports"])

REPORTS: dict[str, dict[str, Any]] = {
    "reservas": {
        "collection": "reservations",
        "columns": [
            ("code", "Código"),
            ("customer_name", "Cliente"),
            ("event_date", "Data"),
            ("start_time", "Início"),
            ("end_time", "Fim"),
            ("total", "Total"),
            ("status", "Status"),
        ],
        "sort": "event_date",
    },
    "faturamento": {
        "collection": "financial_entries",
        "columns": [
            ("date", "Data"),
            ("kind", "Tipo"),
            ("category", "Categoria"),
            ("description", "Descrição"),
            ("amount", "Valor"),
        ],
        "sort": "date",
    },
    "clientes": {
        "collection": "customers",
        "columns": [
            ("name", "Nome"),
            ("document", "CPF/CNPJ"),
            ("whatsapp", "WhatsApp"),
            ("email", "E-mail"),
            ("city", "Cidade"),
            ("state", "UF"),
        ],
        "sort": "name",
    },
    "brinquedos": {
        "collection": "toys",
        "columns": [
            ("name", "Nome"),
            ("category", "Categoria"),
            ("quantity", "Quantidade"),
            ("daily_price", "Valor diária"),
            ("status", "Status"),
            ("age_range", "Faixa etária"),
        ],
        "sort": "name",
    },
    "pagamentos": {
        "collection": "payments",
        "columns": [
            ("id", "ID"),
            ("customer_name", "Cliente"),
            ("amount", "Valor"),
            ("status", "Status"),
            ("mp_payment_id", "ID Mercado Pago"),
            ("created_at", "Criado em"),
        ],
        "sort": "created_at",
    },
    "contratos": {
        "collection": "contracts",
        "columns": [
            ("number", "Número"),
            ("status", "Status"),
            ("signature_name", "Assinado por"),
            ("accepted_at", "Aceito em"),
            ("version", "Versão"),
        ],
        "sort": "created_at",
    },
    "cancelamentos": {
        "collection": "reservations",
        "columns": [
            ("code", "Código"),
            ("customer_name", "Cliente"),
            ("event_date", "Data"),
            ("total", "Total"),
            ("status", "Status"),
        ],
        "sort": "event_date",
        "query": {"status": {"$in": ["cancelada", "expirada"]}},
    },
    "whatsapp": {
        "collection": "whatsapp_messages",
        "columns": [
            ("created_at", "Criado em"),
            ("phone", "Telefone"),
            ("message_type", "Tipo"),
            ("status", "Status"),
            ("error", "Erro"),
        ],
        "sort": "created_at",
    },
}


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:.2f}".replace(".", ",")
    return str(value)


@router.get("/types", response_model=list[str])
async def report_types(_: dict = Depends(require_admin)):
    return list(REPORTS.keys())


@router.get("/{report}")
async def report_data(
    report: str,
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    _: dict = Depends(require_admin),
):
    spec = REPORTS.get(report)
    if not spec:
        raise HTTPException(status_code=404, detail="Relatório não encontrado")
    query: dict[str, Any] = dict(spec.get("query") or {})
    date_field = "event_date" if spec["collection"] == "reservations" else spec["sort"]
    if (date_from or date_to) and date_field in ("event_date", "date"):
        query[date_field] = {}
        if date_from:
            query[date_field]["$gte"] = date_from
        if date_to:
            query[date_field]["$lte"] = date_to
    docs = await db[spec["collection"]].find(query, {"_id": 0}).sort(spec["sort"], -1).to_list(5000)
    return {
        "report": report,
        "columns": [{"key": k, "label": label} for k, label in spec["columns"]],
        "rows": [{k: _stringify(d.get(k)) for k, _ in spec["columns"]} for d in docs],
        "count": len(docs),
    }


@router.get("/{report}/export.csv")
async def export_csv(
    report: str,
    date_from: str = Query(default=""),
    date_to: str = Query(default=""),
    user: dict = Depends(require_admin),
):
    data = await report_data(report, date_from, date_to, user)
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow([c["label"] for c in data["columns"]])
    for row in data["rows"]:
        writer.writerow([row[c["key"]] for c in data["columns"]])
    buffer.seek(0)
    # BOM so Excel pt-BR opens the accented CSV correctly.
    content = "\ufeff" + buffer.getvalue()
    return StreamingResponse(
        io.BytesIO(content.encode("utf-8")),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="relatorio-{report}.csv"'},
    )

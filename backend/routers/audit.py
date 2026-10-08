"""Audit trail — admin-only read access."""

from fastapi import APIRouter, Depends, Query

from lib.auth import require_admin
from lib.db import db
from models.schemas import AuditLog

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLog])
async def list_logs(
    entity: str = Query(default=""),
    action: str = Query(default=""),
    _: dict = Depends(require_admin),
):
    query: dict = {}
    if entity:
        query["entity"] = entity
    if action:
        query["action"] = action
    docs = await db["audit_logs"].find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [AuditLog(**d) for d in docs]

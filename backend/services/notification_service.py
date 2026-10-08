"""Audit trail + internal notifications (idempotent via dedupe_key)."""

from typing import Any

from pymongo.errors import DuplicateKeyError

from lib.db import db
from models.schemas import AuditLog, Notification


async def log_audit(
    *,
    user: dict[str, Any] | None,
    action: str,
    entity: str = "",
    entity_id: str = "",
    details: str = "",
    ip: str = "",
) -> None:
    entry = AuditLog(
        user_id=(user or {}).get("id", ""),
        user_name=(user or {}).get("name", "sistema"),
        action=action,
        entity=entity,
        entity_id=entity_id,
        details=details,
        ip=ip,
    )
    await db["audit_logs"].insert_one(entry.model_dump())


async def notify(
    *,
    title: str,
    message: str = "",
    kind: str = "info",
    event: str = "",
    reservation_id: str | None = None,
    customer_id: str | None = None,
    dedupe_key: str | None = None,
) -> None:
    doc = Notification(
        title=title,
        message=message,
        kind=kind,
        event=event,
        reservation_id=reservation_id,
        customer_id=customer_id,
    ).model_dump()
    if dedupe_key:
        doc["dedupe_key"] = dedupe_key
    try:
        await db["notifications"].insert_one(doc)
    except DuplicateKeyError:
        pass  # same event already notified — idempotent by design

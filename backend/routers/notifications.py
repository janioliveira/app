"""Internal notification centre."""

from fastapi import APIRouter, Depends, HTTPException, Query

from lib.auth import ROLE_CUSTOMER, current_user
from lib.db import db
from models.schemas import Notification, OkResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[Notification])
async def list_notifications(
    unread_only: bool = Query(default=False), user: dict = Depends(current_user)
):
    query: dict = {}
    if user["role"] == ROLE_CUSTOMER:
        query["customer_id"] = user.get("customer_id")
    if unread_only:
        query["read"] = False
    docs = await db["notifications"].find(query, {"_id": 0}).sort("created_at", -1).to_list(300)
    return [Notification(**d) for d in docs]


@router.post("/{notification_id}/read", response_model=Notification)
async def mark_read(notification_id: str, _: dict = Depends(current_user)):
    result = await db["notifications"].update_one(
        {"id": notification_id}, {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    doc = await db["notifications"].find_one({"id": notification_id}, {"_id": 0})
    return Notification(**doc)


@router.post("/read-all", response_model=OkResponse)
async def mark_all_read(user: dict = Depends(current_user)):
    query: dict = {"read": False}
    if user["role"] == ROLE_CUSTOMER:
        query["customer_id"] = user.get("customer_id")
    result = await db["notifications"].update_many(query, {"$set": {"read": True}})
    return OkResponse(message=f"{result.modified_count} notificações marcadas como lidas")

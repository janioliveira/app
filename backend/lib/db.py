"""Shared Mongo handle — import `client`/`db` from here (server.py, routers, seed.py)."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING, IndexModel

load_dotenv(Path(__file__).parent.parent / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logger = logging.getLogger(__name__)

# One entry per collection: every field a route filters, sorts, or dedupes on.
INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("role", ASCENDING)], name="role"),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="ttl", expireAfterSeconds=0),
    ],
    "customers": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("document", ASCENDING)], name="document"),
        IndexModel([("name", ASCENDING)], name="name"),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
    ],
    "toys": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("category", ASCENDING), ("name", ASCENDING)], name="category_name"),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "reservations": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("code", ASCENDING)], name="code", unique=True),
        IndexModel([("event_date", ASCENDING), ("status", ASCENDING)], name="date_status"),
        IndexModel([("customer_id", ASCENDING), ("event_date", DESCENDING)], name="customer_date"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
    ],
    "quotes": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("number", ASCENDING)], name="number", unique=True),
        IndexModel([("customer_id", ASCENDING), ("created_at", DESCENDING)], name="customer_created"),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "payments": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("reservation_id", ASCENDING)], name="reservation"),
        IndexModel([("mp_payment_id", ASCENDING)], name="mp_payment_id"),
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)], name="status_created"),
    ],
    "contracts": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("reservation_id", ASCENDING)], name="reservation", unique=True),
        IndexModel([("customer_id", ASCENDING)], name="customer"),
        IndexModel([("status", ASCENDING)], name="status"),
    ],
    "financial_entries": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("kind", ASCENDING), ("date", DESCENDING)], name="kind_date"),
        IndexModel([("reservation_id", ASCENDING)], name="reservation"),
        IndexModel([("payment_id", ASCENDING)], name="payment"),
    ],
    "notifications": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("read", ASCENDING), ("created_at", DESCENDING)], name="read_created"),
        IndexModel([("dedupe_key", ASCENDING)], name="dedupe", unique=True, sparse=True),
    ],
    "whatsapp_messages": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("customer_id", ASCENDING), ("created_at", DESCENDING)], name="customer_created"),
        IndexModel([("status", ASCENDING)], name="status"),
        IndexModel([("wamid", ASCENDING)], name="wamid", sparse=True),
        IndexModel([("dedupe_key", ASCENDING)], name="dedupe", unique=True, sparse=True),
    ],
    "audit_logs": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("created_at", DESCENDING)], name="created_desc"),
        IndexModel([("entity", ASCENDING), ("entity_id", ASCENDING)], name="entity"),
    ],
    "webhook_events": [
        IndexModel([("event_key", ASCENDING)], name="event_key", unique=True),
    ],
    "settings": [],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:  # one at a time so a bad spec skips only itself
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:  # never block boot on an index
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)

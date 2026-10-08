"""Remove registros órfãos cujas reservas não existem mais (limpeza pós-teste).

Uso: cd /app/backend && python cleanup_orphans.py
"""

import asyncio

from lib.db import db

CHILD_COLLECTIONS = (
    "payments",
    "contracts",
    "financial_entries",
    "whatsapp_messages",
    "notifications",
)


async def main() -> None:
    alive = {
        r["id"] for r in await db["reservations"].find({}, {"id": 1, "_id": 0}).to_list(10000)
    }
    print(f"reservas existentes: {len(alive)}")

    for collection in CHILD_COLLECTIONS:
        docs = await db[collection].find(
            {"reservation_id": {"$nin": [None, ""]}}, {"id": 1, "reservation_id": 1, "_id": 0}
        ).to_list(20000)
        orphans = [d["id"] for d in docs if d.get("reservation_id") not in alive]
        if orphans:
            result = await db[collection].delete_many({"id": {"$in": orphans}})
            print(f"{collection}: {result.deleted_count} órfão(s) removido(s)")
        else:
            print(f"{collection}: nenhum órfão")

    print("limpeza concluída")


if __name__ == "__main__":
    asyncio.run(main())

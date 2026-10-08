"""Idempotent demo seed for Lany Infláveis. Run: cd /app/backend && python seed.py"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from models.schemas import (
    CompanySettings,
    Contract,
    Customer,
    FinancialEntry,
    Reservation,
    Toy,
)
from services.contract_service import build_contract_body

ADMIN_EMAIL = "admin@lanyinflaveis.com.br"
STAFF_EMAIL = "equipe@lanyinflaveis.com.br"
CUSTOMER_EMAIL = "cliente@exemplo.com.br"
DEFAULT_PASSWORD = "Lany@2026"

TOYS = [
    {
        "name": "Futebol de Sabão",
        "category": "Inflável",
        "description": "Campo inflável com espuma e sabão — a atração mais disputada das festas.",
        "image_url": "https://images.unsplash.com/photo-1740033135773-bf7c886ae45a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "width_m": 4,
        "length_m": 8,
        "height_m": 2,
        "capacity": 12,
        "age_range": "8 a 14 anos",
        "daily_price": 650.0,
        "quantity": 1,
        "notes": "Necessita ponto de água próximo.",
    },
    {
        "name": "Cama Elástica 3,05m",
        "category": "Cama Elástica",
        "description": "Cama elástica com rede de proteção total e escada de acesso.",
        "image_url": "https://images.unsplash.com/photo-1740033135773-bf7c886ae45a?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "width_m": 3.05,
        "length_m": 3.05,
        "height_m": 2.5,
        "capacity": 6,
        "age_range": "4 a 12 anos",
        "daily_price": 280.0,
        "quantity": 2,
    },
    {
        "name": "Tobogã Inflável 5m",
        "category": "Inflável",
        "description": "Tobogã gigante com escalada lateral e piscina de amortecimento.",
        "image_url": "https://images.unsplash.com/photo-1770144018298-9a39b149b372?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "width_m": 4,
        "length_m": 9,
        "height_m": 5,
        "capacity": 10,
        "age_range": "5 a 14 anos",
        "daily_price": 720.0,
        "quantity": 1,
    },
    {
        "name": "Pula-Pula Castelo 3x3m",
        "category": "Inflável",
        "description": "Castelinho encantado com cerca inflável e teto solar.",
        "image_url": "https://images.unsplash.com/photo-1765947389633-461a4af7712b?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "width_m": 3,
        "length_m": 3,
        "height_m": 2.8,
        "capacity": 8,
        "age_range": "2 a 10 anos",
        "daily_price": 320.0,
        "quantity": 3,
    },
    {
        "name": "Piscina de Bolinhas",
        "category": "Área Baby",
        "description": "Piscina cercada com 2.000 bolinhas coloridas higienizadas.",
        "image_url": "https://images.unsplash.com/photo-1531956531700-dc0ee0f1f9a5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "width_m": 2,
        "length_m": 2,
        "height_m": 0.6,
        "capacity": 8,
        "age_range": "1 a 6 anos",
        "daily_price": 180.0,
        "quantity": 2,
    },
    {
        "name": "Carrinho Pipoca & Algodão Doce",
        "category": "Alimentação",
        "description": "Carrinho retrô com pipoca e algodão doce ilimitados por 4 horas.",
        "image_url": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200",
        "width_m": 1,
        "length_m": 1.4,
        "height_m": 1.6,
        "capacity": 100,
        "age_range": "Livre",
        "daily_price": 390.0,
        "quantity": 1,
        "status": "manutencao",
        "maintenance_notes": "Troca da resistência do algodão doce prevista para esta semana.",
    },
]

CUSTOMERS = [
    {
        "name": "Mariana Alves Ribeiro",
        "document": "324.558.110-45",
        "phone": "+5511982340011",
        "whatsapp": "+5511982340011",
        "email": CUSTOMER_EMAIL,
        "zip_code": "04533-010",
        "street": "Rua Jerônimo da Veiga",
        "number": "142",
        "complement": "Apto 72",
        "district": "Itaim Bibi",
        "city": "São Paulo",
        "state": "SP",
        "notes": "Cliente recorrente — sempre pede montagem com 2h de antecedência.",
    },
    {
        "name": "Condomínio Jardim das Acácias",
        "document": "18.442.props/0001-23".replace("props", "773"),
        "phone": "+5511975512200",
        "whatsapp": "+5511975512200",
        "email": "sindico@jardimacacias.com.br",
        "zip_code": "05726-190",
        "street": "Av. das Acácias",
        "number": "900",
        "district": "Vila Andrade",
        "city": "São Paulo",
        "state": "SP",
        "notes": "Eventos no salão de festas — acesso pela portaria de serviço.",
    },
    {
        "name": "Rafael Monteiro Dias",
        "document": "702.113.908-22",
        "phone": "+5511996700188",
        "whatsapp": "+5511996700188",
        "email": "rafael.dias@exemplo.com.br",
        "zip_code": "09780-000",
        "street": "Rua das Palmeiras",
        "number": "55",
        "district": "Centro",
        "city": "São Bernardo do Campo",
        "state": "SP",
    },
]


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def seed_users(customer_id: str) -> None:
    users = [
        {
            "name": "Lany Souza (Administradora)",
            "email": ADMIN_EMAIL,
            "role": "admin",
            "customer_id": None,
        },
        {
            "name": "Equipe Operacional",
            "email": STAFF_EMAIL,
            "role": "funcionario",
            "customer_id": None,
        },
        {
            "name": "Mariana Alves Ribeiro",
            "email": CUSTOMER_EMAIL,
            "role": "cliente",
            "customer_id": customer_id,
        },
    ]
    for user in users:
        await db["users"].update_one(
            {"email": user["email"]},
            {
                "$set": {**user, "active": True},
                "$setOnInsert": {
                    "id": str(uuid.uuid4()),
                    "password_hash": hash_password(DEFAULT_PASSWORD),
                    "created_at": _now(),
                },
            },
            upsert=True,
        )


async def main() -> None:
    print("Semeando dados de demonstração da Lany Infláveis…")

    await db["settings"].update_one(
        {"_id": "company"},
        {
            "$set": CompanySettings(
                name="Lany Infláveis",
                trade_name="Lany Infláveis",
                legal_name="Lany Infláveis Locação de Brinquedos LTDA",
                document="52.118.904/0001-67",
                phone="+5511991234567",
                whatsapp="+5511991234567",
                email="contato@lanyinflaveis.com.br",
                instagram="@lanyinflaveis",
                address="Rua das Festas, 220 — Galpão 3",
                city="São Paulo",
                state="SP",
                pix_key="contato@lanyinflaveis.com.br",
            ).model_dump()
        },
        upsert=True,
    )

    # Toys
    toy_ids: dict[str, str] = {}
    for data in TOYS:
        existing = await db["toys"].find_one({"name": data["name"]}, {"_id": 0})
        if existing:
            toy_ids[data["name"]] = existing["id"]
            continue
        toy = Toy(**{**data, "is_demo": True})
        await db["toys"].insert_one(toy.model_dump())
        toy_ids[data["name"]] = toy.id

    # Customers
    customer_ids: dict[str, str] = {}
    for data in CUSTOMERS:
        existing = await db["customers"].find_one({"email": data["email"]}, {"_id": 0})
        if existing:
            customer_ids[data["name"]] = existing["id"]
            continue
        customer = Customer(**{**data, "is_demo": True})
        await db["customers"].insert_one(customer.model_dump())
        customer_ids[data["name"]] = customer.id

    await seed_users(customer_ids["Mariana Alves Ribeiro"])

    # Reservations across past/future so the dashboard and charts have signal.
    today = _now()
    plan = [
        ("Mariana Alves Ribeiro", "Pula-Pula Castelo 3x3m", 1, today + timedelta(days=3), "confirmada", "14:00", "19:00"),
        ("Mariana Alves Ribeiro", "Futebol de Sabão", 1, today - timedelta(days=24), "finalizada", "13:00", "18:00"),
        ("Condomínio Jardim das Acácias", "Tobogã Inflável 5m", 1, today + timedelta(days=9), "aguardando_pagamento", "10:00", "17:00"),
        ("Condomínio Jardim das Acácias", "Cama Elástica 3,05m", 2, today - timedelta(days=52), "finalizada", "09:00", "16:00"),
        ("Rafael Monteiro Dias", "Piscina de Bolinhas", 1, today + timedelta(days=1), "pre_reserva", "15:00", "20:00"),
        ("Rafael Monteiro Dias", "Cama Elástica 3,05m", 1, today - timedelta(days=8), "cancelada", "11:00", "16:00"),
    ]

    for idx, (customer_name, toy_name, qty, when, status, start, end) in enumerate(plan, start=1):
        code = f"RES-DEMO-{idx:03d}"
        if await db["reservations"].find_one({"code": code}):
            continue
        toy = await db["toys"].find_one({"id": toy_ids[toy_name]}, {"_id": 0})
        customer = await db["customers"].find_one(
            {"id": customer_ids[customer_name]}, {"_id": 0}
        )
        unit = float(toy["daily_price"])
        subtotal = round(unit * qty, 2)
        delivery = 80.0
        total = round(subtotal + delivery, 2)
        reservation = Reservation(
            code=code,
            customer_id=customer["id"],
            customer_name=customer["name"],
            customer_whatsapp=customer.get("whatsapp", ""),
            items=[
                {
                    "toy_id": toy["id"],
                    "toy_name": toy["name"],
                    "quantity": qty,
                    "unit_price": unit,
                }
            ],
            event_date=when.strftime("%Y-%m-%d"),
            start_time=start,
            end_time=end,
            address=f"{customer.get('street', '')}, {customer.get('number', '')}",
            city=customer.get("city", ""),
            district=customer.get("district", ""),
            subtotal=subtotal,
            discount=0,
            delivery_fee=delivery,
            total=total,
            status=status,
            notes="Reserva de demonstração.",
            is_demo=True,
            created_at=when - timedelta(days=5),
            updated_at=when - timedelta(days=5),
        )
        await db["reservations"].insert_one(reservation.model_dump())

        if status in ("confirmada", "finalizada"):
            payment_id = str(uuid.uuid4())
            await db["payments"].insert_one(
                {
                    "id": payment_id,
                    "reservation_id": reservation.id,
                    "customer_id": customer["id"],
                    "customer_name": customer["name"],
                    "amount": total,
                    "method": "pix",
                    "status": "approved",
                    "status_detail": "approved_demo",
                    "mp_payment_id": f"sim-DEMO{idx:04d}",
                    "qr_code": "",
                    "qr_code_base64": "",
                    "ticket_url": "",
                    "simulation": True,
                    "expires_at": None,
                    "approved_at": when - timedelta(days=4),
                    "created_at": when - timedelta(days=5),
                }
            )
            await db["reservations"].update_one(
                {"id": reservation.id}, {"$set": {"payment_id": payment_id}}
            )
            await db["financial_entries"].insert_one(
                FinancialEntry(
                    kind="entrada",
                    category="PIX Mercado Pago",
                    description=f"Pagamento PIX da reserva {code}",
                    amount=total,
                    date=(when - timedelta(days=4)).strftime("%Y-%m-%d"),
                    reservation_id=reservation.id,
                    payment_id=payment_id,
                ).model_dump()
            )

            count = await db["contracts"].count_documents({})
            contract = Contract(
                reservation_id=reservation.id,
                customer_id=customer["id"],
                number=f"CT-DEMO-{count + 1:04d}",
                body=await build_contract_body(reservation.model_dump(), customer),
                status="aceito" if status == "finalizada" else "pendente",
                accepted_at=when - timedelta(days=3) if status == "finalizada" else None,
                accepted_by=customer["name"] if status == "finalizada" else "",
                accepted_ip="177.12.44.8" if status == "finalizada" else "",
                signature_name=customer["name"] if status == "finalizada" else "",
            )
            await db["contracts"].insert_one(contract.model_dump())
            await db["reservations"].update_one(
                {"id": reservation.id}, {"$set": {"contract_id": contract.id}}
            )

    # Expenses so the financial module and charts are populated.
    expenses = [
        ("Combustível", "Abastecimento da van de entregas", 420.0, 6),
        ("Manutenção", "Reparo de costura do tobogã", 310.0, 14),
        ("Materiais", "Compra de 1.000 bolinhas novas", 260.0, 21),
        ("Marketing", "Impulsionamento Instagram @lanyinflaveis", 350.0, 10),
        ("Transporte", "Frete extra — evento em São Bernardo", 180.0, 3),
    ]
    for category, description, amount, days_ago in expenses:
        if await db["financial_entries"].find_one({"description": description}):
            continue
        await db["financial_entries"].insert_one(
            FinancialEntry(
                kind="saida",
                category=category,
                description=description,
                amount=amount,
                date=(today - timedelta(days=days_ago)).strftime("%Y-%m-%d"),
            ).model_dump()
        )

    await ensure_indexes()
    print(f"Pronto. Admin: {ADMIN_EMAIL} / {DEFAULT_PASSWORD}")
    print(f"Funcionário: {STAFF_EMAIL} / {DEFAULT_PASSWORD}")
    print(f"Cliente: {CUSTOMER_EMAIL} / {DEFAULT_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())

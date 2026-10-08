import asyncio
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
from lib.db import client, ensure_indexes
from routers import (
    audit,
    auth,
    contracts,
    customers,
    dashboard,
    financial,
    notifications,
    payments,
    quotes,
    reports,
    reservations,
    settings,
    toys,
    webhooks,
    whatsapp,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    yield
    client.close()


app = FastAPI(
    title="Lany Infláveis — API de Gestão",
    description="Gestão de locação de brinquedos infláveis: reservas, PIX Mercado Pago, contratos e WhatsApp.",
    lifespan=lifespan,
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Lany Infláveis API", "status": "ok"}


# One module per resource; each exposes its own APIRouter.
api_router.include_router(auth.router)
api_router.include_router(customers.router)
api_router.include_router(toys.router)
api_router.include_router(reservations.router)
api_router.include_router(quotes.router)
api_router.include_router(payments.router)
api_router.include_router(contracts.router)
api_router.include_router(financial.router)
api_router.include_router(dashboard.router)
api_router.include_router(notifications.router)
api_router.include_router(whatsapp.router)
api_router.include_router(reports.router)
api_router.include_router(settings.router)
api_router.include_router(audit.router)
api_router.include_router(webhooks.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Include the router in the main app — must stay the last statement.
app.include_router(api_router)

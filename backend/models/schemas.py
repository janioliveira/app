"""All Pydantic v2 request/response models. Mirrored by frontend/src/lib/types.ts."""

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


def new_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- auth / users
Role = Literal["admin", "funcionario", "cliente"]


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class RegisterInput(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    phone: str = ""
    document: str = ""


class PasswordResetInput(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    password: str = Field(min_length=6)


class UserCreate(BaseModel):
    name: str = Field(min_length=2)
    email: EmailStr
    password: str = Field(min_length=6)
    role: Role = "funcionario"


class UserUpdate(BaseModel):
    name: str | None = None
    role: Role | None = None
    active: bool | None = None
    password: str | None = None


class User(BaseModel):
    id: str
    name: str
    email: str
    role: Role
    customer_id: str | None = None
    active: bool = True
    created_at: datetime | None = None


# ------------------------------------------------------------------- customers
class CustomerInput(BaseModel):
    name: str = Field(min_length=2)
    document: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: str = ""
    zip_code: str = ""
    street: str = ""
    number: str = ""
    complement: str = ""
    district: str = ""
    city: str = ""
    state: str = ""
    notes: str = ""


class Customer(CustomerInput):
    id: str = Field(default_factory=new_id)
    is_demo: bool = False
    created_at: datetime = Field(default_factory=utc_now)


# ------------------------------------------------------------------------ toys
ToyStatus = Literal["disponivel", "manutencao", "inativo"]


class ToyInput(BaseModel):
    name: str = Field(min_length=2)
    category: str = "Inflável"
    description: str = ""
    image_url: str = ""
    width_m: float = 0
    length_m: float = 0
    height_m: float = 0
    capacity: int = 0
    age_range: str = ""
    daily_price: float = Field(default=0, ge=0)
    quantity: int = Field(default=1, ge=0)
    status: ToyStatus = "disponivel"
    maintenance_notes: str = ""
    notes: str = ""


class Toy(ToyInput):
    id: str = Field(default_factory=new_id)
    is_demo: bool = False
    created_at: datetime = Field(default_factory=utc_now)


# ---------------------------------------------------------- reservations/quotes
ReservationStatus = Literal[
    "pre_reserva", "aguardando_pagamento", "confirmada", "cancelada", "expirada", "finalizada"
]
QuoteStatus = Literal[
    "rascunho", "enviado", "aguardando_resposta", "aprovado", "recusado", "expirado", "convertido"
]


class LineItem(BaseModel):
    toy_id: str
    toy_name: str = ""
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(default=0, ge=0)


class ReservationInput(BaseModel):
    customer_id: str | None = None
    customer: CustomerInput | None = None
    items: list[LineItem] = Field(min_length=1)
    event_date: str  # YYYY-MM-DD
    start_time: str = "08:00"
    end_time: str = "18:00"
    address: str = ""
    city: str = ""
    district: str = ""
    discount: float = Field(default=0, ge=0)
    delivery_fee: float = Field(default=0, ge=0)
    notes: str = ""


class Reservation(BaseModel):
    id: str = Field(default_factory=new_id)
    code: str
    customer_id: str
    customer_name: str = ""
    customer_whatsapp: str = ""
    items: list[LineItem] = []
    event_date: str
    start_time: str
    end_time: str
    address: str = ""
    city: str = ""
    district: str = ""
    subtotal: float = 0
    discount: float = 0
    delivery_fee: float = 0
    total: float = 0
    status: ReservationStatus = "pre_reserva"
    payment_id: str | None = None
    contract_id: str | None = None
    notes: str = ""
    is_demo: bool = False
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class ReservationStatusInput(BaseModel):
    status: ReservationStatus
    reason: str = ""


class AvailabilityInput(BaseModel):
    toy_ids: list[str] = []
    event_date: str
    start_time: str = "08:00"
    end_time: str = "18:00"


class AvailabilityItem(BaseModel):
    toy_id: str
    toy_name: str
    available: bool
    reason: str = ""


class AvailabilityResult(BaseModel):
    available: bool
    items: list[AvailabilityItem] = []


class QuoteInput(ReservationInput):
    valid_until: str = ""


class Quote(BaseModel):
    id: str = Field(default_factory=new_id)
    number: str
    customer_id: str
    customer_name: str = ""
    items: list[LineItem] = []
    event_date: str
    start_time: str = "08:00"
    end_time: str = "18:00"
    address: str = ""
    subtotal: float = 0
    discount: float = 0
    delivery_fee: float = 0
    total: float = 0
    status: QuoteStatus = "rascunho"
    valid_until: str = ""
    reservation_id: str | None = None
    notes: str = ""
    is_demo: bool = False
    created_at: datetime = Field(default_factory=utc_now)


class QuoteStatusInput(BaseModel):
    status: QuoteStatus


# -------------------------------------------------------------------- payments
PaymentStatus = Literal["pending", "approved", "expired", "cancelled", "refunded", "rejected"]


class PaymentCreateInput(BaseModel):
    reservation_id: str
    amount: float | None = None


class Payment(BaseModel):
    id: str = Field(default_factory=new_id)
    reservation_id: str
    customer_id: str
    customer_name: str = ""
    amount: float
    method: Literal["pix"] = "pix"
    status: PaymentStatus = "pending"
    status_detail: str = ""
    mp_payment_id: str = ""
    qr_code: str = ""
    qr_code_base64: str = ""
    ticket_url: str = ""
    simulation: bool = True
    expires_at: datetime | None = None
    approved_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)


# -------------------------------------------------------------------- contracts
ContractStatus = Literal["pendente", "aceito", "cancelado"]


class Contract(BaseModel):
    id: str = Field(default_factory=new_id)
    reservation_id: str
    customer_id: str
    number: str
    version: str = "1.0"
    body: str = ""
    status: ContractStatus = "pendente"
    accepted_at: datetime | None = None
    accepted_by: str = ""
    accepted_ip: str = ""
    signature_name: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class ContractAcceptInput(BaseModel):
    signature_name: str = Field(min_length=3)
    agreed: bool = True


# -------------------------------------------------------------------- financial
EntryKind = Literal["entrada", "saida"]


class FinancialEntryInput(BaseModel):
    kind: EntryKind
    category: str = "Outros"
    description: str = ""
    amount: float = Field(gt=0)
    date: str = ""
    reservation_id: str | None = None


class FinancialEntry(BaseModel):
    id: str = Field(default_factory=new_id)
    kind: EntryKind
    category: str = "Outros"
    description: str = ""
    amount: float
    date: str
    reservation_id: str | None = None
    payment_id: str | None = None
    created_at: datetime = Field(default_factory=utc_now)


class FinancialSummary(BaseModel):
    revenue: float = 0
    expenses: float = 0
    net_profit: float = 0
    receivable: float = 0
    received: float = 0
    pix_pending: float = 0
    pix_approved: float = 0
    pix_expired: float = 0
    pix_cancelled: float = 0
    pix_refunded: float = 0
    expenses_by_category: list[dict[str, Any]] = []


# ----------------------------------------------------------------- dashboard
class DashboardChartPoint(BaseModel):
    label: str
    value: float
    secondary: float = 0


class DashboardSummary(BaseModel):
    reservations_today: int = 0
    reservations_week: int = 0
    reservations_month: int = 0
    next_event: Reservation | None = None
    toys_available: int = 0
    toys_rented_today: int = 0
    payments_pending: int = 0
    payments_approved: int = 0
    amount_received: float = 0
    amount_receivable: float = 0
    revenue_month: float = 0
    cancellations_month: int = 0
    revenue_chart: list[DashboardChartPoint] = []
    reservations_chart: list[DashboardChartPoint] = []
    top_toys: list[DashboardChartPoint] = []
    payments_chart: list[DashboardChartPoint] = []


# ------------------------------------------------------------- notifications
class Notification(BaseModel):
    id: str = Field(default_factory=new_id)
    title: str
    message: str = ""
    kind: str = "info"
    event: str = ""
    reservation_id: str | None = None
    customer_id: str | None = None
    read: bool = False
    created_at: datetime = Field(default_factory=utc_now)


# ---------------------------------------------------------------- whatsapp
WhatsAppStatus = Literal[
    "pendente", "enviando", "enviado", "entregue", "lido", "falhou", "cancelado"
]


class WhatsAppMessage(BaseModel):
    id: str = Field(default_factory=new_id)
    customer_id: str | None = None
    reservation_id: str | None = None
    phone: str = ""
    message_type: str = "custom"
    template: str = ""
    message: str = ""
    status: WhatsAppStatus = "pendente"
    provider_message_id: str = ""
    wa_link: str = ""
    error: str = ""
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class WhatsAppSendInput(BaseModel):
    customer_id: str | None = None
    reservation_id: str | None = None
    phone: str = ""
    message: str = Field(min_length=1)
    message_type: str = "custom"


# ----------------------------------------------------------------- settings
class CompanySettings(BaseModel):
    name: str = "Lany Infláveis"
    trade_name: str = "Lany Infláveis"
    legal_name: str = ""
    document: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: str = ""
    instagram: str = "@lanyinflaveis"
    address: str = ""
    city: str = ""
    state: str = ""
    logo_url: str = ""
    pix_key: str = ""
    contract_terms: str = ""


class MercadoPagoSettings(BaseModel):
    environment: Literal["sandbox", "production"] = "sandbox"
    configured: bool = False
    token_preview: str = ""
    webhook_secret_configured: bool = False
    pix_expiration_minutes: int = 30


class WhatsAppTemplates(BaseModel):
    nova_reserva: str = (
        "Olá, {NOME}! Sua solicitação de reserva para {DATA} foi registrada. "
        "Estamos aguardando a confirmação do pagamento PIX."
    )
    pix_gerado: str = (
        "Olá, {NOME}! Seu PIX para a reserva da Lany Infláveis foi gerado. "
        "Acesse o sistema para visualizar o QR Code ou copiar o código PIX."
    )
    pagamento_confirmado: str = (
        "Olá, {NOME}! Seu pagamento PIX foi confirmado com sucesso. Sua reserva está confirmada."
    )
    pagamento_expirado: str = (
        "Olá, {NOME}! O pagamento PIX da sua reserva expirou. "
        "Caso ainda tenha interesse, será necessário gerar uma nova cobrança."
    )
    contrato: str = (
        "Olá, {NOME}! Seu contrato da Lany Infláveis está disponível para visualização e aceite."
    )
    lembrete_evento: str = (
        "Olá, {NOME}! Seu evento com a Lany Infláveis acontecerá em {DATA} às {HORARIO}."
    )
    cancelamento: str = "Olá, {NOME}! Sua reserva foi cancelada."


class WhatsAppSettings(BaseModel):
    provider: str = "meta_cloud_api"
    enabled: bool = True
    api_url: str = "https://graph.facebook.com/v23.0"
    phone_number_id: str = ""
    business_phone: str = ""
    account_id: str = ""
    configured: bool = False
    token_preview: str = ""
    templates: WhatsAppTemplates = Field(default_factory=WhatsAppTemplates)


class WhatsAppSettingsInput(BaseModel):
    provider: str | None = None
    enabled: bool | None = None
    api_url: str | None = None
    phone_number_id: str | None = None
    business_phone: str | None = None
    account_id: str | None = None
    access_token: str | None = None
    templates: WhatsAppTemplates | None = None


class IntegrationsSettings(BaseModel):
    mercadopago: MercadoPagoSettings = Field(default_factory=MercadoPagoSettings)
    whatsapp: WhatsAppSettings = Field(default_factory=WhatsAppSettings)


# ------------------------------------------------------------------- audit
class AuditLog(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str = ""
    user_name: str = "sistema"
    action: str
    entity: str = ""
    entity_id: str = ""
    details: str = ""
    ip: str = ""
    created_at: datetime = Field(default_factory=utc_now)


class OkResponse(BaseModel):
    ok: bool = True
    message: str = ""

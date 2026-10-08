// Hand-written mirrors of backend/models/schemas.py. Nothing infers across the
// Python↔TypeScript boundary — change a Pydantic model, change its interface here.

export type Role = "admin" | "funcionario" | "cliente";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  customer_id: string | null;
  active: boolean;
  created_at: string | null;
}

export interface CustomerInput {
  name: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
}

export interface Customer extends CustomerInput {
  id: string;
  is_demo: boolean;
  created_at: string;
}

export type ToyStatus = "disponivel" | "manutencao" | "inativo";

export interface ToyInput {
  name: string;
  category: string;
  description: string;
  image_url: string;
  width_m: number;
  length_m: number;
  height_m: number;
  capacity: number;
  age_range: string;
  daily_price: number;
  quantity: number;
  status: ToyStatus;
  maintenance_notes: string;
  notes: string;
}

export interface Toy extends ToyInput {
  id: string;
  is_demo: boolean;
  created_at: string;
}

export type ReservationStatus =
  | "pre_reserva"
  | "aguardando_pagamento"
  | "confirmada"
  | "cancelada"
  | "expirada"
  | "finalizada";

export type QuoteStatus =
  | "rascunho"
  | "enviado"
  | "aguardando_resposta"
  | "aprovado"
  | "recusado"
  | "expirado"
  | "convertido";

export interface LineItem {
  toy_id: string;
  toy_name: string;
  quantity: number;
  unit_price: number;
}

export interface ReservationInput {
  customer_id?: string | null;
  customer?: Partial<CustomerInput> | null;
  items: Array<Pick<LineItem, "toy_id" | "quantity"> & Partial<LineItem>>;
  event_date: string;
  start_time: string;
  end_time: string;
  address?: string;
  city?: string;
  district?: string;
  discount?: number;
  delivery_fee?: number;
  notes?: string;
}

export interface Reservation {
  id: string;
  code: string;
  customer_id: string;
  customer_name: string;
  customer_whatsapp: string;
  items: LineItem[];
  event_date: string;
  start_time: string;
  end_time: string;
  address: string;
  city: string;
  district: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  status: ReservationStatus;
  payment_id: string | null;
  contract_id: string | null;
  notes: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityItem {
  toy_id: string;
  toy_name: string;
  available: boolean;
  reason: string;
}

export interface AvailabilityResult {
  available: boolean;
  items: AvailabilityItem[];
}

export interface Quote {
  id: string;
  number: string;
  customer_id: string;
  customer_name: string;
  items: LineItem[];
  event_date: string;
  start_time: string;
  end_time: string;
  address: string;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  status: QuoteStatus;
  valid_until: string;
  reservation_id: string | null;
  notes: string;
  is_demo: boolean;
  created_at: string;
}

export type PaymentStatus =
  | "pending"
  | "approved"
  | "expired"
  | "cancelled"
  | "refunded"
  | "rejected";

export interface Payment {
  id: string;
  reservation_id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  method: "pix";
  status: PaymentStatus;
  status_detail: string;
  mp_payment_id: string;
  qr_code: string;
  qr_code_base64: string;
  ticket_url: string;
  simulation: boolean;
  expires_at: string | null;
  approved_at: string | null;
  created_at: string;
}

export type ContractStatus = "pendente" | "aceito" | "cancelado";

export interface Contract {
  id: string;
  reservation_id: string;
  customer_id: string;
  number: string;
  version: string;
  body: string;
  status: ContractStatus;
  accepted_at: string | null;
  accepted_by: string;
  accepted_ip: string;
  signature_name: string;
  created_at: string;
}

export type EntryKind = "entrada" | "saida";

export interface FinancialEntry {
  id: string;
  kind: EntryKind;
  category: string;
  description: string;
  amount: number;
  date: string;
  reservation_id: string | null;
  payment_id: string | null;
  created_at: string;
}

export interface FinancialSummary {
  revenue: number;
  expenses: number;
  net_profit: number;
  receivable: number;
  received: number;
  pix_pending: number;
  pix_approved: number;
  pix_expired: number;
  pix_cancelled: number;
  pix_refunded: number;
  expenses_by_category: Array<{ category: string; amount: number }>;
}

export interface DashboardChartPoint {
  label: string;
  value: number;
  secondary: number;
}

export interface DashboardSummary {
  reservations_today: number;
  reservations_week: number;
  reservations_month: number;
  next_event: Reservation | null;
  toys_available: number;
  toys_rented_today: number;
  payments_pending: number;
  payments_approved: number;
  amount_received: number;
  amount_receivable: number;
  revenue_month: number;
  cancellations_month: number;
  revenue_chart: DashboardChartPoint[];
  reservations_chart: DashboardChartPoint[];
  top_toys: DashboardChartPoint[];
  payments_chart: DashboardChartPoint[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  kind: string;
  event: string;
  reservation_id: string | null;
  customer_id: string | null;
  read: boolean;
  created_at: string;
}

export type WhatsAppStatus =
  | "pendente"
  | "enviando"
  | "enviado"
  | "entregue"
  | "lido"
  | "falhou"
  | "cancelado";

export interface WhatsAppMessage {
  id: string;
  customer_id: string | null;
  reservation_id: string | null;
  phone: string;
  message_type: string;
  template: string;
  message: string;
  status: WhatsAppStatus;
  provider_message_id: string;
  wa_link: string;
  error: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  name: string;
  trade_name: string;
  legal_name: string;
  document: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  address: string;
  city: string;
  state: string;
  logo_url: string;
  pix_key: string;
  contract_terms: string;
}

export interface WhatsAppTemplates {
  nova_reserva: string;
  pix_gerado: string;
  pagamento_confirmado: string;
  pagamento_expirado: string;
  contrato: string;
  lembrete_evento: string;
  cancelamento: string;
}

export interface MercadoPagoSettings {
  environment: "sandbox" | "production";
  configured: boolean;
  token_preview: string;
  webhook_secret_configured: boolean;
  pix_expiration_minutes: number;
}

export interface WhatsAppSettings {
  provider: string;
  enabled: boolean;
  api_url: string;
  phone_number_id: string;
  business_phone: string;
  account_id: string;
  configured: boolean;
  token_preview: string;
  templates: WhatsAppTemplates;
}

export interface IntegrationsSettings {
  mercadopago: MercadoPagoSettings;
  whatsapp: WhatsAppSettings;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  ip: string;
  created_at: string;
}

export interface OkResponse {
  ok: boolean;
  message: string;
}

export interface CustomerHistory {
  reservations: Reservation[];
  payments: Payment[];
  total_reservations: number;
  total_spent: number;
}

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportData {
  report: string;
  columns: ReportColumn[];
  rows: Array<Record<string, string>>;
  count: number;
}

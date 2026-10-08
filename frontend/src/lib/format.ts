// pt-BR formatting helpers. Currency, dates and status labels live here so no page
// hand-rolls Intl options.

export const brl = (value: number | null | undefined): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value ?? 0);

export const num = (value: number | null | undefined): string =>
  new Intl.NumberFormat("pt-BR").format(value ?? 0);

/** "2026-03-14" → "14/03/2026". Never parsed through Date to avoid timezone drift. */
export const isoToBr = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export const dateTimeBr = (value: string | null | undefined): string => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
};

export const weekdayBr = (iso: string): string => {
  if (!iso) return "";
  const parsed = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(parsed);
};

/** Server-anchored "today" is preferred; this is only for input defaults. */
export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const addDaysIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

export const RESERVATION_LABELS: Record<string, string> = {
  pre_reserva: "Pré-reserva",
  aguardando_pagamento: "Aguardando pagamento",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  expirada: "Expirada",
  finalizada: "Finalizada",
};

export const QUOTE_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aguardando_resposta: "Aguardando resposta",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Convertido em reserva",
};

export const PAYMENT_LABELS: Record<string, string> = {
  pending: "PIX pendente",
  approved: "PIX aprovado",
  expired: "PIX expirado",
  cancelled: "PIX cancelado",
  refunded: "PIX estornado",
  rejected: "PIX recusado",
};

export const TOY_STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível",
  manutencao: "Em manutenção",
  inativo: "Inativo",
};

export const CONTRACT_LABELS: Record<string, string> = {
  pendente: "Aguardando aceite",
  aceito: "Aceito",
  cancelado: "Cancelado",
};

export const WHATSAPP_LABELS: Record<string, string> = {
  pendente: "Pendente",
  enviando: "Enviando",
  enviado: "Enviado",
  entregue: "Entregue",
  lido: "Lido",
  falhou: "Falhou",
  cancelado: "Cancelado",
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  funcionario: "Funcionário",
  cliente: "Cliente",
};

/** Tailwind classes per status — tone, not raw colour choices, at each call site. */
export const statusTone = (status: string): string => {
  switch (status) {
    case "confirmada":
    case "approved":
    case "aceito":
    case "aprovado":
    case "entregue":
    case "lido":
    case "enviado":
    case "disponivel":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "aguardando_pagamento":
    case "pending":
    case "pendente":
    case "enviando":
    case "aguardando_resposta":
    case "manutencao":
      return "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300";
    case "cancelada":
    case "cancelled":
    case "expirada":
    case "expired":
    case "falhou":
    case "recusado":
    case "rejected":
    case "cancelado":
    case "expirado":
      return "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300";
    case "finalizada":
    case "convertido":
    case "refunded":
      return "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300";
    default:
      return "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300";
  }
};

export const maskPhone = (value: string): string => {
  const digits = value.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_m, a, b, c) =>
      [a && `(${a})`, b, c && `-${c}`].filter(Boolean).join(" ").trim(),
    );
  }
  return digits
    .slice(0, 11)
    .replace(/(\d{2})(\d{5})(\d{0,4})/, (_m, a, b, c) => `(${a}) ${b}${c ? `-${c}` : ""}`);
};

export const maskDocument = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 11) {
    return digits
      .slice(0, 11)
      .replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_m, a, b, c, d) =>
        [a, b, c].filter(Boolean).join(".") + (d ? `-${d}` : ""),
      );
  }
  return digits
    .slice(0, 14)
    .replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
};

export const minutesUntil = (iso: string | null): number => {
  if (!iso) return 0;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(Math.floor(diff / 60000), 0);
};

export const countdown = (iso: string | null): string => {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expirado";
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

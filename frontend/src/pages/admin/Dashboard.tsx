import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Package,
  QrCode,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { RESERVATION_LABELS, brl, isoToBr, weekdayBr } from "@/lib/format";
import type { DashboardSummary } from "@/lib/types";

const CHART_COLORS = ["#EA580C", "#0284C7", "#00A868", "#F59E0B", "#8B5CF6", "#EF4444"];

export default function Dashboard() {
  const summary = useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
    refetchInterval: 60_000,
  });

  const data = summary.data;

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Visão geral
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Indicadores de reservas, agenda e recebimentos PIX em tempo real.
          </p>
        </div>
        <Link
          to="/admin/reservas"
          className={buttonVariants({ variant: "outline" })}
          data-testid="dashboard-reservations-link"
        >
          Gerenciar reservas
        </Link>
      </header>

      {summary.isError ? (
        <Card className="border-destructive/40 mt-6 rounded-2xl">
          <CardContent className="flex items-center gap-3 p-5" data-testid="dashboard-error">
            <AlertTriangle className="text-destructive size-5" />
            <p className="text-sm">
              Não foi possível carregar os indicadores agora. Os dados aparecerão quando a conexão
              for restabelecida.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* KPI grid */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Reservas hoje"
          value={String(data?.reservations_today ?? 0)}
          hint={`${data?.reservations_week ?? 0} nos próximos 7 dias`}
          icon={CalendarDays}
          testId="metric-reservations-today"
        />
        <MetricCard
          label="Reservas no mês"
          value={String(data?.reservations_month ?? 0)}
          hint={`${data?.cancellations_month ?? 0} cancelamentos`}
          icon={Clock}
          tone="azure"
          testId="metric-reservations-month"
        />
        <MetricCard
          label="Faturamento do mês"
          value={brl(data?.revenue_month ?? 0)}
          hint={`${brl(data?.amount_received ?? 0)} recebido no total`}
          icon={TrendingUp}
          tone="pix"
          testId="metric-revenue-month"
        />
        <MetricCard
          label="A receber (PIX)"
          value={brl(data?.amount_receivable ?? 0)}
          hint={`${data?.payments_pending ?? 0} cobranças pendentes`}
          icon={Wallet}
          tone="warning"
          testId="metric-receivable"
        />
        <MetricCard
          label="Brinquedos disponíveis"
          value={String(data?.toys_available ?? 0)}
          hint={`${data?.toys_rented_today ?? 0} em evento hoje`}
          icon={Package}
          testId="metric-toys-available"
        />
        <MetricCard
          label="PIX aprovados"
          value={String(data?.payments_approved ?? 0)}
          icon={CheckCircle2}
          tone="pix"
          testId="metric-pix-approved"
        />
        <MetricCard
          label="PIX pendentes"
          value={String(data?.payments_pending ?? 0)}
          icon={QrCode}
          tone="warning"
          testId="metric-pix-pending"
        />
        <MetricCard
          label="Cancelamentos no mês"
          value={String(data?.cancellations_month ?? 0)}
          icon={AlertTriangle}
          tone="danger"
          testId="metric-cancellations"
        />
      </section>

      {/* Next event + revenue chart */}
      <section className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="next-event-card">
          <CardHeader>
            <CardTitle className="text-base">Próximo evento</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.next_event ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{data.next_event.code}</span>
                  <StatusPill
                    status={data.next_event.status}
                    label={RESERVATION_LABELS[data.next_event.status]}
                  />
                </div>
                <div>
                  <p className="text-2xl font-extrabold tracking-tight">
                    {isoToBr(data.next_event.event_date)}
                  </p>
                  <p className="text-muted-foreground text-sm capitalize">
                    {weekdayBr(data.next_event.event_date)} · {data.next_event.start_time} às{" "}
                    {data.next_event.end_time}
                  </p>
                </div>
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Cliente</dt>
                    <dd className="truncate font-medium">{data.next_event.customer_name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Local</dt>
                    <dd className="truncate font-medium">
                      {data.next_event.address || data.next_event.city || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Valor</dt>
                    <dd className="text-primary font-bold">{brl(data.next_event.total)}</dd>
                  </div>
                </dl>
                <ul className="border-border/70 space-y-1 border-t pt-3 text-sm">
                  {data.next_event.items.map((item) => (
                    <li key={item.toy_id} className="truncate">
                      {item.quantity}x {item.toy_name}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Nenhum evento agendado"
                description="Crie um agendamento para ver o próximo evento aqui."
                action={
                  <Link to="/admin/reservas" className={buttonVariants({ size: "sm" })}>
                    Criar novo agendamento
                  </Link>
                }
                testId="next-event-empty"
              />
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="revenue-chart-card">
          <CardHeader>
            <CardTitle className="text-base">Faturamento dos últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.revenue_chart ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} width={70} />
                  <Tooltip
                    formatter={(value: number) => [brl(value), "Faturamento"]}
                    labelFormatter={(label: string) => `Mês: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#EA580C"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Secondary charts */}
      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="reservations-chart-card">
          <CardHeader>
            <CardTitle className="text-base">Reservas por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.reservations_chart ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
                  <Tooltip formatter={(value: number) => [String(value), "Reservas"]} />
                  <Bar dataKey="value" fill="#0284C7" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="top-toys-chart-card">
          <CardHeader>
            <CardTitle className="text-base">Brinquedos mais alugados</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.top_toys ?? []).length === 0 ? (
              <p className="text-muted-foreground py-8 text-sm">Sem dados suficientes ainda.</p>
            ) : (
              <ul className="space-y-3">
                {(data?.top_toys ?? []).map((item, index) => {
                  const max = Math.max(...(data?.top_toys ?? []).map((t) => t.value), 1);
                  return (
                    <li key={item.label} data-testid={`top-toy-${index}`}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{item.label}</span>
                        <span className="text-muted-foreground tabular-nums">{item.value}</span>
                      </div>
                      <div className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full">
                        <div
                          className="h-full rounded-full transition-[width] duration-500"
                          style={{
                            width: `${(item.value / max) * 100}%`,
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="payments-chart-card">
          <CardHeader>
            <CardTitle className="text-base">Pagamentos por status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.payments_chart ?? []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: number) => [String(value), "Cobranças"]} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {(data?.payments_chart ?? []).map((_entry, index) => (
                      <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>
    </AdminLayout>
  );
}

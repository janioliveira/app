import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, QrCode, RotateCcw, Wallet, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { StatusPill } from "@/components/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { PAYMENT_LABELS, brl, dateTimeBr } from "@/lib/format";
import type { Payment } from "@/lib/types";

const FILTERS = [
  { value: "todos", label: "Todos os status" },
  ...Object.entries(PAYMENT_LABELS).map(([value, label]) => ({ value, label })),
];

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

export default function Payments() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("todos");

  const payments = useQuery<Payment[]>({
    queryKey: ["payments", status],
    queryFn: () => apiGet<Payment[]>(`/payments${status !== "todos" ? `?status=${status}` : ""}`),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["payments"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const cancel = useMutation<Payment, Error, string>({
    mutationFn: (id) => apiPost<Payment>(`/payments/${id}/cancel`),
    onSuccess: async () => {
      toast.success("Cobrança PIX cancelada.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível cancelar.")),
  });

  const refund = useMutation<Payment, Error, string>({
    mutationFn: (id) => apiPost<Payment>(`/payments/${id}/refund`),
    onSuccess: async () => {
      toast.success("Estorno registrado.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível estornar.")),
  });

  const list = payments.data ?? [];
  const approved = list.filter((p) => p.status === "approved");
  const pending = list.filter((p) => p.status === "pending");

  return (
    <AdminLayout>
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Recebimentos
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Pagamentos PIX</h1>
        <p className="text-muted-foreground mt-2">
          Todas as cobranças geradas no Mercado Pago, com confirmação automática por webhook.
        </p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="PIX aprovados"
          value={brl(approved.reduce((sum, p) => sum + p.amount, 0))}
          hint={`${approved.length} cobranças`}
          icon={Wallet}
          tone="pix"
          testId="payments-metric-approved"
        />
        <MetricCard
          label="Aguardando pagamento"
          value={brl(pending.reduce((sum, p) => sum + p.amount, 0))}
          hint={`${pending.length} cobranças pendentes`}
          icon={QrCode}
          tone="warning"
          testId="payments-metric-pending"
        />
        <MetricCard
          label="Total de cobranças"
          value={String(list.length)}
          icon={Wallet}
          tone="azure"
          testId="payments-metric-total"
        />
      </section>

      <Card className="border-border/70 mt-6 rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="pay-status">Filtrar por status</Label>
            <Select value={status} onValueChange={(value: string) => setStatus(value)}>
              <SelectTrigger id="pay-status" data-testid="payments-status-filter">
                <SelectValue>
                  {(v) => FILTERS.find((f) => f.value === v)?.label ?? "Todos"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {payments.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted h-14 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={QrCode}
            title="Nenhuma cobrança PIX encontrada"
            description="As cobranças aparecem aqui assim que uma reserva gera o PIX."
            action={
              <Link to="/admin/reservas" className={buttonVariants({ size: "sm" })}>
                Ir para reservas
              </Link>
            }
            testId="payments-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="payments-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ID Mercado Pago</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((payment) => (
                  <TableRow key={payment.id} data-testid={`payment-row-${payment.id}`}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {payment.customer_name || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {brl(payment.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={payment.status}
                        label={PAYMENT_LABELS[payment.status]}
                        pulse={payment.status === "pending"}
                      />
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate font-mono text-xs">
                      {payment.mp_payment_id || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {dateTimeBr(payment.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          to={`/pagamento/${payment.id}`}
                          className={buttonVariants({ variant: "outline", size: "xs" })}
                          data-testid={`payment-view-${payment.id}`}
                        >
                          Ver
                        </Link>
                        {payment.status === "pending" ? (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => cancel.mutate(payment.id)}
                            disabled={cancel.isPending}
                            aria-label="Cancelar cobrança"
                            data-testid={`payment-cancel-${payment.id}`}
                          >
                            {cancel.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <XCircle className="size-3.5" />
                            )}
                          </Button>
                        ) : null}
                        {payment.status === "approved" ? (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() => refund.mutate(payment.id)}
                            disabled={refund.isPending}
                            aria-label="Estornar pagamento"
                            data-testid={`payment-refund-${payment.id}`}
                          >
                            {refund.isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3.5" />
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}

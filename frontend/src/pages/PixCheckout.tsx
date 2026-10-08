import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  FileText,
  Loader2,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PublicLayout } from "@/components/PublicLayout";
import { StatusPill } from "@/components/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api";
import { PAYMENT_LABELS, brl, countdown, isoToBr } from "@/lib/format";
import type { Payment, Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function PixCheckout() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [tick, setTick] = useState(0);

  const payment = useQuery<Payment>({
    queryKey: ["payment", id],
    queryFn: () => apiGet<Payment>(`/payments/${id}`),
    // Poll while the charge is live; stop on any terminal state.
    refetchInterval: (query) => (query.state.data?.status === "pending" ? 5000 : false),
  });

  const reservation = useQuery<Reservation>({
    queryKey: ["reservation", payment.data?.reservation_id],
    queryFn: () => apiGet<Reservation>(`/reservations/${payment.data?.reservation_id}`),
    enabled: Boolean(payment.data?.reservation_id),
  });

  const contractId = reservation.data?.contract_id;

  const simulate = useMutation<Payment, Error, void>({
    mutationFn: () => apiPost<Payment>(`/payments/${id}/simulate-approval`),
    onSuccess: async () => {
      toast.success("Pagamento PIX confirmado! Reserva garantida.");
      await queryClient.invalidateQueries({ queryKey: ["payment", id] });
      await queryClient.invalidateQueries({ queryKey: ["reservation"] });
    },
    onError: () => toast.error("Não foi possível simular a aprovação."),
  });

  // 1s heartbeat so the countdown re-renders without refetching.
  useEffect(() => {
    if (payment.data?.status !== "pending") return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(timer);
  }, [payment.data?.status]);

  const data = payment.data;
  const isPending = data?.status === "pending";
  const isApproved = data?.status === "approved";
  const remaining = data?.expires_at ? countdown(data.expires_at) : "—";

  const copy = async () => {
    if (!data?.qr_code) return;
    try {
      await navigator.clipboard.writeText(data.qr_code);
      toast.success("Código PIX copiado!");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o código manualmente.");
    }
  };

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Pagamento PIX</h1>
          <p className="text-muted-foreground mt-3 text-lg">
            Escaneie o QR Code ou use o PIX copia e cola. A confirmação é automática — não é preciso
            enviar comprovante.
          </p>
        </header>

        {payment.isError ? (
          <Card className="border-destructive/40 mt-8 rounded-2xl">
            <CardContent className="flex items-start gap-3 p-6" data-testid="checkout-error">
              <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">Cobrança não encontrada</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  O link pode ter expirado. Faça uma nova reserva para gerar outro PIX.
                </p>
                <Link to="/reservar" className={cn(buttonVariants({ size: "sm" }), "mt-4")}>
                  Fazer nova reserva
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.85fr] lg:items-start">
          {/* PIX panel */}
          <Card
            className={cn(
              "rounded-3xl border-2 shadow-lg",
              isApproved
                ? "border-[var(--pix)]/50 bg-[var(--pix)]/5"
                : "border-border/70 bg-card",
            )}
            data-testid="pix-panel"
          >
            <CardContent className="space-y-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Valor a pagar
                  </p>
                  <p className="text-3xl font-extrabold tracking-tight" data-testid="pix-amount">
                    {brl(data?.amount ?? 0)}
                  </p>
                </div>
                {data ? (
                  <StatusPill
                    status={data.status}
                    label={PAYMENT_LABELS[data.status] ?? data.status}
                    pulse={isPending}
                    testId="pix-status-badge"
                  />
                ) : null}
              </div>

              {isPending && data?.expires_at ? (
                <div
                  className="bg-muted/60 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                  data-testid="pix-countdown"
                >
                  <Clock className="text-primary size-4" />
                  <span>
                    Expira em <strong className="tabular-nums">{remaining}</strong>
                    <span className="hidden" data-tick={tick} />
                  </span>
                </div>
              ) : null}

              {isApproved ? (
                <div
                  className="flex items-start gap-3 rounded-xl bg-[var(--pix)]/12 p-4"
                  data-testid="pix-approved-banner"
                >
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--pix)]" />
                  <div>
                    <p className="font-bold text-[var(--pix)]">Pagamento confirmado!</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Sua reserva está confirmada e o contrato foi gerado automaticamente.
                    </p>
                    {contractId ? (
                      <Link
                        to={`/contrato/${contractId}`}
                        className={cn(buttonVariants({ size: "sm" }), "mt-4")}
                        data-testid="pix-contract-link"
                      >
                        <FileText className="mr-2 size-4" /> Ver e assinar contrato
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {isPending && data?.qr_code_base64 ? (
                <div className="flex flex-col items-center gap-5">
                  <div className="rounded-2xl bg-white p-4 shadow-md">
                    <img
                      src={`data:image/png;base64,${data.qr_code_base64}`}
                      alt="QR Code para pagamento PIX"
                      className="size-56 object-contain"
                      data-testid="pix-qrcode-image"
                    />
                  </div>

                  <div className="w-full space-y-2">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      PIX copia e cola
                    </p>
                    <div className="bg-muted/60 border-border/70 rounded-xl border p-3">
                      <p
                        className="text-muted-foreground max-h-20 overflow-y-auto font-mono text-[11px] break-all"
                        data-testid="pix-copy-paste-code"
                      >
                        {data.qr_code}
                      </p>
                    </div>
                    <Button
                      className="w-full bg-[var(--pix)] text-[var(--pix-foreground)] shadow-sm hover:bg-[var(--pix)]/90"
                      onClick={copy}
                      data-testid="pix-copy-button"
                    >
                      <Copy className="mr-2 size-4" /> Copiar código PIX
                    </Button>
                  </div>
                </div>
              ) : null}

              {isPending ? (
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => payment.refetch()}
                    disabled={payment.isFetching}
                    data-testid="pix-refresh-button"
                  >
                    {payment.isFetching ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" />
                    )}
                    Já paguei, verificar
                  </Button>
                  {data?.simulation ? (
                    <Button
                      variant="secondary"
                      onClick={() => simulate.mutate()}
                      disabled={simulate.isPending}
                      data-testid="pix-simulate-button"
                    >
                      {simulate.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <QrCode className="mr-2 size-4" />
                      )}
                      Simular pagamento (demo)
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {data?.status === "expired" ? (
                <div className="space-y-3" data-testid="pix-expired-banner">
                  <p className="text-destructive flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="size-4" /> Esta cobrança PIX expirou e o brinquedo foi
                    liberado na agenda.
                  </p>
                  <Link to="/reservar" className={buttonVariants({ size: "sm" })}>
                    Gerar nova reserva
                  </Link>
                </div>
              ) : null}

              {data?.simulation ? (
                <p
                  className="text-muted-foreground border-border/70 border-t pt-4 text-xs leading-relaxed"
                  data-testid="pix-simulation-notice"
                >
                  <strong>Modo demonstração:</strong> sem o Access Token do Mercado Pago, o QR Code é
                  gerado localmente e a aprovação é simulada pelo mesmo fluxo de webhook usado em
                  produção.
                </p>
              ) : null}
            </CardContent>
          </Card>

          {/* Reservation summary */}
          <Card
            className="border-border/70 rounded-2xl shadow-sm lg:sticky lg:top-24"
            data-testid="checkout-reservation-summary"
          >
            <CardContent className="space-y-4 p-6">
              <h2 className="text-base font-bold">Dados da reserva</h2>
              {reservation.data ? (
                <>
                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Código</dt>
                      <dd className="font-semibold" data-testid="checkout-reservation-code">
                        {reservation.data.code}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Cliente</dt>
                      <dd className="truncate font-medium">{reservation.data.customer_name}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Data</dt>
                      <dd className="font-medium">{isoToBr(reservation.data.event_date)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Horário</dt>
                      <dd className="font-medium">
                        {reservation.data.start_time} às {reservation.data.end_time}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Status</dt>
                      <dd>
                        <StatusPill status={reservation.data.status} label={reservation.data.status} />
                      </dd>
                    </div>
                  </dl>

                  <div className="border-border/70 border-t pt-4">
                    <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                      Atrações
                    </p>
                    <ul className="space-y-1.5 text-sm">
                      {reservation.data.items.map((item) => (
                        <li key={item.toy_id} className="flex justify-between gap-3">
                          <span className="truncate">
                            {item.quantity}x {item.toy_name}
                          </span>
                          <span className="font-medium">
                            {brl(item.unit_price * item.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">Carregando dados da reserva…</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}

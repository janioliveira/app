import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  FileText,
  LogOut,
  Package,
  QrCode,
  Wallet,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { PublicLayout } from "@/components/PublicLayout";
import { StatusPill } from "@/components/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/useSession";
import { apiGet } from "@/lib/api";
import {
  CONTRACT_LABELS,
  PAYMENT_LABELS,
  RESERVATION_LABELS,
  brl,
  dateTimeBr,
  isoToBr,
} from "@/lib/format";
import { endSession } from "@/lib/session";
import type { Contract, Payment, Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Portal() {
  const { user } = useSession();
  const navigate = useNavigate();

  const reservations = useQuery<Reservation[]>({
    queryKey: ["reservations", "mine"],
    queryFn: () => apiGet<Reservation[]>("/reservations"),
  });
  const payments = useQuery<Payment[]>({
    queryKey: ["payments", "mine"],
    queryFn: () => apiGet<Payment[]>("/payments"),
  });
  const contracts = useQuery<Contract[]>({
    queryKey: ["contracts", "mine"],
    queryFn: () => apiGet<Contract[]>("/contracts"),
  });

  const list = reservations.data ?? [];
  const upcoming = list
    .filter((r) => ["pre_reserva", "aguardando_pagamento", "confirmada"].includes(r.status))
    .sort((a, b) => a.event_date.localeCompare(b.event_date));
  const pendingPix = (payments.data ?? []).filter((p) => p.status === "pending");
  const totalSpent = (payments.data ?? [])
    .filter((p) => p.status === "approved")
    .reduce((sum, p) => sum + p.amount, 0);

  const signOut = async () => {
    await endSession();
    navigate("/", { replace: true });
  };

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Portal do cliente
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Olá, {user?.name?.split(" ")[0]}
            </h1>
            <p className="text-muted-foreground mt-2">
              Acompanhe suas reservas, pagamentos PIX e contratos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/reservar"
              className={buttonVariants({ size: "sm" })}
              data-testid="portal-new-reservation-button"
            >
              Nova reserva
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              data-testid="portal-logout-button"
            >
              <LogOut className="mr-2 size-4" /> Sair
            </Button>
          </div>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Reservas ativas"
            value={String(upcoming.length)}
            icon={CalendarDays}
            testId="portal-metric-active"
          />
          <MetricCard
            label="PIX pendentes"
            value={String(pendingPix.length)}
            icon={QrCode}
            tone="warning"
            testId="portal-metric-pending"
          />
          <MetricCard
            label="Total investido"
            value={brl(totalSpent)}
            icon={Wallet}
            tone="pix"
            testId="portal-metric-spent"
          />
          <MetricCard
            label="Contratos"
            value={String((contracts.data ?? []).length)}
            icon={FileText}
            tone="azure"
            testId="portal-metric-contracts"
          />
        </div>

        {pendingPix.length > 0 ? (
          <Card className="mt-6 rounded-2xl border-amber-400/50 bg-amber-50 dark:bg-amber-500/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex items-start gap-3">
                <QrCode className="mt-0.5 size-5 shrink-0 text-amber-600" />
                <div>
                  <p className="font-bold">Você tem um PIX aguardando pagamento</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {brl(pendingPix[0].amount)} — finalize para garantir a data na agenda.
                  </p>
                </div>
              </div>
              <Link
                to={`/pagamento/${pendingPix[0].id}`}
                className={buttonVariants({ size: "sm" })}
                data-testid="portal-pay-pix-button"
              >
                Pagar agora
              </Link>
            </CardContent>
          </Card>
        ) : null}

        <Tabs defaultValue="reservas" className="mt-8">
          <TabsList variant="line" data-testid="portal-tabs">
            <TabsTrigger value="reservas" data-testid="portal-tab-reservations">
              Minhas reservas
            </TabsTrigger>
            <TabsTrigger value="pagamentos" data-testid="portal-tab-payments">
              Pagamentos
            </TabsTrigger>
            <TabsTrigger value="contratos" data-testid="portal-tab-contracts">
              Contratos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reservas" className="mt-6 space-y-4">
            {list.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nenhuma reserva encontrada"
                description="Quando você reservar uma atração, ela aparecerá aqui com o status atualizado."
                action={
                  <Link to="/reservar" className={buttonVariants({ size: "sm" })}>
                    Criar primeira reserva
                  </Link>
                }
                testId="portal-reservations-empty"
              />
            ) : (
              list.map((reservation) => (
                <Card
                  key={reservation.id}
                  className="border-border/70 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md"
                  data-testid={`portal-reservation-${reservation.id}`}
                >
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold">{reservation.code}</span>
                        <StatusPill
                          status={reservation.status}
                          label={RESERVATION_LABELS[reservation.status]}
                        />
                      </div>
                      <p className="text-muted-foreground mt-2 text-sm">
                        {isoToBr(reservation.event_date)} · {reservation.start_time} às{" "}
                        {reservation.end_time}
                      </p>
                      <p className="mt-1 truncate text-sm">
                        {reservation.items.map((i) => `${i.quantity}x ${i.toy_name}`).join(", ")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-primary text-lg font-extrabold">
                        {brl(reservation.total)}
                      </span>
                      <div className="flex gap-2">
                        {reservation.payment_id ? (
                          <Link
                            to={`/pagamento/${reservation.payment_id}`}
                            className={cn(buttonVariants({ variant: "outline", size: "xs" }))}
                            data-testid={`portal-payment-link-${reservation.id}`}
                          >
                            Ver PIX
                          </Link>
                        ) : null}
                        {reservation.contract_id ? (
                          <Link
                            to={`/contrato/${reservation.contract_id}`}
                            className={cn(buttonVariants({ size: "xs" }))}
                            data-testid={`portal-contract-link-${reservation.id}`}
                          >
                            Contrato
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="pagamentos" className="mt-6 space-y-3">
            {(payments.data ?? []).length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nenhum pagamento registrado"
                description="Seus pagamentos PIX aparecerão aqui com o status de confirmação."
                testId="portal-payments-empty"
              />
            ) : (
              (payments.data ?? []).map((payment) => (
                <Card
                  key={payment.id}
                  className="border-border/70 rounded-2xl shadow-sm"
                  data-testid={`portal-payment-${payment.id}`}
                >
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <p className="font-bold">{brl(payment.amount)}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Criado em {dateTimeBr(payment.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill
                        status={payment.status}
                        label={PAYMENT_LABELS[payment.status]}
                        pulse={payment.status === "pending"}
                      />
                      <Link
                        to={`/pagamento/${payment.id}`}
                        className={buttonVariants({ variant: "outline", size: "xs" })}
                      >
                        Detalhes
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="contratos" className="mt-6 space-y-3">
            {(contracts.data ?? []).length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Nenhum contrato disponível"
                description="O contrato é gerado automaticamente após a confirmação do pagamento PIX."
                testId="portal-contracts-empty"
              />
            ) : (
              (contracts.data ?? []).map((contract) => (
                <Card
                  key={contract.id}
                  className="border-border/70 rounded-2xl shadow-sm"
                  data-testid={`portal-contract-${contract.id}`}
                >
                  <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div>
                      <p className="font-bold">{contract.number}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {contract.status === "aceito"
                          ? `Assinado em ${dateTimeBr(contract.accepted_at)}`
                          : "Aguardando seu aceite"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusPill
                        status={contract.status}
                        label={CONTRACT_LABELS[contract.status]}
                      />
                      <Link
                        to={`/contrato/${contract.id}`}
                        className={buttonVariants({
                          size: "xs",
                          variant: contract.status === "aceito" ? "outline" : "default",
                        })}
                        data-testid={`portal-contract-open-${contract.id}`}
                      >
                        {contract.status === "aceito" ? "Visualizar" : "Ler e assinar"}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PublicLayout>
  );
}

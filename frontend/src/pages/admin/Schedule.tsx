import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { RESERVATION_LABELS, brl, isoToBr } from "@/lib/format";
import type { Reservation } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const toIso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export default function Schedule() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string>(
    toIso(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  const monthStart = toIso(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthEnd = toIso(year, month, daysInMonth);

  const reservations = useQuery<Reservation[]>({
    queryKey: ["reservations", "schedule", monthStart, monthEnd],
    queryFn: () =>
      apiGet<Reservation[]>(`/reservations?date_from=${monthStart}&date_to=${monthEnd}`),
  });

  const byDate = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const reservation of reservations.data ?? []) {
      const list = map.get(reservation.event_date) ?? [];
      list.push(reservation);
      map.set(reservation.event_date, list);
    }
    return map;
  }, [reservations.data]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const shift = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
  };

  const dayReservations = byDate.get(selected) ?? [];

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Planejamento
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground mt-2">
            Calendário de eventos e controle de disponibilidade por data.
          </p>
        </div>
        <Link
          to="/admin/reservas"
          className={buttonVariants({ variant: "outline" })}
          data-testid="schedule-bookings-link"
        >
          Ir para reservas
        </Link>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.6fr] xl:items-start">
        <Card className="border-border/70 rounded-2xl shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base capitalize" data-testid="schedule-month-label">
              {MONTHS[month]} de {year}
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => shift(-1)}
                aria-label="Mês anterior"
                data-testid="schedule-prev-month"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setYear(now.getFullYear());
                  setMonth(now.getMonth());
                  setSelected(toIso(now.getFullYear(), now.getMonth(), now.getDate()));
                }}
                data-testid="schedule-today-button"
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => shift(1)}
                aria-label="Próximo mês"
                data-testid="schedule-next-month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="text-muted-foreground pb-2 text-center text-[11px] font-semibold tracking-wider uppercase"
                >
                  {label}
                </div>
              ))}
              {cells.map((day, index) => {
                if (day === null) return <div key={`empty-${index}`} />;
                const iso = toIso(year, month, day);
                const items = byDate.get(iso) ?? [];
                const active = items.filter(
                  (r) => !["cancelada", "expirada"].includes(r.status),
                );
                const isToday = iso === toIso(now.getFullYear(), now.getMonth(), now.getDate());
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelected(iso)}
                    data-testid={`schedule-day-${iso}`}
                    className={cn(
                      "flex min-h-[68px] flex-col items-start gap-1 rounded-xl border p-2 text-left",
                      "transition-[background-color,border-color,box-shadow] duration-150",
                      selected === iso
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border/60 hover:bg-muted/60",
                    )}
                  >
                    <span
                      className={cn(
                        "text-xs font-bold",
                        isToday && "bg-primary text-primary-foreground grid size-5 place-items-center rounded-full",
                      )}
                    >
                      {day}
                    </span>
                    {active.length > 0 ? (
                      <span className="bg-[var(--pix)]/15 w-full truncate rounded px-1 py-0.5 text-[10px] font-semibold text-[var(--pix)]">
                        {active.length} evento{active.length > 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 rounded-2xl shadow-sm xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base" data-testid="schedule-selected-label">
              {isoToBr(selected)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dayReservations.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nenhuma reserva nesta data"
                description="A agenda está livre — ótimo momento para confirmar um novo evento."
                action={
                  <Link to="/admin/reservas" className={buttonVariants({ size: "sm" })}>
                    Criar novo agendamento
                  </Link>
                }
                testId="schedule-day-empty"
              />
            ) : (
              dayReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="border-border/70 rounded-xl border p-4"
                  data-testid={`schedule-reservation-${reservation.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{reservation.code}</span>
                    <StatusPill
                      status={reservation.status}
                      label={RESERVATION_LABELS[reservation.status]}
                    />
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    {reservation.start_time} às {reservation.end_time}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium">{reservation.customer_name}</p>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {reservation.items.map((i) => `${i.quantity}x ${i.toy_name}`).join(", ")}
                  </p>
                  <p className="text-primary mt-2 font-bold">{brl(reservation.total)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

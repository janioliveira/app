import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Plus, QrCode, Search, Trash2, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { RESERVATION_LABELS, addDaysIso, brl, isoToBr } from "@/lib/format";
import type { Customer, Payment, Reservation, ReservationStatus, Toy } from "@/lib/types";

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: "todos", label: "Todos os status" },
  ...Object.entries(RESERVATION_LABELS).map(([value, label]) => ({ value, label })),
];

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

export default function Bookings() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    toy_id: "",
    quantity: 1,
    event_date: addDaysIso(5),
    start_time: "14:00",
    end_time: "19:00",
    address: "",
    city: "",
    district: "",
    delivery_fee: 80,
    discount: 0,
    notes: "",
  });

  const reservations = useQuery<Reservation[]>({
    queryKey: ["reservations", status],
    queryFn: () =>
      apiGet<Reservation[]>(`/reservations${status !== "todos" ? `?status=${status}` : ""}`),
  });
  const customers = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/customers"),
  });
  const toys = useQuery<Toy[]>({
    queryKey: ["toys"],
    queryFn: () => apiGet<Toy[]>("/toys"),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const create = useMutation<Reservation, Error, void>({
    mutationFn: () =>
      apiPost<Reservation>("/reservations", {
        customer_id: form.customer_id,
        items: [{ toy_id: form.toy_id, quantity: Number(form.quantity) }],
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        address: form.address,
        city: form.city,
        district: form.district,
        delivery_fee: Number(form.delivery_fee),
        discount: Number(form.discount),
        notes: form.notes,
      }),
    onSuccess: async (reservation) => {
      toast.success(`Reserva ${reservation.code} criada.`);
      setOpen(false);
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível criar a reserva.")),
  });

  const changeStatus = useMutation<Reservation, Error, { id: string; next: ReservationStatus }>({
    mutationFn: ({ id, next }) =>
      apiPatch<Reservation>(`/reservations/${id}/status`, { status: next, reason: "" }),
    onSuccess: async () => {
      toast.success("Status atualizado.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível alterar o status.")),
  });

  const generatePix = useMutation<Payment, Error, string>({
    mutationFn: (reservationId) =>
      apiPost<Payment>("/payments/pix", { reservation_id: reservationId }),
    onSuccess: async (payment) => {
      toast.success("Cobrança PIX gerada.");
      await invalidate();
      window.open(`/pagamento/${payment.id}`, "_blank");
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível gerar o PIX.")),
  });

  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiDelete(`/reservations/${id}`),
    onSuccess: async () => {
      toast.success("Reserva removida.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível remover.")),
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (reservations.data ?? []).filter(
      (r) =>
        !term ||
        r.code.toLowerCase().includes(term) ||
        r.customer_name.toLowerCase().includes(term),
    );
  }, [reservations.data, search]);

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Operação
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Reservas</h1>
          <p className="text-muted-foreground mt-2">
            Ciclo completo: pré-reserva, PIX, confirmação, contrato e finalização.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button className="shadow-sm" data-testid="new-reservation-button">
                <Plus className="mr-2 size-4" /> Nova reserva
              </Button>
            }
          />
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nova reserva</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="res-customer">Cliente</Label>
                <Select
                  value={form.customer_id}
                  onValueChange={(value: string) => setForm({ ...form, customer_id: value })}
                >
                  <SelectTrigger id="res-customer" data-testid="reservation-customer-select">
                    <SelectValue>
                      {(v) =>
                        (customers.data ?? []).find((c) => c.id === v)?.name ??
                        "Selecione um cliente"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(customers.data ?? []).map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="res-toy">Brinquedo</Label>
                <Select
                  value={form.toy_id}
                  onValueChange={(value: string) => setForm({ ...form, toy_id: value })}
                >
                  <SelectTrigger id="res-toy" data-testid="reservation-toy-select">
                    <SelectValue>
                      {(v) =>
                        (toys.data ?? []).find((t) => t.id === v)?.name ?? "Selecione o brinquedo"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(toys.data ?? []).map((toy) => (
                      <SelectItem key={toy.id} value={toy.id}>
                        {toy.name} — {brl(toy.daily_price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="res-qty">Quantidade</Label>
                <Input
                  id="res-qty"
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  data-testid="reservation-quantity-input"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="res-date">Data</Label>
                <Input
                  id="res-date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  data-testid="reservation-date-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="res-start">Início</Label>
                  <Input
                    id="res-start"
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    data-testid="reservation-start-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="res-end">Término</Label>
                  <Input
                    id="res-end"
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    data-testid="reservation-end-input"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="res-address">Endereço do evento</Label>
                <Input
                  id="res-address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  data-testid="reservation-address-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-city">Cidade</Label>
                <Input
                  id="res-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  data-testid="reservation-city-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-district">Bairro</Label>
                <Input
                  id="res-district"
                  value={form.district}
                  onChange={(e) => setForm({ ...form, district: e.target.value })}
                  data-testid="reservation-district-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-fee">Deslocamento (R$)</Label>
                <Input
                  id="res-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.delivery_fee}
                  onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
                  data-testid="reservation-fee-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="res-discount">Desconto (R$)</Label>
                <Input
                  id="res-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                  data-testid="reservation-discount-input"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="res-notes">Observações</Label>
                <Textarea
                  id="res-notes"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  data-testid="reservation-notes-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => create.mutate()}
                disabled={!form.customer_id || !form.toy_id || create.isPending}
                data-testid="reservation-save-button"
              >
                {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Criar reserva
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      <Card className="border-border/70 mt-8 rounded-2xl shadow-sm">
        <CardContent className="flex flex-wrap gap-4 p-5">
          <div className="min-w-[220px] flex-1 space-y-1.5">
            <Label htmlFor="res-search">Buscar</Label>
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                id="res-search"
                className="pl-9"
                placeholder="Código ou cliente"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="reservations-search-input"
              />
            </div>
          </div>
          <div className="min-w-[200px] space-y-1.5">
            <Label htmlFor="res-status">Status</Label>
            <Select value={status} onValueChange={(value: string) => setStatus(value)}>
              <SelectTrigger id="res-status" data-testid="reservations-status-filter">
                <SelectValue>
                  {(v) => STATUS_FILTERS.find((s) => s.value === v)?.label ?? "Todos"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {reservations.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-muted h-14 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nenhuma reserva encontrada"
            description="Crie um novo agendamento ou ajuste os filtros de busca."
            action={
              <Button size="sm" onClick={() => setOpen(true)} data-testid="empty-new-reservation">
                Criar novo agendamento
              </Button>
            }
            testId="reservations-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="reservations-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data / horário</TableHead>
                  <TableHead>Atrações</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((reservation) => (
                  <TableRow key={reservation.id} data-testid={`reservation-row-${reservation.id}`}>
                    <TableCell className="font-semibold">{reservation.code}</TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {reservation.customer_name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isoToBr(reservation.event_date)}
                      <span className="text-muted-foreground block text-xs">
                        {reservation.start_time} às {reservation.end_time}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {reservation.items.map((i) => `${i.quantity}x ${i.toy_name}`).join(", ")}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {brl(reservation.total)}
                    </TableCell>
                    <TableCell>
                      <StatusPill
                        status={reservation.status}
                        label={RESERVATION_LABELS[reservation.status]}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {reservation.payment_id ? (
                          <Link
                            to={`/pagamento/${reservation.payment_id}`}
                            className={buttonVariants({ variant: "outline", size: "xs" })}
                            data-testid={`reservation-view-pix-${reservation.id}`}
                          >
                            Ver PIX
                          </Link>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => generatePix.mutate(reservation.id)}
                            disabled={generatePix.isPending}
                            data-testid={`reservation-generate-pix-${reservation.id}`}
                          >
                            <QrCode className="mr-1 size-3" /> PIX
                          </Button>
                        )}
                        {reservation.contract_id ? (
                          <Link
                            to={`/contrato/${reservation.contract_id}`}
                            className={buttonVariants({ variant: "ghost", size: "xs" })}
                            data-testid={`reservation-contract-${reservation.id}`}
                          >
                            Contrato
                          </Link>
                        ) : null}
                        {!["cancelada", "finalizada"].includes(reservation.status) ? (
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            onClick={() =>
                              changeStatus.mutate({ id: reservation.id, next: "cancelada" })
                            }
                            aria-label="Cancelar reserva"
                            data-testid={`reservation-cancel-${reservation.id}`}
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        ) : null}
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => remove.mutate(reservation.id)}
                          aria-label="Excluir reserva"
                          data-testid={`reservation-delete-${reservation.id}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
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

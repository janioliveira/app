import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { QUOTE_LABELS, addDaysIso, brl, isoToBr } from "@/lib/format";
import type { Customer, Quote, QuoteStatus, Reservation, Toy } from "@/lib/types";

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

export default function Budgets() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customer_id: "",
    toy_id: "",
    quantity: 1,
    event_date: addDaysIso(14),
    start_time: "14:00",
    end_time: "19:00",
    address: "",
    discount: 0,
    delivery_fee: 80,
    valid_until: addDaysIso(7),
    notes: "",
  });

  const quotes = useQuery<Quote[]>({
    queryKey: ["quotes"],
    queryFn: () => apiGet<Quote[]>("/quotes"),
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
    await queryClient.invalidateQueries({ queryKey: ["quotes"] });
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const create = useMutation<Quote, Error, void>({
    mutationFn: () =>
      apiPost<Quote>("/quotes", {
        customer_id: form.customer_id,
        items: [{ toy_id: form.toy_id, quantity: Number(form.quantity) }],
        event_date: form.event_date,
        start_time: form.start_time,
        end_time: form.end_time,
        address: form.address,
        discount: Number(form.discount),
        delivery_fee: Number(form.delivery_fee),
        valid_until: form.valid_until,
        notes: form.notes,
      }),
    onSuccess: async (quote) => {
      toast.success(`Orçamento ${quote.number} criado.`);
      setOpen(false);
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível criar o orçamento.")),
  });

  const changeStatus = useMutation<Quote, Error, { id: string; next: QuoteStatus }>({
    mutationFn: ({ id, next }) => apiPatch<Quote>(`/quotes/${id}/status`, { status: next }),
    onSuccess: async () => {
      toast.success("Status do orçamento atualizado.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível atualizar.")),
  });

  const convert = useMutation<Reservation, Error, string>({
    mutationFn: (id) => apiPost<Reservation>(`/quotes/${id}/convert`),
    onSuccess: async (reservation) => {
      toast.success(`Convertido na reserva ${reservation.code}.`);
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível converter.")),
  });

  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiDelete(`/quotes/${id}`),
    onSuccess: async () => {
      toast.success("Orçamento removido.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível remover.")),
  });

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Comercial
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground mt-2">
            Do rascunho à conversão em reserva, com validade e desconto controlados.
          </p>
        </div>
        <Button className="shadow-sm" onClick={() => setOpen(true)} data-testid="new-quote-button">
          <Plus className="mr-2 size-4" /> Novo orçamento
        </Button>
      </header>

      <div className="mt-8">
        {quotes.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted h-14 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (quotes.data ?? []).length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum orçamento emitido"
            description="Crie um orçamento para enviar a proposta antes de bloquear a agenda."
            action={
              <Button size="sm" onClick={() => setOpen(true)} data-testid="empty-new-quote">
                Criar orçamento
              </Button>
            }
            testId="quotes-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="quotes-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data do evento</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(quotes.data ?? []).map((quote) => (
                  <TableRow key={quote.id} data-testid={`quote-row-${quote.id}`}>
                    <TableCell className="font-semibold">{quote.number}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{quote.customer_name}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {isoToBr(quote.event_date)}
                      <span className="text-muted-foreground block text-xs">
                        válido até {isoToBr(quote.valid_until) || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{brl(quote.total)}</TableCell>
                    <TableCell>
                      <StatusPill status={quote.status} label={QUOTE_LABELS[quote.status]} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Select
                          value={quote.status}
                          onValueChange={(value: string) =>
                            changeStatus.mutate({ id: quote.id, next: value as QuoteStatus })
                          }
                        >
                          <SelectTrigger
                            size="sm"
                            className="w-[140px]"
                            data-testid={`quote-status-select-${quote.id}`}
                          >
                            <SelectValue>{(v) => QUOTE_LABELS[String(v)] ?? ""}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(QUOTE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {quote.status !== "convertido" ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => convert.mutate(quote.id)}
                            disabled={convert.isPending}
                            data-testid={`quote-convert-${quote.id}`}
                          >
                            <ArrowRightLeft className="mr-1 size-3" /> Converter
                          </Button>
                        ) : null}
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => remove.mutate(quote.id)}
                          aria-label="Excluir orçamento"
                          data-testid={`quote-delete-${quote.id}`}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo orçamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="quote-customer">Cliente</Label>
              <Select
                value={form.customer_id}
                onValueChange={(value: string) => setForm({ ...form, customer_id: value })}
              >
                <SelectTrigger id="quote-customer" data-testid="quote-customer-select">
                  <SelectValue>
                    {(v) =>
                      (customers.data ?? []).find((c) => c.id === v)?.name ?? "Selecione o cliente"
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
              <Label htmlFor="quote-toy">Brinquedo</Label>
              <Select
                value={form.toy_id}
                onValueChange={(value: string) => setForm({ ...form, toy_id: value })}
              >
                <SelectTrigger id="quote-toy" data-testid="quote-toy-select">
                  <SelectValue>
                    {(v) => (toys.data ?? []).find((t) => t.id === v)?.name ?? "Selecione"}
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
              <Label htmlFor="quote-qty">Quantidade</Label>
              <Input
                id="quote-qty"
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                data-testid="quote-quantity-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-date">Data do evento</Label>
              <Input
                id="quote-date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                data-testid="quote-date-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-valid">Validade da proposta</Label>
              <Input
                id="quote-valid"
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                data-testid="quote-valid-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-start">Início</Label>
              <Input
                id="quote-start"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                data-testid="quote-start-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-end">Término</Label>
              <Input
                id="quote-end"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                data-testid="quote-end-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-fee">Deslocamento (R$)</Label>
              <Input
                id="quote-fee"
                type="number"
                min={0}
                step="0.01"
                value={form.delivery_fee}
                onChange={(e) => setForm({ ...form, delivery_fee: Number(e.target.value) })}
                data-testid="quote-fee-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quote-discount">Desconto (R$)</Label>
              <Input
                id="quote-discount"
                type="number"
                min={0}
                step="0.01"
                value={form.discount}
                onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                data-testid="quote-discount-input"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="quote-address">Endereço do evento</Label>
              <Input
                id="quote-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                data-testid="quote-address-input"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="quote-notes">Observações</Label>
              <Textarea
                id="quote-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                data-testid="quote-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={!form.customer_id || !form.toy_id || create.isPending}
              data-testid="quote-save-button"
            >
              {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Criar orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

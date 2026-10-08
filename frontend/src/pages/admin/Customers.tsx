import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, MessageCircle, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { RESERVATION_LABELS, brl, isoToBr, maskDocument, maskPhone } from "@/lib/format";
import type { Customer, CustomerHistory, CustomerInput } from "@/lib/types";

const EMPTY: CustomerInput = {
  name: "",
  document: "",
  phone: "",
  whatsapp: "",
  email: "",
  zip_code: "",
  street: "",
  number: "",
  complement: "",
  district: "",
  city: "",
  state: "",
  notes: "",
};

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

export default function Customers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [historyFor, setHistoryFor] = useState<Customer | null>(null);

  const customers = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/customers"),
  });

  const history = useQuery<CustomerHistory>({
    queryKey: ["customer-history", historyFor?.id],
    queryFn: () => apiGet<CustomerHistory>(`/customers/${historyFor?.id}/history`),
    enabled: Boolean(historyFor),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["customers"] });

  const save = useMutation<Customer, Error, void>({
    mutationFn: () =>
      editing
        ? apiPut<Customer>(`/customers/${editing}`, form)
        : apiPost<Customer>("/customers", form),
    onSuccess: async () => {
      toast.success(editing ? "Cliente atualizado." : "Cliente cadastrado.");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível salvar o cliente.")),
  });

  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiDelete(`/customers/${id}`),
    onSuccess: async () => {
      toast.success("Cliente removido.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível remover.")),
  });

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (customers.data ?? []).filter(
      (c) =>
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.document.toLowerCase().includes(term) ||
        c.whatsapp.includes(term),
    );
  }, [customers.data, search]);

  const startEdit = (customer: Customer) => {
    setEditing(customer.id);
    setForm({
      name: customer.name,
      document: customer.document,
      phone: customer.phone,
      whatsapp: customer.whatsapp,
      email: customer.email,
      zip_code: customer.zip_code,
      street: customer.street,
      number: customer.number,
      complement: customer.complement,
      district: customer.district,
      city: customer.city,
      state: customer.state,
      notes: customer.notes,
    });
    setOpen(true);
  };

  const FIELDS: Array<[keyof CustomerInput, string, string]> = [
    ["name", "Nome completo / razão social", "text"],
    ["document", "CPF / CNPJ", "text"],
    ["whatsapp", "WhatsApp (com DDI +55)", "text"],
    ["phone", "Telefone", "text"],
    ["email", "E-mail", "email"],
    ["zip_code", "CEP", "text"],
    ["street", "Rua", "text"],
    ["number", "Número", "text"],
    ["complement", "Complemento", "text"],
    ["district", "Bairro", "text"],
    ["city", "Cidade", "text"],
    ["state", "Estado (UF)", "text"],
  ];

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Relacionamento
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground mt-2">
            Cadastro completo com endereço, WhatsApp internacional e histórico de festas.
          </p>
        </div>
        <Button
          className="shadow-sm"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setOpen(true);
          }}
          data-testid="new-customer-button"
        >
          <Plus className="mr-2 size-4" /> Novo cliente
        </Button>
      </header>

      <Card className="border-border/70 mt-8 rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="relative max-w-md">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome, documento ou WhatsApp"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="customers-search-input"
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {customers.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted h-14 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente encontrado"
            description="Cadastre o primeiro cliente para começar a registrar reservas."
            action={
              <Button size="sm" onClick={() => setOpen(true)} data-testid="empty-new-customer">
                Cadastrar cliente
              </Button>
            }
            testId="customers-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="customers-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((customer) => (
                  <TableRow key={customer.id} data-testid={`customer-row-${customer.id}`}>
                    <TableCell className="max-w-[220px] truncate font-semibold">
                      {customer.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{customer.document || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{customer.whatsapp || "—"}</TableCell>
                    <TableCell>
                      {customer.city ? `${customer.city}/${customer.state}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        {customer.whatsapp ? (
                          <a
                            href={`https://wa.me/${customer.whatsapp.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`WhatsApp de ${customer.name}`}
                            data-testid={`customer-whatsapp-${customer.id}`}
                          >
                            <Button size="icon-xs" variant="ghost">
                              <MessageCircle className="size-3.5" />
                            </Button>
                          </a>
                        ) : null}
                        <Button
                          size="icon-xs"
                          variant="outline"
                          onClick={() => setHistoryFor(customer)}
                          aria-label={`Histórico de ${customer.name}`}
                          data-testid={`customer-history-${customer.id}`}
                        >
                          <History className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="outline"
                          onClick={() => startEdit(customer)}
                          aria-label={`Editar ${customer.name}`}
                          data-testid={`customer-edit-${customer.id}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => remove.mutate(customer.id)}
                          aria-label={`Excluir ${customer.name}`}
                          data-testid={`customer-delete-${customer.id}`}
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

      {/* Create / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(([key, label, type]) => (
              <div
                key={String(key)}
                className={key === "name" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}
              >
                <Label htmlFor={`cust-${String(key)}`}>{label}</Label>
                <Input
                  id={`cust-${String(key)}`}
                  type={type}
                  value={String(form[key] ?? "")}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const value =
                      key === "whatsapp" || key === "phone"
                        ? maskPhone(raw)
                        : key === "document"
                          ? maskDocument(raw)
                          : key === "state"
                            ? raw.toUpperCase().slice(0, 2)
                            : raw;
                    setForm({ ...form, [key]: value });
                  }}
                  data-testid={`customer-${String(key)}-input`}
                />
              </div>
            ))}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cust-notes">Observações</Label>
              <Textarea
                id="cust-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                data-testid="customer-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={form.name.length < 2 || save.isPending}
              data-testid="customer-save-button"
            >
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Salvar cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={Boolean(historyFor)} onOpenChange={(value) => !value && setHistoryFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {historyFor?.name}</DialogTitle>
          </DialogHeader>
          {history.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Reservas
                  </p>
                  <p className="mt-1 text-2xl font-bold" data-testid="history-total-reservations">
                    {history.data?.total_reservations ?? 0}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-xl p-4">
                  <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    Total gasto
                  </p>
                  <p className="mt-1 text-2xl font-bold" data-testid="history-total-spent">
                    {brl(history.data?.total_spent ?? 0)}
                  </p>
                </div>
              </div>

              {(history.data?.reservations ?? []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Este cliente ainda não possui reservas registradas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(history.data?.reservations ?? []).map((reservation) => (
                    <li
                      key={reservation.id}
                      className="border-border/70 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                      data-testid={`history-reservation-${reservation.id}`}
                    >
                      <span>
                        <strong>{reservation.code}</strong>
                        <span className="text-muted-foreground block text-xs">
                          {isoToBr(reservation.event_date)} · {reservation.start_time}
                        </span>
                      </span>
                      <StatusPill
                        status={reservation.status}
                        label={RESERVATION_LABELS[reservation.status]}
                      />
                      <span className="font-semibold">{brl(reservation.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/api";
import { brl, isoToBr, todayIso } from "@/lib/format";
import type { EntryKind, FinancialEntry, FinancialSummary } from "@/lib/types";

const EXPENSE_CATEGORIES = [
  "Combustível",
  "Manutenção",
  "Materiais",
  "Marketing",
  "Transporte",
  "Outros",
];
const INCOME_CATEGORIES = ["PIX Mercado Pago", "Recebimento administrativo", "Outros"];

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

export default function Financial() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    kind: "saida" as EntryKind,
    category: "Combustível",
    description: "",
    amount: 0,
    date: todayIso(),
  });

  const summary = useQuery<FinancialSummary>({
    queryKey: ["financial", "summary"],
    queryFn: () => apiGet<FinancialSummary>("/financial/summary"),
  });
  const entries = useQuery<FinancialEntry[]>({
    queryKey: ["financial", "entries"],
    queryFn: () => apiGet<FinancialEntry[]>("/financial/entries"),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["financial"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const create = useMutation<FinancialEntry, Error, void>({
    mutationFn: () => apiPost<FinancialEntry>("/financial/entries", form),
    onSuccess: async () => {
      toast.success("Lançamento registrado.");
      setOpen(false);
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível lançar.")),
  });

  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiDelete(`/financial/entries/${id}`),
    onSuccess: async () => {
      toast.success("Lançamento removido.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível remover.")),
  });

  const data = summary.data;
  const categories = form.kind === "entrada" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Gestão
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground mt-2">
            Receitas PIX, despesas operacionais e lucro líquido consolidados.
          </p>
        </div>
        <Button className="shadow-sm" onClick={() => setOpen(true)} data-testid="new-entry-button">
          <Plus className="mr-2 size-4" /> Novo lançamento
        </Button>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Receita"
          value={brl(data?.revenue ?? 0)}
          icon={TrendingUp}
          tone="pix"
          testId="financial-metric-revenue"
        />
        <MetricCard
          label="Despesas"
          value={brl(data?.expenses ?? 0)}
          icon={TrendingDown}
          tone="danger"
          testId="financial-metric-expenses"
        />
        <MetricCard
          label="Lucro líquido"
          value={brl(data?.net_profit ?? 0)}
          icon={Wallet}
          testId="financial-metric-profit"
        />
        <MetricCard
          label="A receber"
          value={brl(data?.receivable ?? 0)}
          icon={Wallet}
          tone="warning"
          testId="financial-metric-receivable"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="pix-breakdown-card">
          <CardHeader>
            <CardTitle className="text-base">Situação das cobranças PIX</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {(
                [
                  ["PIX aprovado", data?.pix_approved ?? 0, "text-[var(--pix)]"],
                  ["PIX pendente", data?.pix_pending ?? 0, "text-amber-600 dark:text-amber-400"],
                  ["PIX expirado", data?.pix_expired ?? 0, "text-muted-foreground"],
                  ["PIX cancelado", data?.pix_cancelled ?? 0, "text-muted-foreground"],
                  ["PIX estornado", data?.pix_refunded ?? 0, "text-rose-600 dark:text-rose-400"],
                ] as Array<[string, number, string]>
              ).map(([label, value, tone]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={`font-bold ${tone}`}>{brl(value)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="expenses-category-card">
          <CardHeader>
            <CardTitle className="text-base">Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.expenses_by_category ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhuma despesa lançada ainda.</p>
            ) : (
              <ul className="space-y-3">
                {(data?.expenses_by_category ?? []).map((item) => {
                  const max = Math.max(
                    ...(data?.expenses_by_category ?? []).map((e) => e.amount),
                    1,
                  );
                  return (
                    <li key={item.category} data-testid={`expense-category-${item.category}`}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium">{item.category}</span>
                        <span className="font-semibold">{brl(item.amount)}</span>
                      </div>
                      <div className="bg-muted mt-1.5 h-2 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${(item.amount / max) * 100}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="mt-6">
        {(entries.data ?? []).length === 0 && !entries.isLoading ? (
          <EmptyState
            icon={Wallet}
            title="Nenhum lançamento registrado"
            description="Lance as despesas operacionais para acompanhar o lucro líquido real."
            action={
              <Button size="sm" onClick={() => setOpen(true)} data-testid="empty-new-entry">
                Registrar lançamento
              </Button>
            }
            testId="financial-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="financial-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(entries.data ?? []).map((entry) => (
                  <TableRow key={entry.id} data-testid={`financial-row-${entry.id}`}>
                    <TableCell className="whitespace-nowrap">{isoToBr(entry.date)}</TableCell>
                    <TableCell>
                      <span
                        className={
                          entry.kind === "entrada"
                            ? "font-semibold text-[var(--pix)]"
                            : "font-semibold text-rose-600 dark:text-rose-400"
                        }
                      >
                        {entry.kind === "entrada" ? "Entrada" : "Saída"}
                      </span>
                    </TableCell>
                    <TableCell>{entry.category}</TableCell>
                    <TableCell className="max-w-[260px] truncate">{entry.description}</TableCell>
                    <TableCell className="text-right font-semibold">{brl(entry.amount)}</TableCell>
                    <TableCell className="text-right">
                      {entry.payment_id ? (
                        <span className="text-muted-foreground text-xs">automático</span>
                      ) : (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          onClick={() => remove.mutate(entry.id)}
                          aria-label="Excluir lançamento"
                          data-testid={`financial-delete-${entry.id}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo lançamento</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fin-kind">Tipo</Label>
              <Select
                value={form.kind}
                onValueChange={(value: string) =>
                  setForm({
                    ...form,
                    kind: value as EntryKind,
                    category: value === "entrada" ? INCOME_CATEGORIES[1] : EXPENSE_CATEGORIES[0],
                  })
                }
              >
                <SelectTrigger id="fin-kind" data-testid="entry-kind-select">
                  <SelectValue>{(v) => (v === "entrada" ? "Entrada" : "Saída")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-category">Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(value: string) => setForm({ ...form, category: value })}
              >
                <SelectTrigger id="fin-category" data-testid="entry-category-select">
                  <SelectValue>{(v) => String(v ?? "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-description">Descrição</Label>
              <Input
                id="fin-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="entry-description-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fin-amount">Valor (R$)</Label>
                <Input
                  id="fin-amount"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                  data-testid="entry-amount-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin-date">Data</Label>
                <Input
                  id="fin-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  data-testid="entry-date-input"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => create.mutate()}
              disabled={form.amount <= 0 || create.isPending}
              data-testid="entry-save-button"
            >
              {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Salvar lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

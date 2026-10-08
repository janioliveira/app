import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Package, Pencil, Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { TOY_STATUS_LABELS, brl } from "@/lib/format";
import type { Toy, ToyInput, ToyStatus } from "@/lib/types";

const EMPTY: ToyInput = {
  name: "",
  category: "Inflável",
  description: "",
  image_url: "",
  width_m: 0,
  length_m: 0,
  height_m: 0,
  capacity: 0,
  age_range: "",
  daily_price: 0,
  quantity: 1,
  status: "disponivel",
  maintenance_notes: "",
  notes: "",
};

const CATEGORIES = ["Inflável", "Cama Elástica", "Área Baby", "Alimentação", "Outros"];

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

export default function Inventory() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ToyInput>(EMPTY);

  const toys = useQuery<Toy[]>({
    queryKey: ["toys"],
    queryFn: () => apiGet<Toy[]>("/toys"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["toys"] });

  const save = useMutation<Toy, Error, void>({
    mutationFn: () =>
      editing ? apiPut<Toy>(`/toys/${editing}`, form) : apiPost<Toy>("/toys", form),
    onSuccess: async () => {
      toast.success(editing ? "Brinquedo atualizado." : "Brinquedo cadastrado.");
      setOpen(false);
      setEditing(null);
      setForm(EMPTY);
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível salvar.")),
  });

  const remove = useMutation<unknown, Error, string>({
    mutationFn: (id) => apiDelete(`/toys/${id}`),
    onSuccess: async () => {
      toast.success("Brinquedo removido.");
      await invalidate();
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível remover.")),
  });

  const startEdit = (toy: Toy) => {
    setEditing(toy.id);
    setForm({
      name: toy.name,
      category: toy.category,
      description: toy.description,
      image_url: toy.image_url,
      width_m: toy.width_m,
      length_m: toy.length_m,
      height_m: toy.height_m,
      capacity: toy.capacity,
      age_range: toy.age_range,
      daily_price: toy.daily_price,
      quantity: toy.quantity,
      status: toy.status,
      maintenance_notes: toy.maintenance_notes,
      notes: toy.notes,
    });
    setOpen(true);
  };

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Catálogo
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Brinquedos</h1>
          <p className="text-muted-foreground mt-2">
            Dimensões, capacidade, valores de diária e controle de manutenção.
          </p>
        </div>
        <Button
          className="shadow-sm"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY);
            setOpen(true);
          }}
          data-testid="new-toy-button"
        >
          <Plus className="mr-2 size-4" /> Novo brinquedo
        </Button>
      </header>

      <div className="mt-8">
        {toys.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted h-56 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : (toys.data ?? []).length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum brinquedo cadastrado"
            description="Cadastre a primeira atração para começar a receber reservas."
            action={
              <Button size="sm" onClick={() => setOpen(true)} data-testid="empty-new-toy">
                Cadastrar brinquedo
              </Button>
            }
            testId="inventory-empty-state"
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {(toys.data ?? []).map((toy) => (
              <Card
                key={toy.id}
                className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm transition-shadow duration-200 hover:shadow-md"
                data-testid={`inventory-toy-${toy.id}`}
              >
                <div className="bg-muted relative h-40">
                  {toy.image_url ? (
                    <img src={toy.image_url} alt={toy.name} className="size-full object-cover" />
                  ) : (
                    <Package className="text-muted-foreground absolute inset-0 m-auto size-10" />
                  )}
                  <StatusPill
                    status={toy.status}
                    label={TOY_STATUS_LABELS[toy.status]}
                    className="absolute top-3 right-3"
                    testId={`inventory-status-${toy.id}`}
                  />
                </div>
                <CardContent className="space-y-3 p-5">
                  <div>
                    <h2 className="font-bold">{toy.name}</h2>
                    <p className="text-muted-foreground text-xs">{toy.category}</p>
                  </div>
                  <dl className="text-muted-foreground grid grid-cols-2 gap-1.5 text-xs">
                    <div>
                      {toy.length_m}m × {toy.width_m}m × {toy.height_m}m
                    </div>
                    <div>até {toy.capacity} crianças</div>
                    <div>Qtd. em estoque: {toy.quantity}</div>
                    <div>{toy.age_range || "faixa livre"}</div>
                  </dl>
                  {toy.maintenance_notes ? (
                    <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                      {toy.maintenance_notes}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-primary text-lg font-extrabold">
                      {brl(toy.daily_price)}
                    </span>
                    <div className="flex gap-1.5">
                      <Button
                        size="icon-xs"
                        variant="outline"
                        onClick={() => startEdit(toy)}
                        aria-label={`Editar ${toy.name}`}
                        data-testid={`inventory-edit-${toy.id}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => remove.mutate(toy.id)}
                        aria-label={`Excluir ${toy.name}`}
                        data-testid={`inventory-delete-${toy.id}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar brinquedo" : "Novo brinquedo"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="toy-name">Nome</Label>
              <Input
                id="toy-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                data-testid="toy-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toy-category">Categoria</Label>
              <Select
                value={form.category}
                onValueChange={(value: string) => setForm({ ...form, category: value })}
              >
                <SelectTrigger id="toy-category" data-testid="toy-category-select">
                  <SelectValue>{(v) => String(v ?? "")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="toy-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value: string) =>
                  setForm({ ...form, status: value as ToyStatus })
                }
              >
                <SelectTrigger id="toy-status" data-testid="toy-status-select">
                  <SelectValue>{(v) => TOY_STATUS_LABELS[String(v)] ?? ""}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TOY_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="toy-description">Descrição</Label>
              <Textarea
                id="toy-description"
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                data-testid="toy-description-input"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="toy-image">URL da foto</Label>
              <Input
                id="toy-image"
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                placeholder="https://…"
                data-testid="toy-image-input"
              />
            </div>
            {(
              [
                ["length_m", "Comprimento (m)"],
                ["width_m", "Largura (m)"],
                ["height_m", "Altura (m)"],
                ["capacity", "Capacidade (crianças)"],
                ["daily_price", "Valor da diária (R$)"],
                ["quantity", "Quantidade em estoque"],
              ] as Array<[keyof ToyInput, string]>
            ).map(([key, label]) => (
              <div key={String(key)} className="space-y-1.5">
                <Label htmlFor={`toy-${String(key)}`}>{label}</Label>
                <Input
                  id={`toy-${String(key)}`}
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(form[key])}
                  onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })}
                  data-testid={`toy-${String(key)}-input`}
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="toy-age">Faixa etária</Label>
              <Input
                id="toy-age"
                value={form.age_range}
                onChange={(e) => setForm({ ...form, age_range: e.target.value })}
                placeholder="4 a 12 anos"
                data-testid="toy-age-input"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="toy-maintenance">Observações de manutenção</Label>
              <Textarea
                id="toy-maintenance"
                rows={2}
                value={form.maintenance_notes}
                onChange={(e) => setForm({ ...form, maintenance_notes: e.target.value })}
                data-testid="toy-maintenance-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => save.mutate()}
              disabled={form.name.length < 2 || save.isPending}
              data-testid="toy-save-button"
            >
              {save.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Salvar brinquedo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

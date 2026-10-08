import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  Minus,
  Package,
  Plus,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PublicLayout } from "@/components/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/useSession";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { addDaysIso, brl, isoToBr, maskDocument, maskPhone, weekdayBr } from "@/lib/format";
import type { AvailabilityResult, Payment, Reservation, Toy } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Brinquedos", "Data e horário", "Seus dados", "Pagamento PIX"];
const DELIVERY_FEE = 80;

export default function BookingFlow() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useSession();

  const [step, setStep] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>(() => {
    const preselected = params.get("toy");
    return preselected ? { [preselected]: 1 } : {};
  });
  const [date, setDate] = useState(params.get("date") || addDaysIso(7));
  const [start, setStart] = useState(params.get("start") || "14:00");
  const [end, setEnd] = useState(params.get("end") || "19:00");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    document: "",
    street: "",
    number: "",
    district: "",
    city: "",
    state: "SP",
    zip_code: "",
    notes: "",
  });

  const toys = useQuery<Toy[]>({
    queryKey: ["toys", "booking"],
    queryFn: () => apiGet<Toy[]>("/toys?only_available=true"),
  });

  const availability = useMutation<AvailabilityResult, Error, void>({
    mutationFn: () =>
      apiPost<AvailabilityResult>("/reservations/availability", {
        toy_ids: Object.keys(cart),
        event_date: date,
        start_time: start,
        end_time: end,
      }),
    onSuccess: (result) => {
      if (result.available) {
        toast.success("Tudo livre nesta data! Pode seguir.");
        setStep(2);
      } else {
        toast.error("Alguns brinquedos estão indisponíveis neste horário.");
      }
    },
    onError: () => toast.error("Não foi possível consultar a agenda agora."),
  });

  const createReservation = useMutation<Payment, Error, void>({
    mutationFn: async () => {
      const reservation = await apiPost<Reservation>("/reservations", {
        customer_id: user?.role === "cliente" ? user.customer_id : null,
        customer:
          user?.role === "cliente"
            ? null
            : {
                name: form.name,
                email: form.email,
                phone: form.phone,
                whatsapp: form.phone,
                document: form.document,
                street: form.street,
                number: form.number,
                district: form.district,
                city: form.city,
                state: form.state,
                zip_code: form.zip_code,
              },
        items: Object.entries(cart).map(([toy_id, quantity]) => ({ toy_id, quantity })),
        event_date: date,
        start_time: start,
        end_time: end,
        address: `${form.street}${form.number ? `, ${form.number}` : ""}`.trim(),
        city: form.city,
        district: form.district,
        delivery_fee: DELIVERY_FEE,
        discount: 0,
        notes: form.notes,
      });
      return apiPost<Payment>("/payments/pix", { reservation_id: reservation.id });
    },
    onSuccess: (payment) => {
      toast.success("Pré-reserva criada! Finalize o pagamento PIX.");
      navigate(`/pagamento/${payment.id}`);
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
          ? (error.body as { detail: string }).detail
          : "Não foi possível criar a reserva.";
      toast.error(detail);
    },
  });

  const selected = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, quantity]) => {
          const toy = (toys.data ?? []).find((t) => t.id === id);
          return toy ? { toy, quantity } : null;
        })
        .filter((entry): entry is { toy: Toy; quantity: number } => entry !== null),
    [cart, toys.data],
  );

  const subtotal = selected.reduce((sum, i) => sum + i.toy.daily_price * i.quantity, 0);
  const total = subtotal + (selected.length ? DELIVERY_FEE : 0);

  const setQty = (id: string, delta: number) =>
    setCart((prev) => {
      const next = { ...prev };
      const value = (next[id] ?? 0) + delta;
      if (value <= 0) delete next[id];
      else next[id] = value;
      return next;
    });

  const dataValid =
    user?.role === "cliente" ||
    (form.name.length > 2 && form.phone.replace(/\D/g, "").length >= 10 && form.city.length > 1);

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Fazer uma reserva</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-lg">
          Quatro passos: escolher as atrações, confirmar a agenda, informar os dados e pagar por
          PIX.
        </p>

        {/* Stepper */}
        <ol className="mt-8 flex flex-wrap gap-2" data-testid="booking-stepper">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-200",
                  index === step
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : index < step
                      ? "bg-[var(--pix)]/15 text-[var(--pix)]"
                      : "bg-muted text-muted-foreground",
                )}
                data-testid={`booking-step-${index}`}
              >
                {index < step ? <CheckCircle2 className="size-3.5" /> : <span>{index + 1}</span>}
                {label}
              </span>
              {index < STEPS.length - 1 ? (
                <ArrowRight className="text-muted-foreground/50 size-3.5" />
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_0.6fr] lg:items-start">
          <div className="space-y-6">
            {/* Step 0 — toys */}
            {step === 0 ? (
              <Card className="border-border/70 rounded-2xl shadow-sm">
                <CardContent className="space-y-4 p-6">
                  <h2 className="text-lg font-bold">Escolha as atrações</h2>
                  {toys.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-muted h-20 animate-pulse rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <ul className="space-y-3" data-testid="booking-toy-list">
                      {(toys.data ?? []).map((toy) => (
                        <li
                          key={toy.id}
                          className={cn(
                            "border-border/70 flex items-center gap-4 rounded-xl border p-3 transition-colors duration-150",
                            cart[toy.id] ? "border-primary/50 bg-primary/5" : "hover:bg-muted/50",
                          )}
                          data-testid={`booking-toy-${toy.id}`}
                        >
                          <div className="bg-muted size-16 shrink-0 overflow-hidden rounded-lg">
                            {toy.image_url ? (
                              <img src={toy.image_url} alt={toy.name} className="size-full object-cover" />
                            ) : (
                              <Package className="text-muted-foreground m-auto size-6" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold">{toy.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {toy.length_m}m × {toy.width_m}m · até {toy.capacity} crianças
                            </p>
                            <p className="text-primary mt-1 text-sm font-bold">
                              {brl(toy.daily_price)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon-xs"
                              onClick={() => setQty(toy.id, -1)}
                              disabled={!cart[toy.id]}
                              aria-label={`Remover ${toy.name}`}
                              data-testid={`booking-decrease-${toy.id}`}
                            >
                              <Minus className="size-3" />
                            </Button>
                            <span
                              className="w-7 text-center text-sm font-bold"
                              data-testid={`booking-qty-${toy.id}`}
                            >
                              {cart[toy.id] ?? 0}
                            </span>
                            <Button
                              variant="outline"
                              size="icon-xs"
                              onClick={() => setQty(toy.id, 1)}
                              disabled={(cart[toy.id] ?? 0) >= toy.quantity}
                              aria-label={`Adicionar ${toy.name}`}
                              data-testid={`booking-increase-${toy.id}`}
                            >
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Step 1 — date */}
            {step === 1 ? (
              <Card className="border-border/70 rounded-2xl shadow-sm">
                <CardContent className="space-y-5 p-6">
                  <h2 className="text-lg font-bold">Data e horário do evento</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-date">Data</Label>
                      <Input
                        id="bf-date"
                        type="date"
                        value={date}
                        min={addDaysIso(0)}
                        onChange={(e) => setDate(e.target.value)}
                        data-testid="booking-date-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-start">Início</Label>
                      <Input
                        id="bf-start"
                        type="time"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        data-testid="booking-start-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-end">Término</Label>
                      <Input
                        id="bf-end"
                        type="time"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        data-testid="booking-end-input"
                      />
                    </div>
                  </div>
                  {date ? (
                    <p className="text-muted-foreground text-sm capitalize">
                      {weekdayBr(date)} · {isoToBr(date)} · {start} às {end}
                    </p>
                  ) : null}

                  {availability.data && !availability.data.available ? (
                    <ul className="space-y-2" data-testid="booking-conflict-list">
                      {availability.data.items
                        .filter((item) => !item.available)
                        .map((item) => (
                          <li
                            key={item.toy_id}
                            className="text-destructive flex items-center gap-2 text-sm"
                          >
                            <XCircle className="size-4" /> {item.toy_name}: {item.reason}
                          </li>
                        ))}
                    </ul>
                  ) : null}

                  <Button
                    onClick={() => availability.mutate()}
                    disabled={availability.isPending || !date}
                    className="shadow-sm"
                    data-testid="booking-check-availability-button"
                  >
                    {availability.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <CalendarCheck className="mr-2 size-4" />
                    )}
                    Confirmar disponibilidade
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {/* Step 2 — customer data */}
            {step === 2 ? (
              <Card className="border-border/70 rounded-2xl shadow-sm">
                <CardContent className="space-y-5 p-6">
                  <h2 className="text-lg font-bold">Seus dados e endereço do evento</h2>
                  {user?.role === "cliente" ? (
                    <p
                      className="bg-muted/50 rounded-xl p-4 text-sm"
                      data-testid="booking-logged-customer"
                    >
                      Reserva será criada na sua conta: <strong>{user.name}</strong>. Informe apenas o
                      endereço do evento abaixo.
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="bf-name">Nome completo</Label>
                        <Input
                          id="bf-name"
                          required
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          data-testid="booking-name-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bf-phone">WhatsApp</Label>
                        <Input
                          id="bf-phone"
                          required
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                          placeholder="(11) 98234-0011"
                          data-testid="booking-phone-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bf-email">E-mail</Label>
                        <Input
                          id="bf-email"
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          data-testid="booking-email-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="bf-document">CPF/CNPJ</Label>
                        <Input
                          id="bf-document"
                          value={form.document}
                          onChange={(e) =>
                            setForm({ ...form, document: maskDocument(e.target.value) })
                          }
                          data-testid="booking-document-input"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="bf-street">Rua</Label>
                      <Input
                        id="bf-street"
                        value={form.street}
                        onChange={(e) => setForm({ ...form, street: e.target.value })}
                        data-testid="booking-street-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-number">Número</Label>
                      <Input
                        id="bf-number"
                        value={form.number}
                        onChange={(e) => setForm({ ...form, number: e.target.value })}
                        data-testid="booking-number-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-district">Bairro</Label>
                      <Input
                        id="bf-district"
                        value={form.district}
                        onChange={(e) => setForm({ ...form, district: e.target.value })}
                        data-testid="booking-district-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-city">Cidade</Label>
                      <Input
                        id="bf-city"
                        required
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        data-testid="booking-city-input"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="bf-state">UF</Label>
                      <Input
                        id="bf-state"
                        maxLength={2}
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })}
                        data-testid="booking-state-input"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="bf-notes">Observações</Label>
                      <Textarea
                        id="bf-notes"
                        rows={3}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        placeholder="Ponto de energia, acesso, horário de montagem…"
                        data-testid="booking-notes-input"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                disabled={step === 0}
                data-testid="booking-back-button"
              >
                <ArrowLeft className="mr-2 size-4" /> Voltar
              </Button>

              {step === 0 ? (
                <Button
                  onClick={() => setStep(1)}
                  disabled={selected.length === 0}
                  className="shadow-sm"
                  data-testid="booking-next-button"
                >
                  Continuar <ArrowRight className="ml-2 size-4" />
                </Button>
              ) : null}

              {step === 2 ? (
                <Button
                  onClick={() => createReservation.mutate()}
                  disabled={!dataValid || createReservation.isPending}
                  className="shadow-sm"
                  data-testid="booking-submit-button"
                >
                  {createReservation.isPending ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Gerando PIX…
                    </>
                  ) : (
                    <>
                      Gerar PIX de {brl(total)} <ArrowRight className="ml-2 size-4" />
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>

          {/* Summary */}
          <Card
            className="border-border/70 rounded-2xl shadow-sm lg:sticky lg:top-24"
            data-testid="booking-summary"
          >
            <CardContent className="space-y-4 p-6">
              <h2 className="text-base font-bold">Resumo da reserva</h2>
              {selected.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nenhuma atração selecionada ainda.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {selected.map(({ toy, quantity }) => (
                    <li
                      key={toy.id}
                      className="flex items-start justify-between gap-3 text-sm"
                      data-testid={`summary-item-${toy.id}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{toy.name}</span>
                        <span className="text-muted-foreground text-xs">{quantity}x diária</span>
                      </span>
                      <span className="font-semibold">{brl(toy.daily_price * quantity)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="border-border/70 space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span data-testid="summary-subtotal">{brl(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Deslocamento</span>
                  <span>{brl(selected.length ? DELIVERY_FEE : 0)}</span>
                </div>
                <div className="flex items-center justify-between pt-2 text-base font-extrabold">
                  <span>Total</span>
                  <span className="text-primary" data-testid="summary-total">
                    {brl(total)}
                  </span>
                </div>
              </div>

              {date ? (
                <Badge className="bg-muted text-muted-foreground w-full justify-center py-1.5">
                  {isoToBr(date)} · {start} às {end}
                </Badge>
              ) : null}

              <p className="text-muted-foreground text-xs leading-relaxed">
                Pagamento exclusivamente por PIX (Mercado Pago). A reserva é confirmada
                automaticamente após a aprovação.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicLayout>
  );
}

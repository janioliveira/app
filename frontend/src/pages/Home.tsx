import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PublicLayout } from "@/components/PublicLayout";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPost } from "@/lib/api";
import { addDaysIso, brl } from "@/lib/format";
import type { AvailabilityResult, Toy } from "@/lib/types";
import { cn } from "@/lib/utils";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1770144018298-9a39b149b372?crop=entropy&cs=srgb&fm=jpg&q=85&w=1400";

const BENEFITS = [
  {
    icon: Truck,
    title: "Montagem inclusa",
    description: "Entregamos, montamos e desmontamos no horário combinado, sem custo extra.",
  },
  {
    icon: ShieldCheck,
    title: "Higienização garantida",
    description: "Todos os brinquedos são lavados e sanitizados antes de cada evento.",
  },
  {
    icon: QrCode,
    title: "Pagamento por PIX",
    description: "QR Code na hora, confirmação automática e reserva garantida na agenda.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [date, setDate] = useState(addDaysIso(7));
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("19:00");

  const toys = useQuery<Toy[]>({
    queryKey: ["toys", "public"],
    queryFn: () => apiGet<Toy[]>("/toys?only_available=true"),
  });

  const check = useMutation<AvailabilityResult, Error, void>({
    mutationFn: () =>
      apiPost<AvailabilityResult>("/reservations/availability", {
        toy_ids: [],
        event_date: date,
        start_time: start,
        end_time: end,
      }),
  });

  const featured = (toys.data ?? []).slice(0, 3);
  const freeCount = check.data ? check.data.items.filter((i) => i.available).length : null;

  return (
    <PublicLayout>
      {/* Hero — split, asymmetric; renders fully without any backend data. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={HERO_IMAGE}
            alt="Brinquedos infláveis coloridos montados para festa infantil"
            className="size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/96 via-white/88 to-sky-50/80 dark:from-slate-950/95 dark:via-slate-950/90 dark:to-slate-900/85" />
        </div>

        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-8 lg:py-24">
          <div className="animate-rise max-w-2xl">
            <Badge
              className="bg-primary/12 text-primary border-primary/20 border font-semibold"
              data-testid="hero-badge"
            >
              <Sparkles className="mr-1.5 size-3.5" /> Festas inesquecíveis desde o primeiro pulo
            </Badge>
            <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Brinquedos infláveis que transformam
              <span className="text-primary"> a festa do seu filho</span>
            </h1>
            <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-relaxed">
              Pula-pula, tobogã, futebol de sabão e muito mais. Consulte a disponibilidade em
              segundos, reserve online e pague por PIX com confirmação automática.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/reservar"
                className={cn(buttonVariants({ size: "lg" }), "shadow-lg")}
                data-testid="hero-reserve-button"
              >
                Fazer minha reserva <ArrowRight className="ml-2 size-4" />
              </Link>
              <Link
                to="/brinquedos"
                className={buttonVariants({ variant: "outline", size: "lg" })}
                data-testid="hero-catalog-button"
              >
                Ver catálogo completo
              </Link>
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
              {[
                { label: "Atrações", value: `${toys.data?.length ?? 6}+` },
                { label: "Montagem", value: "Inclusa" },
                { label: "Pagamento", value: "PIX" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dt className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                    {stat.label}
                  </dt>
                  <dd className="mt-1 text-xl font-bold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Instant availability check */}
          <Card
            className="border-border/70 h-fit rounded-3xl shadow-xl lg:mt-6"
            data-testid="availability-widget"
          >
            <CardContent className="space-y-5 p-6 sm:p-7">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <CalendarCheck className="text-primary size-5" /> Consultar disponibilidade
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  Informe a data e o horário do evento para ver o que está livre na agenda.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="home-date">Data do evento</Label>
                  <Input
                    id="home-date"
                    type="date"
                    value={date}
                    min={addDaysIso(0)}
                    onChange={(e) => setDate(e.target.value)}
                    data-testid="availability-date-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="home-start">Início</Label>
                    <Input
                      id="home-start"
                      type="time"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      data-testid="availability-start-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="home-end">Término</Label>
                    <Input
                      id="home-end"
                      type="time"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      data-testid="availability-end-input"
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full shadow-sm"
                onClick={() => check.mutate()}
                disabled={check.isPending || !date}
                data-testid="availability-check-button"
              >
                {check.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Consultando…
                  </>
                ) : (
                  "Verificar agenda"
                )}
              </Button>

              {check.isError ? (
                <p className="text-destructive text-sm" data-testid="availability-error">
                  Não foi possível consultar agora. Fale com a gente pelo WhatsApp.
                </p>
              ) : null}

              {check.data ? (
                <div
                  className="bg-muted/50 space-y-2 rounded-xl p-4"
                  data-testid="availability-result"
                >
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-[var(--pix)]" />
                    {freeCount} atração(ões) livre(s) nesta data
                  </p>
                  <ul className="space-y-1">
                    {check.data.items.slice(0, 4).map((item) => (
                      <li
                        key={item.toy_id}
                        className="flex items-center justify-between gap-3 text-xs"
                        data-testid={`availability-item-${item.toy_id}`}
                      >
                        <span className="truncate">{item.toy_name}</span>
                        <span
                          className={
                            item.available
                              ? "font-semibold text-[var(--pix)]"
                              : "text-muted-foreground"
                          }
                        >
                          {item.available ? "livre" : item.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={() =>
                      navigate(`/reservar?date=${date}&start=${start}&end=${end}`)
                    }
                    data-testid="availability-continue-button"
                  >
                    Continuar para a reserva
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <Card
              key={benefit.title}
              className="border-border/70 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <CardContent className="p-6">
                <span className="bg-primary/10 text-primary grid size-11 place-items-center rounded-xl">
                  <benefit.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-bold">{benefit.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {benefit.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured catalog */}
      <section className="border-border/70 bg-muted/30 border-y">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                As atrações mais pedidas
              </h2>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Diárias com entrega, montagem e retirada incluídas na região metropolitana.
              </p>
            </div>
            <Link
              to="/brinquedos"
              className={buttonVariants({ variant: "outline" })}
              data-testid="featured-all-button"
            >
              Ver todos
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="border-border/70 rounded-2xl">
                    <div className="bg-muted h-44 animate-pulse rounded-t-2xl" />
                    <CardContent className="space-y-3 p-5">
                      <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                      <div className="bg-muted h-3 w-1/3 animate-pulse rounded" />
                    </CardContent>
                  </Card>
                ))
              : featured.map((toy) => (
                  <Card
                    key={toy.id}
                    className="border-border/70 group overflow-hidden rounded-2xl p-0 shadow-sm transition-shadow duration-200 hover:shadow-lg"
                    data-testid={`featured-toy-${toy.id}`}
                  >
                    <div className="bg-muted relative h-44 overflow-hidden">
                      {toy.image_url ? (
                        <img
                          src={toy.image_url}
                          alt={toy.name}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : null}
                      <Badge className="absolute top-3 left-3 bg-white/90 text-slate-900">
                        {toy.category}
                      </Badge>
                    </div>
                    <CardContent className="space-y-3 p-5">
                      <h3 className="text-base font-bold">{toy.name}</h3>
                      <p className="text-muted-foreground line-clamp-2 text-sm">
                        {toy.description}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-primary text-lg font-extrabold">
                          {brl(toy.daily_price)}
                        </span>
                        <Link
                          to={`/reservar?toy=${toy.id}`}
                          className={buttonVariants({ size: "sm" })}
                          data-testid={`featured-reserve-${toy.id}`}
                        >
                          Reservar
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Como funciona a reserva
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {[
            { step: "1", title: "Escolha", text: "Selecione as atrações, a data e o horário." },
            { step: "2", title: "Pré-reserva", text: "Confirmamos a disponibilidade na agenda." },
            { step: "3", title: "PIX", text: "Pague pelo QR Code ou copia e cola." },
            { step: "4", title: "Contrato", text: "Reserva confirmada e contrato para aceite." },
          ].map((item) => (
            <li key={item.step} className="relative">
              <span className="bg-primary text-primary-foreground grid size-10 place-items-center rounded-xl text-sm font-black shadow-md">
                {item.step}
              </span>
              <h3 className="mt-4 font-bold">{item.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{item.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </PublicLayout>
  );
}

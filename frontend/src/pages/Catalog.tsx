import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarCheck, Loader2, Package, Ruler, Users } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import { PublicLayout } from "@/components/PublicLayout";
import { StatusPill } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet, apiPost } from "@/lib/api";
import { TOY_STATUS_LABELS, addDaysIso, brl } from "@/lib/format";
import type { AvailabilityResult, Toy } from "@/lib/types";

export default function Catalog() {
  const [category, setCategory] = useState("todas");
  const [date, setDate] = useState(addDaysIso(7));
  const [start, setStart] = useState("14:00");
  const [end, setEnd] = useState("19:00");

  const toys = useQuery<Toy[]>({
    queryKey: ["toys", "catalog"],
    queryFn: () => apiGet<Toy[]>("/toys"),
  });

  const categories = useQuery<string[]>({
    queryKey: ["toys", "categories"],
    queryFn: () => apiGet<string[]>("/toys/categories"),
  });

  const availability = useMutation<AvailabilityResult, Error, void>({
    mutationFn: () =>
      apiPost<AvailabilityResult>("/reservations/availability", {
        toy_ids: [],
        event_date: date,
        start_time: start,
        end_time: end,
      }),
  });

  const availabilityMap = new Map(
    (availability.data?.items ?? []).map((item) => [item.toy_id, item]),
  );

  const visible = (toys.data ?? []).filter(
    (toy) => category === "todas" || toy.category === category,
  );

  const categoryOptions = ["todas", ...(categories.data ?? [])];

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Catálogo de brinquedos
          </h1>
          <p className="text-muted-foreground mt-3 text-lg leading-relaxed">
            Dimensões, capacidade e faixa etária de cada atração. Consulte a agenda para a sua
            data antes de reservar.
          </p>
        </header>

        {/* Date-aware availability filter */}
        <Card className="border-border/70 mt-8 rounded-2xl shadow-sm">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="cat-date">Data do evento</Label>
              <Input
                id="cat-date"
                type="date"
                value={date}
                min={addDaysIso(0)}
                onChange={(e) => setDate(e.target.value)}
                data-testid="catalog-date-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-start">Início</Label>
              <Input
                id="cat-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                data-testid="catalog-start-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-end">Término</Label>
              <Input
                id="cat-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                data-testid="catalog-end-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-category">Categoria</Label>
              <Select value={category} onValueChange={(value: string) => setCategory(value)}>
                <SelectTrigger id="cat-category" data-testid="catalog-category-select">
                  <SelectValue>{(v) => (v === "todas" ? "Todas" : String(v ?? ""))}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "todas" ? "Todas" : option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => availability.mutate()}
              disabled={availability.isPending}
              className="shadow-sm"
              data-testid="catalog-check-button"
            >
              {availability.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CalendarCheck className="mr-2 size-4" />
              )}
              Verificar agenda
            </Button>
          </CardContent>
        </Card>

        {/* Catalog grid — always renders, even if the availability call fails. */}
        <div className="mt-8">
          {toys.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="border-border/70 rounded-2xl">
                  <div className="bg-muted h-48 animate-pulse rounded-t-2xl" />
                  <CardContent className="space-y-3 p-5">
                    <div className="bg-muted h-4 w-2/3 animate-pulse rounded" />
                    <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Nenhum brinquedo nesta categoria"
              description="Experimente outra categoria ou fale com a gente pelo WhatsApp para montar um pacote sob medida."
              testId="catalog-empty-state"
            />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((toy) => {
                const slot = availabilityMap.get(toy.id);
                return (
                  <Card
                    key={toy.id}
                    className="border-border/70 group flex flex-col overflow-hidden rounded-2xl p-0 shadow-sm transition-shadow duration-200 hover:shadow-lg"
                    data-testid={`catalog-toy-${toy.id}`}
                  >
                    <div className="bg-muted relative h-48 overflow-hidden">
                      {toy.image_url ? (
                        <img
                          src={toy.image_url}
                          alt={toy.name}
                          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <div className="text-muted-foreground grid size-full place-items-center">
                          <Package className="size-10" />
                        </div>
                      )}
                      <Badge className="absolute top-3 left-3 bg-white/90 text-slate-900">
                        {toy.category}
                      </Badge>
                      {slot ? (
                        <StatusPill
                          status={slot.available ? "confirmada" : "cancelada"}
                          label={slot.available ? "Livre na data" : "Indisponível"}
                          className="absolute top-3 right-3"
                          testId={`catalog-availability-${toy.id}`}
                        />
                      ) : toy.status !== "disponivel" ? (
                        <StatusPill
                          status={toy.status}
                          label={TOY_STATUS_LABELS[toy.status]}
                          className="absolute top-3 right-3"
                        />
                      ) : null}
                    </div>

                    <CardContent className="flex flex-1 flex-col gap-3 p-5">
                      <h2 className="text-lg font-bold">{toy.name}</h2>
                      <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
                        {toy.description}
                      </p>

                      <dl className="text-muted-foreground mt-1 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Ruler className="size-3.5" />
                          {toy.length_m}m × {toy.width_m}m
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          até {toy.capacity} crianças
                        </div>
                        <div className="col-span-2">Faixa etária: {toy.age_range || "livre"}</div>
                      </dl>

                      <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                        <div>
                          <p className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                            Diária
                          </p>
                          <p className="text-primary text-xl font-extrabold">
                            {brl(toy.daily_price)}
                          </p>
                        </div>
                        <Link
                          to={`/reservar?toy=${toy.id}&date=${date}&start=${start}&end=${end}`}
                          className={buttonVariants({ size: "sm" })}
                          data-testid={`catalog-reserve-${toy.id}`}
                        >
                          Reservar
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

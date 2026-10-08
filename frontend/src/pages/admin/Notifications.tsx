import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet, apiPost } from "@/lib/api";
import { dateTimeBr } from "@/lib/format";
import type { Notification, OkResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<string, string> = {
  info: "Informação",
  success: "Sucesso",
  warning: "Atenção",
};

export default function Notifications() {
  const queryClient = useQueryClient();

  const notifications = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => apiGet<Notification[]>("/notifications"),
  });

  const markAll = useMutation<OkResponse, Error, void>({
    mutationFn: () => apiPost<OkResponse>("/notifications/read-all"),
    onSuccess: async (data) => {
      toast.success(data.message);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => toast.error("Não foi possível marcar como lidas."),
  });

  const markOne = useMutation<Notification, Error, string>({
    mutationFn: (id) => apiPost<Notification>(`/notifications/${id}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const list = notifications.data ?? [];
  const unread = list.filter((n) => !n.read).length;

  return (
    <AdminLayout>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Central
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground mt-2">
            {unread > 0 ? `${unread} notificação(ões) não lida(s).` : "Tudo em dia por aqui."}
          </p>
        </div>
        {unread > 0 ? (
          <Button
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
            data-testid="notifications-mark-all-button"
          >
            {markAll.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 size-4" />
            )}
            Marcar todas como lidas
          </Button>
        ) : null}
      </header>

      <div className="mt-8 space-y-3">
        {notifications.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-muted h-20 animate-pulse rounded-2xl" />
          ))
        ) : list.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nenhuma notificação ainda"
            description="Avisamos aqui sobre novas reservas, PIX aprovados, contratos e cancelamentos."
            testId="notifications-empty-state"
          />
        ) : (
          list.map((notification) => (
            <Card
              key={notification.id}
              className={cn(
                "border-border/70 rounded-2xl shadow-sm transition-shadow duration-200 hover:shadow-md",
                !notification.read && "border-primary/40 bg-primary/5",
              )}
              data-testid={`notification-${notification.id}`}
            >
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{notification.title}</p>
                    <StatusPill
                      status={notification.kind === "success" ? "confirmada" : notification.kind}
                      label={KIND_LABELS[notification.kind] ?? notification.kind}
                    />
                    {!notification.read ? (
                      <span className="bg-primary size-2 rounded-full" aria-label="Não lida" />
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-sm">{notification.message}</p>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {dateTimeBr(notification.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {notification.reservation_id ? (
                    <Link
                      to="/admin/reservas"
                      className={buttonVariants({ variant: "outline", size: "xs" })}
                      data-testid={`notification-reservation-${notification.id}`}
                    >
                      Ver reserva
                    </Link>
                  ) : null}
                  {!notification.read ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => markOne.mutate(notification.id)}
                      data-testid={`notification-read-${notification.id}`}
                    >
                      Marcar como lida
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </AdminLayout>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { WHATSAPP_LABELS, dateTimeBr } from "@/lib/format";
import type { Customer, WhatsAppMessage } from "@/lib/types";

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

export default function WhatsAppLogs() {
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [message, setMessage] = useState("");

  const messages = useQuery<WhatsAppMessage[]>({
    queryKey: ["whatsapp", "messages"],
    queryFn: () => apiGet<WhatsAppMessage[]>("/whatsapp/messages"),
    refetchInterval: 60_000,
  });
  const customers = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: () => apiGet<Customer[]>("/customers"),
  });

  const send = useMutation<WhatsAppMessage, Error, void>({
    mutationFn: () =>
      apiPost<WhatsAppMessage>("/whatsapp/send", {
        customer_id: customerId,
        message,
        message_type: "custom",
      }),
    onSuccess: async (result) => {
      if (result.status === "enviado") toast.success("Mensagem enviada pela API oficial.");
      else if (result.status === "pendente")
        toast.warning("Provedor não configurado — use o link wa.me registrado no histórico.");
      else toast.error(`Falha no envio: ${result.error || result.status}`);
      setMessage("");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp"] });
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível registrar o envio.")),
  });

  const list = messages.data ?? [];

  return (
    <AdminLayout>
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Comunicação
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">WhatsApp</h1>
        <p className="text-muted-foreground mt-2">
          Histórico de mensagens automáticas e manuais, com status de entrega do provedor.
        </p>
      </header>

      <div className="mt-8 grid gap-6 xl:grid-cols-[0.75fr_1.25fr] xl:items-start">
        <Card className="border-border/70 rounded-2xl shadow-sm" data-testid="whatsapp-send-card">
          <CardHeader>
            <CardTitle className="text-base">Envio manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wa-customer">Cliente</Label>
              <Select value={customerId} onValueChange={(value: string) => setCustomerId(value)}>
                <SelectTrigger id="wa-customer" data-testid="whatsapp-customer-select">
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
              <Label htmlFor="wa-message">Mensagem</Label>
              <Textarea
                id="wa-message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá! Passando para confirmar os detalhes da sua festa…"
                data-testid="whatsapp-message-input"
              />
            </div>
            <Button
              className="w-full shadow-sm"
              onClick={() => send.mutate()}
              disabled={!customerId || message.trim().length === 0 || send.isPending}
              data-testid="whatsapp-send-button"
            >
              {send.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Send className="mr-2 size-4" />
              )}
              Enviar mensagem
            </Button>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Sem Access Token configurado, a mensagem é registrada como pendente e um link
              <strong> wa.me</strong> fica disponível para envio manual.
            </p>
          </CardContent>
        </Card>

        <div>
          {messages.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-muted h-14 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={MessageCircle}
              title="Nenhuma mensagem registrada"
              description="As notificações automáticas de reserva, PIX e contrato aparecerão aqui."
              testId="whatsapp-empty-state"
            />
          ) : (
            <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
              <Table data-testid="whatsapp-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((item) => (
                    <TableRow key={item.id} data-testid={`whatsapp-row-${item.id}`}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {dateTimeBr(item.created_at)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{item.phone || "—"}</TableCell>
                      <TableCell className="text-xs">{item.message_type}</TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">
                        {item.message}
                      </TableCell>
                      <TableCell>
                        <StatusPill
                          status={item.status}
                          label={WHATSAPP_LABELS[item.status]}
                          testId={`whatsapp-status-${item.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {item.wa_link ? (
                          <a
                            href={item.wa_link}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`whatsapp-link-${item.id}`}
                          >
                            <Button size="icon-xs" variant="outline" aria-label="Abrir no WhatsApp">
                              <ExternalLink className="size-3.5" />
                            </Button>
                          </a>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

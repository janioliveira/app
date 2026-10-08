import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
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
import { apiGet } from "@/lib/api";
import { dateTimeBr } from "@/lib/format";
import type { AuditLog } from "@/lib/types";

export default function AuditLogs() {
  const [entity, setEntity] = useState("");

  const logs = useQuery<AuditLog[]>({
    queryKey: ["audit", entity],
    queryFn: () => apiGet<AuditLog[]>(`/audit/logs${entity ? `?entity=${entity}` : ""}`),
  });

  const list = logs.data ?? [];

  return (
    <AdminLayout>
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Segurança
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Auditoria</h1>
        <p className="text-muted-foreground mt-2">
          Trilha completa de ações: quem fez, o que, quando e de qual endereço IP.
        </p>
      </header>

      <Card className="border-border/70 mt-8 rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="audit-entity">Filtrar por entidade</Label>
            <Input
              id="audit-entity"
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              placeholder="reservation, payment, contract…"
              data-testid="audit-entity-input"
            />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        {logs.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted h-12 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhum registro de auditoria"
            description="As ações realizadas no sistema aparecerão aqui automaticamente."
            testId="audit-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="audit-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((log) => (
                  <TableRow key={log.id} data-testid={`audit-row-${log.id}`}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {dateTimeBr(log.created_at)}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">{log.user_name}</TableCell>
                    <TableCell className="font-semibold">{log.action}</TableCell>
                    <TableCell>
                      {log.entity}
                      {log.entity_id ? (
                        <span className="text-muted-foreground block font-mono text-[10px]">
                          {log.entity_id.slice(0, 8)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm">
                      {log.details || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ip || "—"}</TableCell>
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

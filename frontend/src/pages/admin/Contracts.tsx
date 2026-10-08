import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Link } from "react-router-dom";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { StatusPill } from "@/components/StatusPill";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { CONTRACT_LABELS, dateTimeBr } from "@/lib/format";
import type { Contract } from "@/lib/types";

export default function Contracts() {
  const contracts = useQuery<Contract[]>({
    queryKey: ["contracts"],
    queryFn: () => apiGet<Contract[]>("/contracts"),
  });

  const list = contracts.data ?? [];

  return (
    <AdminLayout>
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Documentos
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Contratos</h1>
        <p className="text-muted-foreground mt-2">
          Gerados automaticamente após a aprovação do PIX, com aceite digital registrado (data,
          hora, IP e versão).
        </p>
      </header>

      <div className="mt-8">
        {contracts.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted h-14 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum contrato gerado"
            description="O contrato é criado assim que o pagamento PIX de uma reserva é confirmado."
            action={
              <Link to="/admin/reservas" className={buttonVariants({ size: "sm" })}>
                Ver reservas
              </Link>
            }
            testId="contracts-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="contracts-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assinado por</TableHead>
                  <TableHead>Aceito em</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((contract) => (
                  <TableRow key={contract.id} data-testid={`contract-row-${contract.id}`}>
                    <TableCell className="font-semibold">{contract.number}</TableCell>
                    <TableCell>
                      <StatusPill
                        status={contract.status}
                        label={CONTRACT_LABELS[contract.status]}
                      />
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {contract.signature_name || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {contract.accepted_at ? dateTimeBr(contract.accepted_at) : "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {contract.accepted_ip || "—"}
                    </TableCell>
                    <TableCell>{contract.version}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/contrato/${contract.id}`}
                        className={buttonVariants({ variant: "outline", size: "xs" })}
                        data-testid={`contract-view-${contract.id}`}
                      >
                        Abrir documento
                      </Link>
                    </TableCell>
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

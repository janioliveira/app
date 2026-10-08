import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { useState } from "react";

import { AdminLayout } from "@/components/AdminLayout";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import type { ReportData } from "@/lib/types";

const REPORT_LABELS: Record<string, string> = {
  reservas: "Reservas",
  faturamento: "Faturamento",
  clientes: "Clientes",
  brinquedos: "Brinquedos",
  pagamentos: "Pagamentos PIX",
  contratos: "Contratos",
  cancelamentos: "Cancelamentos",
  whatsapp: "Mensagens WhatsApp",
};

export default function Reports() {
  const [report, setReport] = useState("reservas");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const query = new URLSearchParams();
  if (dateFrom) query.set("date_from", dateFrom);
  if (dateTo) query.set("date_to", dateTo);
  const qs = query.toString();

  const data = useQuery<ReportData>({
    queryKey: ["report", report, dateFrom, dateTo],
    queryFn: () => apiGet<ReportData>(`/reports/${report}${qs ? `?${qs}` : ""}`),
  });

  const csvUrl = `/api/reports/${report}/export.csv${qs ? `?${qs}` : ""}`;

  return (
    <AdminLayout>
      <header className="no-print">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Análise
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground mt-2">
          Exporte em CSV (compatível com Excel) ou gere o PDF pela impressão do navegador.
        </p>
      </header>

      <Card className="border-border/70 no-print mt-8 rounded-2xl shadow-sm">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="rep-type">Relatório</Label>
            <Select value={report} onValueChange={(value: string) => setReport(value)}>
              <SelectTrigger id="rep-type" data-testid="report-type-select">
                <SelectValue>{(v) => REPORT_LABELS[String(v)] ?? String(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REPORT_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-from">De</Label>
            <Input
              id="rep-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="report-from-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-to">Até</Label>
            <Input
              id="rep-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="report-to-input"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={csvUrl} download data-testid="report-csv-link">
              <Button variant="outline" className="shadow-sm">
                <FileSpreadsheet className="mr-2 size-4" /> CSV / Excel
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={() => window.print()}
              data-testid="report-print-button"
            >
              <Printer className="mr-2 size-4" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <p className="text-muted-foreground mb-3 text-sm" data-testid="report-count">
          {data.data?.count ?? 0} registro(s) encontrados em{" "}
          <strong>{REPORT_LABELS[report]}</strong>
        </p>

        {data.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-muted h-12 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (data.data?.rows ?? []).length === 0 ? (
          <EmptyState
            icon={Download}
            title="Nenhum registro no período"
            description="Ajuste o intervalo de datas ou escolha outro relatório."
            testId="report-empty-state"
          />
        ) : (
          <Card className="border-border/70 overflow-hidden rounded-2xl p-0 shadow-sm">
            <Table data-testid="report-table">
              <TableHeader>
                <TableRow>
                  {(data.data?.columns ?? []).map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.data?.rows ?? []).map((row, index) => (
                  <TableRow key={index} data-testid={`report-row-${index}`}>
                    {(data.data?.columns ?? []).map((column) => (
                      <TableCell key={column.key} className="max-w-[240px] truncate">
                        {row[column.key] || "—"}
                      </TableCell>
                    ))}
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

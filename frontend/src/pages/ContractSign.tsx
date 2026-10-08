import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, Printer, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { PublicLayout } from "@/components/PublicLayout";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { CONTRACT_LABELS, dateTimeBr } from "@/lib/format";
import type { Contract } from "@/lib/types";

export default function ContractSign() {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);

  const contract = useQuery<Contract>({
    queryKey: ["contract", id],
    queryFn: () => apiGet<Contract>(`/contracts/${id}`),
  });

  const accept = useMutation<Contract, Error, void>({
    mutationFn: () =>
      apiPost<Contract>(`/contracts/${id}/accept`, { signature_name: signature, agreed }),
    onSuccess: async () => {
      toast.success("Contrato aceito e assinado digitalmente!");
      await queryClient.invalidateQueries({ queryKey: ["contract", id] });
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
          ? (error.body as { detail: string }).detail
          : "Não foi possível registrar o aceite.";
      toast.error(detail);
    },
  });

  const data = contract.data;
  const accepted = data?.status === "aceito";

  return (
    <PublicLayout>
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="no-print flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Contrato de locação
            </h1>
            <p className="text-muted-foreground mt-2">
              {data ? `Documento ${data.number} · versão ${data.version}` : "Carregando documento…"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {data ? (
              <StatusPill
                status={data.status}
                label={CONTRACT_LABELS[data.status] ?? data.status}
                testId="contract-status-badge"
              />
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              data-testid="contract-print-button"
            >
              <Printer className="mr-2 size-4" /> Salvar em PDF
            </Button>
          </div>
        </header>

        {contract.isError ? (
          <Card className="border-destructive/40 mt-8 rounded-2xl">
            <CardContent className="p-6" data-testid="contract-error">
              <p className="font-semibold">Contrato não encontrado</p>
              <p className="text-muted-foreground mt-1 text-sm">
                O contrato é gerado automaticamente após a confirmação do pagamento PIX.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Document body */}
        <Card className="border-border/70 mt-8 rounded-2xl shadow-sm">
          <CardContent className="p-6 sm:p-8">
            {contract.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="bg-muted h-4 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <pre
                className="font-sans text-sm leading-relaxed whitespace-pre-wrap"
                data-testid="contract-body"
              >
                {data?.body}
              </pre>
            )}
          </CardContent>
        </Card>

        {/* Signature */}
        {accepted ? (
          <Card
            className="mt-6 rounded-2xl border-[var(--pix)]/40 bg-[var(--pix)]/5"
            data-testid="contract-accepted-card"
          >
            <CardContent className="flex items-start gap-3 p-6">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[var(--pix)]" />
              <div className="text-sm">
                <p className="font-bold text-[var(--pix)]">Contrato aceito</p>
                <dl className="text-muted-foreground mt-2 space-y-1">
                  <div>
                    Assinado por: <strong className="text-foreground">{data?.signature_name}</strong>
                  </div>
                  <div>Data e hora: {dateTimeBr(data?.accepted_at ?? null)}</div>
                  <div>Endereço IP registrado: {data?.accepted_ip || "não disponível"}</div>
                  <div>Versão do documento: {data?.version}</div>
                  <div>Reserva: {data?.reservation_id}</div>
                </dl>
              </div>
            </CardContent>
          </Card>
        ) : data ? (
          <Card className="no-print border-border/70 mt-6 rounded-2xl shadow-sm">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-5" />
                <h2 className="text-lg font-bold">Aceite e assinatura digital</h2>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Ao assinar, registramos seu nome, a data, a hora, o endereço IP e a versão deste
                documento — com validade jurídica nos termos da MP 2.200-2/2001.
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="signature">Digite seu nome completo para assinar</Label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Nome completo do responsável"
                  className="font-semibold"
                  data-testid="contract-signature-input"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(checked) => setAgreed(checked === true)}
                  data-testid="contract-agree-checkbox"
                />
                <span className="text-muted-foreground leading-relaxed">
                  Li e concordo integralmente com todas as cláusulas e condições deste contrato de
                  locação, incluindo responsabilidades, danos, cancelamento e segurança.
                </span>
              </label>

              <Button
                className="w-full shadow-sm sm:w-auto"
                disabled={!agreed || signature.trim().length < 3 || accept.isPending}
                onClick={() => accept.mutate()}
                data-testid="contract-accept-button"
              >
                {accept.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Registrando aceite…
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 size-4" /> Aceitar e assinar contrato
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </PublicLayout>
  );
}

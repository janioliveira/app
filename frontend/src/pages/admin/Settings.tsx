import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, MessageCircle, Plus, QrCode, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { StatusPill } from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/format";
import type {
  CompanySettings,
  IntegrationsSettings,
  Role,
  User,
  WhatsAppTemplates,
} from "@/lib/types";

const errorDetail = (error: Error, fallback: string): string =>
  error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
    ? (error.body as { detail: string }).detail
    : fallback;

const TEMPLATE_LABELS: Array<[keyof WhatsAppTemplates, string]> = [
  ["nova_reserva", "Nova reserva"],
  ["pix_gerado", "PIX gerado"],
  ["pagamento_confirmado", "Pagamento confirmado"],
  ["pagamento_expirado", "Pagamento expirado"],
  ["contrato", "Contrato disponível"],
  ["lembrete_evento", "Lembrete do evento"],
  ["cancelamento", "Cancelamento"],
];

const COMPANY_FIELDS: Array<[keyof CompanySettings, string]> = [
  ["trade_name", "Nome fantasia"],
  ["legal_name", "Razão social"],
  ["document", "CNPJ"],
  ["phone", "Telefone"],
  ["whatsapp", "WhatsApp (com DDI)"],
  ["email", "E-mail"],
  ["instagram", "Instagram"],
  ["pix_key", "Chave PIX"],
  ["address", "Endereço"],
  ["city", "Cidade"],
  ["state", "Estado (UF)"],
  ["logo_url", "URL do logo"],
];

export default function Settings() {
  const queryClient = useQueryClient();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [wa, setWa] = useState({ api_url: "", phone_number_id: "", business_phone: "", account_id: "", access_token: "" });
  const [templates, setTemplates] = useState<WhatsAppTemplates | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "funcionario" as Role,
  });

  const companyQuery = useQuery<CompanySettings>({
    queryKey: ["settings", "company"],
    queryFn: () => apiGet<CompanySettings>("/settings/company"),
  });
  const integrations = useQuery<IntegrationsSettings>({
    queryKey: ["settings", "integrations"],
    queryFn: () => apiGet<IntegrationsSettings>("/settings/integrations"),
  });
  const users = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => apiGet<User[]>("/auth/users"),
  });

  useEffect(() => {
    if (companyQuery.data && !company) setCompany(companyQuery.data);
  }, [companyQuery.data, company]);

  useEffect(() => {
    if (integrations.data && !templates) {
      setTemplates(integrations.data.whatsapp.templates);
      setWa({
        api_url: integrations.data.whatsapp.api_url,
        phone_number_id: integrations.data.whatsapp.phone_number_id,
        business_phone: integrations.data.whatsapp.business_phone,
        account_id: integrations.data.whatsapp.account_id,
        access_token: "",
      });
    }
  }, [integrations.data, templates]);

  const saveCompany = useMutation<CompanySettings, Error, void>({
    mutationFn: () => apiPut<CompanySettings>("/settings/company", company),
    onSuccess: async () => {
      toast.success("Dados da empresa atualizados.");
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível salvar.")),
  });

  const saveWhatsApp = useMutation<IntegrationsSettings, Error, void>({
    mutationFn: () =>
      apiPut<IntegrationsSettings>("/settings/integrations/whatsapp", {
        api_url: wa.api_url,
        phone_number_id: wa.phone_number_id,
        business_phone: wa.business_phone,
        account_id: wa.account_id,
        access_token: wa.access_token || null,
        templates,
      }),
    onSuccess: async () => {
      toast.success("Integração WhatsApp atualizada.");
      setWa((prev) => ({ ...prev, access_token: "" }));
      await queryClient.invalidateQueries({ queryKey: ["settings", "integrations"] });
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível salvar.")),
  });

  const createUser = useMutation<User, Error, void>({
    mutationFn: () => apiPost<User>("/auth/users", newUser),
    onSuccess: async () => {
      toast.success("Usuário criado.");
      setUserOpen(false);
      setNewUser({ name: "", email: "", password: "", role: "funcionario" });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível criar o usuário.")),
  });

  const toggleUser = useMutation<User, Error, { id: string; active: boolean }>({
    mutationFn: ({ id, active }) => apiPatch<User>(`/auth/users/${id}`, { active }),
    onSuccess: async () => {
      toast.success("Usuário atualizado.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(errorDetail(error, "Não foi possível atualizar.")),
  });

  const mp = integrations.data?.mercadopago;

  return (
    <AdminLayout>
      <header>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Administração
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-2">
          Dados da empresa, integrações de pagamento e WhatsApp, e controle de usuários.
        </p>
      </header>

      <Tabs defaultValue="empresa" className="mt-8">
        <TabsList variant="line" data-testid="settings-tabs">
          <TabsTrigger value="empresa" data-testid="settings-tab-company">
            <Building2 className="mr-2 size-4" /> Empresa
          </TabsTrigger>
          <TabsTrigger value="mercadopago" data-testid="settings-tab-mercadopago">
            <QrCode className="mr-2 size-4" /> Mercado Pago
          </TabsTrigger>
          <TabsTrigger value="whatsapp" data-testid="settings-tab-whatsapp">
            <MessageCircle className="mr-2 size-4" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="usuarios" data-testid="settings-tab-users">
            <Users className="mr-2 size-4" /> Usuários
          </TabsTrigger>
        </TabsList>

        {/* Company */}
        <TabsContent value="empresa" className="mt-6">
          <Card className="border-border/70 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Dados cadastrais da Lany Infláveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {COMPANY_FIELDS.map(([key, label]) => (
                  <div key={String(key)} className="space-y-1.5">
                    <Label htmlFor={`co-${String(key)}`}>{label}</Label>
                    <Input
                      id={`co-${String(key)}`}
                      value={String(company?.[key] ?? "")}
                      onChange={(e) =>
                        setCompany((prev) =>
                          prev ? { ...prev, [key]: e.target.value } : prev,
                        )
                      }
                      data-testid={`company-${String(key)}-input`}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="co-terms">Cláusulas contratuais padrão</Label>
                <Textarea
                  id="co-terms"
                  rows={8}
                  value={company?.contract_terms ?? ""}
                  onChange={(e) =>
                    setCompany((prev) => (prev ? { ...prev, contract_terms: e.target.value } : prev))
                  }
                  placeholder="Deixe vazio para usar as cláusulas padrão de locação de brinquedos."
                  data-testid="company-terms-input"
                />
              </div>
              <Button
                onClick={() => saveCompany.mutate()}
                disabled={!company || saveCompany.isPending}
                className="shadow-sm"
                data-testid="company-save-button"
              >
                {saveCompany.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Salvar dados da empresa
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mercado Pago */}
        <TabsContent value="mercadopago" className="mt-6">
          <Card className="border-border/70 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Integração Mercado Pago — PIX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <dl className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Access Token</dt>
                  <dd className="flex items-center gap-2">
                    <StatusPill
                      status={mp?.configured ? "confirmada" : "aguardando_pagamento"}
                      label={mp?.configured ? "Configurado" : "Modo simulação"}
                      testId="mp-token-status"
                    />
                    {mp?.token_preview ? (
                      <code className="text-muted-foreground text-xs">{mp.token_preview}</code>
                    ) : null}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Webhook Secret</dt>
                  <dd>
                    <StatusPill
                      status={mp?.webhook_secret_configured ? "confirmada" : "aguardando_pagamento"}
                      label={mp?.webhook_secret_configured ? "Configurado" : "Não configurado"}
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Ambiente</dt>
                  <dd className="font-semibold">{mp?.environment ?? "sandbox"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Expiração do PIX</dt>
                  <dd className="font-semibold">{mp?.pix_expiration_minutes ?? 30} minutos</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">URL do webhook</dt>
                  <dd>
                    <code className="text-xs">/api/webhooks/mercadopago</code>
                  </dd>
                </div>
              </dl>

              <div className="bg-muted/50 space-y-2 rounded-xl p-4 text-sm">
                <p className="font-semibold">Como ativar o PIX real</p>
                <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-xs leading-relaxed">
                  <li>
                    Crie uma aplicação em <strong>Mercado Pago Developers → Suas integrações</strong>.
                  </li>
                  <li>
                    Copie o <strong>Access Token</strong> e defina{" "}
                    <code>MERCADOPAGO_ACCESS_TOKEN</code> nas variáveis de ambiente do servidor.
                  </li>
                  <li>
                    Em <strong>Webhooks</strong>, cadastre a URL acima para o evento{" "}
                    <code>payment</code> e salve a chave secreta em{" "}
                    <code>MERCADOPAGO_WEBHOOK_SECRET</code>.
                  </li>
                  <li>Reinicie o serviço. O token nunca é exposto ao navegador.</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp */}
        <TabsContent value="whatsapp" className="mt-6">
          <Card className="border-border/70 rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Integração WhatsApp Business</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill
                  status={integrations.data?.whatsapp.configured ? "confirmada" : "aguardando_pagamento"}
                  label={
                    integrations.data?.whatsapp.configured
                      ? "Provedor configurado"
                      : "Aguardando Access Token"
                  }
                  testId="whatsapp-integration-status"
                />
                <span className="text-muted-foreground text-xs">
                  Provedor: {integrations.data?.whatsapp.provider ?? "meta_cloud_api"}
                </span>
                {integrations.data?.whatsapp.token_preview ? (
                  <code className="text-muted-foreground text-xs">
                    {integrations.data.whatsapp.token_preview}
                  </code>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="wa-api">URL da API</Label>
                  <Input
                    id="wa-api"
                    value={wa.api_url}
                    onChange={(e) => setWa({ ...wa, api_url: e.target.value })}
                    data-testid="whatsapp-apiurl-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wa-phoneid">Phone Number ID</Label>
                  <Input
                    id="wa-phoneid"
                    value={wa.phone_number_id}
                    onChange={(e) => setWa({ ...wa, phone_number_id: e.target.value })}
                    data-testid="whatsapp-phoneid-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wa-business">Número empresarial</Label>
                  <Input
                    id="wa-business"
                    value={wa.business_phone}
                    onChange={(e) => setWa({ ...wa, business_phone: e.target.value })}
                    data-testid="whatsapp-business-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wa-account">Identificador da conta (WABA)</Label>
                  <Input
                    id="wa-account"
                    value={wa.account_id}
                    onChange={(e) => setWa({ ...wa, account_id: e.target.value })}
                    data-testid="whatsapp-account-input"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="wa-token">Access Token (armazenado apenas no servidor)</Label>
                  <Input
                    id="wa-token"
                    type="password"
                    value={wa.access_token}
                    onChange={(e) => setWa({ ...wa, access_token: e.target.value })}
                    placeholder="Deixe vazio para manter o token atual"
                    data-testid="whatsapp-token-input"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Templates das notificações automáticas
                </p>
                {TEMPLATE_LABELS.map(([key, label]) => (
                  <div key={String(key)} className="space-y-1.5">
                    <Label htmlFor={`tpl-${String(key)}`}>{label}</Label>
                    <Textarea
                      id={`tpl-${String(key)}`}
                      rows={2}
                      value={templates?.[key] ?? ""}
                      onChange={(e) =>
                        setTemplates((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))
                      }
                      data-testid={`whatsapp-template-${String(key)}-input`}
                    />
                  </div>
                ))}
                <p className="text-muted-foreground text-xs">
                  Variáveis disponíveis: <code>{"{NOME}"}</code>, <code>{"{DATA}"}</code>,{" "}
                  <code>{"{HORARIO}"}</code>
                </p>
              </div>

              <Button
                onClick={() => saveWhatsApp.mutate()}
                disabled={saveWhatsApp.isPending}
                className="shadow-sm"
                data-testid="whatsapp-save-button"
              >
                {saveWhatsApp.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Salvar integração WhatsApp
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users */}
        <TabsContent value="usuarios" className="mt-6">
          <Card className="border-border/70 rounded-2xl p-0 shadow-sm">
            <CardHeader className="flex-row items-center justify-between p-6">
              <CardTitle className="text-base">Usuários e permissões</CardTitle>
              <Button size="sm" onClick={() => setUserOpen(true)} data-testid="new-user-button">
                <Plus className="mr-2 size-4" /> Novo usuário
              </Button>
            </CardHeader>
            <Table data-testid="users-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(users.data ?? []).map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-semibold">{user.name}</TableCell>
                    <TableCell className="max-w-[220px] truncate">{user.email}</TableCell>
                    <TableCell>{ROLE_LABELS[user.role]}</TableCell>
                    <TableCell>
                      <StatusPill
                        status={user.active ? "confirmada" : "cancelada"}
                        label={user.active ? "Ativo" : "Desativado"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => toggleUser.mutate({ id: user.id, active: !user.active })}
                        data-testid={`user-toggle-${user.id}`}
                      >
                        {user.active ? "Desativar" : "Ativar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nu-name">Nome</Label>
              <Input
                id="nu-name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                data-testid="user-name-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-email">E-mail</Label>
              <Input
                id="nu-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                data-testid="user-email-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-password">Senha provisória</Label>
              <Input
                id="nu-password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                data-testid="user-password-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nu-role">Perfil de acesso</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: string) => setNewUser({ ...newUser, role: value as Role })}
              >
                <SelectTrigger id="nu-role" data-testid="user-role-select">
                  <SelectValue>{(v) => ROLE_LABELS[String(v)] ?? ""}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="funcionario">Funcionário</SelectItem>
                  <SelectItem value="cliente">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createUser.mutate()}
              disabled={
                newUser.name.length < 2 ||
                !newUser.email ||
                newUser.password.length < 6 ||
                createUser.isPending
              }
              data-testid="user-save-button"
            >
              {createUser.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Criar usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPost } from "@/lib/api";
import { beginSession, homeForRole } from "@/lib/session";
import type { OkResponse, User } from "@/lib/types";

const HIGHLIGHTS = [
  { icon: QrCode, text: "Pagamento PIX com confirmação automática" },
  { icon: ShieldCheck, text: "Contratos digitais com aceite registrado" },
  { icon: CheckCircle2, text: "Agenda protegida contra reservas em conflito" },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recovering, setRecovering] = useState(false);

  const login = useMutation<User, Error, void>({
    mutationFn: () => apiPost<User>("/auth/login", { email, password }),
    onSuccess: async (user) => {
      await beginSession();
      toast.success(`Bem-vindo(a), ${user.name.split(" ")[0]}!`);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : homeForRole(user.role), { replace: true });
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
          ? (error.body as { detail: string }).detail
          : "Não foi possível entrar. Verifique os dados e tente novamente.";
      toast.error(detail);
    },
  });

  const recover = useMutation<OkResponse, Error, void>({
    mutationFn: () => apiPost<OkResponse>("/auth/password-reset", { email }),
    onSuccess: (data) => {
      toast.success(data.message);
      setRecovering(false);
    },
    onError: () => toast.error("Não foi possível solicitar a recuperação agora."),
  });

  return (
    <div className="bg-background grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* Brand panel */}
      <aside className="bg-sidebar relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="absolute inset-0 opacity-25">
          <img
            src="https://images.unsplash.com/photo-1530103862676-de8c9debad1d?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
            alt=""
            className="size-full object-cover"
          />
        </div>
        <div className="relative">
          <Link to="/" className="flex items-center gap-3" data-testid="login-brand-link">
            <span className="from-primary grid size-11 place-items-center rounded-xl bg-gradient-to-br to-amber-400 text-xl font-black text-white shadow-lg">
              L
            </span>
            <span className="text-sidebar-foreground text-lg font-extrabold">Lany Infláveis</span>
          </Link>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-sidebar-foreground text-3xl leading-tight font-extrabold">
            O sistema que organiza cada festa, do orçamento ao contrato assinado.
          </h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text} className="text-sidebar-foreground/80 flex items-center gap-3">
                <span className="bg-primary/20 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
                  <item.icon className="size-4" />
                </span>
                <span className="text-sm">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sidebar-foreground/50 relative text-xs">@lanyinflaveis</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <span className="from-primary grid size-9 place-items-center rounded-lg bg-gradient-to-br to-amber-400 font-black text-white">
                L
              </span>
              <span className="font-extrabold">Lany Infláveis</span>
            </Link>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight">
            {recovering ? "Recuperar senha" : "Entrar no sistema"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {recovering
              ? "Informe o e-mail cadastrado para receber as instruções."
              : "Acesse o painel administrativo ou o portal do cliente."}
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (recovering) recover.mutate();
              else login.mutate();
            }}
            data-testid="login-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com.br"
                data-testid="login-email-input"
              />
            </div>

            {!recovering ? (
              <div className="space-y-1.5">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  data-testid="login-password-input"
                />
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full shadow-sm"
              disabled={login.isPending || recover.isPending}
              data-testid="login-submit-button"
            >
              {login.isPending || recover.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Processando…
                </>
              ) : recovering ? (
                "Enviar instruções"
              ) : (
                "Entrar"
              )}
            </Button>

            <div className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-150"
                onClick={() => setRecovering((value) => !value)}
                data-testid="login-toggle-recovery-button"
              >
                {recovering ? "Voltar ao login" : "Esqueci minha senha"}
              </button>
              <Link
                to="/cadastro"
                className="text-primary font-semibold hover:underline"
                data-testid="login-register-link"
              >
                Criar conta
              </Link>
            </div>
          </form>

          <Card className="border-border/70 bg-muted/40 mt-8 rounded-2xl">
            <CardContent className="space-y-1 p-4 text-xs">
              <p className="font-semibold">Acessos de demonstração</p>
              <p className="text-muted-foreground" data-testid="demo-credentials-admin">
                Administrador: admin@lanyinflaveis.com.br / Lany@2026
              </p>
              <p className="text-muted-foreground" data-testid="demo-credentials-staff">
                Funcionário: equipe@lanyinflaveis.com.br / Lany@2026
              </p>
              <p className="text-muted-foreground" data-testid="demo-credentials-customer">
                Cliente: cliente@exemplo.com.br / Lany@2026
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

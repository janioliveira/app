import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPost } from "@/lib/api";
import { maskDocument, maskPhone } from "@/lib/format";
import { beginSession } from "@/lib/session";
import type { User } from "@/lib/types";

const BENEFITS = [
  "Acompanhe suas reservas e pagamentos PIX em um só lugar",
  "Receba o contrato digital para leitura e aceite online",
  "Histórico completo das festas que você já realizou",
];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    document: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const register = useMutation<User, Error, void>({
    mutationFn: () => apiPost<User>("/auth/register", form),
    onSuccess: async (user) => {
      await beginSession();
      toast.success(`Conta criada! Bem-vindo(a), ${user.name.split(" ")[0]}.`);
      navigate("/cliente", { replace: true });
    },
    onError: (error) => {
      const detail =
        error instanceof ApiError && typeof (error.body as { detail?: string })?.detail === "string"
          ? (error.body as { detail: string }).detail
          : "Não foi possível criar a conta agora.";
      toast.error(detail);
    },
  });

  return (
    <div className="bg-background grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <aside className="bg-sidebar relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
        <div className="absolute inset-0 opacity-25">
          <img
            src="https://images.unsplash.com/photo-1531956531700-dc0ee0f1f9a5?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200"
            alt=""
            className="size-full object-cover"
          />
        </div>
        <Link to="/" className="relative flex items-center gap-3" data-testid="register-brand-link">
          <span className="from-primary grid size-11 place-items-center rounded-xl bg-gradient-to-br to-amber-400 text-xl font-black text-white shadow-lg">
            L
          </span>
          <span className="text-sidebar-foreground text-lg font-extrabold">Lany Infláveis</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-sidebar-foreground text-3xl leading-tight font-extrabold">
            Crie sua conta e reserve a próxima festa em minutos.
          </h2>
          <ul className="mt-8 space-y-4">
            {BENEFITS.map((text) => (
              <li key={text} className="text-sidebar-foreground/80 flex items-start gap-3 text-sm">
                <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sidebar-foreground/50 relative text-xs">@lanyinflaveis</p>
      </aside>

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

          <h1 className="text-3xl font-extrabold tracking-tight">Criar conta de cliente</h1>
          <p className="text-muted-foreground mt-2">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Entrar
            </Link>
          </p>

          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              register.mutate();
            }}
            data-testid="register-form"
          >
            <div className="space-y-1.5">
              <Label htmlFor="reg-name">Nome completo</Label>
              <Input
                id="reg-name"
                required
                minLength={2}
                value={form.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="Maria Silva"
                data-testid="register-name-input"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-email">E-mail</Label>
              <Input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder="seu@email.com.br"
                data-testid="register-email-input"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-phone">WhatsApp</Label>
                <Input
                  id="reg-phone"
                  required
                  value={form.phone}
                  onChange={(e) => set("phone")(maskPhone(e.target.value))}
                  placeholder="(11) 98234-0011"
                  data-testid="register-phone-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-document">CPF/CNPJ</Label>
                <Input
                  id="reg-document"
                  value={form.document}
                  onChange={(e) => set("document")(maskDocument(e.target.value))}
                  placeholder="000.000.000-00"
                  data-testid="register-document-input"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reg-password">Senha</Label>
              <Input
                id="reg-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
                placeholder="mínimo de 6 caracteres"
                data-testid="register-password-input"
              />
            </div>

            <Button
              type="submit"
              className="w-full shadow-sm"
              disabled={register.isPending}
              data-testid="register-submit-button"
            >
              {register.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Criando conta…
                </>
              ) : (
                "Criar minha conta"
              )}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

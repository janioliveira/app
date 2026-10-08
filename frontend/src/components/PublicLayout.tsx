import { Instagram, LogOut, Menu, Phone } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCompany, useSession } from "@/hooks/useSession";
import { endSession, homeForRole } from "@/lib/session";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Início" },
  { to: "/brinquedos", label: "Brinquedos" },
  { to: "/reservar", label: "Reservar" },
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const { data: company } = useCompany();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await endSession();
    navigate("/", { replace: true });
  };

  // `scope` keeps the desktop bar and the mobile drawer on distinct testids —
  // the same nav renders twice, and duplicate testids break strict selectors.
  const navItems = (scope: "desktop" | "mobile", onNavigate?: () => void) =>
    LINKS.map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.to === "/"}
        onClick={onNavigate}
        data-testid={
          scope === "mobile"
            ? `public-nav-mobile-${link.label.toLowerCase()}`
            : `public-nav-${link.label.toLowerCase()}`
        }
        className={({ isActive }) =>
          cn(
            "rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150",
            isActive
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )
        }
      >
        {link.label}
      </NavLink>
    ));

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="border-border/80 bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 border-b backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3" data-testid="public-brand-link">
            <span className="from-primary grid size-10 place-items-center rounded-xl bg-gradient-to-br to-amber-400 text-lg font-black text-white shadow-md">
              L
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight">
                {company?.trade_name || "Lany Infláveis"}
              </span>
              <span className="text-muted-foreground block text-[11px] font-medium">
                Brinquedos para festas infantis
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">{navItems("desktop")}</nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <Link
                  to={homeForRole(user.role)}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}
                  data-testid="public-panel-link"
                >
                  Meu painel
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={signOut}
                  aria-label="Sair"
                  data-testid="public-logout-button"
                >
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <Link
                to="/login"
                className={cn(buttonVariants({ size: "sm" }), "shadow-sm")}
                data-testid="public-login-link"
              >
                Entrar
              </Link>
            )}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="md:hidden"
                    data-testid="public-menu-button"
                  >
                    <Menu className="size-4" />
                  </Button>
                }
              />
              <SheetContent side="right" className="w-[260px] p-5">
                <div className="mt-6 flex flex-col gap-2">
                  {navItems("mobile", () => setOpen(false))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-border/70 bg-muted/40 border-t">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          <div>
            <p className="text-base font-bold">{company?.trade_name || "Lany Infláveis"}</p>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              Locação de brinquedos infláveis, camas elásticas e atrações para festas infantis com
              montagem, higienização e segurança inclusas.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Contato
            </p>
            {company?.whatsapp ? (
              <a
                href={`https://wa.me/${company.whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-primary flex items-center gap-2 transition-colors duration-150"
                data-testid="footer-whatsapp-link"
              >
                <Phone className="size-4" /> {company.whatsapp}
              </a>
            ) : null}
            <a
              href={`https://instagram.com/${(company?.instagram || "@lanyinflaveis").replace("@", "")}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary flex items-center gap-2 transition-colors duration-150"
              data-testid="footer-instagram-link"
            >
              <Instagram className="size-4" /> {company?.instagram || "@lanyinflaveis"}
            </a>
          </div>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              Pagamento
            </p>
            <p className="text-muted-foreground">
              Exclusivamente via <strong className="text-[var(--pix)]">PIX</strong>, processado pelo
              Mercado Pago com confirmação automática.
            </p>
          </div>
        </div>
        <div className="border-border/70 text-muted-foreground border-t px-4 py-4 text-center text-xs">
          © {new Date().getFullYear()} {company?.legal_name || "Lany Infláveis"} — todos os direitos
          reservados.
        </div>
      </footer>
    </div>
  );
}

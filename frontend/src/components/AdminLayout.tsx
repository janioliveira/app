import {
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  PieChart,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications, useSession } from "@/hooks/useSession";
import { ROLE_LABELS } from "@/lib/format";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/admin/agenda", label: "Agenda", icon: CalendarDays, adminOnly: false },
  { to: "/admin/reservas", label: "Reservas", icon: ClipboardList, adminOnly: false },
  { to: "/admin/orcamentos", label: "Orçamentos", icon: FileText, adminOnly: false },
  { to: "/admin/brinquedos", label: "Brinquedos", icon: Package, adminOnly: false },
  { to: "/admin/clientes", label: "Clientes", icon: Users, adminOnly: false },
  { to: "/admin/pagamentos", label: "Pagamentos PIX", icon: Wallet, adminOnly: false },
  { to: "/admin/contratos", label: "Contratos", icon: FileText, adminOnly: false },
  { to: "/admin/financeiro", label: "Financeiro", icon: PieChart, adminOnly: true },
  { to: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, adminOnly: false },
  { to: "/admin/relatorios", label: "Relatórios", icon: ClipboardList, adminOnly: true },
  { to: "/admin/auditoria", label: "Auditoria", icon: ShieldCheck, adminOnly: true },
  { to: "/admin/configuracoes", label: "Configurações", icon: SettingsIcon, adminOnly: true },
];

// `scope` keeps the sidebar and the mobile drawer on distinct testids — the same
// nav renders twice, and duplicate testids break strict selectors.
function NavItems({
  onNavigate,
  scope = "desktop",
}: {
  onNavigate?: () => void;
  scope?: "desktop" | "mobile";
}) {
  const { isAdmin } = useSession();
  return (
    <nav
      className="flex flex-col gap-1"
      data-testid={scope === "mobile" ? "admin-nav-mobile" : "admin-nav"}
    >
      {NAV.filter((item) => !item.adminOnly || isAdmin).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/admin"}
          onClick={onNavigate}
          data-testid={`${scope === "mobile" ? "nav-mobile" : "nav"}-${item.to.split("/").pop() || "dashboard"}`}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
              "transition-[background-color,color,transform] duration-150",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <Link to="/" className="flex items-center gap-3 px-2 py-1" data-testid="sidebar-brand-link">
      <span className="from-primary grid size-10 place-items-center rounded-xl bg-gradient-to-br to-amber-400 text-lg font-black text-white shadow-lg">
        L
      </span>
      <span className="min-w-0">
        <span className="text-sidebar-foreground block truncate text-sm font-bold">
          Lany Infláveis
        </span>
        <span className="text-sidebar-foreground/60 block truncate text-xs">
          Gestão de locação
        </span>
      </span>
    </Link>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const { data: notifications } = useNotifications();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  const signOut = async () => {
    await endSession();
    navigate("/login", { replace: true });
  };

  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="bg-sidebar border-sidebar-border hidden flex-col gap-6 border-r p-4 lg:flex lg:h-screen lg:sticky lg:top-0">
        <SidebarBrand />
        <div className="flex-1 overflow-y-auto pr-1">
          <NavItems />
        </div>
        <div className="border-sidebar-border space-y-3 border-t pt-4">
          <div className="px-2">
            <p className="text-sidebar-foreground truncate text-sm font-semibold">{user?.name}</p>
            <p className="text-sidebar-foreground/60 truncate text-xs">
              {ROLE_LABELS[user?.role ?? ""] ?? ""}
            </p>
          </div>
          <Button
            variant="ghost"
            className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full justify-start"
            onClick={signOut}
            data-testid="sidebar-logout-button"
          >
            <LogOut className="mr-2 size-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="bg-background/80 border-border/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger
                render={
                  <Button variant="outline" size="icon-sm" data-testid="mobile-menu-button" className="lg:hidden">
                    <Menu className="size-4" />
                  </Button>
                }
              />
              <SheetContent side="left" className="bg-sidebar w-[280px] p-4">
                <div className="space-y-6">
                  <SidebarBrand />
                  <NavItems scope="mobile" onNavigate={() => setOpen(false)} />
                  <Button
                    variant="ghost"
                    className="text-sidebar-foreground/80 w-full justify-start"
                    onClick={signOut}
                    data-testid="mobile-logout-button"
                  >
                    <LogOut className="mr-2 size-4" /> Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-sm font-semibold lg:hidden">Lany Infláveis</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/notificacoes"
              className="relative"
              data-testid="header-notifications-link"
            >
              <Button variant="ghost" size="icon-sm" aria-label="Notificações">
                <Bell className="size-4" />
              </Button>
              {unread > 0 ? (
                <Badge
                  className="bg-primary text-primary-foreground absolute -top-1 -right-1 min-w-5 justify-center px-1 py-0 text-[10px]"
                  data-testid="notifications-unread-badge"
                >
                  {unread}
                </Badge>
              ) : null}
            </Link>
            <ThemeToggle />
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground hidden text-xs font-semibold transition-colors duration-150 sm:block"
              data-testid="header-site-link"
            >
              Ver site
            </Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

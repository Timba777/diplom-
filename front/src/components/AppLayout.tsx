import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Tag,
  Users,
  Gauge,
  BarChart3,
  LogOut,
  Menu,
  X,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Дашборд", icon: LayoutDashboard },
  { to: "/operations", label: "Операции", icon: ArrowLeftRight },
  { to: "/categories", label: "Категории", icon: Tag },
  { to: "/families", label: "Семьи", icon: Users },
  { to: "/limits", label: "Лимиты", icon: Gauge },
  { to: "/analytics", label: "Аналитика", icon: BarChart3 },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-card border-r flex flex-col transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-14 flex items-center gap-2 px-5 border-b">
          <Wallet className="h-5 w-5 text-primary" />
          <span className="font-semibold text-base tracking-tight">
            FinTracker
          </span>
          <button
            className="ml-auto lg:hidden p-1"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )
              }
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t space-y-3">
          {user && (
            <div className="text-xs text-muted-foreground truncate px-1">
              {user.name || user.email}
            </div>
          )}
          <button
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Выход
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-14 bg-card/80 backdrop-blur border-b flex items-center px-4 lg:px-6">
          <button
            className="lg:hidden p-2 -ml-2 mr-2"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold">
            {links.find(
              (l) =>
                l.to === location.pathname ||
                (l.to !== "/" && location.pathname.startsWith(l.to))
            )?.label || "FinTracker"}
          </h1>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

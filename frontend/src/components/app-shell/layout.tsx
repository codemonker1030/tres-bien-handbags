import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, ShoppingCart, Receipt, CheckSquare, Settings, ShoppingBag, Sun, Moon, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/app-shell/theme-provider";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/debts", label: "Debts", icon: Landmark },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

const APP_NAME = "Tres Bien Handbags";
const APP_TAGLINE = "Fashion boutique manager";

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0",
        className
      )}
    >
      {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* ── Mobile top header ─────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-2 px-4 h-14 bg-card border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <ShoppingBag className="w-4 h-4 text-primary" />
        </div>
        <div className="leading-tight flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-none truncate">{APP_NAME}</p>
          <p className="text-[10px] text-muted-foreground">{APP_TAGLINE}</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)] md:min-h-screen">

        {/* ── Desktop sidebar ────────────────────────── */}
        <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col shrink-0 sticky top-0 h-screen">
          <div className="p-6 pb-4">
            <h1 className="text-lg font-bold tracking-tight text-primary flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>
              {APP_NAME}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 ml-9">{APP_TAGLINE}</p>
          </div>

          <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border flex items-center gap-2">
            <button className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground flex-1 transition-colors">
              <Settings className="w-4 h-4 shrink-0" />
              Settings
            </button>
            <ThemeToggle />
          </div>
        </aside>

        {/* ── Page content ──────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile bottom nav ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border flex items-stretch h-16">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

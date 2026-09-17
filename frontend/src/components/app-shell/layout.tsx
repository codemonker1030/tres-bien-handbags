import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  CheckSquare,
  Settings,
  ShoppingBag,
  Sun,
  Moon,
  Landmark,
  MoreHorizontal,
  X,
  PackagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/app-shell/theme-provider";

interface LayoutProps {
  children: React.ReactNode;
}

const desktopNavItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/purchases", label: "Purchases", icon: PackagePlus },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/debts", label: "Debts", icon: Landmark },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

const mobileNavItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: ShoppingCart },
  { href: "/debts", label: "Debts", icon: Landmark },
];

const moreItems = [
  { href: "/purchases", label: "Purchases", icon: PackagePlus },
  { href: "/expenses", label: "Expenses", icon: Receipt },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

const APP_NAME = "Tres Bien Handbags";
const APP_TAGLINE = "Fashion boutique manager";

function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0",
        className,
      )}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreItems.some(
    (item) => location === item.href,
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Mobile top header ─────────────────────────── */}
      <header className="md:hidden sticky top-0 z-40 flex items-center gap-2 px-3 h-12 bg-card/95 backdrop-blur border-b border-border">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <ShoppingBag className="w-3.5 h-3.5 text-primary" />
        </div>

        <p className="text-[13px] font-semibold text-foreground leading-none truncate flex-1">
          {APP_NAME}
        </p>

        <ThemeToggle />
      </header>

      <div className="flex min-h-[calc(100vh-3rem)] md:min-h-screen">
        {/* ── Desktop sidebar ────────────────────────── */}
        <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col shrink-0 sticky top-0 h-screen">
          <div className="p-6 pb-4">
            <h1 className="text-lg font-bold tracking-tight text-primary flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4 text-primary" />
              </div>

              {APP_NAME}
            </h1>

            <p className="text-xs text-muted-foreground mt-1 ml-9">
              {APP_TAGLINE}
            </p>
          </div>

          <nav className="flex-1 px-3 pb-4 space-y-0.5 overflow-y-auto">
            {desktopNavItems.map((item) => {
              const isActive = location === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />

                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground flex-1 transition-colors"
            >
              <Settings className="w-4 h-4 shrink-0" />
              Settings
            </button>

            <ThemeToggle />
          </div>
        </aside>

        {/* ── Page content ──────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <div className="px-3 py-3 md:p-8 pb-20 md:pb-8 max-w-6xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile More menu ───────────────────────── */}
      {moreOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="md:hidden fixed inset-0 z-40 bg-black/20"
            onClick={() => setMoreOpen(false)}
          />

          <div className="md:hidden fixed bottom-[4.5rem] right-3 z-50 w-44 rounded-2xl border border-border bg-card shadow-xl p-1.5">
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-xs font-semibold text-muted-foreground">
                More
              </span>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {moreItems.map((item) => {
              const isActive = location === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted/60",
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground",
                    )}
                  />

                  {item.label}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* ── Mobile bottom nav ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-card/95 backdrop-blur border-t border-border">
        <div className="h-16 pb-[env(safe-area-inset-bottom)] flex items-stretch">
          {mobileNavItems.map((item) => {
            const isActive = location === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground",
                )}
                data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              >
                <item.icon
                  className={cn(
                    "w-[18px] h-[18px]",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground",
                  )}
                />

                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 text-[9px] font-medium transition-colors",
              moreOpen || moreActive
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <MoreHorizontal
              className={cn(
                "w-[18px] h-[18px]",
                moreOpen || moreActive
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            />

            More
          </button>
        </div>
      </nav>
    </div>
  );
}
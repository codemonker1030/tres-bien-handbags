import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp,
  Package,
  CreditCard,
  CheckSquare,
  Receipt,
  BarChart3,
  AlertTriangle,
  ChevronRight,
  CircleCheck,
  WalletCards,
} from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetSalesByMonth,
  ActivityItem,
} from "@workspace/api-client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

type SeriesKey = "revenue" | "expenses";

const RANGES: { label: string; months: 1 | 3 | 6 | 12 }[] = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
];

const SERIES = {
  revenue: {
    label: "Revenue",
    color: "hsl(153 72% 43%)",
  },
  expenses: {
    label: "Expenses",
    color: "hsl(0 72% 51%)",
  },
} as const;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1.5">
        {label}
      </p>

      <div className="space-y-1">
        {payload.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: entry.color }}
              />
              <span className="text-muted-foreground">
                {entry.name}
              </span>
            </div>

            <span
              className="font-medium"
              style={{ color: entry.color }}
            >
              {formatCurrency(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function greetingForNow() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function PulseItem({
  label,
  value,
  helper,
  icon,
  href,
  warning,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  icon: React.ReactNode;
  href?: string;
  warning?: boolean;
}) {
  const content = (
    <div className="flex items-start gap-2.5 py-3">
      <div
        className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
          warning
            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
          {label}
        </p>

        <div className="mt-0.5 text-sm md:text-base font-semibold text-foreground truncate">
          {value}
        </div>

        <p
          className={cn(
            "text-[10px] md:text-xs mt-0.5 truncate",
            warning
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
          )}
        >
          {helper}
        </p>
      </div>

      {href && (
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 mt-2 shrink-0" />
      )}
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block rounded-xl transition-colors hover:bg-muted/40"
    >
      {content}
    </Link>
  );
}

export function Dashboard() {
  const [range, setRange] = useState<1 | 3 | 6 | 12>(6);
  const [visible, setVisible] = useState<
    Record<SeriesKey, boolean>
  >({
    revenue: true,
    expenses: true,
  });

  const {
    data: summary,
    isLoading: isLoadingSummary,
  } = useGetDashboardSummary();

  const {
    data: activities,
    isLoading: isLoadingActivity,
  } = useGetRecentActivity();

  const {
    data: salesData,
    isLoading: isLoadingSales,
  } = useGetSalesByMonth({ months: range });

  const toggleSeries = (key: SeriesKey) =>
    setVisible((v) => ({
      ...v,
      [key]: !v[key],
    }));

  const hasAnyData = salesData?.some(
    (d) => d.revenue > 0 || d.expenses > 0,
  );

  const attentionItems = useMemo(() => {
    const items: Array<{
      title: string;
      helper: string;
      href: string;
      tone: "amber" | "red" | "blue";
      icon: React.ReactNode;
    }> = [];

    if ((summary?.outstandingDebts ?? 0) > 0) {
      items.push({
        title: `${formatCurrency(
          summary?.totalOwedToYou ?? 0,
        )} to collect`,
        helper: `${summary?.outstandingDebts ?? 0} customer${
          (summary?.outstandingDebts ?? 0) === 1
            ? ""
            : "s"
        } still owe you`,
        href: "/debts",
        tone: "amber",
        icon: <CreditCard className="w-4 h-4" />,
      });
    }

    if ((summary?.lowStockCount ?? 0) > 0) {
      items.push({
        title: `${summary?.lowStockCount ?? 0} product${
          (summary?.lowStockCount ?? 0) === 1
            ? ""
            : "s"
        } running low`,
        helper: "Check stock before you sell out",
        href: "/inventory",
        tone: "red",
        icon: <AlertTriangle className="w-4 h-4" />,
      });
    }

    if ((summary?.openTasksCount ?? 0) > 0) {
      items.push({
        title: `${summary?.openTasksCount ?? 0} task${
          (summary?.openTasksCount ?? 0) === 1
            ? ""
            : "s"
        } waiting`,
        helper: "Review what needs your attention",
        href: "/tasks",
        tone: "blue",
        icon: <CheckSquare className="w-4 h-4" />,
      });
    }

    return items;
  }, [summary]);

  return (
    <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
      {/* ── Hero ────────────────────────────────────── */}
      <section className="pt-0.5">
        <p className="text-xs md:text-sm text-muted-foreground">
          {greetingForNow()}
        </p>

        <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-foreground mt-0.5">
          Here’s how business looks today
        </h2>

        <div className="mt-4 md:mt-5">
          {isLoadingSummary ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ) : (
            <>
              <p
                className={cn(
                  "text-3xl md:text-4xl font-semibold tracking-tight leading-none",
                  (summary?.netProfit ?? 0) >= 0
                    ? "text-primary"
                    : "text-destructive",
                )}
              >
                {formatCurrency(summary?.netProfit ?? 0)}
              </p>

              <p className="text-xs md:text-sm text-muted-foreground mt-2">
                Net profit · Revenue{" "}
                <span className="text-foreground font-medium">
                  {formatCurrency(
                    summary?.totalRevenue ?? 0,
                  )}
                </span>
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Business pulse ─────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card px-3 md:px-4">
        {isLoadingSummary ? (
          <div className="grid grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "py-3",
                  i % 2 === 0 && "pr-3 border-r border-border",
                  i % 2 === 1 && "pl-3",
                  i < 2 && "border-b border-border",
                )}
              >
                <Skeleton className="h-14 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2">
            <div className="pr-3 border-r border-b border-border">
              <PulseItem
                label="Sales"
                value={formatCurrency(
                  summary?.totalRevenue ?? 0,
                )}
                helper="Revenue recorded"
                icon={<TrendingUp className="w-3.5 h-3.5" />}
              />
            </div>

            <div className="pl-3 border-b border-border">
              <PulseItem
                label="Stock"
                value={`${summary?.totalProducts ?? 0} items`}
                helper={
                  (summary?.lowStockCount ?? 0) > 0
                    ? `${summary?.lowStockCount} low stock`
                    : "Stock looks good"
                }
                href="/inventory"
                warning={(summary?.lowStockCount ?? 0) > 0}
                icon={<Package className="w-3.5 h-3.5" />}
              />
            </div>

            <div className="pr-3 border-r border-border">
              <PulseItem
                label="Owed to you"
                value={formatCurrency(
                  summary?.totalOwedToYou ?? 0,
                )}
                helper={
                  (summary?.outstandingDebts ?? 0) > 0
                    ? `${summary?.outstandingDebts} customer${
                        (summary?.outstandingDebts ?? 0) === 1
                          ? ""
                          : "s"
                      } outstanding`
                    : "Nothing outstanding"
                }
                href="/debts"
                warning={
                  (summary?.outstandingDebts ?? 0) > 0
                }
                icon={<CreditCard className="w-3.5 h-3.5" />}
              />
            </div>

            <div className="pl-3">
              <PulseItem
                label="Tasks"
                value={`${summary?.openTasksCount ?? 0} open`}
                helper={
                  (summary?.openTasksCount ?? 0) > 0
                    ? "Needs attention"
                    : "All caught up"
                }
                href="/tasks"
                warning={
                  (summary?.openTasksCount ?? 0) > 0
                }
                icon={<CheckSquare className="w-3.5 h-3.5" />}
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Cash flow ─────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-card p-3 md:p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm md:text-base font-semibold text-foreground">
              Cash flow
            </h3>

            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
              Revenue and expenses over time
            </p>
          </div>

          <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-1 shrink-0">
            {RANGES.map((r) => (
              <button
                key={r.months}
                onClick={() => setRange(r.months)}
                className={cn(
                  "px-2 py-1 rounded-md text-[10px] md:text-xs font-medium transition-all",
                  range === r.months
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-3 text-[10px] md:text-xs text-muted-foreground">
          {(Object.entries(SERIES) as [
            SeriesKey,
            (typeof SERIES)[SeriesKey],
          ][]).map(([key, series]) => (
            <button
              key={key}
              onClick={() => toggleSeries(key)}
              className={cn(
                "inline-flex items-center gap-1.5 transition-opacity",
                !visible[key] && "opacity-40",
              )}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: series.color }}
              />
              {series.label}
            </button>
          ))}
        </div>

        <div className="mt-2">
          {isLoadingSales ? (
            <Skeleton className="w-full h-[165px] md:h-[220px]" />
          ) : !hasAnyData ? (
            <div className="h-[165px] md:h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <BarChart3 className="w-7 h-7 opacity-20" />
              <p className="text-xs text-center">
                No cash-flow data yet.
              </p>
            </div>
          ) : (
            <div className="h-[165px] md:h-[220px] w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <ComposedChart
                  data={salesData}
                  margin={{
                    top: 8,
                    right: 4,
                    left: -8,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="revenueGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={SERIES.revenue.color}
                        stopOpacity={0.18}
                      />
                      <stop
                        offset="95%"
                        stopColor={SERIES.revenue.color}
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />

                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 9,
                    }}
                    dy={7}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "hsl(var(--muted-foreground))",
                      fontSize: 9,
                    }}
                    tickFormatter={(val) =>
                      val >= 1000
                        ? `${(val / 1000).toFixed(0)}k`
                        : `${val}`
                    }
                    width={34}
                  />

                  <Tooltip
                    content={<ChartTooltip />}
                  />

                  {visible.revenue && (
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke={SERIES.revenue.color}
                      strokeWidth={2.25}
                      fill="url(#revenueGradient)"
                      dot={false}
                      activeDot={{
                        r: 3.5,
                        strokeWidth: 0,
                      }}
                    />
                  )}

                  {visible.expenses && (
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke={SERIES.expenses.color}
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{
                        r: 3.5,
                        strokeWidth: 0,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ── Needs attention ───────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm md:text-base font-semibold text-foreground">
            Needs your attention
          </h3>
        </div>

        {isLoadingSummary ? (
          <div className="space-y-2">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : attentionItems.length > 0 ? (
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {attentionItems.map((item) => {
              const toneClass =
                item.tone === "amber"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : item.tone === "red"
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      toneClass,
                    )}
                  >
                    {item.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs md:text-sm font-medium text-foreground">
                      {item.title}
                    </p>

                    <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                      {item.helper}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-3 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <CircleCheck className="w-4 h-4" />
            </div>

            <div>
              <p className="text-xs md:text-sm font-medium text-foreground">
                Everything looks good today
              </p>

              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                No urgent debts, stock, or tasks need attention.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Recent activity ───────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm md:text-base font-semibold text-foreground">
              Recent activity
            </h3>
            <p className="hidden md:block text-xs text-muted-foreground mt-0.5">
              Latest updates in your shop
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {isLoadingActivity ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex gap-3"
                >
                  <Skeleton className="h-8 w-8 rounded-lg shrink-0" />

                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="divide-y divide-border">
              {activities
                .slice(0, 6)
                .map((activity: ActivityItem) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 px-3 py-3"
                  >
                    <div className="shrink-0 bg-muted w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground">
                      {activity.type === "debt" && (
                        <CreditCard className="w-3.5 h-3.5" />
                      )}

                      {activity.type === "expense" && (
                        <Receipt className="w-3.5 h-3.5" />
                      )}

                      {activity.type === "product" && (
                        <Package className="w-3.5 h-3.5" />
                      )}

                      {activity.type === "task" && (
                        <CheckSquare className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm text-foreground leading-snug truncate">
                        {activity.description}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground mt-0.5">
                        <span>
                          {new Date(
                            activity.timestamp,
                          ).toLocaleDateString(
                            "en-KE",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                      </div>
                    </div>

                    {activity.amount != null && (
                      <span
                        className={cn(
                          "text-xs md:text-sm font-medium shrink-0",
                          activity.type === "expense"
                            ? "text-destructive"
                            : "text-primary",
                        )}
                      >
                        {activity.type === "expense"
                          ? "-"
                          : "+"}
                        {formatCurrency(
                          activity.amount,
                        )}
                      </span>
                    )}
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <div className="w-9 h-9 bg-muted rounded-xl flex items-center justify-center mb-2">
                <WalletCards className="w-4 h-4 opacity-50" />
              </div>

              <p className="text-sm font-medium text-foreground">
                No recent activity
              </p>

              <p className="text-xs mt-0.5">
                Actions you take will appear here.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Desktop quick actions ─────────────────── */}
      <div className="hidden md:flex gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
        >
          <Link href="/tasks">
            <CheckSquare className="w-4 h-4 mr-2" />
            Tasks
          </Link>
        </Button>

        <Button asChild size="sm">
          <Link href="/debts">
            <CreditCard className="w-4 h-4 mr-2" />
            View debts
          </Link>
        </Button>
      </div>
    </div>
  );
}
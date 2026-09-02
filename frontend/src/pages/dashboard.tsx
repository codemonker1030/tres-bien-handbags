import React, { useState } from "react";
import { Link } from "wouter";
import {
  TrendingUp,
  Package,
  CreditCard,
  CheckSquare,
  Receipt,
  BarChart3,
  AlertTriangle,
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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  revenue: { label: "Revenue", color: "hsl(153 72% 43%)", fill: "hsl(153 72% 43% / 0.15)" },
  expenses: { label: "Expenses", color: "hsl(0 72% 51%)", fill: "hsl(0 72% 51% / 0.08)" },
} as const;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium" style={{ color: entry.color }}>
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Dashboard() {
  const [range, setRange] = useState<1 | 3 | 6 | 12>(6);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    revenue: true,
    expenses: true,
  });

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: activities, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: salesData, isLoading: isLoadingSales } = useGetSalesByMonth({ months: range });

  const toggleSeries = (key: SeriesKey) =>
    setVisible((v) => ({ ...v, [key]: !v[key] }));

  const hasAnyData = salesData?.some((d) => d.revenue > 0 || d.expenses > 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* ── Header ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Today's snapshot</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button asChild variant="outline" size="sm">
            <Link href="/tasks">Tasks</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/debts">View Debts</Link>
          </Button>
        </div>
      </div>

      {/* ── Stat cards — 2×2 on mobile ─────────────── */}
      {isLoadingSummary ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">

          {/* Net Profit */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Net Profit</span>
              <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
              </span>
            </div>
            <p className={cn("text-xl font-bold leading-tight", (summary?.netProfit || 0) >= 0 ? "text-primary" : "text-destructive")}>
              {formatCurrency(summary?.netProfit || 0)}
            </p>
            <p className="text-[11px] text-muted-foreground">Rev: {formatCurrency(summary?.totalRevenue || 0)}</p>
          </div>

          {/* Inventory */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Inventory</span>
              <span className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-blue-500" />
              </span>
            </div>
            <p className="text-xl font-bold leading-tight text-foreground">
              {summary?.totalProducts || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">items</span>
            </p>
            {(summary?.lowStockCount ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                {summary!.lowStockCount} low stock
              </span>
            ) : (
              <p className="text-[11px] text-muted-foreground">Stock healthy</p>
            )}
          </div>

          {/* Debts */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Debts</span>
              <span className="w-7 h-7 rounded-full bg-orange-500/10 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-orange-500" />
              </span>
            </div>
            <p className="text-xl font-bold leading-tight text-foreground">
              {formatCurrency(summary?.totalOwedToYou || 0)}
            </p>
            <p className="text-[11px] text-muted-foreground">{summary?.outstandingDebts || 0} outstanding</p>
          </div>

          {/* Tasks */}
          <div className="rounded-2xl bg-card border border-border p-4 flex flex-col gap-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Tasks</span>
              <span className="w-7 h-7 rounded-full bg-purple-500/10 flex items-center justify-center">
                <CheckSquare className="w-3.5 h-3.5 text-purple-500" />
              </span>
            </div>
            <p className="text-xl font-bold leading-tight text-foreground">
              {summary?.openTasksCount || 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">open</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Needing attention</p>
          </div>
        </div>
      )}

      {/* ── Cash Flow chart ─────────────────────────── */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Cash Flow</CardTitle>
                <CardDescription className="text-xs">Revenue vs expenses</CardDescription>
              </div>
              <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.months}
                    onClick={() => setRange(r.months)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                      range === r.months
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              {(Object.entries(SERIES) as [SeriesKey, typeof SERIES[SeriesKey]][]).map(([key, s]) => (
                <button
                  key={key}
                  onClick={() => toggleSeries(key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all",
                    visible[key] ? "text-white border-transparent" : "bg-transparent text-muted-foreground border-border"
                  )}
                  style={visible[key] ? { background: s.color, borderColor: s.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: visible[key] ? "white" : s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {isLoadingSales ? (
            <Skeleton className="w-full h-[220px]" />
          ) : !hasAnyData ? (
            <div className="h-[220px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <BarChart3 className="w-8 h-8 opacity-25" />
              <p className="text-xs text-center">No data yet — record sales and log expenses.</p>
            </div>
          ) : (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={salesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SERIES.revenue.color} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={SERIES.revenue.color} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SERIES.expenses.color} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={SERIES.expenses.color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                    tickFormatter={(val) =>
                      val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
                    }
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {visible.revenue && (
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke={SERIES.revenue.color}
                      strokeWidth={2.5}
                      fill="url(#revenueGradient)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  )}
                  {visible.expenses && (
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke={SERIES.expenses.color}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Activity ─────────────────────────── */}
      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription className="text-xs">Latest updates in your shop</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingActivity ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities && activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity: ActivityItem) => (
                <div key={activity.id} className="flex gap-3 text-sm">
                  <div className="mt-0.5 shrink-0 bg-muted w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground">
                    {activity.type === "debt" && <CreditCard className="w-3.5 h-3.5" />}
                    {activity.type === "expense" && <Receipt className="w-3.5 h-3.5" />}
                    {activity.type === "product" && <Package className="w-3.5 h-3.5" />}
                    {activity.type === "task" && <CheckSquare className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground leading-snug text-sm">{activity.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>
                        {new Date(activity.timestamp).toLocaleDateString("en-KE", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {activity.amount && (
                        <span className={cn("font-medium", activity.type === "expense" ? "text-destructive" : "text-primary")}>
                          {activity.type === "expense" ? "-" : "+"}
                          {formatCurrency(activity.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mb-2">
                <BarChart3 className="w-5 h-5 opacity-50" />
              </div>
              <p className="text-sm font-medium text-foreground">No recent activity</p>
              <p className="text-xs mt-0.5">Actions you take will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Trash2,
  Search,
  Edit3,
  CalendarDays,
  ListTodo,
  Package,
  CreditCard,
  Building2,
  ChevronRight,
  Sparkles,
  PackageX,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  useListTasks,
  useCompleteTask,
  useDeleteTask,
  useListLowStockProducts,
  type Task,
  type Product,
} from "@workspace/api-client";
import { useToast } from "@/hooks/use-toast";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { TaskDialog } from "@/components/dialogs/task-dialog";

type TaskFilter = "todo" | "done" | "all";

interface SmartDebt {
  id: number;
  name: string;
  description: string;
  amount: number;
  amountPaid: number;
  remaining: number;
  dueDate?: string | null;
}

interface SmartAction {
  id: string;
  title: string;
  helper: string;
  href: string;
  priority: number;
  tone: "red" | "amber" | "blue" | "slate";
  icon: React.ReactNode;
  badge: string;
}

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? ""
).replace(/\/+$/, "");

async function fetchCustomerDebts(): Promise<SmartDebt[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/debts/customers`,
  );

  if (!response.ok) {
    throw new Error("Failed to load customer debts");
  }

  const rows = await response.json();

  return rows.map(
    (row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.customerName ?? ""),
      description: String(row.description ?? ""),
      amount: Number(row.amount ?? 0),
      amountPaid: Number(row.amountPaid ?? 0),
      remaining: Number(row.remaining ?? 0),
      dueDate:
        typeof row.dueDate === "string"
          ? row.dueDate
          : null,
    }),
  );
}

async function fetchSupplierDebts(): Promise<SmartDebt[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/debts/suppliers`,
  );

  if (!response.ok) {
    throw new Error("Failed to load supplier debts");
  }

  const rows = await response.json();

  return rows.map(
    (row: Record<string, unknown>) => ({
      id: Number(row.id),
      name: String(row.supplierName ?? ""),
      description: String(row.description ?? ""),
      amount: Number(row.amount ?? 0),
      amountPaid: Number(row.amountPaid ?? 0),
      remaining: Number(row.remaining ?? 0),
      dueDate:
        typeof row.dueDate === "string"
          ? row.dueDate
          : null,
    }),
  );
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  if (d >= todayStart && d <= todayEnd) {
    return "Today";
  }

  return d.toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "done") {
    return false;
  }

  return new Date(task.dueDate) < startOfToday();
}

function isDueToday(task: Task) {
  if (!task.dueDate || task.status === "done") {
    return false;
  }

  const d = new Date(task.dueDate);

  return d >= startOfToday() && d <= endOfToday();
}

function isUpcoming(task: Task) {
  if (!task.dueDate || task.status === "done") {
    return false;
  }

  return new Date(task.dueDate) > endOfToday();
}

function isDebtOverdue(debt: SmartDebt) {
  if (!debt.dueDate || debt.remaining <= 0) {
    return false;
  }

  return new Date(debt.dueDate) < startOfToday();
}

function priorityWeight(priority: string) {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function PriorityBadge({
  priority,
}: {
  priority: string;
}) {
  const styles =
    priority === "high"
      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      : priority === "medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
        : "bg-muted text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium capitalize",
        styles,
      )}
    >
      {priority}
    </span>
  );
}

function TaskRow({
  task,
  onComplete,
  onEdit,
  onDelete,
}: {
  task: Task;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  const overdue = isOverdue(task);
  const done = task.status === "done";

  return (
    <div
      className={cn(
        "px-3 py-3 md:px-4 md:py-3.5 border-b border-border last:border-0 transition-colors",
        done
          ? "bg-muted/20"
          : "hover:bg-muted/30",
      )}
      data-testid={`task-${task.id}`}
    >
      <div className="flex items-start gap-2.5 md:gap-3">
        <button
          type="button"
          onClick={onComplete}
          disabled={done}
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors",
            done
              ? "text-primary"
              : overdue
                ? "text-red-500 hover:bg-red-500/10"
                : "text-muted-foreground hover:text-primary hover:bg-primary/10",
          )}
          aria-label={
            done ? "Task complete" : "Complete task"
          }
        >
          {done ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Circle className="w-5 h-5" />
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={onEdit}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h4
                  className={cn(
                    "text-xs md:text-sm font-medium text-foreground truncate max-w-[190px] md:max-w-none",
                    done &&
                      "line-through text-muted-foreground",
                  )}
                >
                  {task.title}
                </h4>

                {!done && (
                  <PriorityBadge
                    priority={task.priority}
                  />
                )}
              </div>

              {task.description && (
                <p
                  className={cn(
                    "text-[10px] md:text-xs text-muted-foreground mt-0.5 line-clamp-1",
                    done && "line-through opacity-70",
                  )}
                >
                  {task.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {!done && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Edit task"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onDelete}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {task.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[9px] md:text-[11px] font-medium",
                  overdue
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground",
                )}
              >
                {overdue ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}

                {overdue
                  ? `Overdue · ${formatDate(
                      task.dueDate,
                    )}`
                  : formatDate(task.dueDate)}
              </span>
            )}

            {!task.dueDate && !done && (
              <span className="text-[9px] md:text-[11px] text-muted-foreground">
                No due date
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SmartActionRow({
  action,
}: {
  action: SmartAction;
}) {
  const toneClass =
    action.tone === "red"
      ? "bg-red-500/10 text-red-600 dark:text-red-400"
      : action.tone === "amber"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : action.tone === "blue"
          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
          : "bg-muted text-muted-foreground";

  return (
    <Link
      href={action.href}
      className="flex items-center gap-3 px-3 py-3 md:px-4 md:py-3.5 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
          toneClass,
        )}
      >
        {action.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs md:text-sm font-medium text-foreground truncate">
            {action.title}
          </p>

          <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-medium shrink-0">
            Automatic
          </span>
        </div>

        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {action.helper}
        </p>
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
    </Link>
  );
}

export function Tasks() {
  const { toast } = useToast();

  const {
    data: tasks = [],
    isLoading: isLoadingTasks,
    refetch,
  } = useListTasks();

  const {
    data: lowStockProducts = [],
    isLoading: isLoadingProducts,
  } = useListLowStockProducts();

  const {
    data: customerDebts = [],
    isLoading: isLoadingCustomerDebts,
  } = useQuery({
    queryKey: ["debts", "customers"],
    queryFn: fetchCustomerDebts,
  });

  const {
    data: supplierDebts = [],
    isLoading: isLoadingSupplierDebts,
  } = useQuery({
    queryKey: ["debts", "suppliers"],
    queryFn: fetchSupplierDebts,
  });

  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [editingTask, setEditingTask] =
    useState<Task | null>(null);

  const [filter, setFilter] =
    useState<TaskFilter>("todo");

  const [searchTerm, setSearchTerm] =
    useState("");

  const pendingTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== "done")
        .sort((a, b) => {
          if (isOverdue(a) !== isOverdue(b)) {
            return isOverdue(a) ? -1 : 1;
          }

          if (isDueToday(a) !== isDueToday(b)) {
            return isDueToday(a) ? -1 : 1;
          }

          const priorityDiff =
            priorityWeight(b.priority) -
            priorityWeight(a.priority);

          if (priorityDiff !== 0) {
            return priorityDiff;
          }

          if (a.dueDate && b.dueDate) {
            return (
              new Date(a.dueDate).getTime() -
              new Date(b.dueDate).getTime()
            );
          }

          if (a.dueDate) return -1;
          if (b.dueDate) return 1;

          return 0;
        }),
    [tasks],
  );

  const completedTasks = useMemo(
    () =>
      tasks.filter(
        (task) => task.status === "done",
      ),
    [tasks],
  );

  const todayCount = pendingTasks.filter(
    isDueToday,
  ).length;

  const overdueManualCount = pendingTasks.filter(
    isOverdue,
  ).length;

  const upcomingCount = pendingTasks.filter(
    isUpcoming,
  ).length;

  const smartActions = useMemo(() => {
    const actions: SmartAction[] = [];

    // Customer balances: overdue ones rank highest.
    for (const debt of customerDebts) {
      if (debt.remaining <= 0) continue;

      const overdue = isDebtOverdue(debt);

      actions.push({
        id: `customer-debt-${debt.id}`,
        title: overdue
          ? `Payment overdue from ${debt.name}`
          : `Follow up with ${debt.name}`,
        helper: `${formatCurrency(
          debt.remaining,
        )} still to collect${
          debt.dueDate
            ? ` · ${
                overdue
                  ? `due ${formatDate(debt.dueDate)}`
                  : `due ${formatDate(debt.dueDate)}`
              }`
            : ""
        }`,
        href: "/debts",
        priority: overdue ? 100 : 60,
        tone: overdue ? "red" : "amber",
        icon: <CreditCard className="w-4 h-4" />,
        badge: overdue ? "Overdue" : "Payment",
      });
    }

    // Inventory: out-of-stock before merely low stock.
    for (const product of lowStockProducts) {
      if (product.stock <= 0) {
        actions.push({
          id: `stock-out-${product.id}`,
          title: `${product.name} is out of stock`,
          helper:
            "Restock this product before the next sale.",
          href: "/inventory",
          priority: 90,
          tone: "red",
          icon: <PackageX className="w-4 h-4" />,
          badge: "Stock",
        });
      } else {
        actions.push({
          id: `stock-low-${product.id}`,
          title: `${product.name} is running low`,
          helper: `${product.stock} unit${
            product.stock === 1 ? "" : "s"
          } remaining · restock soon`,
          href: "/inventory",
          priority: 70,
          tone: "amber",
          icon: <Package className="w-4 h-4" />,
          badge: "Stock",
        });
      }
    }

    // Supplier balances: overdue before ordinary outstanding.
    for (const debt of supplierDebts) {
      if (debt.remaining <= 0) continue;

      const overdue = isDebtOverdue(debt);

      actions.push({
        id: `supplier-debt-${debt.id}`,
        title: overdue
          ? `Supplier payment overdue`
          : `Supplier payment to ${debt.name}`,
        helper: `${formatCurrency(
          debt.remaining,
        )} still to pay${
          debt.dueDate
            ? ` · due ${formatDate(debt.dueDate)}`
            : ""
        }`,
        href: "/debts",
        priority: overdue ? 85 : 50,
        tone: overdue ? "red" : "blue",
        icon: <Building2 className="w-4 h-4" />,
        badge: "Supplier",
      });
    }

    return actions.sort(
      (a, b) => b.priority - a.priority,
    );
  }, [
    customerDebts,
    supplierDebts,
    lowStockProducts,
  ]);

  const filteredTasks = useMemo(() => {
    const base =
      filter === "todo"
        ? pendingTasks
        : filter === "done"
          ? completedTasks
          : tasks;

    const query =
      searchTerm.trim().toLowerCase();

    if (!query) return base;

    return base.filter((task) => {
      return (
        task.title
          .toLowerCase()
          .includes(query) ||
        task.description
          ?.toLowerCase()
          .includes(query)
      );
    });
  }, [
    filter,
    pendingTasks,
    completedTasks,
    tasks,
    searchTerm,
  ]);

  const handleComplete = (task: Task) => {
    if (task.status === "done") {
      return;
    }

    completeTask.mutate(
      { id: task.id },
      {
        onSuccess: () => {
          toast({
            title: "Task completed",
          });
          refetch();
        },
        onError: () => {
          toast({
            title: "Could not complete task",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDelete = (
    id: number,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    deleteTask.mutate(
      { id },
      {
        onSuccess: () => {
          toast({
            title: "Task deleted",
          });
          refetch();
        },
        onError: () => {
          toast({
            title: "Could not delete task",
            variant: "destructive",
          });
        },
      },
    );
  };

  const FilterButton = ({
    value,
    label,
  }: {
    value: TaskFilter;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      className={cn(
        "px-2.5 md:px-3 py-1 rounded-md text-[10px] md:text-xs font-medium transition-all whitespace-nowrap",
        filter === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const isLoadingSmartActions =
    isLoadingProducts ||
    isLoadingCustomerDebts ||
    isLoadingSupplierDebts;

  return (
    <div className="space-y-3 md:space-y-5 animate-in fade-in duration-500">
      {/* ── Header ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-foreground">
            Tasks
          </h2>

          <p className="hidden md:block text-sm text-muted-foreground mt-1">
            Business actions Tres Bien notices, plus tasks you create yourself.
          </p>
        </div>

        <Button
          data-testid="button-add-task"
          onClick={() => {
            setEditingTask(null);
            setDialogOpen(true);
          }}
          size="sm"
          className="h-8 px-2.5 md:h-9 md:px-4 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />

          <span className="hidden md:inline">
            Add Task
          </span>

          <span className="md:hidden ml-1">
            Add
          </span>
        </Button>
      </div>

      {/* ── Task pulse ─────────────────────────── */}
      {isLoadingTasks ? (
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-3 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-3 md:p-4 border-r border-border">
            <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
              Today
            </p>

            <p
              className={cn(
                "text-sm md:text-lg font-semibold mt-0.5",
                todayCount > 0
                  ? "text-primary"
                  : "text-foreground",
              )}
            >
              {todayCount}
            </p>

            <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
              due today
            </p>
          </div>

          <div className="px-3 py-3 md:p-4 border-r border-border">
            <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
              Upcoming
            </p>

            <p className="text-sm md:text-lg font-semibold text-foreground mt-0.5">
              {upcomingCount}
            </p>

            <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
              scheduled
            </p>
          </div>

          <div className="px-3 py-3 md:p-4">
            <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
              Completed
            </p>

            <p className="text-sm md:text-lg font-semibold text-foreground mt-0.5">
              {completedTasks.length}
            </p>

            <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
              finished
            </p>
          </div>
        </div>
      )}

      {/* ── Automatic business actions ─────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" />

              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Business actions
              </h3>
            </div>

            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
              Generated automatically from your live business data.
            </p>
          </div>

          {!isLoadingSmartActions &&
            smartActions.length > 0 && (
              <span className="text-[10px] md:text-xs text-muted-foreground">
                {smartActions.length}
              </span>
            )}
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {isLoadingSmartActions ? (
            <div className="p-3 space-y-2.5">
              {Array.from({ length: 3 }).map(
                (_, i) => (
                  <Skeleton
                    key={i}
                    className="h-16 rounded-lg"
                  />
                ),
              )}
            </div>
          ) : smartActions.length > 0 ? (
            smartActions.map((action) => (
              <SmartActionRow
                key={action.id}
                action={action}
              />
            ))
          ) : (
            <div className="flex items-center gap-3 px-3 py-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>

              <div>
                <p className="text-xs md:text-sm font-medium text-foreground">
                  No business actions right now
                </p>

                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                  Stock and debt issues will appear here automatically.
                </p>
              </div>
            </div>
          )}
        </div>

        {smartActions.length > 0 && (
          <p className="text-[9px] md:text-[11px] text-muted-foreground mt-1.5 px-1">
            These clear themselves when you resolve the source issue in Inventory or Debts.
          </p>
        )}
      </section>

      {/* ── Manual task attention ──────────────── */}
      {!isLoadingTasks &&
        overdueManualCount > 0 && (
          <section>
            <h3 className="text-sm md:text-base font-semibold text-foreground mb-2">
              Manual tasks needing attention
            </h3>

            <button
              type="button"
              onClick={() => setFilter("todo")}
              className="w-full rounded-2xl border border-red-500/30 bg-red-500/5 px-3 py-3 text-left flex items-center gap-3 hover:bg-red-500/10 transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs md:text-sm font-medium text-foreground">
                  {overdueManualCount} overdue task
                  {overdueManualCount === 1
                    ? ""
                    : "s"}
                </p>

                <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                  Review what should have been completed already.
                </p>
              </div>
            </button>
          </section>
        )}

      {/* ── My tasks ───────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm md:text-base font-semibold text-foreground">
            My tasks
          </h3>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-2.5 md:px-4 py-2.5 md:py-3 border-b border-border bg-muted/30 space-y-2 md:space-y-0 md:flex md:items-center md:justify-between md:gap-3">
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1 w-max">
                <FilterButton
                  value="todo"
                  label={`To do (${pendingTasks.length})`}
                />

                <FilterButton
                  value="done"
                  label={`Done (${completedTasks.length})`}
                />

                <FilterButton
                  value="all"
                  label="All"
                />
              </div>
            </div>

            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground md:top-2.5" />

              <Input
                type="search"
                placeholder="Search tasks..."
                className="h-8 md:h-9 pl-9 text-xs md:text-sm bg-background border-border"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
              />
            </div>
          </div>

          {isLoadingTasks ? (
            <div className="p-3 md:p-4 space-y-2.5">
              {Array.from({ length: 3 }).map(
                (_, i) => (
                  <Skeleton
                    key={i}
                    className="h-20 md:h-16 rounded-lg"
                  />
                ),
              )}
            </div>
          ) : filteredTasks.length > 0 ? (
            filteredTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={() =>
                  handleComplete(task)
                }
                onEdit={() => {
                  setEditingTask(task);
                  setDialogOpen(true);
                }}
                onDelete={(e) =>
                  handleDelete(task.id, e)
                }
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 md:py-16 text-muted-foreground">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-2.5">
                {filter === "done" ? (
                  <CheckCircle2 className="w-4 h-4 opacity-50" />
                ) : (
                  <ListTodo className="w-4 h-4 opacity-50" />
                )}
              </div>

              <p className="text-sm font-medium text-foreground">
                {searchTerm
                  ? "No matching tasks"
                  : filter === "done"
                    ? "Nothing completed yet"
                    : filter === "all"
                      ? "No manual tasks yet"
                      : "All caught up"}
              </p>

              <p className="text-xs mt-1 text-center px-6">
                {searchTerm
                  ? "Try a different search."
                  : filter === "todo"
                    ? "There’s nothing you manually scheduled right now."
                    : "Tasks you create will appear here."}
              </p>

              {!searchTerm &&
                filter !== "done" && (
                  <button
                    type="button"
                    className="text-xs text-primary mt-2.5 hover:underline"
                    onClick={() => {
                      setEditingTask(null);
                      setDialogOpen(true);
                    }}
                  >
                    + Add a task
                  </button>
                )}
            </div>
          )}
        </div>
      </section>

      {/* ── Helpful ideas ───────────────────────── */}
      {!isLoadingTasks &&
        tasks.length === 0 && (
          <section className="rounded-2xl border border-border bg-card p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <CalendarDays className="w-4 h-4 text-muted-foreground" />

              <h3 className="text-xs md:text-sm font-medium text-foreground">
                Good manual tasks to add
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] md:text-xs text-muted-foreground">
              <p>• Post new arrivals on WhatsApp</p>
              <p>• Deliver a customer order</p>
              <p>• Call a supplier about new stock</p>
              <p>• Pick up stock or packaging</p>
            </div>
          </section>
        )}

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
      />
    </div>
  );
}

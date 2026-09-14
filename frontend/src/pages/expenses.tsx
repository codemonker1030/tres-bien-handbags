import React, { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Tag,
  Calendar,
  Edit,
  Trash2,
  Receipt,
  TrendingDown,
  Store,
} from "lucide-react";
import {
  useListExpenses,
  useDeleteExpense,
  type Expense,
} from "@workspace/api-client";
import { useToast } from "@/hooks/use-toast";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ExpenseDialog } from "@/components/dialogs/expense-dialog";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isSameMonth(dateStr: string, now = new Date()) {
  const date = new Date(dateStr);

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function ExpenseRow({
  expense,
  onEdit,
  onDelete,
}: {
  expense: Expense;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="md:hidden px-3 py-3 border-b border-border last:border-0">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
          <Receipt className="w-3.5 h-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {expense.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {expense.category}
                </span>

                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-2.5 h-2.5" />
                  {formatDate(expense.date)}
                </span>
              </div>

              {expense.vendor && (
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {expense.vendor}
                </p>
              )}
            </div>

            <p className="text-sm font-semibold text-destructive shrink-0">
              {formatCurrency(expense.amount)}
            </p>
          </div>

          <div className="flex items-center justify-end gap-0.5 mt-1.5">
            <button
              type="button"
              onClick={onEdit}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Edit expense"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Delete expense"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Expenses() {
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const [deleteConfirmOpen, setDeleteConfirmOpen] =
    useState(false);
  const [expenseToDelete, setExpenseToDelete] =
    useState<number | null>(null);

  const [dialogOpen, setDialogOpen] =
    useState(false);
  const [editingExpense, setEditingExpense] =
    useState<Expense | null>(null);

  const {
    data: expenses = [],
    isLoading,
    refetch,
  } = useListExpenses();

  const deleteExpense = useDeleteExpense();

  const categorySummary = useMemo(() => {
    const totals = new Map<string, number>();

    for (const expense of expenses) {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) +
          expense.amount,
      );
    }

    return Array.from(totals.entries())
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return expenses.filter((expense) => {
      const matchesCategory =
        activeCategory === "all" ||
        expense.category === activeCategory;

      const matchesSearch =
        query === "" ||
        expense.description
          .toLowerCase()
          .includes(query) ||
        expense.category
          .toLowerCase()
          .includes(query) ||
        (expense.vendor?.toLowerCase().includes(query) ??
          false);

      return matchesCategory && matchesSearch;
    });
  }, [expenses, searchTerm, activeCategory]);

  const totalExpenses = filteredExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );

  const thisMonthTotal = expenses
    .filter((expense) => isSameMonth(expense.date))
    .reduce(
      (sum, expense) => sum + expense.amount,
      0,
    );

  const topCategory = categorySummary[0];

  const handleDelete = (id: number) => {
    setExpenseToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete == null) return;

    deleteExpense.mutate(
      { id: expenseToDelete },
      {
        onSuccess: () => {
          toast({
            title: "Expense deleted",
            description:
              "The expense has been removed.",
          });

          refetch();
        },

        onError: () => {
          toast({
            title: "Error",
            description:
              "Could not delete expense.",
            variant: "destructive",
          });
        },

        onSettled: () => {
          setDeleteConfirmOpen(false);
          setExpenseToDelete(null);
        },
      },
    );
  };

  return (
    <div className="space-y-3 md:space-y-5 animate-in fade-in duration-500">
      {/* ── Header ────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-foreground">
            Expenses
          </h2>

          <p className="hidden md:block text-sm text-muted-foreground mt-1">
            Track business spending and understand where money goes.
          </p>
        </div>

        <Button
          data-testid="button-add-expense"
          onClick={() => {
            setEditingExpense(null);
            setDialogOpen(true);
          }}
          size="sm"
          className="h-8 px-2.5 md:h-9 md:px-4 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />

          <span className="hidden md:inline">
            Log Expense
          </span>

          <span className="md:hidden ml-1">
            Add
          </span>
        </Button>
      </div>

      {/* ── Expense pulse ─────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-3 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-3 py-3 md:p-4 border-r border-border">
            <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
              This month
            </p>

            <p className="text-sm md:text-lg font-semibold text-destructive mt-0.5 truncate">
              {formatCurrency(thisMonthTotal)}
            </p>

            <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
              spent
            </p>
          </div>

          <div className="px-3 py-3 md:p-4 border-r border-border">
            <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
              Displayed
            </p>

            <p className="text-sm md:text-lg font-semibold text-foreground mt-0.5 truncate">
              {formatCurrency(totalExpenses)}
            </p>

            <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
              {filteredExpenses.length} record
              {filteredExpenses.length === 1
                ? ""
                : "s"}
            </p>
          </div>

          <div className="px-3 py-3 md:p-4">
            <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
              Top category
            </p>

            <p className="text-sm md:text-lg font-semibold text-foreground mt-0.5 truncate">
              {topCategory?.category ?? "—"}
            </p>

            <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5 truncate">
              {topCategory
                ? formatCurrency(topCategory.amount)
                : "No spending yet"}
            </p>
          </div>
        </div>
      )}

      {/* ── Category insights ─────────────────────── */}
      {categorySummary.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm md:text-base font-semibold text-foreground">
              Spending by category
            </h3>
          </div>

          <div className="overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
            <div className="flex gap-2 w-max">
              <button
                type="button"
                onClick={() =>
                  setActiveCategory("all")
                }
                className={cn(
                  "rounded-xl border px-3 py-2 text-left min-w-[92px] transition-colors",
                  activeCategory === "all"
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-muted/30",
                )}
              >
                <p className="text-[9px] md:text-xs text-muted-foreground">
                  All
                </p>

                <p className="text-xs md:text-sm font-semibold text-foreground mt-0.5">
                  {expenses.length}
                </p>
              </button>

              {categorySummary.map((item) => (
                <button
                  type="button"
                  key={item.category}
                  onClick={() =>
                    setActiveCategory(
                      activeCategory === item.category
                        ? "all"
                        : item.category,
                    )
                  }
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left min-w-[110px] transition-colors",
                    activeCategory === item.category
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/30",
                  )}
                >
                  <p className="text-[9px] md:text-xs text-muted-foreground truncate">
                    {item.category}
                  </p>

                  <p className="text-xs md:text-sm font-semibold text-foreground mt-0.5 truncate">
                    {formatCurrency(item.amount)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Expense history ───────────────────────── */}
      <section className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-3 md:px-4 py-2.5 md:py-3 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden md:block">
              <h3 className="text-sm md:text-base font-semibold text-foreground">
                Expense history
              </h3>
            </div>

            <div className="relative w-full md:max-w-xs md:ml-auto">
              <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground md:top-2.5" />

              <Input
                type="search"
                placeholder="Search expenses..."
                className="h-8 md:h-9 pl-9 text-xs md:text-sm bg-background border-border"
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(e.target.value)
                }
                data-testid="input-search-expenses"
              />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="p-3 md:p-4 space-y-2.5">
            {Array.from({ length: 4 }).map(
              (_, i) => (
                <Skeleton
                  key={i}
                  className="h-20 md:h-14 w-full rounded-lg"
                />
              ),
            )}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 text-muted-foreground">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-2.5">
              <TrendingDown className="w-4 h-4 opacity-50" />
            </div>

            <p className="text-sm font-medium text-foreground">
              No expenses found
            </p>

            <p className="text-xs mt-1 text-center px-6">
              {searchTerm || activeCategory !== "all"
                ? "Try changing your search or category filter."
                : "Business spending you log will appear here."}
            </p>

            {!searchTerm &&
              activeCategory === "all" && (
                <button
                  type="button"
                  className="text-xs text-primary mt-2.5 hover:underline"
                  onClick={() => {
                    setEditingExpense(null);
                    setDialogOpen(true);
                  }}
                >
                  + Log your first expense
                </button>
              )}
          </div>
        ) : (
          <>
            {/* mobile */}
            <div className="md:hidden">
              {filteredExpenses.map(
                (expense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense}
                    onEdit={() => {
                      setEditingExpense(expense);
                      setDialogOpen(true);
                    }}
                    onDelete={() =>
                      handleDelete(expense.id)
                    }
                  />
                ),
              )}
            </div>

            {/* desktop */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>
                      Date
                    </TableHead>
                    <TableHead>
                      Description
                    </TableHead>
                    <TableHead>
                      Category
                    </TableHead>
                    <TableHead>
                      Vendor
                    </TableHead>
                    <TableHead className="text-right">
                      Amount
                    </TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredExpenses.map(
                    (expense) => (
                      <TableRow
                        key={expense.id}
                        data-testid={`expense-row-${expense.id}`}
                      >
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDate(
                            expense.date,
                          )}
                        </TableCell>

                        <TableCell>
                          <span className="font-medium text-foreground">
                            {expense.description}
                          </span>
                        </TableCell>

                        <TableCell>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Tag className="w-3 h-3" />
                            {expense.category}
                          </span>
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            {expense.vendor && (
                              <Store className="w-3.5 h-3.5" />
                            )}
                            {expense.vendor ||
                              "—"}
                          </span>
                        </TableCell>

                        <TableCell className="text-right font-medium text-destructive">
                          {formatCurrency(
                            expense.amount,
                          )}
                        </TableCell>

                        <TableCell className="text-right p-2">
                          <div className="flex items-center justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                setEditingExpense(
                                  expense,
                                );
                                setDialogOpen(
                                  true,
                                );
                              }}
                              aria-label="Edit expense"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                handleDelete(
                                  expense.id,
                                )
                              }
                              data-testid={`button-delete-expense-${expense.id}`}
                              aria-label="Delete expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete expense?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Are you sure you want to remove
              this expense record? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editingExpense}
      />
    </div>
  );
}
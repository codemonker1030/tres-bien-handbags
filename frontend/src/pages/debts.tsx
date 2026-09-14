import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit,
  Trash2,
  CreditCard,
  Users,
  Building2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  WalletCards,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  DebtDialog,
  RecordPaymentDialog,
  CUSTOMER_DEBTS_KEY,
  SUPPLIER_DEBTS_KEY,
  type Debt,
  type DebtKind,
} from "@/components/dialogs/debt-dialog";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? ""
).replace(/\/+$/, "");

// ─── API fetch helpers ────────────────────────────────────────────────────────
async function fetchCustomerDebts(): Promise<Debt[]> {
  const r = await fetch(
    `${API_BASE_URL}/api/debts/customers`,
  );

  if (!r.ok) {
    throw new Error("Failed to load customer debts");
  }

  const rows = await r.json();

  return rows.map(
    (d: Record<string, unknown>) => ({
      ...d,
      name: d.customerName as string,
    }),
  );
}

async function fetchSupplierDebts(): Promise<Debt[]> {
  const r = await fetch(
    `${API_BASE_URL}/api/debts/suppliers`,
  );

  if (!r.ok) {
    throw new Error("Failed to load supplier debts");
  }

  const rows = await r.json();

  return rows.map(
    (d: Record<string, unknown>) => ({
      ...d,
      name: d.supplierName as string,
    }),
  );
}

async function apiDelete(
  path: string,
): Promise<void> {
  const r = await fetch(
    `${API_BASE_URL}${path}`,
    { method: "DELETE" },
  );

  if (!r.ok && r.status !== 204) {
    throw new Error("Delete failed");
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────
type FilterTab =
  | "outstanding"
  | "settled"
  | "all";

function debtStatus(
  d: Debt,
): "settled" | "partial" | "outstanding" {
  if (d.remaining <= 0) return "settled";
  if (d.amountPaid > 0) return "partial";
  return "outstanding";
}

function isOverdue(d: Debt): boolean {
  if (!d.dueDate) return false;

  return (
    debtStatus(d) !== "settled" &&
    new Date(d.dueDate) < new Date()
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(
    "en-KE",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

function StatusBadge({
  debt,
}: {
  debt: Debt;
}) {
  const status = debtStatus(debt);
  const overdue = isOverdue(debt);

  if (status === "settled") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-medium bg-primary/10 text-primary">
        <CheckCircle2 className="w-2.5 h-2.5 md:w-3 md:h-3" />
        Settled
      </span>
    );
  }

  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />
        Overdue
      </span>
    );
  }

  if (status === "partial") {
    return (
      <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Partial
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-medium bg-muted text-muted-foreground">
      Outstanding
    </span>
  );
}

// ─── single debt row ──────────────────────────────────────────────────────────
function DebtRow({
  debt,
  onEdit,
  onPayment,
  onDelete,
}: {
  debt: Debt;
  onEdit: () => void;
  onPayment: () => void;
  onDelete: () => void;
}) {
  const settled =
    debtStatus(debt) === "settled";

  const pct = Math.min(
    100,
    debt.amount > 0
      ? (debt.amountPaid / debt.amount) * 100
      : 0,
  );

  return (
    <div className="px-3 py-3 md:p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2.5 md:gap-3">
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
          <WalletCards className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-medium text-xs md:text-sm text-foreground truncate max-w-[180px] md:max-w-none">
                  {debt.name}
                </span>

                <StatusBadge debt={debt} />
              </div>

              <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {debt.description}
              </p>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm md:text-lg font-semibold text-foreground">
                {formatCurrency(debt.remaining)}
              </p>

              {debt.amountPaid > 0 && (
                <p className="text-[9px] md:text-[11px] text-muted-foreground">
                  of {formatCurrency(debt.amount)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] md:text-xs text-muted-foreground">
                {debt.phone && (
                  <span>{debt.phone}</span>
                )}

                {debt.dueDate && (
                  <span
                    className={cn(
                      isOverdue(debt) &&
                        "text-red-600 dark:text-red-400 font-medium",
                    )}
                  >
                    Due {formatDate(debt.dueDate)}
                  </span>
                )}
              </div>

              {debt.amountPaid > 0 &&
                !settled && (
                  <div className="mt-1.5 max-w-[220px]">
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${pct}%`,
                        }}
                      />
                    </div>

                    <p className="text-[9px] md:text-[11px] text-muted-foreground mt-1">
                      Paid{" "}
                      {formatCurrency(
                        debt.amountPaid,
                      )}
                    </p>
                  </div>
                )}

              {debt.notes && (
                <p className="text-[9px] md:text-xs text-muted-foreground truncate max-w-[210px] md:max-w-[420px] mt-0.5">
                  {debt.notes}
                </p>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              {!settled && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 md:px-2.5 text-[10px] md:text-xs border-primary/40 text-primary hover:bg-primary/10"
                  onClick={onPayment}
                >
                  <CreditCard className="w-3 h-3 mr-1" />
                  Pay
                </Button>
              )}

              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit debt"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                <Edit className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onDelete}
                aria-label="Delete debt"
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── panel (used for both customer + supplier) ────────────────────────────────
function DebtPanel({
  kind,
}: {
  kind: DebtKind;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const isCustomer =
    kind === "customer";

  const queryKey = isCustomer
    ? CUSTOMER_DEBTS_KEY
    : SUPPLIER_DEBTS_KEY;

  const fetchFn = isCustomer
    ? fetchCustomerDebts
    : fetchSupplierDebts;

  const apiBase = isCustomer
    ? "/api/debts/customers"
    : "/api/debts/suppliers";

  const label = isCustomer
    ? "Customer"
    : "Supplier";

  const {
    data: debts = [],
    isLoading,
  } = useQuery({
    queryKey,
    queryFn: fetchFn,
  });

  const [filterTab, setFilterTab] =
    useState<FilterTab>("outstanding");

  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [
    payDialogOpen,
    setPayDialogOpen,
  ] = useState(false);

  const [editing, setEditing] =
    useState<Debt | null>(null);

  const [paying, setPaying] =
    useState<Debt | null>(null);

  const outstandingDebts = debts.filter(
    (d) => debtStatus(d) !== "settled",
  );

  const settledDebts = debts.filter(
    (d) => debtStatus(d) === "settled",
  );

  const totalOutstanding =
    outstandingDebts.reduce(
      (sum, debt) =>
        sum + debt.remaining,
      0,
    );

  const totalSettled =
    settledDebts.reduce(
      (sum, debt) =>
        sum + debt.amount,
      0,
    );

  const overdueCount =
    debts.filter(isOverdue).length;

  const filtered = debts.filter(
    (debt) => {
      if (
        filterTab === "outstanding"
      ) {
        return (
          debtStatus(debt) !== "settled"
        );
      }

      if (
        filterTab === "settled"
      ) {
        return (
          debtStatus(debt) === "settled"
        );
      }

      return true;
    },
  );

  const handleDelete = async (
    id: number,
  ) => {
    try {
      await apiDelete(
        `${apiBase}/${id}`,
      );

      qc.invalidateQueries({
        queryKey,
      });

      toast({
        title: "Debt removed",
      });
    } catch {
      toast({
        title: "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const FilterBtn = ({
    value,
    label: buttonLabel,
  }: {
    value: FilterTab;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() =>
        setFilterTab(value)
      }
      className={cn(
        "px-2.5 md:px-3 py-1 rounded-md text-[10px] md:text-xs font-medium transition-all whitespace-nowrap",
        filterTab === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {buttonLabel}
    </button>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      {/* action + summary */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
            {isCustomer
              ? "Outstanding to collect"
              : "Outstanding to pay"}
          </p>

          <p
            className={cn(
              "text-2xl md:text-3xl font-semibold tracking-tight mt-0.5",
              isCustomer
                ? "text-primary"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {formatCurrency(
              totalOutstanding,
            )}
          </p>

          <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
            {outstandingDebts.length} outstanding
            {overdueCount > 0 &&
              ` · ${overdueCount} overdue`}
          </p>
        </div>

        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          size="sm"
          className="h-8 px-2.5 md:px-3 shrink-0"
        >
          <Plus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1.5" />

          <span className="hidden md:inline">
            Add {label} Debt
          </span>

          <span className="md:hidden ml-1">
            Add
          </span>
        </Button>
      </div>

      {/* compact pulse */}
      <div className="grid grid-cols-3 rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-3 py-3 md:p-4 border-r border-border">
          <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
            Outstanding
          </p>

          <p
            className={cn(
              "text-sm md:text-lg font-semibold mt-0.5 truncate",
              isCustomer
                ? "text-primary"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {outstandingDebts.length}
          </p>

          <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
            open
          </p>
        </div>

        <div className="px-3 py-3 md:p-4 border-r border-border">
          <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
            Settled
          </p>

          <p className="text-sm md:text-lg font-semibold text-foreground mt-0.5 truncate">
            {formatCurrency(
              totalSettled,
            )}
          </p>

          <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
            {settledDebts.length} cleared
          </p>
        </div>

        <div className="px-3 py-3 md:p-4">
          <p className="text-[9px] md:text-xs text-muted-foreground font-medium">
            Overdue
          </p>

          <p
            className={cn(
              "text-sm md:text-lg font-semibold mt-0.5",
              overdueCount > 0
                ? "text-red-600 dark:text-red-400"
                : "text-foreground",
            )}
          >
            {overdueCount}
          </p>

          <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
            past due
          </p>
        </div>
      </div>

      {/* list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-2.5 md:px-4 py-2.5 md:py-3 border-b border-border bg-muted/30 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1 w-max">
            <FilterBtn
              value="outstanding"
              label={`Outstanding (${outstandingDebts.length})`}
            />

            <FilterBtn
              value="settled"
              label={`Settled (${settledDebts.length})`}
            />

            <FilterBtn
              value="all"
              label="All"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-3 md:p-4 space-y-2.5">
            {Array.from({
              length: 3,
            }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-20 md:h-24 w-full rounded-lg"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 text-muted-foreground">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center mb-2.5">
              {isCustomer ? (
                <Users className="w-4 h-4 opacity-50" />
              ) : (
                <Building2 className="w-4 h-4 opacity-50" />
              )}
            </div>

            <p className="text-sm font-medium text-foreground">
              {filterTab === "settled"
                ? "No settled debts yet"
                : `No ${
                    filterTab ===
                    "outstanding"
                      ? "outstanding "
                      : ""
                  }${label.toLowerCase()} debts`}
            </p>

            <p className="text-xs mt-1 text-center px-6">
              {isCustomer
                ? "Customer balances will appear here automatically from partial and credit sales."
                : "Add supplier debts when you owe a supplier."}
            </p>

            {filterTab !== "settled" && (
              <button
                type="button"
                className="text-xs text-primary mt-2.5 hover:underline"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
              >
                + Add one now
              </button>
            )}
          </div>
        ) : (
          filtered.map((debt) => (
            <DebtRow
              key={debt.id}
              debt={debt}
              onEdit={() => {
                setEditing(debt);
                setDialogOpen(true);
              }}
              onPayment={() => {
                setPaying(debt);
                setPayDialogOpen(true);
              }}
              onDelete={() =>
                handleDelete(debt.id)
              }
            />
          ))
        )}
      </div>

      <DebtDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        kind={kind}
        debt={editing}
      />

      <RecordPaymentDialog
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        kind={kind}
        debt={paying}
      />
    </div>
  );
}

// ─── Main Debts page ──────────────────────────────────────────────────────────
type MainTab =
  | "customers"
  | "suppliers";

export function Debts() {
  const [tab, setTab] =
    useState<MainTab>("customers");

  return (
    <div className="space-y-3 md:space-y-5 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-foreground">
          Debts
        </h2>

        <p className="hidden md:block text-sm text-muted-foreground mt-1">
          Track who owes you and what you owe others.
        </p>
      </div>

      {/* compact tab switcher */}
      <div className="grid grid-cols-2 gap-1 bg-muted/50 rounded-lg md:rounded-xl p-1 w-full sm:w-fit">
        <button
          type="button"
          onClick={() =>
            setTab("customers")
          }
          className={cn(
            "flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-sm font-medium transition-all",
            tab === "customers"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="w-3.5 h-3.5 md:w-4 md:h-4" />
          Customers owe me
        </button>

        <button
          type="button"
          onClick={() =>
            setTab("suppliers")
          }
          className={cn(
            "flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 md:py-2 rounded-md md:rounded-lg text-[10px] md:text-sm font-medium transition-all",
            tab === "suppliers"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Building2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
          Suppliers I owe
        </button>
      </div>

      {tab === "customers" ? (
        <DebtPanel kind="customer" />
      ) : (
        <DebtPanel kind="supplier" />
      )}
    </div>
  );
}
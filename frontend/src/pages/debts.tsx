import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, CreditCard, Users, Building2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import {
  DebtDialog, RecordPaymentDialog,
  CUSTOMER_DEBTS_KEY, SUPPLIER_DEBTS_KEY,
  type Debt, type DebtKind,
} from "@/components/dialogs/debt-dialog";

// ─── API fetch helpers ────────────────────────────────────────────────────────
async function fetchCustomerDebts(): Promise<Debt[]> {
  const r = await fetch("/api/debts/customers");
  if (!r.ok) throw new Error("Failed to load customer debts");
  const rows = await r.json();
  // API returns customerName — normalise to `name`
  return rows.map((d: Record<string, unknown>) => ({
    ...d,
    name: d.customerName as string,
  }));
}

async function fetchSupplierDebts(): Promise<Debt[]> {
  const r = await fetch("/api/debts/suppliers");
  if (!r.ok) throw new Error("Failed to load supplier debts");
  const rows = await r.json();
  return rows.map((d: Record<string, unknown>) => ({
    ...d,
    name: d.supplierName as string,
  }));
}

async function apiDelete(path: string): Promise<void> {
  const r = await fetch(path, { method: "DELETE" });
  if (!r.ok && r.status !== 204) throw new Error("Delete failed");
}

// ─── helpers ──────────────────────────────────────────────────────────────────
type FilterTab = "outstanding" | "settled" | "all";

function debtStatus(d: Debt): "settled" | "partial" | "outstanding" {
  if (d.remaining <= 0) return "settled";
  if (d.amountPaid > 0) return "partial";
  return "outstanding";
}

function isOverdue(d: Debt): boolean {
  if (!d.dueDate) return false;
  return debtStatus(d) !== "settled" && new Date(d.dueDate) < new Date();
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function StatusBadge({ debt }: { debt: Debt }) {
  const s = debtStatus(debt);
  const overdue = isOverdue(debt);
  if (s === "settled")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
        <CheckCircle2 className="w-3 h-3" /> Settled
      </span>
    );
  if (overdue)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="w-3 h-3" /> Overdue
      </span>
    );
  if (s === "partial")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Partial
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground">
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
  const settled = debtStatus(debt) === "settled";
  const pct = Math.min(100, debt.amount > 0 ? (debt.amountPaid / debt.amount) * 100 : 0);

  return (
    <div className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* name + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{debt.name}</span>
            <StatusBadge debt={debt} />
            {debt.phone && (
              <span className="text-[11px] text-muted-foreground">{debt.phone}</span>
            )}
          </div>

          {/* description */}
          <p className="text-sm text-muted-foreground">{debt.description}</p>

          {/* due date + notes */}
          <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            {debt.dueDate && <span>Due {formatDate(debt.dueDate)}</span>}
            {debt.notes && <span className="truncate max-w-[200px]">{debt.notes}</span>}
          </div>

          {/* progress bar for partial payments */}
          {debt.amountPaid > 0 && !settled && (
            <div className="space-y-0.5">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Paid {formatCurrency(debt.amountPaid)} of {formatCurrency(debt.amount)}
              </p>
            </div>
          )}
        </div>

        {/* amount + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{formatCurrency(debt.remaining)}</p>
            {debt.amountPaid > 0 && (
              <p className="text-[11px] text-muted-foreground">of {formatCurrency(debt.amount)}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!settled && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5 border-primary/40 text-primary hover:bg-primary/10"
                onClick={onPayment}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Pay
              </Button>
            )}
            <button
              onClick={onEdit}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── panel (used for both customer + supplier) ────────────────────────────────
function DebtPanel({ kind }: { kind: DebtKind }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const isCustomer = kind === "customer";
  const queryKey = isCustomer ? CUSTOMER_DEBTS_KEY : SUPPLIER_DEBTS_KEY;
  const fetchFn = isCustomer ? fetchCustomerDebts : fetchSupplierDebts;
  const apiBase = isCustomer ? "/api/debts/customers" : "/api/debts/suppliers";
  const label = isCustomer ? "Customer" : "Supplier";

  const { data: debts = [], isLoading } = useQuery({ queryKey, queryFn: fetchFn });

  const [filterTab, setFilterTab] = useState<FilterTab>("outstanding");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [paying, setPaying] = useState<Debt | null>(null);

  const totalOutstanding = debts
    .filter((d) => debtStatus(d) !== "settled")
    .reduce((s, d) => s + d.remaining, 0);
  const totalSettled = debts
    .filter((d) => debtStatus(d) === "settled")
    .reduce((s, d) => s + d.amount, 0);
  const overdueCount = debts.filter(isOverdue).length;

  const filtered = debts.filter((d) => {
    if (filterTab === "outstanding") return debtStatus(d) !== "settled";
    if (filterTab === "settled") return debtStatus(d) === "settled";
    return true;
  });

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`${apiBase}/${id}`);
      qc.invalidateQueries({ queryKey });
      toast({ title: "Debt removed" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  const FilterBtn = ({ value, label: btnLabel }: { value: FilterTab; label: string }) => (
    <button
      onClick={() => setFilterTab(value)}
      className={cn(
        "px-3 py-1 rounded-md text-xs font-semibold transition-all",
        filterTab === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {btnLabel}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* add button */}
      <div className="flex justify-end">
        <Button
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          size="sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Add {label} Debt
        </Button>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div
          className={cn(
            "rounded-xl p-4 border",
            isCustomer
              ? "border-primary/40 bg-primary/5"
              : "border-red-400/60 bg-red-50/50 dark:bg-red-950/20",
          )}
        >
          <p className="text-xs text-muted-foreground font-medium mb-1">
            {isCustomer ? "You're owed" : "You owe"}
          </p>
          <p
            className={cn(
              "text-xl font-bold",
              isCustomer ? "text-primary" : "text-red-600 dark:text-red-400",
            )}
          >
            {formatCurrency(totalOutstanding)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {debts.filter((d) => debtStatus(d) !== "settled").length} outstanding
          </p>
        </div>

        <div className="rounded-xl p-4 border border-border bg-card">
          <p className="text-xs text-muted-foreground font-medium mb-1">Settled</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalSettled)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {debts.filter((d) => debtStatus(d) === "settled").length} cleared
          </p>
        </div>

        <div
          className={cn(
            "rounded-xl p-4 border",
            overdueCount > 0
              ? "border-red-400/60 bg-red-50/50 dark:bg-red-950/20"
              : "border-border bg-card",
          )}
        >
          <p className="text-xs text-muted-foreground font-medium mb-1">Overdue</p>
          <p
            className={cn(
              "text-xl font-bold",
              overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground",
            )}
          >
            {overdueCount}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">past due date</p>
        </div>
      </div>

      {/* list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* filter tabs */}
        <div className="flex items-center gap-1 px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
            <FilterBtn value="outstanding" label={`Outstanding (${debts.filter(d => debtStatus(d) !== "settled").length})`} />
            <FilterBtn value="settled" label={`Settled (${debts.filter(d => debtStatus(d) === "settled").length})`} />
            <FilterBtn value="all" label="All" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            {isCustomer
              ? <Users className="w-8 h-8 mb-3 opacity-30" />
              : <Building2 className="w-8 h-8 mb-3 opacity-30" />}
            <p className="text-sm">
              {filterTab === "settled"
                ? "No settled debts yet."
                : `No ${filterTab === "outstanding" ? "outstanding " : ""}${label.toLowerCase()} debts recorded.`}
            </p>
            {filterTab !== "settled" && (
              <button
                className="text-xs text-primary mt-2 hover:underline"
                onClick={() => { setEditing(null); setDialogOpen(true); }}
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
              onEdit={() => { setEditing(debt); setDialogOpen(true); }}
              onPayment={() => { setPaying(debt); setPayDialogOpen(true); }}
              onDelete={() => handleDelete(debt.id)}
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
type MainTab = "customers" | "suppliers";

export function Debts() {
  const [tab, setTab] = useState<MainTab>("customers");

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Debts</h2>
        <p className="text-muted-foreground mt-1">Track who owes you and what you owe others.</p>
      </div>

      {/* tab switcher */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("customers")}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all",
            tab === "customers"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Users className="w-4 h-4" />
          Customers Owe Me
        </button>
        <button
          onClick={() => setTab("suppliers")}
          className={cn(
            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all",
            tab === "suppliers"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Building2 className="w-4 h-4" />
          Suppliers I Owe
        </button>
      </div>

      {tab === "customers" ? <DebtPanel kind="customer" /> : <DebtPanel kind="supplier" />}
    </div>
  );
}

import React, { useState } from "react";
import {
  ShoppingBag,
  Trash2,
  Banknote,
  Smartphone,
  AlertCircle,
} from "lucide-react";
import {
  useListAllSales,
  useDeleteSale,
  SaleWithProduct,
} from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

// ─── shared types ────────────────────────────────────────────────────────────
type MethodFilter = "all" | "cash" | "mpesa";
type SaleTypeFilter = "all" | "paid" | "partial" | "credit";

// ─── helpers ─────────────────────────────────────────────────────────────────
// Uses the live remaining balance from the linked debt record when available,
// so settling a debt from the Debts page automatically reclassifies the sale
// here too — no need to touch the sale itself.
function getSaleType(s: SaleWithProduct): "paid" | "partial" | "credit" {
  const debt = s.debtRemaining ?? s.debtAmount ?? 0;
  if (debt <= 0) return "paid";
  if (debt >= s.exactSellingPrice) return "credit";
  return "partial";
}

function PaymentBadge({ method }: { method: string | null | undefined }) {
  if (!method) return null;
  if (method === "cash")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        <Banknote className="w-3 h-3" /> Cash
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
      <Smartphone className="w-3 h-3" /> Mpesa
    </span>
  );
}

function SaleTypeBadge({ sale }: { sale: SaleWithProduct }) {
  const type = getSaleType(sale);
  if (type === "credit")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="w-3 h-3" /> Credit
      </span>
    );
  if (type === "partial")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Partial
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
      Paid
    </span>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Paid sales tab ───────────────────────────────────────────────────────────
function PaidSalesTab() {
  const { data: sales, isLoading } = useListAllSales();
  const deleteSale = useDeleteSale();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState<SaleTypeFilter>("all");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const all = sales ?? [];

  const filtered = all.filter((s) => {
    const type = getSaleType(s);
    const typeMatch = typeFilter === "all" || type === typeFilter;
    // Method filter only applies when money was actually collected (not credit)
    const methodMatch = methodFilter === "all" || (type !== "credit" && s.paymentMethod === methodFilter);
    return typeMatch && methodMatch;
  });

  const totalRevenue  = all.reduce((sum, s) => sum + s.exactSellingPrice, 0);
  const partialDebt   = all.filter((s) => getSaleType(s) === "partial").reduce((sum, s) => sum + (s.debtRemaining ?? s.debtAmount ?? 0), 0);
  const creditOwed    = all.filter((s) => getSaleType(s) === "credit").reduce((sum, s) => sum + (s.debtRemaining ?? s.exactSellingPrice), 0);
  const paidCount     = all.filter((s) => getSaleType(s) === "paid").length;
  const partialCount  = all.filter((s) => getSaleType(s) === "partial").length;
  const creditCount   = all.filter((s) => getSaleType(s) === "credit").length;

  const handleDelete = (id: number) => {
    deleteSale.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listAllSales"] });
          toast({ title: "Sale removed" });
          setConfirmDeleteId(null);
        },
        onError: () =>
          toast({ title: "Failed to remove sale", variant: "destructive" }),
      },
    );
  };

  const TypeBtn = ({ value, label }: { value: SaleTypeFilter; label: string }) => (
    <button
      onClick={() => setTypeFilter(value)}
      className={cn(
        "px-3 py-1 rounded-md text-xs font-semibold transition-all",
        typeFilter === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const MethodBtn = ({ value, label }: { value: MethodFilter; label: string }) => (
    <button
      onClick={() => setMethodFilter(value)}
      className={cn(
        "px-3 py-1 rounded-md text-xs font-semibold transition-all",
        methodFilter === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* summary cards — 4 across */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 border border-primary/40 bg-primary/5">
          <p className="text-xs text-muted-foreground font-medium mb-1">Total revenue</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{all.length} sale{all.length !== 1 ? "s" : ""}</p>
        </div>
        <div
          className="rounded-xl p-4 border border-border bg-card cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setTypeFilter(typeFilter === "paid" ? "all" : "paid")}
        >
          <p className="text-xs text-muted-foreground font-medium mb-1">Paid</p>
          <p className="text-xl font-bold text-primary">{paidCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">fully collected</p>
        </div>
        <div
          className={cn(
            "rounded-xl p-4 border cursor-pointer transition-colors",
            partialCount > 0 ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50" : "border-border bg-card hover:bg-muted/30",
          )}
          onClick={() => setTypeFilter(typeFilter === "partial" ? "all" : "partial")}
        >
          <p className="text-xs text-muted-foreground font-medium mb-1">Partial</p>
          <p className={cn("text-xl font-bold", partialCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{partialCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(partialDebt)} owed</p>
        </div>
        <div
          className={cn(
            "rounded-xl p-4 border cursor-pointer transition-colors",
            creditCount > 0 ? "border-red-400/60 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50" : "border-border bg-card hover:bg-muted/30",
          )}
          onClick={() => setTypeFilter(typeFilter === "credit" ? "all" : "credit")}
        >
          <p className="text-xs text-muted-foreground font-medium mb-1">Credit</p>
          <p className={cn("text-xl font-bold", creditCount > 0 ? "text-red-600 dark:text-red-400" : "text-foreground")}>{creditCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(creditOwed)} owed</p>
        </div>
      </div>

      {/* list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
          {/* type filter */}
          <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
            <TypeBtn value="all" label={`All (${all.length})`} />
            <TypeBtn value="paid" label="Paid" />
            <TypeBtn value="partial" label="Partial" />
            <TypeBtn value="credit" label="Credit" />
          </div>
          {/* payment method filter — hide for credit since it has no payment */}
          {typeFilter !== "credit" && (
            <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
              <MethodBtn value="all" label="All" />
              <MethodBtn value="cash" label="Cash" />
              <MethodBtn value="mpesa" label="Mpesa" />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingBag className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm">No sales recorded yet.</p>
            <p className="text-xs mt-1">Mark products as sold from the Inventory page.</p>
          </div>
        ) : (
          filtered.map((sale) => (
            <SaleRow
              key={sale.id}
              sale={sale}
              onDelete={() => setConfirmDeleteId(sale.id)}
            />
          ))
        )}
      </div>

      {/* confirm delete */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Remove this sale?</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete the sale record. Stock is not restored automatically.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleteSale.isPending}
              >
                {deleteSale.isPending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SaleRow({
  sale,
  onDelete,
}: {
  sale: SaleWithProduct;
  onDelete: () => void;
}) {
  const type = getSaleType(sale);

  return (
    <div className="flex items-center gap-3 p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      {/* product image / placeholder */}
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {sale.productImageUrl ? (
          <img
            src={sale.productImageUrl}
            alt={sale.productName}
            className="w-full h-full object-cover"
          />
        ) : (
          <ShoppingBag className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* details */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-0.5">
          <span className="font-semibold text-foreground truncate">{sale.productName}</span>
          <SaleTypeBadge sale={sale} />
          {/* show payment method only when money was actually collected */}
          {type !== "credit" && <PaymentBadge method={sale.paymentMethod} />}
        </div>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>{formatDate(sale.soldAt)}</span>
          {type === "partial" && (
            <span className="text-amber-600 dark:text-amber-400">
              Owes {formatCurrency(sale.debtRemaining ?? sale.debtAmount ?? 0)}
            </span>
          )}
          {type === "credit" && (
            <span className="text-red-600 dark:text-red-400">
              Full amount owed: {formatCurrency(sale.debtRemaining ?? sale.exactSellingPrice)}
            </span>
          )}
          {sale.notes && <span className="truncate max-w-[180px]">{sale.notes}</span>}
        </div>
      </div>

      {/* amount + delete */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-lg font-bold text-foreground">
          {formatCurrency(sale.exactSellingPrice)}
        </span>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Remove sale"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Sales page ──────────────────────────────────────────────────────────
export function Sales() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* page header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Sales</h2>
        <p className="text-muted-foreground mt-1">
          Track completed sales. Outstanding balances are tracked on the Debts page.
        </p>
      </div>

      <PaidSalesTab />
    </div>
  );
}

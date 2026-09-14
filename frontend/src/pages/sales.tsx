import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Trash2,
  Banknote,
  Smartphone,
  AlertCircle,
  Pencil,
  Loader2,
} from "lucide-react";
import {
  useListAllSales,
  useDeleteSale,
  useUpdateSale,
  getListAllSalesQueryKey,
  getListProductSalesQueryKey,
  type SaleWithProduct,
  type SalePaymentMethod,
} from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

// ─── shared types ────────────────────────────────────────────────────────────
type MethodFilter = "all" | "cash" | "mpesa";
type SaleType = "paid" | "partial" | "credit";
type SaleTypeFilter = "all" | SaleType;

// ─── helpers ─────────────────────────────────────────────────────────────────
// Uses the live remaining balance from the linked debt record when available,
// so settling a debt from the Debts page automatically reclassifies the sale.
function getSaleType(s: SaleWithProduct): SaleType {
  const debt = s.debtRemaining ?? s.debtAmount ?? 0;

  if (debt <= 0) return "paid";
  if (debt >= s.exactSellingPrice) return "credit";

  return "partial";
}

function getRemaining(s: SaleWithProduct): number {
  return Math.max(0, s.debtRemaining ?? s.debtAmount ?? 0);
}

function PaymentBadge({
  method,
}: {
  method: string | null | undefined;
}) {
  if (!method) return null;

  if (method === "cash") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        <Banknote className="w-2.5 h-2.5 md:w-3 md:h-3" />
        Cash
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
      <Smartphone className="w-2.5 h-2.5 md:w-3 md:h-3" />
      Mpesa
    </span>
  );
}

function SaleTypeBadge({ sale }: { sale: SaleWithProduct }) {
  const type = getSaleType(sale);

  if (type === "credit") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="w-2.5 h-2.5 md:w-3 md:h-3" />
        Credit
      </span>
    );
  }

  if (type === "partial") {
    return (
      <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
        Partial
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[9px] md:text-[11px] font-semibold bg-primary/10 text-primary">
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

// ─── Edit sale ───────────────────────────────────────────────────────────────
function EditSaleDialog({
  sale,
  open,
  onOpenChange,
}: {
  sale: SaleWithProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateSale = useUpdateSale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [saleType, setSaleType] = useState<SaleType>("paid");
  const [sellingPrice, setSellingPrice] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<SalePaymentMethod>("cash");
  const [remainingBalance, setRemainingBalance] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !sale) return;

    const type = getSaleType(sale);

    setSaleType(type);
    setSellingPrice(String(sale.exactSellingPrice));
    setPaymentMethod(sale.paymentMethod);
    setRemainingBalance(
      type === "paid" ? "" : String(getRemaining(sale)),
    );
    setCustomerName(sale.customerName ?? "");
    setNotes(sale.notes ?? "");
  }, [open, sale]);

  if (!sale) return null;

  const handleSave = () => {
    const price = Number(sellingPrice);

    if (!Number.isFinite(price) || price <= 0) {
      toast({
        title: "Enter a valid selling price",
        variant: "destructive",
      });
      return;
    }

    let debtAmount = 0;

    if (saleType === "partial") {
      debtAmount = Number(remainingBalance);

      if (
        !Number.isFinite(debtAmount) ||
        debtAmount <= 0 ||
        debtAmount >= price
      ) {
        toast({
          title: "Enter a valid remaining balance",
          description:
            "For a partial sale, the balance must be more than 0 and less than the selling price.",
          variant: "destructive",
        });
        return;
      }
    }

    if (saleType === "credit") {
      debtAmount = price;
    }

    if (debtAmount > 0 && !customerName.trim()) {
      toast({
        title: "Customer name is required",
        description:
          "A customer name is needed so the balance can stay linked to Debts.",
        variant: "destructive",
      });
      return;
    }

    updateSale.mutate(
      {
        id: sale.id,
        data: {
          exactSellingPrice: price,
          paymentMethod,
          debtAmount,
          customerName:
            debtAmount > 0 ? customerName.trim() : undefined,
          notes: notes.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListAllSalesQueryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: getListProductSalesQueryKey(sale.productId),
          });
          queryClient.invalidateQueries({
            queryKey: ["debts", "customers"],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/summary"],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/recent-activity"],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/sales-by-month"],
          });

          toast({ title: "Sale updated" });
          onOpenChange(false);
        },
        onError: (error) => {
          toast({
            title: "Failed to update sale",
            description: error.message,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sale</DialogTitle>
          <DialogDescription>
            {sale.productName}. Any outstanding balance stays linked to the
            customer debt automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Sale type
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(["paid", "partial", "credit"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSaleType(type)}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-semibold capitalize transition-colors",
                    saleType === type
                      ? type === "paid"
                        ? "border-primary bg-primary/10 text-primary"
                        : type === "partial"
                          ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                          : "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                      : "border-border text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Selling price (KSh)
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
            />
          </div>

          {saleType === "partial" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Amount still owed (KSh)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={remainingBalance}
                onChange={(e) => setRemainingBalance(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                This is the live remaining balance that will appear in Debts.
              </p>
            </div>
          )}

          {(saleType === "partial" || saleType === "credit") && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Customer name
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Jane Wanjiru"
              />
            </div>
          )}

          {saleType !== "credit" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Payment method
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5",
                    paymentMethod === "cash"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Cash
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod("mpesa")}
                  className={cn(
                    "h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5",
                    paymentMethod === "mpesa"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mpesa
                </button>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Notes
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              disabled={updateSale.isPending}
            >
              {updateSale.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {updateSale.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sale row ────────────────────────────────────────────────────────────────
function SaleRow({
  sale,
  onEdit,
  onDelete,
}: {
  sale: SaleWithProduct;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const type = getSaleType(sale);
  const remaining = getRemaining(sale);

  return (
    <div className="p-3 md:p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2.5 md:gap-3">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
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

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-xs md:text-sm text-foreground truncate">
                {sale.productName}
              </p>

              <div className="flex flex-wrap items-center gap-1 mt-1">
                <SaleTypeBadge sale={sale} />
                {type !== "credit" && (
                  <PaymentBadge method={sale.paymentMethod} />
                )}
              </div>
            </div>

            <p className="text-sm md:text-lg font-bold text-foreground shrink-0">
              {formatCurrency(sale.exactSellingPrice)}
            </p>
          </div>

          <div className="mt-1.5 flex items-end justify-between gap-2">
            <div className="min-w-0 text-[10px] md:text-xs text-muted-foreground space-y-0.5">
              <p>{formatDate(sale.soldAt)}</p>

              {remaining > 0 && (
                <p
                  className={cn(
                    "font-medium",
                    type === "credit"
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-600 dark:text-amber-400",
                  )}
                >
                  {sale.customerName ? `${sale.customerName} · ` : ""}
                  Owes {formatCurrency(remaining)}
                </p>
              )}

              {sale.notes && (
                <p className="truncate max-w-[190px] md:max-w-[360px]">
                  {sale.notes}
                </p>
              )}
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={onEdit}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Edit sale"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onDelete}
                className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Remove sale"
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

// ─── Sales content ───────────────────────────────────────────────────────────
function PaidSalesTab() {
  const { data: sales, isLoading } = useListAllSales();
  const deleteSale = useDeleteSale();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [typeFilter, setTypeFilter] =
    useState<SaleTypeFilter>("all");
  const [methodFilter, setMethodFilter] =
    useState<MethodFilter>("all");
  const [confirmDeleteId, setConfirmDeleteId] =
    useState<number | null>(null);
  const [editingSale, setEditingSale] =
    useState<SaleWithProduct | null>(null);

  const all = sales ?? [];

  const filtered = all.filter((sale) => {
    const type = getSaleType(sale);

    const typeMatch =
      typeFilter === "all" || type === typeFilter;

    const methodMatch =
      methodFilter === "all" ||
      (type !== "credit" &&
        sale.paymentMethod === methodFilter);

    return typeMatch && methodMatch;
  });

  // "Collected" is actual cash/M-Pesa received, rather than the full value
  // of sales that may still contain outstanding credit.
  const totalCollected = all.reduce(
    (sum, sale) =>
      sum +
      Math.max(
        0,
        sale.exactSellingPrice - getRemaining(sale),
      ),
    0,
  );

  const partialDebt = all
    .filter((sale) => getSaleType(sale) === "partial")
    .reduce((sum, sale) => sum + getRemaining(sale), 0);

  const creditOwed = all
    .filter((sale) => getSaleType(sale) === "credit")
    .reduce((sum, sale) => sum + getRemaining(sale), 0);

  const paidCount = all.filter(
    (sale) => getSaleType(sale) === "paid",
  ).length;

  const partialCount = all.filter(
    (sale) => getSaleType(sale) === "partial",
  ).length;

  const creditCount = all.filter(
    (sale) => getSaleType(sale) === "credit",
  ).length;

  const handleDelete = (id: number) => {
    const sale = all.find((item) => item.id === id);

    deleteSale.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: getListAllSalesQueryKey(),
          });

          if (sale) {
            queryClient.invalidateQueries({
              queryKey: getListProductSalesQueryKey(
                sale.productId,
              ),
            });
          }

          queryClient.invalidateQueries({
            queryKey: ["debts", "customers"],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/summary"],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/recent-activity"],
          });
          queryClient.invalidateQueries({
            queryKey: ["/api/dashboard/sales-by-month"],
          });

          toast({ title: "Sale removed" });
          setConfirmDeleteId(null);
        },
        onError: () =>
          toast({
            title: "Failed to remove sale",
            variant: "destructive",
          }),
      },
    );
  };

  const TypeBtn = ({
    value,
    label,
  }: {
    value: SaleTypeFilter;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setTypeFilter(value)}
      className={cn(
        "px-2.5 md:px-3 py-1 rounded-md text-[10px] md:text-xs font-semibold transition-all whitespace-nowrap",
        typeFilter === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const MethodBtn = ({
    value,
    label,
  }: {
    value: MethodFilter;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setMethodFilter(value)}
      className={cn(
        "px-2.5 md:px-3 py-1 rounded-md text-[10px] md:text-xs font-semibold transition-all whitespace-nowrap",
        methodFilter === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3 md:space-y-4">
      {/* compact summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        <div className="rounded-xl p-3 md:p-4 border border-primary/40 bg-primary/5">
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium mb-0.5 md:mb-1">
            Collected
          </p>
          <p className="text-base md:text-xl font-bold text-primary truncate">
            {formatCurrency(totalCollected)}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
            {all.length} sale{all.length !== 1 ? "s" : ""}
          </p>
        </div>

        <button
          type="button"
          className="rounded-xl p-3 md:p-4 border border-border bg-card text-left hover:bg-muted/30 transition-colors"
          onClick={() =>
            setTypeFilter(
              typeFilter === "paid" ? "all" : "paid",
            )
          }
        >
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium mb-0.5 md:mb-1">
            Paid
          </p>
          <p className="text-base md:text-xl font-bold text-primary">
            {paidCount}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
            fully collected
          </p>
        </button>

        <button
          type="button"
          className={cn(
            "rounded-xl p-3 md:p-4 border text-left transition-colors",
            partialCount > 0
              ? "border-amber-400/60 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100/50"
              : "border-border bg-card hover:bg-muted/30",
          )}
          onClick={() =>
            setTypeFilter(
              typeFilter === "partial" ? "all" : "partial",
            )
          }
        >
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium mb-0.5 md:mb-1">
            Partial
          </p>
          <p
            className={cn(
              "text-base md:text-xl font-bold",
              partialCount > 0
                ? "text-amber-600 dark:text-amber-400"
                : "text-foreground",
            )}
          >
            {partialCount}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">
            {formatCurrency(partialDebt)} owed
          </p>
        </button>

        <button
          type="button"
          className={cn(
            "rounded-xl p-3 md:p-4 border text-left transition-colors",
            creditCount > 0
              ? "border-red-400/60 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100/50"
              : "border-border bg-card hover:bg-muted/30",
          )}
          onClick={() =>
            setTypeFilter(
              typeFilter === "credit" ? "all" : "credit",
            )
          }
        >
          <p className="text-[10px] md:text-xs text-muted-foreground font-medium mb-0.5 md:mb-1">
            Credit
          </p>
          <p
            className={cn(
              "text-base md:text-xl font-bold",
              creditCount > 0
                ? "text-red-600 dark:text-red-400"
                : "text-foreground",
            )}
          >
            {creditCount}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">
            {formatCurrency(creditOwed)} owed
          </p>
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-2.5 md:px-4 py-2.5 md:py-3 border-b border-border bg-muted/30 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-2">
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1 w-max">
              <TypeBtn
                value="all"
                label={`All (${all.length})`}
              />
              <TypeBtn value="paid" label="Paid" />
              <TypeBtn value="partial" label="Partial" />
              <TypeBtn value="credit" label="Credit" />
            </div>
          </div>

          {typeFilter !== "credit" && (
            <div className="overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1 w-max">
                <MethodBtn value="all" label="All" />
                <MethodBtn value="cash" label="Cash" />
                <MethodBtn value="mpesa" label="Mpesa" />
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-3 md:p-4 space-y-2 md:space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-20 md:h-16 w-full rounded-lg"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 md:py-16 text-muted-foreground">
            <ShoppingBag className="w-7 h-7 md:w-8 md:h-8 mb-2.5 md:mb-3 opacity-30" />
            <p className="text-sm">
              No matching sales.
            </p>
            <p className="text-xs mt-1">
              Sales are recorded from Inventory.
            </p>
          </div>
        ) : (
          filtered.map((sale) => (
            <SaleRow
              key={sale.id}
              sale={sale}
              onEdit={() => setEditingSale(sale)}
              onDelete={() =>
                setConfirmDeleteId(sale.id)
              }
            />
          ))
        )}
      </div>

      <EditSaleDialog
        sale={editingSale}
        open={editingSale !== null}
        onOpenChange={(open) => {
          if (!open) setEditingSale(null);
        }}
      />

      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card border border-border rounded-2xl p-5 md:p-6 max-w-sm w-full mx-4 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />

              <div>
                <p className="font-semibold text-foreground">
                  Remove this sale?
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  This permanently deletes the sale and its linked
                  customer debt. Stock is not restored automatically.
                </p>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() =>
                  handleDelete(confirmDeleteId)
                }
                disabled={deleteSale.isPending}
              >
                {deleteSale.isPending
                  ? "Removing…"
                  : "Remove"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Sales page ─────────────────────────────────────────────────────────
export function Sales() {
  return (
    <div className="space-y-3 md:space-y-5 animate-in fade-in duration-500">
      <div>
        <h2 className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
          Sales
        </h2>

        <p className="hidden md:block text-muted-foreground mt-1">
          Track completed sales. Outstanding balances stay synchronized
          with the Debts page.
        </p>
      </div>

      <PaidSalesTab />
    </div>
  );
}

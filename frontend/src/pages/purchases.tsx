import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  PackagePlus,
  ReceiptText,
  Truck,
  Wallet,
} from "lucide-react";

import {
  useListStockPurchases,
  type StockPurchase,
} from "@workspace/api-client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StockPurchaseDialog } from "@/components/dialogs/stock-purchase-dialog";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function itemsCount(purchase: StockPurchase) {
  return purchase.items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
}

function PurchaseRow({
  purchase,
}: {
  purchase: StockPurchase;
}) {
  const unitCount = itemsCount(purchase);
  const isPaid = purchase.supplierBalance <= 0;

  return (
    <div className="flex items-center gap-3 px-3 py-3.5 md:px-4 md:py-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <Truck className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-xs md:text-sm font-medium text-foreground truncate">
            {purchase.supplierName}
          </p>

          <span
            className={cn(
              "inline-flex px-1.5 py-0.5 rounded-full text-[9px] md:text-[10px] font-medium shrink-0",
              isPaid
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400",
            )}
          >
            {isPaid ? "Paid" : "Balance"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5 text-[10px] md:text-xs text-muted-foreground">
          <span>{formatDate(purchase.purchaseDate)}</span>
          <span>·</span>
          <span>
            {unitCount} unit{unitCount === 1 ? "" : "s"}
          </span>

          {purchase.sharedCostsTotal > 0 && (
            <>
              <span>·</span>
              <span>
                {formatCurrency(
                  purchase.sharedCostsTotal,
                )} shared costs
              </span>
            </>
          )}
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs md:text-sm font-semibold text-foreground tabular-nums">
          {formatCurrency(purchase.totalCost)}
        </p>

        {!isPaid && (
          <p className="text-[9px] md:text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
            {formatCurrency(
              purchase.supplierBalance,
            )} owed
          </p>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 hidden sm:block" />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 md:p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] md:text-xs font-medium text-muted-foreground">
            {label}
          </p>

          <p className="text-base md:text-xl font-semibold text-foreground mt-1 truncate tabular-nums">
            {value}
          </p>

          <p className="text-[9px] md:text-[11px] text-muted-foreground mt-0.5">
            {helper}
          </p>
        </div>

        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

export function Purchases() {
  const [dialogOpen, setDialogOpen] =
    useState(false);

  const {
    data: purchases = [],
    isLoading,
  } = useListStockPurchases();

  const stats = useMemo(() => {
    const now = new Date();

    const thisMonth = purchases.filter(
      (purchase) => {
        const date = new Date(
          purchase.purchaseDate,
        );

        return (
          date.getFullYear() ===
            now.getFullYear() &&
          date.getMonth() ===
            now.getMonth()
        );
      },
    );

    const procurementValue = purchases.reduce(
      (sum, purchase) =>
        sum + purchase.totalCost,
      0,
    );

    const cashDeployed = purchases.reduce(
      (sum, purchase) =>
        sum + purchase.amountPaid,
      0,
    );

    const supplierBalance = purchases.reduce(
      (sum, purchase) =>
        sum + purchase.supplierBalance,
      0,
    );

    const thisMonthValue = thisMonth.reduce(
      (sum, purchase) =>
        sum + purchase.totalCost,
      0,
    );

    return {
      procurementValue,
      cashDeployed,
      supplierBalance,
      purchaseCount: purchases.length,
      thisMonthCount: thisMonth.length,
      thisMonthValue,
    };
  }, [purchases]);

  return (
    <div className="space-y-3 md:space-y-5 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-foreground">
            Purchases
          </h2>

          <p className="hidden md:block text-sm text-muted-foreground mt-1">
            Track every stock purchase, the cash invested, shared costs and supplier balances.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="h-8 px-2.5 md:h-9 md:px-4 shrink-0"
        >
          <PackagePlus className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-2" />

          <span className="hidden md:inline">
            Record Purchase
          </span>

          <span className="md:hidden ml-1">
            Record
          </span>
        </Button>
      </div>

      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          {Array.from({ length: 4 }).map(
            (_, i) => (
              <Skeleton
                key={i}
                className="h-24 rounded-2xl"
              />
            ),
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
          <SummaryCard
            icon={ReceiptText}
            label="Stock purchased"
            value={formatCurrency(
              stats.procurementValue,
            )}
            helper={`${stats.purchaseCount} purchase${
              stats.purchaseCount === 1
                ? ""
                : "s"
            } recorded`}
          />

          <SummaryCard
            icon={Wallet}
            label="Cash deployed"
            value={formatCurrency(
              stats.cashDeployed,
            )}
            helper="Cash already paid"
          />

          <SummaryCard
            icon={Truck}
            label="Supplier balance"
            value={formatCurrency(
              stats.supplierBalance,
            )}
            helper="Still owed to suppliers"
          />

          <SummaryCard
            icon={CalendarDays}
            label="This month"
            value={formatCurrency(
              stats.thisMonthValue,
            )}
            helper={`${stats.thisMonthCount} purchase${
              stats.thisMonthCount === 1
                ? ""
                : "s"
            }`}
          />
        </div>
      )}

      {/* Purchase history */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-sm md:text-base font-semibold text-foreground">
              Purchase history
            </h3>

            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
              Every procurement is preserved for stock costing and future profit calculations.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          {isLoading ? (
            <div className="p-3 space-y-2.5">
              {Array.from({ length: 4 }).map(
                (_, i) => (
                  <Skeleton
                    key={i}
                    className="h-16 rounded-lg"
                  />
                ),
              )}
            </div>
          ) : purchases.length > 0 ? (
            purchases.map((purchase) => (
              <PurchaseRow
                key={purchase.id}
                purchase={purchase}
              />
            ))
          ) : (
            <div className="py-14 px-5 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                <PackagePlus className="w-5 h-5" />
              </div>

              <p className="text-sm font-medium text-foreground">
                No stock purchases yet
              </p>

              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Record the next stock purchase here. Inventory, supplier balances and landed costs will update automatically.
              </p>

              <Button
                type="button"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setDialogOpen(true)
                }
              >
                <PackagePlus className="w-4 h-4 mr-2" />
                Record first purchase
              </Button>
            </div>
          )}
        </div>
      </section>

      <StockPurchaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
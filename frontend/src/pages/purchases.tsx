import React, { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Hash,
  Package,
  PackagePlus,
  ReceiptText,
  Truck,
  MoreVertical,
  Pencil,
  CreditCard,
  Trash2,
} from "lucide-react";

import {
  useListStockPurchases,
  useDeleteStockPurchase,
  getListStockPurchasesQueryKey,
  type StockPurchase,
} from "@workspace/api-client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StockPurchaseDialog } from "@/components/dialogs/stock-purchase-dialog";
import {
  RecordPaymentDialog,
  type Debt,
} from "@/components/dialogs/debt-dialog";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(
    "en-KE",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  );
}

function purchaseLabel(
  purchase: StockPurchase,
) {
  return (
    purchase.purchaseNumber ??
    `Purchase #${purchase.id}`
  );
}

function paymentLabel(
  purchase: StockPurchase,
) {
  if (purchase.paymentStatus === "paid") {
    return "Paid";
  }

  if (
    purchase.paymentStatus ===
    "partially_paid"
  ) {
    return "Part paid";
  }

  return "Not paid";
}

function purchaseGroups(
  purchase: StockPurchase,
) {
  if (purchase.stockGroups.length > 0) {
    return purchase.stockGroups.map(
      (group) => ({
        key: `group-${group.id}`,
        name: group.category,
        quantity: group.quantity,
        description: group.description,
      }),
    );
  }

  // Historical purchases created before the simplified
  // stock-group model.
  return purchase.legacyItems.map(
    (item) => ({
      key: `legacy-${item.id}`,
      name:
        item.productName ??
        "Stock item",
      quantity: item.quantity,
      description: null,
    }),
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────

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
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm md:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-muted-foreground md:text-xs">
            {label}
          </p>

          <p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground md:text-xl">
            {value}
          </p>

          <p className="mt-0.5 text-[9px] text-muted-foreground md:text-[11px]">
            {helper}
          </p>
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Purchase card ────────────────────────────────────────────────────────────

function PurchaseCard({
  purchase,
  onEdit,
}: {
  purchase: StockPurchase;
  onEdit: (purchase: StockPurchase) => void;
}) {
  const [expanded, setExpanded] =
    useState(false);

  const [deleteOpen, setDeleteOpen] =
    useState(false);

  const [paymentOpen, setPaymentOpen] =
    useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deletePurchase =
    useDeleteStockPurchase({
      mutation: {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey:
              getListStockPurchasesQueryKey(),
          });

          await queryClient.invalidateQueries({
            queryKey: [
              "/api/debts/suppliers",
            ],
          });

          setDeleteOpen(false);

          toast({
            title: "Purchase deleted",
            description: `${purchaseLabel(
              purchase,
            )} was removed.`,
          });
        },

        onError: (error) => {
          toast({
            title:
              "Could not delete purchase",
            description: error.message,
            variant: "destructive",
          });
        },
      },
    });

  const handleDelete = () => {
    deletePurchase.mutate({
      id: purchase.id,
    });
  };

  const groups =
    purchaseGroups(purchase);

  const paymentDebt: Debt | null =
    purchase.supplierDebtId != null &&
    purchase.supplierBalance > 0
      ? {
          id: purchase.supplierDebtId,
          name: purchase.supplierName,
          phone:
            purchase.supplierPhone ??
            null,
          description: `${purchaseLabel(
            purchase,
          )} stock purchase`,
          amount: purchase.totalCost,
          amountPaid:
            purchase.totalCost -
            purchase.supplierBalance,
          remaining:
            purchase.supplierBalance,
          dueDate: null,
          notes:
            purchase.notes ?? null,
          createdAt:
            purchase.createdAt,
          updatedAt:
            purchase.updatedAt,
        }
      : null;

  const isPaid =
    purchase.paymentStatus === "paid";

  const isPartial =
    purchase.paymentStatus ===
    "partially_paid";

  return (
    <article className="border-b border-border last:border-b-0">
      <div className="flex items-start transition-colors hover:bg-muted/25">
        <button
          type="button"
          onClick={() =>
            setExpanded((current) => !current)
          }
          className="min-w-0 flex-1 px-3 py-4 text-left md:px-5"
        >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ReceiptText className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-xs font-semibold text-foreground md:text-sm">
                {purchaseLabel(purchase)}
              </p>

              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[9px] font-medium md:text-[10px]",
                  isPaid
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : isPartial
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "bg-red-500/10 text-red-700 dark:text-red-400",
                )}
              >
                {paymentLabel(purchase)}
              </span>
            </div>

            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-muted-foreground md:text-xs">
              <span>
                {formatDate(
                  purchase.purchaseDate,
                )}
              </span>

              <span>·</span>

              <span className="truncate">
                {purchase.supplierName}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {groups
                .slice(0, 3)
                .map((group) => (
                  <span
                    key={group.key}
                    className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground md:text-[11px]"
                  >
                    {group.name}
                    <span className="ml-1 font-semibold text-foreground">
                      × {group.quantity}
                    </span>
                  </span>
                ))}

              {groups.length > 3 && (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground md:text-[11px]">
                  +{groups.length - 3} more
                </span>
              )}
            </div>

            <p className="mt-2 text-[10px] text-muted-foreground md:text-xs">
              {purchase.totalQuantity}{" "}
              {purchase.totalQuantity === 1
                ? "item"
                : "items"}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold tabular-nums text-foreground md:text-sm">
              {formatCurrency(
                purchase.totalCost,
              )}
            </p>

            {!isPaid && (
              <p className="mt-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400 md:text-[11px]">
                {formatCurrency(
                  purchase.supplierBalance,
                )}{" "}
                owed
              </p>
            )}

            <div className="mt-2 flex justify-end text-muted-foreground">
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </div>
        </div>
        </button>

        <div className="shrink-0 py-3 pr-2 md:pr-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label={`Actions for ${purchaseLabel(
                  purchase,
                )}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-44"
            >
              <DropdownMenuItem
                onSelect={() =>
                  onEdit(purchase)
                }
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit purchase
              </DropdownMenuItem>

              {paymentDebt && (
                <DropdownMenuItem
                  onSelect={() =>
                    setPaymentOpen(true)
                  }
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Record payment
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() =>
                  setDeleteOpen(true)
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete purchase
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-muted/15 px-3 py-4 md:px-5">
          <div className="grid gap-5 md:grid-cols-2">
            {/* Stock */}

            <section>
              <div className="mb-2 flex items-center gap-2">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />

                <h4 className="text-xs font-semibold text-foreground">
                  Stock bought
                </h4>
              </div>

              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.key}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {group.name}
                      </p>

                      {group.description && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {
                            group.description
                          }
                        </p>
                      )}
                    </div>

                    <span className="shrink-0 text-xs font-semibold tabular-nums">
                      × {group.quantity}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-between px-1 text-xs">
                <span className="text-muted-foreground">
                  Total stock
                </span>

                <span className="font-semibold tabular-nums">
                  {purchase.totalQuantity}{" "}
                  {purchase.totalQuantity ===
                  1
                    ? "item"
                    : "items"}
                </span>
              </div>
            </section>

            {/* Money */}

            <section>
              <div className="mb-2 flex items-center gap-2">
                <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" />

                <h4 className="text-xs font-semibold text-foreground">
                  Purchase cost
                </h4>
              </div>

              <div className="rounded-xl border border-border bg-background p-3">
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Stock cost
                    </span>

                    <span className="tabular-nums">
                      {formatCurrency(
                        purchase.goodsTotal,
                      )}
                    </span>
                  </div>

                  {purchase.sharedCosts.map(
                    (cost) => (
                      <div
                        key={cost.id}
                        className="flex justify-between gap-4"
                      >
                        <span className="truncate text-muted-foreground">
                          {cost.label}
                        </span>

                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(
                            cost.amount,
                          )}
                        </span>
                      </div>
                    ),
                  )}

                  {purchase.sharedCostsTotal >
                    0 &&
                    purchase.sharedCosts
                      .length === 0 && (
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          Additional costs
                        </span>

                        <span className="tabular-nums">
                          {formatCurrency(
                            purchase.sharedCostsTotal,
                          )}
                        </span>
                      </div>
                    )}

                  <div className="border-t border-border pt-2">
                    <div className="flex justify-between gap-4 font-semibold">
                      <span>
                        Total investment
                      </span>

                      <span className="tabular-nums">
                        {formatCurrency(
                          purchase.totalCost,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Paid
                    </span>

                    <span className="tabular-nums">
                      {formatCurrency(
                        purchase.amountPaid,
                      )}
                    </span>
                  </div>

                  {purchase.supplierBalance >
                    0 && (
                    <div className="flex justify-between gap-4 font-medium text-amber-700 dark:text-amber-400">
                      <span>
                        Supplier balance
                      </span>

                      <span className="tabular-nums">
                        {formatCurrency(
                          purchase.supplierBalance,
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {(purchase.reference ||
            purchase.notes ||
            purchase.supplierPhone) && (
            <section className="mt-5 border-t border-border pt-4">
              <h4 className="mb-2 text-xs font-semibold text-foreground">
                Other details
              </h4>

              <div className="grid gap-2 text-xs sm:grid-cols-2">
                {purchase.reference && (
                  <div className="flex gap-2">
                    <Hash className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />

                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        Reference
                      </p>

                      <p className="break-words text-foreground">
                        {purchase.reference}
                      </p>
                    </div>
                  </div>
                )}

                {purchase.supplierPhone && (
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Supplier phone
                    </p>

                    <p className="text-foreground">
                      {
                        purchase.supplierPhone
                      }
                    </p>
                  </div>
                )}

                {purchase.notes && (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] text-muted-foreground">
                      Notes
                    </p>

                    <p className="whitespace-pre-wrap text-foreground">
                      {purchase.notes}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {paymentDebt && (
        <RecordPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          kind="supplier"
          debt={paymentDebt}
        />
      )}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{" "}
              {purchaseLabel(purchase)}?
            </AlertDialogTitle>

            <AlertDialogDescription>
              This will permanently remove
              this purchase
              {purchase.supplierDebtId
                ? " and its linked supplier debt and payment history."
                : "."}{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                deletePurchase.isPending
              }
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={
                deletePurchase.isPending
              }
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePurchase.isPending
                ? "Deleting…"
                : "Delete purchase"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Purchases() {
  const [dialogOpen, setDialogOpen] =
    useState(false);

  const [
    editingPurchase,
    setEditingPurchase,
  ] = useState<StockPurchase | null>(
    null,
  );

  const {
    data: purchases = [],
    isLoading,
  } = useListStockPurchases();

  const stats = useMemo(() => {
    const now = new Date();

    const totalInvested =
      purchases.reduce(
        (sum, purchase) =>
          sum + purchase.totalCost,
        0,
      );

    const totalItems =
      purchases.reduce(
        (sum, purchase) =>
          sum + purchase.totalQuantity,
        0,
      );

    const supplierBalance =
      purchases.reduce(
        (sum, purchase) =>
          sum +
          purchase.supplierBalance,
        0,
      );

    const thisMonth =
      purchases.filter((purchase) => {
        const date = new Date(
          purchase.purchaseDate,
        );

        return (
          date.getFullYear() ===
            now.getFullYear() &&
          date.getMonth() ===
            now.getMonth()
        );
      });

    const thisMonthValue =
      thisMonth.reduce(
        (sum, purchase) =>
          sum + purchase.totalCost,
        0,
      );

    return {
      totalInvested,
      totalItems,
      supplierBalance,
      thisMonthValue,
      purchaseCount:
        purchases.length,
      thisMonthCount:
        thisMonth.length,
    };
  }, [purchases]);

  return (
    <div className="space-y-3 animate-in fade-in duration-500 md:space-y-5">
      {/* Header */}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground md:text-3xl">
            Purchases
          </h2>

          <p className="mt-1 hidden text-sm text-muted-foreground md:block">
            A simple record of stock bought
            and money invested in the
            business.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => {
            setEditingPurchase(null);
            setDialogOpen(true);
          }}
          className="h-8 shrink-0 px-2.5 md:h-9 md:px-4"
        >
          <PackagePlus className="h-3.5 w-3.5 md:mr-2 md:h-4 md:w-4" />

          <span className="hidden md:inline">
            Record Purchase
          </span>

          <span className="ml-1 md:hidden">
            Record
          </span>
        </Button>
      </div>

      {/* Summary */}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
          {Array.from({
            length: 4,
          }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-24 rounded-2xl"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:gap-3 lg:grid-cols-4">
          <SummaryCard
            icon={ReceiptText}
            label="Total invested"
            value={formatCurrency(
              stats.totalInvested,
            )}
            helper={`${stats.purchaseCount} purchase${
              stats.purchaseCount === 1
                ? ""
                : "s"
            } recorded`}
          />

          <SummaryCard
            icon={Package}
            label="Stock bought"
            value={stats.totalItems.toLocaleString(
              "en-KE",
            )}
            helper="Items recorded in purchases"
          />

          <SummaryCard
            icon={Truck}
            label="Amount owed"
            value={formatCurrency(
              stats.supplierBalance,
            )}
            helper="Outstanding supplier balance"
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

      {/* History */}

      <section>
        <div className="mb-2">
          <h3 className="text-sm font-semibold text-foreground md:text-base">
            Purchase history
          </h3>

          <p className="mt-0.5 text-[10px] text-muted-foreground md:text-xs">
            Tap a purchase to see its stock,
            costs and payment details.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="space-y-2.5 p-3">
              {Array.from({
                length: 4,
              }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-24 rounded-xl"
                />
              ))}
            </div>
          ) : purchases.length > 0 ? (
            purchases.map(
              (purchase) => (
                <PurchaseCard
                  key={purchase.id}
                  purchase={purchase}
                  onEdit={(selected) => {
                    setEditingPurchase(
                      selected,
                    );
                    setDialogOpen(true);
                  }}
                />
              ),
            )
          ) : (
            <div className="flex flex-col items-center px-5 py-14 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <PackagePlus className="h-5 w-5" />
              </div>

              <p className="text-sm font-medium text-foreground">
                No purchases yet
              </p>

              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                Record stock purchases here
                to keep track of how much
                stock came in, how much was
                invested and what is still
                owed to suppliers.
              </p>

              <Button
                type="button"
                size="sm"
                className="mt-4"
                onClick={() =>
                  setDialogOpen(true)
                }
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                Record first purchase
              </Button>
            </div>
          )}
        </div>
      </section>

      <StockPurchaseDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);

          if (!open) {
            setEditingPurchase(null);
          }
        }}
        purchase={editingPurchase}
      />
    </div>
  );
}

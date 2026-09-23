import React, { useEffect, useMemo, useState } from "react";
import {
  PackagePlus,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";

import {
  useCreateStockPurchase,
  useUpdateStockPurchase,
  type StockPurchase,
} from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

interface StockPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /**
   * When supplied, the dialog edits this purchase.
   * Otherwise it records a new purchase.
   */
  purchase?: StockPurchase | null;
}

interface StockGroupDraft {
  id: string;
  category: string;
  quantity: number;
  description: string;
}

interface SharedCostDraft {
  id: string;
  label: string;
  amount: number;
}

type PaymentMode = "full" | "partial" | "unpaid";

const COMMON_CATEGORIES = [
  "Handbags",
  "Shoes",
  "Dresses",
  "Clothes",
  "Accessories",
  "Other",
];

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function todayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();

  return new Date(
    now.getTime() - offset * 60_000,
  )
    .toISOString()
    .split("T")[0];
}

function roundMoney(value: number) {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function makeStockGroup(): StockGroupDraft {
  return {
    id: makeId(),
    category: "Handbags",
    quantity: 1,
    description: "",
  };
}

function makeTransportCost(): SharedCostDraft {
  return {
    id: makeId(),
    label: "Transport",
    amount: 0,
  };
}

export function StockPurchaseDialog({
  open,
  onOpenChange,
  purchase = null,
}: StockPurchaseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createPurchase =
    useCreateStockPurchase();

  const updatePurchase =
    useUpdateStockPurchase();

  const isEditing = Boolean(purchase);

  const [purchaseDate, setPurchaseDate] =
    useState(todayString());

  const [supplierName, setSupplierName] =
    useState("");

  const [supplierPhone, setSupplierPhone] =
    useState("");

  const [reference, setReference] =
    useState("");

  const [stockGroups, setStockGroups] =
    useState<StockGroupDraft[]>([
      makeStockGroup(),
    ]);

  const [goodsTotal, setGoodsTotal] =
    useState(0);

  const [sharedCosts, setSharedCosts] =
    useState<SharedCostDraft[]>([
      makeTransportCost(),
    ]);

  const [paymentMode, setPaymentMode] =
    useState<PaymentMode>("full");

  const [partialAmount, setPartialAmount] =
    useState(0);

  const [notes, setNotes] = useState("");

  // Populate the form whenever the dialog opens.
  //
  // Create mode starts with a clean purchase.
  // Edit mode uses the existing procurement details.
  // Payment history is intentionally not edited here.
  useEffect(() => {
    if (!open) return;

    if (purchase) {
      setPurchaseDate(
        purchase.purchaseDate.slice(0, 10),
      );

      setSupplierName(
        purchase.supplierName,
      );

      setSupplierPhone(
        purchase.supplierPhone ?? "",
      );

      setReference(
        purchase.reference ?? "",
      );

      setStockGroups(
        purchase.stockGroups.map(
          (group) => ({
            id: makeId(),
            category: group.category,
            quantity: group.quantity,
            description:
              group.description ?? "",
          }),
        ),
      );

      setGoodsTotal(
        purchase.goodsTotal,
      );

      setSharedCosts(
        purchase.sharedCosts.map(
          (cost) => ({
            id: makeId(),
            label: cost.label,
            amount: cost.amount,
          }),
        ),
      );

      setNotes(
        purchase.notes ?? "",
      );

      // These values are only used by Create mode.
      // Keeping them aligned prevents misleading
      // calculations while the dialog initializes.
      if (
        purchase.amountPaid <= 0
      ) {
        setPaymentMode("unpaid");
        setPartialAmount(0);
      } else if (
        purchase.amountPaid >=
        purchase.totalCost
      ) {
        setPaymentMode("full");
        setPartialAmount(
          purchase.amountPaid,
        );
      } else {
        setPaymentMode("partial");
        setPartialAmount(
          purchase.amountPaid,
        );
      }

      return;
    }

    setPurchaseDate(todayString());
    setSupplierName("");
    setSupplierPhone("");
    setReference("");

    setStockGroups([
      makeStockGroup(),
    ]);

    setGoodsTotal(0);

    setSharedCosts([
      makeTransportCost(),
    ]);

    setPaymentMode("full");
    setPartialAmount(0);
    setNotes("");
  }, [open, purchase]);

  const totalQuantity = useMemo(
    () =>
      stockGroups.reduce(
        (sum, group) =>
          sum + (group.quantity || 0),
        0,
      ),
    [stockGroups],
  );

  const sharedCostsTotal = useMemo(
    () =>
      roundMoney(
        sharedCosts.reduce(
          (sum, cost) =>
            sum + (cost.amount || 0),
          0,
        ),
      ),
    [sharedCosts],
  );

  const totalCost = roundMoney(
    goodsTotal + sharedCostsTotal,
  );

  const amountPaid =
    isEditing && purchase
      ? purchase.amountPaid
      : paymentMode === "full"
        ? totalCost
        : paymentMode === "unpaid"
          ? 0
          : partialAmount;

  const supplierBalance = Math.max(
    0,
    roundMoney(totalCost - amountPaid),
  );

  const addStockGroup = () => {
    setStockGroups((current) => [
      ...current,
      makeStockGroup(),
    ]);
  };

  const removeStockGroup = (
    id: string,
  ) => {
    setStockGroups((current) =>
      current.filter(
        (group) => group.id !== id,
      ),
    );
  };

  const updateStockGroup = (
    id: string,
    patch: Partial<StockGroupDraft>,
  ) => {
    setStockGroups((current) =>
      current.map((group) =>
        group.id === id
          ? { ...group, ...patch }
          : group,
      ),
    );
  };

  const addSharedCost = () => {
    setSharedCosts((current) => [
      ...current,
      {
        id: makeId(),
        label: "",
        amount: 0,
      },
    ]);
  };

  const removeSharedCost = (
    id: string,
  ) => {
    setSharedCosts((current) =>
      current.filter(
        (cost) => cost.id !== id,
      ),
    );
  };

  const updateSharedCost = (
    id: string,
    patch: Partial<SharedCostDraft>,
  ) => {
    setSharedCosts((current) =>
      current.map((cost) =>
        cost.id === id
          ? { ...cost, ...patch }
          : cost,
      ),
    );
  };

  const validate = () => {
    if (!purchaseDate) {
      toast({
        title: "Purchase date is required",
        variant: "destructive",
      });

      return false;
    }

    if (!supplierName.trim()) {
      toast({
        title: "Supplier is required",
        description:
          "Enter where the stock was bought.",
        variant: "destructive",
      });

      return false;
    }

    if (stockGroups.length === 0) {
      toast({
        title: "Add stock",
        description:
          "Add at least one stock group.",
        variant: "destructive",
      });

      return false;
    }

    for (const group of stockGroups) {
      if (!group.category.trim()) {
        toast({
          title: "Choose a category",
          variant: "destructive",
        });

        return false;
      }

      if (
        !Number.isInteger(
          group.quantity,
        ) ||
        group.quantity <= 0
      ) {
        toast({
          title: "Check stock quantity",
          description:
            "Each stock group needs a whole-number quantity greater than zero.",
          variant: "destructive",
        });

        return false;
      }
    }

    if (goodsTotal <= 0) {
      toast({
        title: "Enter the stock cost",
        description:
          "Enter the total amount paid or charged for the goods themselves.",
        variant: "destructive",
      });

      return false;
    }

    for (const cost of sharedCosts) {
      if (cost.amount < 0) {
        toast({
          title:
            "Additional costs cannot be negative",
          variant: "destructive",
        });

        return false;
      }

      if (
        cost.amount > 0 &&
        !cost.label.trim()
      ) {
        toast({
          title:
            "Name the additional cost",
          description:
            "For example Transport, Packaging or Loading.",
          variant: "destructive",
        });

        return false;
      }
    }

    if (
      !isEditing &&
      paymentMode === "partial" &&
      partialAmount <= 0
    ) {
      toast({
        title: "Enter amount paid",
        description:
          "Enter the amount that was actually paid.",
        variant: "destructive",
      });

      return false;
    }

    if (
      !isEditing &&
      paymentMode === "partial" &&
      partialAmount >= totalCost
    ) {
      toast({
        title:
          "Check the payment amount",
        description:
          "For a part payment, the amount paid must be less than the purchase total. Choose Paid in full if everything was paid.",
        variant: "destructive",
      });

      return false;
    }

    return true;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    const commonData = {
      supplierName:
        supplierName.trim(),

      supplierPhone:
        supplierPhone.trim() ||
        undefined,

      purchaseDate,

      stockGroups:
        stockGroups.map(
          (group) => ({
            category:
              group.category.trim(),

            quantity:
              group.quantity,

            description:
              group.description.trim() ||
              undefined,
          }),
        ),

      goodsTotal,

      sharedCosts:
        sharedCosts
          .filter(
            (cost) =>
              cost.amount > 0 &&
              cost.label.trim(),
          )
          .map((cost) => ({
            label:
              cost.label.trim(),

            amount: cost.amount,
          })),

      reference:
        reference.trim() ||
        undefined,

      notes:
        notes.trim() ||
        undefined,
    };

    if (purchase) {
      updatePurchase.mutate(
        {
          id: purchase.id,
          data: commonData,
        },
        {
          onSuccess: async (
            updatedPurchase,
          ) => {
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: [
                  "/api/stock-purchases",
                ],
              }),

              queryClient.invalidateQueries({
                queryKey: [
                  "/api/stock-purchases",
                  purchase.id,
                ],
              }),

              queryClient.invalidateQueries({
                queryKey: [
                  "/api/debts/suppliers",
                ],
              }),

              queryClient.invalidateQueries({
                queryKey: [
                  "debts",
                  "suppliers",
                ],
              }),
            ]);

            toast({
              title:
                "Purchase updated",

              description:
                `${updatedPurchase.purchaseNumber ?? "Purchase"} saved successfully.`,
            });

            onOpenChange(false);
          },

          onError: (error) => {
            toast({
              title:
                "Could not update purchase",

              description:
                error.message ||
                "Please try again.",

              variant: "destructive",
            });
          },
        },
      );

      return;
    }

    createPurchase.mutate(
      {
        data: {
          ...commonData,
          amountPaid,
        },
      },
      {
        onSuccess: async (
          createdPurchase,
        ) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: [
                "/api/stock-purchases",
              ],
            }),

            queryClient.invalidateQueries({
              queryKey: [
                "/api/debts/suppliers",
              ],
            }),

            queryClient.invalidateQueries({
              queryKey: [
                "debts",
                "suppliers",
              ],
            }),
          ]);

          toast({
            title:
              "Purchase recorded",

            description:
              createdPurchase.supplierBalance >
              0
                ? `${createdPurchase.purchaseNumber ?? "Purchase"} saved. ${formatCurrency(
                    createdPurchase.supplierBalance,
                  )} remains payable to the supplier.`
                : `${createdPurchase.purchaseNumber ?? "Purchase"} saved successfully.`,
          });

          onOpenChange(false);
        },

        onError: (error) => {
          toast({
            title:
              "Could not record purchase",

            description:
              error.message ||
              "Please try again.",

            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="
          max-h-[92dvh]
          overflow-y-auto
          p-0
          sm:max-w-xl
        "
      >
        <DialogHeader className="border-b px-4 pb-4 pt-5 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {isEditing
              ? "Edit purchase"
              : "Record purchase"}
          </DialogTitle>

          <DialogDescription>
            {isEditing
              ? "Correct the purchase details. Existing payments are kept unchanged."
              : "Record the stock bought and money invested. Keep it quick."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-4 py-5 sm:px-6">
          {/* Basic details */}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">
                Purchase details
              </h3>

              <p className="mt-0.5 text-xs text-muted-foreground">
                When and where the stock
                was bought.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Date
                </label>

                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) =>
                    setPurchaseDate(
                      event.target.value,
                    )
                  }
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Supplier / source
                </label>

                <Input
                  value={supplierName}
                  onChange={(event) =>
                    setSupplierName(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Kamukunji"
                />
              </div>
            </div>

            <details className="rounded-xl border bg-muted/10">
              <summary className="cursor-pointer px-3.5 py-3 text-xs font-medium text-muted-foreground">
                More purchase details
                (optional)
              </summary>

              <div className="grid gap-3 border-t p-3.5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Supplier phone
                  </label>

                  <Input
                    value={supplierPhone}
                    onChange={(event) =>
                      setSupplierPhone(
                        event.target.value,
                      )
                    }
                    placeholder="07..."
                    inputMode="tel"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    Receipt / reference
                  </label>

                  <Input
                    value={reference}
                    onChange={(event) =>
                      setReference(
                        event.target.value,
                      )
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>
            </details>
          </section>

          {/* Stock */}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Stock bought
                </h3>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Group the stock instead
                  of entering every product.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addStockGroup}
                className="h-8 shrink-0 px-2 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {stockGroups.map(
                (group, index) => (
                  <div
                    key={group.id}
                    className="rounded-xl border bg-card p-3"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_90px_auto] items-end gap-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">
                          Category
                        </label>

                        <select
                          value={
                            group.category
                          }
                          onChange={(
                            event,
                          ) =>
                            updateStockGroup(
                              group.id,
                              {
                                category:
                                  event
                                    .target
                                    .value,
                              },
                            )
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          {COMMON_CATEGORIES.map(
                            (category) => (
                              <option
                                key={
                                  category
                                }
                                value={
                                  category
                                }
                              >
                                {
                                  category
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">
                          Quantity
                        </label>

                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={
                            group.quantity
                          }
                          onChange={(
                            event,
                          ) =>
                            updateStockGroup(
                              group.id,
                              {
                                quantity:
                                  Math.max(
                                    0,
                                    Math.floor(
                                      Number(
                                        event
                                          .target
                                          .value,
                                      ) ||
                                        0,
                                    ),
                                  ),
                              },
                            )
                          }
                          inputMode="numeric"
                        />
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={
                          stockGroups.length ===
                          1
                        }
                        onClick={() =>
                          removeStockGroup(
                            group.id,
                          )
                        }
                        className="h-10 w-9 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove stock group ${
                          index + 1
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <Input
                      value={
                        group.description
                      }
                      onChange={(event) =>
                        updateStockGroup(
                          group.id,
                          {
                            description:
                              event.target
                                .value,
                          },
                        )
                      }
                      placeholder="Short description (optional)"
                      className="mt-2 h-9 text-xs"
                    />
                  </div>
                ),
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-muted/45 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Total stock
              </span>

              <span className="text-sm font-semibold tabular-nums">
                {totalQuantity}{" "}
                {totalQuantity === 1
                  ? "item"
                  : "items"}
              </span>
            </div>
          </section>

          {/* Goods cost */}

          <section className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold">
                Stock cost
              </h3>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Total cost of the goods,
                before transport and other
                costs.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Amount for stock
              </label>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  KSh
                </span>

                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={
                    goodsTotal || ""
                  }
                  onChange={(event) =>
                    setGoodsTotal(
                      Math.max(
                        0,
                        Number(
                          event.target
                            .value,
                        ) || 0,
                      ),
                    )
                  }
                  placeholder="0"
                  inputMode="decimal"
                  className="pl-12 text-base font-medium"
                />
              </div>
            </div>
          </section>

          {/* Extra costs */}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Additional costs
                </h3>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Transport, packaging,
                  loading or other costs.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addSharedCost}
                className="h-8 shrink-0 px-2 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Cost
              </Button>
            </div>

            <div className="space-y-2">
              {sharedCosts.map(
                (cost) => (
                  <div
                    key={cost.id}
                    className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2"
                  >
                    <div className="relative">
                      <Truck className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                      <Input
                        value={cost.label}
                        onChange={(
                          event,
                        ) =>
                          updateSharedCost(
                            cost.id,
                            {
                              label:
                                event
                                  .target
                                  .value,
                            },
                          )
                        }
                        placeholder="Transport"
                        className="pl-9"
                      />
                    </div>

                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={
                        cost.amount || ""
                      }
                      onChange={(
                        event,
                      ) =>
                        updateSharedCost(
                          cost.id,
                          {
                            amount:
                              Math.max(
                                0,
                                Number(
                                  event
                                    .target
                                    .value,
                                ) ||
                                  0,
                              ),
                          },
                        )
                      }
                      placeholder="0"
                      inputMode="decimal"
                    />

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        removeSharedCost(
                          cost.id,
                        )
                      }
                      className="h-10 w-9 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ),
              )}

              {sharedCosts.length ===
                0 && (
                <button
                  type="button"
                  onClick={
                    addSharedCost
                  }
                  className="w-full rounded-lg border border-dashed py-3 text-xs text-muted-foreground hover:bg-muted/40"
                >
                  + Add transport or
                  another cost
                </button>
              )}
            </div>
          </section>

          {/* Payment */}

          {isEditing && purchase ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold">
                  Payment
                </h3>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Payments are managed separately so payment history stays accurate.
                </p>
              </div>

              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Already paid
                  </span>

                  <span className="font-semibold tabular-nums">
                    {formatCurrency(
                      purchase.amountPaid,
                    )}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Balance after changes
                  </span>

                  <span className="font-semibold tabular-nums">
                    {formatCurrency(
                      supplierBalance,
                    )}
                  </span>
                </div>
              </div>
            </section>
          ) : (
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">
                Payment
              </h3>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Any unpaid amount becomes
                supplier debt automatically.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() =>
                  setPaymentMode(
                    "full",
                  )
                }
                className={`rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                  paymentMode === "full"
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Paid in full
              </button>

              <button
                type="button"
                onClick={() =>
                  setPaymentMode(
                    "partial",
                  )
                }
                className={`rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                  paymentMode ===
                  "partial"
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Part payment
              </button>

              <button
                type="button"
                onClick={() =>
                  setPaymentMode(
                    "unpaid",
                  )
                }
                className={`rounded-xl border px-2 py-3 text-xs font-medium transition-colors ${
                  paymentMode ===
                  "unpaid"
                    ? "border-primary bg-primary/10 text-primary"
                    : "bg-background text-muted-foreground hover:bg-muted/40"
                }`}
              >
                Not paid
              </button>
            </div>

            {paymentMode ===
              "partial" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Amount paid
                </label>

                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                    KSh
                  </span>

                  <Input
                    type="number"
                    min={0}
                    max={totalCost}
                    step="0.01"
                    value={
                      partialAmount ||
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      setPartialAmount(
                        Math.max(
                          0,
                          Number(
                            event
                              .target
                              .value,
                          ) || 0,
                        ),
                      )
                    }
                    placeholder="0"
                    inputMode="decimal"
                    className="pl-12"
                  />
                </div>
              </div>
            )}
          </section>
          )}

          {/* Summary */}

          <section className="rounded-2xl bg-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <PackagePlus className="h-4 w-4" />
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Purchase summary
                </p>

                <p className="text-[11px] text-muted-foreground">
                  {totalQuantity}{" "}
                  {totalQuantity === 1
                    ? "item"
                    : "items"}{" "}
                  ·{" "}
                  {
                    stockGroups.length
                  }{" "}
                  stock{" "}
                  {stockGroups.length ===
                  1
                    ? "group"
                    : "groups"}
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Stock
                </span>

                <span className="tabular-nums">
                  {formatCurrency(
                    goodsTotal,
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Additional costs
                </span>

                <span className="tabular-nums">
                  {formatCurrency(
                    sharedCostsTotal,
                  )}
                </span>
              </div>

              <div className="my-2 border-t" />

              <div className="flex justify-between gap-4 text-base font-semibold">
                <span>
                  Total investment
                </span>

                <span className="tabular-nums">
                  {formatCurrency(
                    totalCost,
                  )}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Paid
                </span>

                <span className="tabular-nums">
                  {formatCurrency(
                    amountPaid,
                  )}
                </span>
              </div>

              {supplierBalance >
                0 && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Supplier balance
                  </span>

                  <span className="font-semibold tabular-nums">
                    {formatCurrency(
                      supplierBalance,
                    )}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Notes */}

          <section className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Notes
              <span className="ml-1 font-normal">
                optional
              </span>
            </label>

            <Textarea
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value,
                )
              }
              placeholder="Anything useful about this purchase..."
              className="min-h-[70px] resize-none"
            />
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center gap-3 border-t bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onOpenChange(false)
            }
            disabled={
              isEditing
                ? updatePurchase.isPending
                : createPurchase.isPending
            }
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              isEditing
                ? updatePurchase.isPending
                : createPurchase.isPending
            }
            className="flex-1 sm:ml-auto sm:flex-none"
          >
            {isEditing
              ? updatePurchase.isPending
                ? "Saving..."
                : "Save changes"
              : createPurchase.isPending
                ? "Saving..."
                : "Record purchase"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ImagePlus,
  PackagePlus,
  Plus,
  Trash2,
  Truck,
} from "lucide-react";

import {
  useCreateStockPurchase,
  useListProducts,
  type Product,
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
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type PurchaseItemMode = "existing" | "new";

interface PurchaseItemDraft {
  id: string;
  type: PurchaseItemMode;

  productId: number | null;

  product: {
    name: string;
    category: string;
    price: number;
    imageUrl: string;
    brand: string;
    description: string;
    lowStockThreshold: number;
  };

  quantity: number;
  unitBuyingPrice: number;
}

interface SharedCostDraft {
  id: string;
  label: string;
  amount: number;
}

interface StockPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function makeId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function todayString() {
  return new Date()
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

function makePurchaseItem(): PurchaseItemDraft {
  return {
    id: makeId(),
    type: "existing",
    productId: null,
    product: {
      name: "",
      category: "",
      price: 0,
      imageUrl: "",
      brand: "",
      description: "",
      lowStockThreshold: 1,
    },
    quantity: 1,
    unitBuyingPrice: 0,
  };
}

// ─── Product picker ──────────────────────────────────────────────────────────

function ProductPicker({
  products,
  value,
  onChange,
  disabledProductIds,
}: {
  products: Product[];
  value: number | null;
  onChange: (productId: number) => void;
  disabledProductIds: number[];
}) {
  const [open, setOpen] = useState(false);

  const selected =
    products.find(
      (product) => product.id === value,
    ) ?? null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-background px-3 text-left text-sm transition-colors",
          "hover:bg-muted/40",
          open && "ring-2 ring-ring ring-offset-1",
        )}
      >
        <span
          className={cn(
            "truncate",
            !selected &&
              "text-muted-foreground",
          )}
        >
          {selected
            ? selected.name
            : "Select product"}
        </span>

        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close product picker"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-60 overflow-y-auto rounded-xl border bg-popover p-1.5 shadow-lg">
            {products.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No products available.
              </div>
            ) : (
              products.map((product) => {
                const isSelected =
                  product.id === value;

                const disabled =
                  disabledProductIds.includes(
                    product.id,
                  ) && !isSelected;

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(product.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      !disabled &&
                        "hover:bg-muted",
                      disabled &&
                        "cursor-not-allowed opacity-40",
                    )}
                  >
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <PackagePlus className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {product.name}
                      </p>

                      <p className="truncate text-xs text-muted-foreground">
                        {product.category}
                        {" · "}
                        {product.stock} in stock
                      </p>
                    </div>

                    {isSelected && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

export function StockPurchaseDialog({
  open,
  onOpenChange,
}: StockPurchaseDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products = [] } =
    useListProducts();

  const createPurchase =
    useCreateStockPurchase();

  const [supplierName, setSupplierName] =
    useState("");

  const [supplierPhone, setSupplierPhone] =
    useState("");

  const [purchaseDate, setPurchaseDate] =
    useState(todayString());

  const [amountPaid, setAmountPaid] =
    useState(0);

  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<
    PurchaseItemDraft[]
  >([]);

  const [sharedCosts, setSharedCosts] =
    useState<SharedCostDraft[]>([]);

  // ─── Reset ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    setSupplierName("");
    setSupplierPhone("");
    setPurchaseDate(todayString());
    setAmountPaid(0);
    setNotes("");

    setItems([makePurchaseItem()]);

    setSharedCosts([
      {
        id: makeId(),
        label: "Transport",
        amount: 0,
      },
    ]);
  }, [open]);

  // ─── Calculations ────────────────────────────────────────────────────────

  const goodsTotal = useMemo(
    () =>
      roundMoney(
        items.reduce(
          (sum, item) =>
            sum +
            item.quantity *
              item.unitBuyingPrice,
          0,
        ),
      ),
    [items],
  );

  const sharedCostsTotal = useMemo(
    () =>
      roundMoney(
        sharedCosts.reduce(
          (sum, cost) =>
            sum + cost.amount,
          0,
        ),
      ),
    [sharedCosts],
  );

  const totalCost = roundMoney(
    goodsTotal + sharedCostsTotal,
  );

  const supplierBalance = Math.max(
    0,
    roundMoney(totalCost - amountPaid),
  );

  const selectedProductIds = items
    .filter(
      (item) => item.type === "existing",
    )
    .map((item) => item.productId)
    .filter(
      (id): id is number => id != null,
    );

  // ─── Item actions ────────────────────────────────────────────────────────

  const addItem = () => {
    setItems((current) => [
      ...current,
      makePurchaseItem(),
    ]);
  };

  const removeItem = (id: string) => {
    setItems((current) =>
      current.filter(
        (item) => item.id !== id,
      ),
    );
  };

  const updateItem = (
    id: string,
    patch: Partial<PurchaseItemDraft>,
  ) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, ...patch }
          : item,
      ),
    );
  };

  // ─── Shared cost actions ────────────────────────────────────────────────

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

  const removeSharedCost = (id: string) => {
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

  // ─── Validation ─────────────────────────────────────────────────────────

  const validate = () => {
    if (!supplierName.trim()) {
      toast({
        title: "Supplier is required",
        description:
          "Enter the supplier or source of this stock.",
        variant: "destructive",
      });

      return false;
    }

    if (!purchaseDate) {
      toast({
        title: "Purchase date is required",
        variant: "destructive",
      });

      return false;
    }

    if (items.length === 0) {
      toast({
        title: "Add at least one product",
        variant: "destructive",
      });

      return false;
    }

    for (const item of items) {
      if (
        item.type === "existing" &&
        item.productId == null
      ) {
        toast({
          title: "Select every existing product",
          description:
            "One of the existing-product lines has no product selected.",
          variant: "destructive",
        });

        return false;
      }

      if (item.type === "new") {
        if (!item.product.name.trim()) {
          toast({
            title: "New product name is required",
            description:
              "Enter a name for every new product.",
            variant: "destructive",
          });

          return false;
        }

        if (!item.product.category.trim()) {
          toast({
            title: "New product category is required",
            description:
              "Choose or enter a category for every new product.",
            variant: "destructive",
          });

          return false;
        }

        if (item.product.price < 0) {
          toast({
            title: "Check selling prices",
            description:
              "Selling price cannot be negative.",
            variant: "destructive",
          });

          return false;
        }

        if (
          !Number.isInteger(
            item.product.lowStockThreshold,
          ) ||
          item.product.lowStockThreshold < 0
        ) {
          toast({
            title: "Check low-stock threshold",
            description:
              "Low-stock threshold must be zero or a whole number.",
            variant: "destructive",
          });

          return false;
        }
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        toast({
          title: "Check quantities",
          description:
            "Every quantity must be at least 1.",
          variant: "destructive",
        });

        return false;
      }

      if (item.unitBuyingPrice < 0) {
        toast({
          title: "Check buying prices",
          variant: "destructive",
        });

        return false;
      }
    }

    for (const cost of sharedCosts) {
      if (
        cost.amount > 0 &&
        !cost.label.trim()
      ) {
        toast({
          title: "Name the additional cost",
          description:
            "For example Transport, Packaging or Loading.",
          variant: "destructive",
        });

        return false;
      }

      if (cost.amount < 0) {
        toast({
          title:
            "Additional costs cannot be negative",
          variant: "destructive",
        });

        return false;
      }
    }

    if (amountPaid < 0) {
      toast({
        title:
          "Amount paid cannot be negative",
        variant: "destructive",
      });

      return false;
    }

    if (amountPaid > totalCost) {
      toast({
        title:
          "Amount paid is above the purchase total",
        description:
          "Check the amount paid and try again.",
        variant: "destructive",
      });

      return false;
    }

    return true;
  };

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!validate()) return;

    createPurchase.mutate(
      {
        data: {
          supplierName:
            supplierName.trim(),

          supplierPhone:
            supplierPhone.trim() ||
            undefined,

          purchaseDate,

          items: items.map((item) => {
            if (item.type === "existing") {
              return {
                type: "existing" as const,
                productId:
                  item.productId as number,
                quantity: item.quantity,
                unitBuyingPrice:
                  item.unitBuyingPrice,
              };
            }

            return {
              type: "new" as const,
              product: {
                name: item.product.name.trim(),
                category:
                  item.product.category.trim(),
                price: item.product.price,
                imageUrl:
                  item.product.imageUrl.trim() ||
                  undefined,
                brand:
                  item.product.brand.trim() ||
                  undefined,
                description:
                  item.product.description.trim() ||
                  undefined,
                lowStockThreshold:
                  item.product.lowStockThreshold,
              },
              quantity: item.quantity,
              unitBuyingPrice:
                item.unitBuyingPrice,
            };
          }),

          sharedCosts: sharedCosts
            .filter(
              (cost) =>
                cost.label.trim() &&
                cost.amount > 0,
            )
            .map((cost) => ({
              label: cost.label.trim(),
              amount: cost.amount,
            })),

          amountPaid,

          notes:
            notes.trim() || undefined,
        },
      },
      {
        onSuccess: async (purchase) => {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: [
                "/api/stock-purchases",
              ],
            }),

            queryClient.invalidateQueries({
              queryKey: ["/api/products"],
            }),

            queryClient.invalidateQueries({
              queryKey: [
                "debts",
                "suppliers",
              ],
            }),
          ]);

          toast({
            title: "Stock purchase recorded",
            description:
              purchase.supplierBalance > 0
                ? `${formatCurrency(
                    purchase.supplierBalance,
                  )} supplier balance recorded automatically.`
                : "Inventory has been updated.",
          });

          onOpenChange(false);
        },

        onError: (error) => {
          toast({
            title:
              "Could not record stock purchase",
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
          max-h-[92dvh] overflow-y-auto
          p-0
          sm:max-w-2xl
        "
      >
        {/* Header */}

        <DialogHeader className="border-b px-5 pb-4 pt-5 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Record stock purchase
          </DialogTitle>

          <DialogDescription className="text-sm">
            Add stock once. Inventory and
            supplier balances update
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-7 px-5 py-5 sm:px-6">
          {/* Supplier */}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">
                Purchase details
              </h3>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Where this stock came from.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Supplier
                </label>

                <Input
                  value={supplierName}
                  onChange={(event) =>
                    setSupplierName(
                      event.target.value,
                    )
                  }
                  placeholder="e.g. Kamukunji Fashion"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Phone
                  <span className="ml-1 font-normal">
                    optional
                  </span>
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
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Purchase date
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
          </section>

          {/* Products */}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">
                  Products bought
                </h3>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Enter what you paid the
                  supplier per unit.
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addItem}
                className="h-8 shrink-0 px-2 text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Product
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineTotal =
                  roundMoney(
                    item.quantity *
                      item.unitBuyingPrice,
                  );

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border bg-card p-3.5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Item {index + 1}
                      </span>

                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeItem(
                              item.id,
                            )
                          }
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, {
                              type: "existing",
                            })
                          }
                          className={cn(
                            "rounded-md px-3 py-2 text-xs font-medium transition-colors",
                            item.type === "existing"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          Existing product
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateItem(item.id, {
                              type: "new",
                              productId: null,
                            })
                          }
                          className={cn(
                            "rounded-md px-3 py-2 text-xs font-medium transition-colors",
                            item.type === "new"
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          New product
                        </button>
                      </div>

                      {item.type === "existing" ? (
                        <ProductPicker
                          products={products}
                          value={item.productId}
                          disabledProductIds={
                            selectedProductIds
                          }
                          onChange={(
                            productId,
                          ) => {
                            const product =
                              products.find(
                                (p) =>
                                  p.id ===
                                  productId,
                              );

                            updateItem(
                              item.id,
                              {
                                productId,

                                unitBuyingPrice:
                                  product?.buyingPrice ??
                                  item.unitBuyingPrice,
                              },
                            );
                          }}
                        />
                      ) : (
                        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <ImagePlus className="h-4 w-4 text-primary" />
                            </div>

                            <div>
                              <p className="text-xs font-medium">
                                Create inventory product
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                This product will be created when the purchase is saved.
                              </p>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Product name
                              </label>
                              <Input
                                value={item.product.name}
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    product: {
                                      ...item.product,
                                      name: event.target.value,
                                    },
                                  })
                                }
                                placeholder="e.g. Mini shoulder bag"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Category
                              </label>
                              <Input
                                value={item.product.category}
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    product: {
                                      ...item.product,
                                      category: event.target.value,
                                    },
                                  })
                                }
                                placeholder="e.g. Handbags"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Selling price
                              </label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={item.product.price}
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    product: {
                                      ...item.product,
                                      price: Math.max(
                                        0,
                                        Number(event.target.value) ||
                                          0,
                                      ),
                                    },
                                  })
                                }
                                inputMode="decimal"
                              />
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground">
                                Low-stock alert
                              </label>
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                value={
                                  item.product
                                    .lowStockThreshold
                                }
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    product: {
                                      ...item.product,
                                      lowStockThreshold:
                                        Math.max(
                                          0,
                                          Math.floor(
                                            Number(
                                              event.target
                                                .value,
                                            ) || 0,
                                          ),
                                        ),
                                    },
                                  })
                                }
                                inputMode="numeric"
                              />
                            </div>
                          </div>

                          <details className="rounded-lg border bg-background">
                            <summary className="cursor-pointer px-3 py-2.5 text-xs font-medium text-muted-foreground">
                              Optional product details
                            </summary>

                            <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">
                                  Brand
                                </label>
                                <Input
                                  value={item.product.brand}
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      product: {
                                        ...item.product,
                                        brand:
                                          event.target
                                            .value,
                                      },
                                    })
                                  }
                                  placeholder="Optional"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">
                                  Image URL
                                </label>
                                <Input
                                  value={
                                    item.product.imageUrl
                                  }
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      product: {
                                        ...item.product,
                                        imageUrl:
                                          event.target
                                            .value,
                                      },
                                    })
                                  }
                                  placeholder="Optional"
                                />
                              </div>

                              <div className="space-y-1.5 sm:col-span-2">
                                <label className="text-xs text-muted-foreground">
                                  Description
                                </label>
                                <Textarea
                                  value={
                                    item.product
                                      .description
                                  }
                                  onChange={(event) =>
                                    updateItem(item.id, {
                                      product: {
                                        ...item.product,
                                        description:
                                          event.target
                                            .value,
                                      },
                                    })
                                  }
                                  placeholder="Optional"
                                  className="min-h-[70px] resize-none"
                                />
                              </div>
                            </div>
                          </details>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">
                            Quantity
                          </label>

                          <Input
                            type="number"
                            min={1}
                            step={1}
                            value={
                              item.quantity
                            }
                            onChange={(
                              event,
                            ) =>
                              updateItem(
                                item.id,
                                {
                                  quantity:
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
                            inputMode="numeric"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">
                            Buying price / unit
                          </label>

                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={
                              item.unitBuyingPrice
                            }
                            onChange={(
                              event,
                            ) =>
                              updateItem(
                                item.id,
                                {
                                  unitBuyingPrice:
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
                            inputMode="decimal"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2.5 text-xs">
                        <span className="text-muted-foreground">
                          Goods value
                        </span>

                        <span className="font-medium tabular-nums">
                          {formatCurrency(
                            lineTotal,
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Shared costs */}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">
                  Additional costs
                </h3>

                <p className="mt-0.5 text-xs text-muted-foreground">
                  Shared costs are allocated
                  across these products
                  automatically.
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
                    className="flex items-center gap-2"
                  >
                    <div className="relative min-w-0 flex-1">
                      <Truck className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

                      <Input
                        value={cost.label}
                        onChange={(event) =>
                          updateSharedCost(
                            cost.id,
                            {
                              label:
                                event.target
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
                      value={cost.amount}
                      onChange={(event) =>
                        updateSharedCost(
                          cost.id,
                          {
                            amount:
                              Math.max(
                                0,
                                Number(
                                  event.target
                                    .value,
                                ) || 0,
                              ),
                          },
                        )
                      }
                      placeholder="0"
                      inputMode="decimal"
                      className="w-[120px]"
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
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              )}

              {sharedCosts.length === 0 && (
                <button
                  type="button"
                  onClick={addSharedCost}
                  className="w-full rounded-lg border border-dashed py-3 text-xs text-muted-foreground transition-colors hover:bg-muted/40"
                >
                  + Add transport or another
                  purchase cost
                </button>
              )}
            </div>
          </section>

          {/* Payment */}

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">
                Payment
              </h3>

              <p className="mt-0.5 text-xs text-muted-foreground">
                Enter what you actually paid.
                Any balance becomes supplier
                debt automatically.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Amount paid
              </label>

              <Input
                type="number"
                min={0}
                step="0.01"
                value={amountPaid}
                onChange={(event) =>
                  setAmountPaid(
                    Math.max(
                      0,
                      Number(
                        event.target.value,
                      ) || 0,
                    ),
                  )
                }
                inputMode="decimal"
              />
            </div>
          </section>

          {/* Review */}

          <section className="rounded-xl bg-muted/45 p-4">
            <h3 className="mb-3 text-sm font-medium">
              Purchase summary
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">
                  Goods
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

              <div className="flex justify-between gap-4 font-medium">
                <span>
                  Total purchase
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

              {supplierBalance > 0 && (
                <div className="flex justify-between gap-4 pt-1">
                  <span className="text-muted-foreground">
                    Supplier balance
                  </span>

                  <span className="font-medium tabular-nums">
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
              className="min-h-[80px] resize-none"
            />
          </section>
        </div>

        {/* Footer */}

        <div className="sticky bottom-0 flex items-center gap-3 border-t bg-background/95 px-5 py-4 backdrop-blur sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              onOpenChange(false)
            }
            disabled={
              createPurchase.isPending
            }
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={
              createPurchase.isPending
            }
            className="flex-1 sm:ml-auto sm:flex-none"
          >
            {createPurchase.isPending
              ? "Saving..."
              : "Record purchase"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
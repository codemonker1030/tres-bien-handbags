import React, { useEffect, useMemo, useState } from "react";
import { PackagePlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import {
  getListProductsQueryKey,
  getListStockPurchasesQueryKey,
  useAllocatePurchaseGroup,
  useListProducts,
  type StockPurchaseGroup,
} from "@workspace/api-client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { AddProductDialog } from "@/components/dialogs/add-product-dialog";

interface AddPurchaseStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: StockPurchaseGroup | null;
  purchaseGoodsTotal: number;
  purchaseSharedCostsTotal: number;
}

export function AddPurchaseStockDialog({
  open,
  onOpenChange,
  group,
  purchaseGoodsTotal,
  purchaseSharedCostsTotal,
}: AddPurchaseStockDialogProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [productId, setProductId] = useState<string>("");

  const [quantity, setQuantity] = useState(1);
  const [createProductOpen, setCreateProductOpen] = useState(false);

  const [sizeQuantities, setSizeQuantities] = useState<Record<string, number>>(
    {},
  );

  const productsQuery = useListProducts({
    query: {
      enabled: open,
    },
  });

  const matchingProducts = useMemo(() => {
    if (!group) {
      return [];
    }

    return (productsQuery.data ?? []).filter(
      (product) =>
        product.category.trim().toLowerCase() ===
        group.category.trim().toLowerCase(),
    );
  }, [productsQuery.data, group]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setProductId("");
    setQuantity(1);
    setSizeQuantities({});
  }, [open, group?.id]);

  const allocation = useAllocatePurchaseGroup({
    mutation: {
      onSuccess: async (result) => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: getListStockPurchasesQueryKey(),
          }),

          queryClient.invalidateQueries({
            queryKey: getListProductsQueryKey(),
          }),
        ]);

        toast({
          title: "Stock added to Inventory",
          description: `${result.allocation.quantityAllocated} ${
            result.allocation.quantityAllocated === 1 ? "unit" : "units"
          } added to ${result.product.name}.`,
        });

        onOpenChange(false);
      },

      onError: (error) => {
        toast({
          title: "Could not add stock",
          description: error.message,
          variant: "destructive",
        });
      },
    },
  });

  if (!group) {
    return null;
  }

  const available = group.availableQuantity;

  const groupGoodsTotal = group.quantity * group.unitBuyingPrice;

  const groupShare =
    purchaseGoodsTotal > 0 ? groupGoodsTotal / purchaseGoodsTotal : 0;

  const groupSharedCost = purchaseSharedCostsTotal * groupShare;

  const unitSharedCost =
    group.quantity > 0 ? groupSharedCost / group.quantity : 0;

  const landedUnitCost = group.unitBuyingPrice + unitSharedCost;

  const selectedProduct = matchingProducts.find(
    (product) => String(product.id) === productId,
  );

  const productSizes =
    selectedProduct?.sizes?.filter(
      (size): size is string => typeof size === "string" && size.trim() !== "",
    ) ?? [];

  const usesSizes = productSizes.length > 0;

  const allocatedSizeQuantity = Object.values(sizeQuantities).reduce(
    (total, value) => total + value,
    0,
  );

  const quantityToAllocate = usesSizes ? allocatedSizeQuantity : quantity;

  const canSubmit =
    !!selectedProduct &&
    quantityToAllocate >= 1 &&
    quantityToAllocate <= available &&
    !allocation.isPending;

  const allocateToProduct = (targetProductId: number) => {
    if (
      quantityToAllocate < 1 ||
      quantityToAllocate > available ||
      allocation.isPending
    ) {
      return;
    }

    const allocationSizeQuantities = usesSizes
      ? productSizes
          .map((size) => ({
            size,
            quantity: sizeQuantities[size] ?? 0,
          }))
          .filter((entry) => entry.quantity > 0)
      : undefined;

    allocation.mutate({
      groupId: group.id,
      data: {
        productId: targetProductId,
        quantity: quantityToAllocate,
        sizeQuantities: allocationSizeQuantities,
      },
    });
  };

  const submit = () => {
    if (!selectedProduct || !canSubmit) {
      return;
    }

    allocateToProduct(selectedProduct.id);
  };

  const handleProductCreated = (
    productId: number,
    createdAllocation?: {
      quantity: number;
      sizeQuantities?: Array<{
        size: string;
        quantity: number;
      }>;
    },
  ) => {
    /**
     * AddProductDialog creates purchase-linked products with stock = 0.
     * This allocation is the only operation that moves the purchased
     * quantity into Inventory and creates its cost layer.
     *
     * New sized products return the size distribution entered while the
     * product was being created. Existing products continue to use the
     * allocation controls in this dialog.
     */
    const allocationQuantity =
      createdAllocation?.quantity ?? quantityToAllocate;

    const allocationSizeQuantities = createdAllocation?.sizeQuantities?.filter(
      (entry) => entry.quantity > 0,
    );

    if (
      allocationQuantity < 1 ||
      allocationQuantity > available ||
      allocation.isPending
    ) {
      return;
    }

    allocation.mutate({
      groupId: group.id,
      data: {
        productId,
        quantity: allocationQuantity,
        sizeQuantities:
          allocationSizeQuantities && allocationSizeQuantities.length > 0
            ? allocationSizeQuantities
            : undefined,
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-primary" />
              Add to Inventory
            </DialogTitle>

            <DialogDescription>
              Add purchased stock to an existing product or create a new one.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-xl border border-border bg-muted/25 p-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {group.category}
                  </p>

                  {group.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {group.description}
                    </p>
                  )}
                </div>

                <p className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {formatCurrency(group.unitBuyingPrice)}
                  /unit
                </p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Purchased</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {group.quantity}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground">Added</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums">
                    {group.allocatedQuantity}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground">Available</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-primary">
                    {available}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  Existing Inventory product
                </label>

                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Choose this when the purchased stock belongs to a product
                  already in Inventory.
                </p>
              </div>

              <Select
                value={productId}
                onValueChange={(value) => {
                  setProductId(value);
                  setSizeQuantities({});
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an existing product" />
                </SelectTrigger>

                <SelectContent>
                  {matchingProducts.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name} · {product.stock} in stock
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!productsQuery.isLoading && matchingProducts.length === 0 && (
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  No existing {group.category} products were found in Inventory.
                </p>
              )}

              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />

                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  or
                </span>

                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={allocation.isPending || available <= 0}
                onClick={() => setCreateProductOpen(true)}
              >
                <PackagePlus className="mr-2 h-4 w-4" />
                Create new product
              </Button>

              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Add its name, photos, selling price and product details.
                Purchase cost and stock quantity will remain linked to this
                purchase.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">
                {usesSizes ? "Sizes to add" : "Quantity to add"}
              </label>

              {usesSizes ? (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] text-muted-foreground">
                      Split this purchase across the product sizes.
                    </p>

                    <span className="shrink-0 text-[10px] font-semibold tabular-nums text-primary">
                      {quantityToAllocate} / {available}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {productSizes.map((size) => {
                      const sizeQuantity = sizeQuantities[size] ?? 0;
                      const allocationFull = quantityToAllocate >= available;

                      return (
                        <div
                          key={size}
                          className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground">
                              Size {size}
                            </p>

                            <p className="text-[10px] text-muted-foreground">
                              {sizeQuantity} to Inventory
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={sizeQuantity <= 0}
                              onClick={() =>
                                setSizeQuantities((current) => ({
                                  ...current,
                                  [size]: Math.max(0, (current[size] ?? 0) - 1),
                                }))
                              }
                            >
                              −
                            </Button>

                            <span className="w-7 text-center text-sm font-bold tabular-nums">
                              {sizeQuantity}
                            </span>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              disabled={allocationFull}
                              onClick={() =>
                                setSizeQuantities((current) => ({
                                  ...current,
                                  [size]: (current[size] ?? 0) + 1,
                                }))
                              }
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2 text-[10px]">
                    <span className="text-muted-foreground">
                      Total selected
                    </span>

                    <span className="font-semibold tabular-nums">
                      {quantityToAllocate} of {available} available
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-border p-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={quantity <= 1}
                    onClick={() =>
                      setQuantity((current) => Math.max(1, current - 1))
                    }
                  >
                    −
                  </Button>

                  <div className="text-center">
                    <p className="text-lg font-bold tabular-nums">{quantity}</p>

                    <p className="text-[10px] text-muted-foreground">
                      of {available} available
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    disabled={quantity >= available}
                    onClick={() =>
                      setQuantity((current) => Math.min(available, current + 1))
                    }
                  >
                    +
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-background p-3">
              <p className="mb-3 text-xs font-semibold">Cost allocation</p>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Goods / unit</span>

                  <span className="tabular-nums">
                    {formatCurrency(group.unitBuyingPrice)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Shared cost / unit
                  </span>

                  <span className="tabular-nums">
                    {formatCurrency(unitSharedCost)}
                  </span>
                </div>

                <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                  <span>Landed cost / unit</span>

                  <span className="tabular-nums">
                    {formatCurrency(landedUnitCost)}
                  </span>
                </div>

                <div className="flex justify-between gap-4 pt-1 text-muted-foreground">
                  <span>Allocation value</span>

                  <span className="tabular-nums">
                    {formatCurrency(landedUnitCost * quantityToAllocate)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              type="button"
              className="w-full"
              disabled={!canSubmit}
              onClick={submit}
            >
              <PackagePlus className="mr-2 h-4 w-4" />

              {allocation.isPending
                ? "Adding..."
                : `Add ${quantityToAllocate} ${
                    quantityToAllocate === 1 ? "unit" : "units"
                  } to Inventory`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddProductDialog
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        purchaseMode={{
          category: group.category,
          quantity,
          landedUnitCost,
        }}
        onProductCreated={handleProductCreated}
      />
    </>
  );
}

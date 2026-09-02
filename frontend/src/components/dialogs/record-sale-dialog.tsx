import React, { useState, useEffect } from "react";
import { ShoppingBag, Banknote, Smartphone, CheckCircle2, Clock, CreditCard } from "lucide-react";
import {
  useCreateSale, useGetProduct, getGetProductQueryKey,
  getListProductSalesQueryKey, getListProductsQueryKey,
} from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { CUSTOMER_DEBTS_KEY } from "@/components/dialogs/debt-dialog";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function PaymentBtn({
  label, icon: Icon, selected, onChange,
}: { label: string; icon: React.ElementType; selected: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
        selected
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/50"
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </button>
  );
}

type SaleType = "paid" | "partial" | "credit";

interface RecordSaleDialogProps {
  productId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Records a sale for a single product. Used both from the Product Detail
// page and directly from a product card in the Inventory grid — same form,
// same validation, same behavior, wherever it's opened from.
export function RecordSaleDialog({ productId, open, onOpenChange }: RecordSaleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createSale = useCreateSale();
  const { data: product } = useGetProduct(productId, {
    query: { queryKey: getGetProductQueryKey(productId), enabled: !!productId && open },
  });

  const [exactPrice, setExactPrice] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("paid");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa">("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");

  // Blank slate every time it's opened for a (possibly different) product.
  useEffect(() => {
    if (open) {
      setExactPrice("");
      setSaleType("paid");
      setPaymentMethod("cash");
      setAmountPaid("");
      setCustomerName("");
      setNotes("");
    }
  }, [open, productId]);

  const handleRecordSale = () => {
    const price = parseFloat(exactPrice);
    if (!exactPrice || isNaN(price) || price <= 0) {
      toast({ title: "Enter a valid selling price", variant: "destructive" });
      return;
    }

    let debtAmount: number | undefined;
    let method = paymentMethod;

    if (saleType === "paid") {
      debtAmount = 0;
    } else if (saleType === "partial") {
      const paid = parseFloat(amountPaid);
      if (!amountPaid || isNaN(paid) || paid <= 0) {
        toast({ title: "Enter the amount paid so far", variant: "destructive" });
        return;
      }
      if (paid >= price) {
        toast({ title: "Amount paid cannot exceed the selling price", variant: "destructive" });
        return;
      }
      debtAmount = price - paid;
    } else {
      // credit — nothing paid yet
      debtAmount = price;
      method = "cash"; // default; not meaningful for credit sales
    }

    if ((saleType === "partial" || saleType === "credit") && !customerName.trim()) {
      toast({ title: "Enter the customer's name so the debt can be tracked", variant: "destructive" });
      return;
    }

    createSale.mutate(
      {
        id: productId,
        data: {
          exactSellingPrice: price,
          paymentMethod: method,
          debtAmount,
          customerName: debtAmount && debtAmount > 0 ? customerName.trim() : undefined,
          notes: notes || undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductSalesQueryKey(productId) });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
          if (debtAmount && debtAmount > 0) {
            queryClient.invalidateQueries({ queryKey: CUSTOMER_DEBTS_KEY });
          }
          toast({ title: "Sale recorded!" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to record sale", variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Record a Sale
          </DialogTitle>
          {product && (
            <DialogDescription>
              {product.name} · {product.stock} in stock · Asking {formatCurrency(product.price)}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Sale type selector */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sale Type</label>
            <div className="flex gap-2">
              {(["paid", "partial", "credit"] as SaleType[]).map((type) => {
                const icons = { paid: CheckCircle2, partial: Clock, credit: CreditCard };
                const labels = { paid: "Paid", partial: "Partial", credit: "Credit" };
                const Icon = icons[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSaleType(type)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                      saleType === type
                        ? type === "paid"
                          ? "border-primary bg-primary/10 text-primary"
                          : type === "partial"
                          ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                          : "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        : "border-border bg-card text-muted-foreground hover:border-muted-foreground/40"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {labels[type]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              {saleType === "paid" && "Customer paid the full amount now."}
              {saleType === "partial" && "Customer paid part now — the rest is a debt."}
              {saleType === "credit" && "Nothing paid yet — full amount is owed by the customer."}
            </p>
          </div>

          {/* Selling price */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Selling Price (KSh)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 1750"
              value={exactPrice}
              onChange={(e) => setExactPrice(e.target.value)}
              className="text-base"
            />
          </div>

          {/* Amount paid — only for partial */}
          {saleType === "partial" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount Paid Now (KSh)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 500"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
              {exactPrice && amountPaid && !isNaN(parseFloat(exactPrice)) && !isNaN(parseFloat(amountPaid)) && parseFloat(amountPaid) < parseFloat(exactPrice) && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  Debt remaining: {formatCurrency(parseFloat(exactPrice) - parseFloat(amountPaid))}
                </p>
              )}
            </div>
          )}

          {/* Customer name — required for partial & credit sales */}
          {(saleType === "partial" || saleType === "credit") && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer Name</label>
              <Input
                placeholder="e.g. Jane Wanjiru"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Used to track this debt on the Debts page.
              </p>
            </div>
          )}

          {/* Payment method — not shown for credit */}
          {saleType !== "credit" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Method</label>
              <div className="flex gap-3">
                <PaymentBtn label="Cash" icon={Banknote} selected={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} />
                <PaymentBtn label="M-Pesa" icon={Smartphone} selected={paymentMethod === "mpesa"} onChange={() => setPaymentMethod("mpesa")} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes <span className="text-muted-foreground font-normal normal-case">— optional</span></label>
            <Input placeholder="e.g. Regular customer" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <Button className="w-full" onClick={handleRecordSale} disabled={createSale.isPending}>
            <ShoppingBag className="w-4 h-4 mr-2" />
            {createSale.isPending ? "Recording..." : "Record Sale"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

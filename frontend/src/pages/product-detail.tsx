import React, { useState, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, ShoppingBag, Banknote, Smartphone, Trash2, Package, Edit,
  Clock, CreditCard, Images, LayoutGrid, Boxes, Tags, History as HistoryIcon,
  PlusCircle, RefreshCw,
} from "lucide-react";
import {
  useGetProduct, useListProductSales, useDeleteSale, useDeleteProduct,
  getGetProductQueryKey, getListProductSalesQueryKey, getListProductsQueryKey,
} from "@workspace/api-client";
import type { Product } from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { getTemplateForCategory } from "@/lib/category-templates";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RecordSaleDialog } from "@/components/dialogs/record-sale-dialog";
import { ProductDialog } from "@/components/dialogs/product-dialog";

type StockStatus = "in-stock" | "low-stock" | "out-of-stock";
function getStockStatus(product: Product): StockStatus {
  if (product.stock <= 0) return "out-of-stock";
  if (product.stock <= (product.lowStockThreshold ?? 5)) return "low-stock";
  return "in-stock";
}

type TabKey = "overview" | "inventory" | "attributes" | "gallery" | "history";
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "inventory", label: "Inventory", icon: Boxes },
  { key: "attributes", label: "Attributes", icon: Tags },
  { key: "gallery", label: "Gallery", icon: Images },
  { key: "history", label: "History", icon: HistoryIcon },
];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export function ProductDetail() {
  const [, params] = useRoute("/inventory/:id");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const productId = Number(params?.id);

  const { data: product, isLoading: loadingProduct } = useGetProduct(productId, { query: { queryKey: getGetProductQueryKey(productId), enabled: !!productId } });
  const { data: sales, isLoading: loadingSales } = useListProductSales(productId, { query: { queryKey: getListProductSalesQueryKey(productId), enabled: !!productId } });
  const deleteSale = useDeleteSale();
  const deleteProduct = useDeleteProduct();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteSaleId, setDeleteSaleId] = useState<number | null>(null);
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);

  const template = useMemo(() => getTemplateForCategory(product?.category ?? ""), [product?.category]);

  const confirmDeleteSale = () => {
    if (!deleteSaleId) return;
    deleteSale.mutate({ id: deleteSaleId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductSalesQueryKey(productId) });
        queryClient.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
        toast({ title: "Sale removed" });
      },
      onError: () => toast({ title: "Failed to remove sale", variant: "destructive" }),
      onSettled: () => setDeleteSaleId(null),
    });
  };

  const confirmDeleteProduct = () => {
    deleteProduct.mutate({ id: productId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Product deleted" });
        navigate("/inventory");
      },
      onError: () => {
        toast({ title: "Could not delete product", variant: "destructive" });
        setDeleteProductOpen(false);
      },
    });
  };

  if (loadingProduct) {
    return (
      <div className="space-y-4 animate-in fade-in duration-300 max-w-lg mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Package className="w-12 h-12 mb-3 opacity-30" />
        <p className="font-medium">Product not found</p>
        <Button variant="ghost" className="mt-3" onClick={() => navigate("/inventory")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Inventory
        </Button>
      </div>
    );
  }

  const status = getStockStatus(product);
  const statusLabel = status === "out-of-stock" ? "Out of Stock" : status === "low-stock" ? "Low Stock" : "In Stock";
  const statusClasses =
    status === "out-of-stock" ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900"
    : status === "low-stock" ? "bg-amber-500 text-white"
    : "bg-emerald-500 text-white";

  return (
    <div className="space-y-5 animate-in fade-in duration-300 max-w-lg mx-auto">

      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/inventory")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Inventory
        </button>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditDialogOpen(true)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteProductOpen(true)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Header: large image, name, category, status, stock ── */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} className="w-full aspect-square object-cover" />
        ) : (
          <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground/30">
            <Package className="w-16 h-16" />
          </div>
        )}
        <div className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-foreground">{product.name}</h1>
            <span className={cn("shrink-0 px-2 py-1 rounded-full text-[11px] font-semibold", statusClasses)}>
              {statusLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{template.emoji} {product.category}</span>
            <span className="opacity-40">·</span>
            <span>{product.stock} in stock</span>
          </div>
        </div>
      </div>

      {/* Record a sale */}
      <Button className="w-full" size="lg" onClick={() => setSellDialogOpen(true)} disabled={status === "out-of-stock"}>
        <ShoppingBag className="w-4 h-4 mr-2" />
        Record a Sale
      </Button>

      {/* ── Tabs ── */}
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted/50 p-1 w-max min-w-full">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                activeTab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-in fade-in duration-200">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Product Name</dt>
              <dd className="font-medium text-foreground text-right">{product.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Category</dt>
              <dd className="font-medium text-foreground text-right">{template.emoji} {product.category}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Brand</dt>
              <dd className="font-medium text-foreground text-right">{product.brand || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Selling Price</dt>
              <dd className="font-bold text-primary text-right">{formatCurrency(product.price)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Date Added</dt>
              <dd className="font-medium text-foreground text-right">{formatDate(product.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Last Updated</dt>
              <dd className="font-medium text-foreground text-right">{formatDate(product.updatedAt)}</dd>
            </div>
          </dl>
          {product.description && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">Description</p>
              <p className="text-sm text-foreground">{product.description}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Inventory tab ── */}
      {activeTab === "inventory" && (
        <div className="rounded-2xl border border-border bg-card p-4 animate-in fade-in duration-200">
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Current Quantity</dt>
              <dd className="font-bold text-foreground text-right">{product.stock} units</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Low Stock Alert</dt>
              <dd className="font-medium text-foreground text-right">{product.lowStockThreshold ?? 5} units</dd>
            </div>
            {template.hasSku && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">SKU</dt>
                <dd className="font-medium text-foreground text-right">{product.sku || "—"}</dd>
              </div>
            )}
            {template.hasBarcode && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Barcode</dt>
                <dd className="font-medium text-foreground text-right">{product.barcode || "—"}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Attributes tab — driven entirely by the category template ── */}
      {activeTab === "attributes" && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3 animate-in fade-in duration-200">
          <dl className="space-y-2.5 text-sm">
            {template.attributes.map((attr) => {
              const value = product[attr.key as keyof Product];
              return (
                <div key={attr.key} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{attr.label}</dt>
                  <dd className="font-medium text-foreground text-right">
                    {value != null && value !== "" ? String(value) : "—"}
                  </dd>
                </div>
              );
            })}
          </dl>

          {template.hasColorVariants && product.colorVariants && product.colorVariants.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Color Variants</p>
              <div className="flex flex-wrap gap-1.5">
                {product.colorVariants.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">{c}</span>
                ))}
              </div>
            </div>
          )}

          {template.stockMode === "sizes" && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Sizes & Quantity</p>
              {product.sizeQuantities && product.sizeQuantities.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {product.sizeQuantities.map((sq) => (
                    <div key={sq.size} className="flex items-center justify-between rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm">
                      <span className="font-semibold text-foreground">{sq.size}</span>
                      <span className="text-muted-foreground">{sq.quantity}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No size breakdown recorded.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Gallery tab ── */}
      {activeTab === "gallery" && (
        <div className="animate-in fade-in duration-200">
          {product.images && product.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {product.images.map((url, i) => (
                <img key={url + i} src={url} alt={`${product.name} ${i + 1}`} className="w-full aspect-square object-cover rounded-xl border border-border" />
              ))}
            </div>
          ) : product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="w-full aspect-square object-cover rounded-xl border border-border" />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-muted/30 rounded-xl">
              <Images className="w-10 h-10 opacity-20 mb-2" />
              <p className="text-sm">No photos uploaded yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {activeTab === "history" && (
        <div className="space-y-2 animate-in fade-in duration-200">
          {/* Product created */}
          <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <PlusCircle className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Product created</p>
              <p className="text-xs text-muted-foreground">{formatDate(product.createdAt)}</p>
            </div>
          </div>

          {/* Last updated — only if it actually differs from creation */}
          {product.updatedAt !== product.createdAt && (
            <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Details last updated</p>
                <p className="text-xs text-muted-foreground">{formatDate(product.updatedAt)}</p>
              </div>
            </div>
          )}

          {/* Each sale = a stock-reducing event */}
          {loadingSales ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)
          ) : (
            [...(sales ?? [])].reverse().map((sale) => {
              const remaining = sale.debtRemaining ?? sale.debtAmount ?? 0;
              const isCredit = remaining > 0 && remaining >= sale.exactSellingPrice;
              const isPartial = remaining > 0 && !isCredit;
              return (
                <div key={sale.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                    isCredit ? "bg-red-100 dark:bg-red-900/40"
                    : isPartial ? "bg-amber-100 dark:bg-amber-900/40"
                    : sale.paymentMethod === "mpesa" ? "bg-blue-100 dark:bg-blue-900/40"
                    : "bg-green-100 dark:bg-green-900/40",
                  )}>
                    {isCredit
                      ? <CreditCard className="w-4 h-4 text-red-600 dark:text-red-400" />
                      : isPartial
                      ? <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      : sale.paymentMethod === "mpesa"
                      ? <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      : <Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">Stock sold — 1 unit</span>
                      <span className="font-bold text-foreground text-sm">{formatCurrency(sale.exactSellingPrice)}</span>
                      {isCredit && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Credit</span>}
                      {isPartial && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partial</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(sale.soldAt)}{sale.customerName && ` · ${sale.customerName}`}
                    </p>
                  </div>
                  <button onClick={() => setDeleteSaleId(sale.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}

          {!loadingSales && (sales?.length ?? 0) === 0 && (
            <p className="text-center py-6 text-sm text-muted-foreground">
              No stock or sale activity yet.
            </p>
          )}

          <p className="text-[11px] text-center text-muted-foreground pt-2">
            Shows when this product was created, last edited, and every sale.
            A detailed field-by-field edit log isn't tracked yet.
          </p>
        </div>
      )}

      {/* ── Dialogs ── */}
      <AlertDialog open={deleteSaleId !== null} onOpenChange={open => !open && setDeleteSaleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove sale?</AlertDialogTitle>
            <AlertDialogDescription>This sale record will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSale} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteProductOpen} onOpenChange={setDeleteProductOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove "{product.name}" from your inventory. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteProduct} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RecordSaleDialog productId={productId} open={sellDialogOpen} onOpenChange={setSellDialogOpen} />
      <ProductDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} product={product} />
    </div>
  );
}

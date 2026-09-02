import React, { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Plus,
  Search,
  AlertTriangle,
  Edit,
  Package,
  Banknote,
  Smartphone,
  ShoppingBag,
  Eye,
  Layers,
  Wallet,
  XCircle,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";
import {
  useListProducts,
  Product,
  useListAllSales,
  SaleWithProduct,
} from "@workspace/api-client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { ProductDialog } from "@/components/dialogs/product-dialog";
import { AddProductDialog } from "@/components/dialogs/add-product-dialog";
import { RecordSaleDialog } from "@/components/dialogs/record-sale-dialog";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

// ─── helpers ─────────────────────────────────────────────────────────────────
type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

function getStockStatus(product: Product): StockStatus {
  if (product.stock <= 0) return "out-of-stock";
  if (product.stock <= (product.lowStockThreshold ?? 5)) return "low-stock";
  return "in-stock";
}

// A light, forgiving keyword match — real shop categories are free text, so
// this covers common boutique category names without requiring an exact list.
function getCategoryEmoji(category: string): string {
  const c = category.trim().toLowerCase();
  if (/(hand)?bag|purse|clutch|tote/.test(c)) return "👜";
  if (/dress|gown/.test(c)) return "👗";
  if (/shoe|heel|sandal|boot|sneaker/.test(c)) return "👠";
  if (/scarf|jewel|belt|hat/.test(c)) return "🧣";
  if (/watch/.test(c)) return "⌚";
  if (/wallet/.test(c)) return "👛";
  if (/perfume|fragrance/.test(c)) return "🌸";
  if (/sunglass|glass/.test(c)) return "🕶️";
  return "🏷️";
}

const RECENT_DAYS = 30;
const SECTION_PREVIEW_COUNT = 4;

// Special filter values live alongside real category names in the same
// `activeFilter` string, distinguished by this prefix so they can't collide
// with an actual category someone names "low-stock".
const FILTER_ALL = "all";
const FILTER_LOW_STOCK = "__low-stock";
const FILTER_OUT_OF_STOCK = "__out-of-stock";
const FILTER_RECENT = "__recent";

// ─── stat card (overview bar) ────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  onClick,
  active = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger";
  onClick?: () => void;
  active?: boolean;
}) {
  const toneClasses = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  }[tone];

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={cn(
        "rounded-2xl bg-card border p-4 flex flex-col gap-1 shadow-sm text-left w-full",
        onClick && "transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        active ? "border-primary ring-1 ring-primary" : "border-border",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0", toneClasses)}>
          <Icon className="w-3.5 h-3.5" />
        </span>
      </div>
      <p className="text-xl font-bold leading-tight text-foreground">{value}</p>
    </Wrapper>
  );
}

// ─── stock status badge ──────────────────────────────────────────────────────
function StockBadge({ status, stock }: { status: StockStatus; stock: number }) {
  if (status === "out-of-stock") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900">
        <XCircle className="w-3 h-3" />
        Out of stock
      </span>
    );
  }
  if (status === "low-stock") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500 text-white shadow-sm">
        <AlertTriangle className="w-3 h-3" />
        Low · {stock} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/55 text-white shadow-sm backdrop-blur-sm">
      In stock · {stock}
    </span>
  );
}

// ─── product card (redesigned) ───────────────────────────────────────────────
function ProductCard({
  product,
  onEdit,
  onNavigate,
  onSell,
}: {
  product: Product;
  onEdit: (p: Product) => void;
  onNavigate: (id: number) => void;
  onSell: (id: number) => void;
}) {
  const status = getStockStatus(product);

  return (
    <div className="group rounded-2xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {/* Photo area — tap to view detail */}
      <div
        className="relative aspect-[4/5] bg-muted overflow-hidden cursor-pointer"
        onClick={() => onNavigate(product.id)}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const t = e.target as HTMLImageElement;
              t.style.display = "none";
              t.nextElementSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        {/* Fallback placeholder */}
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40",
            product.imageUrl ? "hidden" : "",
          )}
        >
          <Package className="w-12 h-12" />
          <span className="text-xs mt-2 font-medium uppercase tracking-widest">No photo</span>
        </div>

        {/* Stock status */}
        <div className="absolute top-2.5 left-2.5">
          <StockBadge status={status} stock={product.stock} />
        </div>

        {/* Category badge */}
        <div className="absolute top-2.5 right-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-black/55 text-white shadow-sm backdrop-blur-sm">
            {getCategoryEmoji(product.category)} {product.category}
          </span>
        </div>

        {/* Desktop hover overlay — quick actions: View, Edit, Sell */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 transition-opacity hidden md:flex items-end justify-center pb-3 gap-1.5 opacity-0 group-hover:opacity-100">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs shadow"
            onClick={(e) => { e.stopPropagation(); onNavigate(product.id); }}
          >
            <Eye className="w-3 h-3 mr-1" /> View
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs shadow"
            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
          >
            <Edit className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2 text-xs shadow"
            disabled={status === "out-of-stock"}
            onClick={(e) => { e.stopPropagation(); onSell(product.id); }}
          >
            <ShoppingBag className="w-3 h-3 mr-1" /> Sell
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2">{product.name}</h3>

        {/* Selling price */}
        <p className="text-base font-bold text-primary leading-none mt-auto pt-1.5">
          {formatCurrency(product.price)}
        </p>

        {/* Sell — the primary card action, always visible (not hover-only) so
            it works on mobile too, matching how often it's actually used. */}
        <Button
          size="sm"
          className="w-full h-8 text-xs mt-1"
          disabled={status === "out-of-stock"}
          onClick={(e) => { e.stopPropagation(); onSell(product.id); }}
        >
          <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
          {status === "out-of-stock" ? "Out of stock" : "Sell"}
        </Button>

        {/* Mobile: Edit — View is just tapping the card, Sell is the button above */}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(product); }}
          className="flex items-center justify-center gap-1.5 h-7 text-xs font-medium text-muted-foreground hover:text-foreground mt-0.5 md:hidden"
        >
          <Edit className="w-3.5 h-3.5" /> Edit
        </button>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="p-3.5 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

// ─── category section (collection-browsing view) ────────────────────────────
function CategorySection({
  category,
  products,
  onViewAll,
  ...cardHandlers
}: {
  category: string;
  products: Product[];
  onViewAll: (category: string) => void;
  onEdit: (p: Product) => void;
  onNavigate: (id: number) => void;
  onSell: (id: number) => void;
}) {
  const preview = products.slice(0, SECTION_PREVIEW_COUNT);
  const hasMore = products.length > SECTION_PREVIEW_COUNT;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
          <span className="text-lg leading-none">{getCategoryEmoji(category)}</span>
          {category}
          <span className="text-sm font-normal text-muted-foreground">({products.length})</span>
        </h3>
        {hasMore && (
          <button
            onClick={() => onViewAll(category)}
            className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline underline-offset-2"
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {preview.map((product) => (
          <ProductCard key={product.id} product={product} {...cardHandlers} />
        ))}
      </div>
    </section>
  );
}

function SaleRow({ sale }: { sale: SaleWithProduct }) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="flex items-center gap-3 p-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">
        {sale.productImageUrl ? (
          <img src={sale.productImageUrl} alt={sale.productName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <Package className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground truncate">{sale.productName}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">{formatDate(sale.soldAt)}</span>
          {sale.paymentMethod === "cash" ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              <Banknote className="w-3 h-3" /> Cash
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              <Smartphone className="w-3 h-3" /> Mpesa
            </span>
          )}
          {(sale.debtAmount ?? 0) > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              Debt: {formatCurrency(sale.debtAmount!)}
            </span>
          )}
        </div>
        {sale.notes && (
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sale.notes}</p>
        )}
      </div>

      {/* Price */}
      <div className="shrink-0 text-right">
        <p className="font-bold text-base text-primary">{formatCurrency(sale.exactSellingPrice)}</p>
      </div>
    </div>
  );
}

type MainTab = "stock" | "sold";

export function Inventory() {
  const [mainTab, setMainTab] = useState<MainTab>("stock");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>(FILTER_ALL);
  const [soldSearch, setSoldSearch] = useState("");
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sellProductId, setSellProductId] = useState<number | null>(null);

  const { data: products, isLoading } = useListProducts();
  const { data: allSales, isLoading: isLoadingSales } = useListAllSales();

  // ── derived data ────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    if (!products) return [];
    const seen = new Set<string>();
    const cats: string[] = [];
    for (const p of products) {
      const cat = p.category.trim();
      if (cat && !seen.has(cat.toLowerCase())) {
        seen.add(cat.toLowerCase());
        cats.push(cat);
      }
    }
    return cats.sort((a, b) => a.localeCompare(b));
  }, [products]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const cat of categories) map.set(cat, []);
    for (const p of products ?? []) {
      const cat = p.category.trim();
      map.get(cat)?.push(p);
    }
    return map;
  }, [products, categories]);

  const stats = useMemo(() => {
    const list = products ?? [];
    const inventoryValue = list.reduce((sum, p) => sum + (p.buyingPrice ?? p.price ?? 0) * p.stock, 0);
    const lowStockCount = list.filter((p) => getStockStatus(p) === "low-stock").length;
    const outOfStockCount = list.filter((p) => getStockStatus(p) === "out-of-stock").length;
    const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const recentCount = list.filter((p) => new Date(p.createdAt).getTime() >= recentCutoff).length;
    return {
      totalProducts: list.length,
      categoriesCount: categories.length,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
      recentCount,
    };
  }, [products, categories]);

  // Products matching search alone (used both for the flat filtered view and
  // to decide whether the search itself should collapse the collection view).
  const searchMatchedProducts = useMemo(() => {
    if (!products) return [];
    if (!searchTerm) return products;
    const q = searchTerm.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [products, searchTerm]);

  const isBrowsingCollections = activeFilter === FILTER_ALL && !searchTerm;

  const flatFilteredProducts = useMemo(() => {
    let list = searchMatchedProducts;
    if (activeFilter === FILTER_LOW_STOCK) {
      list = list.filter((p) => getStockStatus(p) === "low-stock");
    } else if (activeFilter === FILTER_OUT_OF_STOCK) {
      list = list.filter((p) => getStockStatus(p) === "out-of-stock");
    } else if (activeFilter === FILTER_RECENT) {
      const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
      list = list
        .filter((p) => new Date(p.createdAt).getTime() >= cutoff)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (activeFilter !== FILTER_ALL) {
      list = list.filter((p) => p.category.trim().toLowerCase() === activeFilter.toLowerCase());
    }
    return list;
  }, [searchMatchedProducts, activeFilter]);

  const filteredSales = useMemo(() => {
    if (!allSales) return [];
    if (!soldSearch) return allSales;
    const q = soldSearch.toLowerCase();
    return allSales.filter(
      (s) =>
        s.productName.toLowerCase().includes(q) ||
        s.paymentMethod.includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q),
    );
  }, [allSales, soldSearch]);

  const totalSalesRevenue = useMemo(
    () => (allSales ?? []).reduce((sum, s) => sum + s.exactSellingPrice, 0),
    [allSales],
  );

  // Clicking an already-active stat card clears back to "All" — a natural
  // toggle rather than a one-way filter you have to hunt for another way to clear.
  const toggleFilter = (value: string) => {
    setActiveFilter((current) => (current === value ? FILTER_ALL : value));
  };

  const cardHandlers = {
    onEdit: (p: Product) => { setEditingProduct(p); setDialogOpen(true); },
    onNavigate: (id: number) => navigate(`/inventory/${id}`),
    onSell: (id: number) => setSellProductId(id),
  };

  const activeFilterLabel =
    activeFilter === FILTER_LOW_STOCK ? "Low Stock"
    : activeFilter === FILTER_OUT_OF_STOCK ? "Out of Stock"
    : activeFilter === FILTER_RECENT ? "Recently Added"
    : activeFilter === FILTER_ALL ? "All"
    : activeFilter;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Inventory</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Your boutique's collection, organized.</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      {/* Main tab: In Stock / Sold */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setMainTab("stock")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
            mainTab === "stock"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          In Stock
          <span className="ml-1.5 text-xs opacity-60">({products?.length ?? 0})</span>
        </button>
        <button
          onClick={() => setMainTab("sold")}
          className={cn(
            "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
            mainTab === "sold"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Sold
          <span className="ml-1.5 text-xs opacity-60">({allSales?.length ?? 0})</span>
        </button>
      </div>

      {/* ── IN STOCK TAB ─────────────────────────────── */}
      {mainTab === "stock" && (
        <>
          {/* Overview stats — the Low Stock / Out of Stock / Recently Added
              cards double as filters; tap one to filter, tap again to clear. */}
          {!isLoading && (products?.length ?? 0) > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon={Package} label="Total Products" value={String(stats.totalProducts)} />
              <StatCard icon={Layers} label="Categories" value={String(stats.categoriesCount)} />
              <StatCard icon={Wallet} label="Inventory Value" value={formatCurrency(stats.inventoryValue)} />
              <StatCard
                icon={AlertTriangle}
                label="Low Stock"
                value={String(stats.lowStockCount)}
                tone="warning"
                onClick={() => toggleFilter(FILTER_LOW_STOCK)}
                active={activeFilter === FILTER_LOW_STOCK}
              />
              <StatCard
                icon={XCircle}
                label="Out of Stock"
                value={String(stats.outOfStockCount)}
                tone="danger"
                onClick={() => toggleFilter(FILTER_OUT_OF_STOCK)}
                active={activeFilter === FILTER_OUT_OF_STOCK}
              />
              <StatCard
                icon={Sparkles}
                label="Recently Added"
                value={String(stats.recentCount)}
                onClick={() => toggleFilter(FILTER_RECENT)}
                active={activeFilter === FILTER_RECENT}
              />
            </div>
          )}

          {/* Filters — category browsing only; Low Stock / Out of Stock /
              Recently Added live as cards above instead of duplicating here. */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!isLoading && (
              <div className="overflow-x-auto flex-1">
                <div className="inline-flex h-9 items-center gap-1 rounded-lg bg-muted/50 p-1 w-max">
                  <button
                    onClick={() => setActiveFilter(FILTER_ALL)}
                    className={cn(
                      "px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                      activeFilter === FILTER_ALL ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    All <span className="ml-1 text-xs opacity-60">({products?.length ?? 0})</span>
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveFilter(cat)}
                      className={cn(
                        "px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                        activeFilter.toLowerCase() === cat.toLowerCase() ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {getCategoryEmoji(cat)} {cat}
                      <span className="ml-1 text-xs opacity-60">({productsByCategory.get(cat)?.length ?? 0})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                className="pl-9 bg-muted/50 border-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : (products?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <Package className="w-8 h-8 opacity-40" />
              </div>
              <p className="font-medium text-foreground">Your inventory is empty</p>
              <p className="text-sm mt-1">Tap Add Product to start building your collection.</p>
            </div>
          ) : isBrowsingCollections && categories.length > 0 ? (
            // ── Collection browsing: one section per category ──────────────
            <div className="space-y-8">
              {categories.map((cat) => (
                <CategorySection
                  key={cat}
                  category={cat}
                  products={productsByCategory.get(cat) ?? []}
                  onViewAll={(c) => setActiveFilter(c)}
                  {...cardHandlers}
                />
              ))}
            </div>
          ) : isBrowsingCollections ? (
            // Safety net: products exist but no category could be derived from
            // them — fall back to a single flat grid rather than a blank page.
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {(products ?? []).map((product) => (
                <ProductCard key={product.id} product={product} {...cardHandlers} />
              ))}
            </div>
          ) : (
            // ── Flat filtered view: a specific filter, category, or search ──
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? (
                    <>Search results for <span className="font-medium text-foreground">"{searchTerm}"</span></>
                  ) : (
                    <>Showing <span className="font-medium text-foreground">{activeFilterLabel}</span></>
                  )}
                  <span className="ml-1.5 opacity-60">({flatFilteredProducts.length})</span>
                </p>
                {(activeFilter !== FILTER_ALL || searchTerm) && (
                  <button
                    onClick={() => { setActiveFilter(FILTER_ALL); setSearchTerm(""); }}
                    className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>
              {flatFilteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {flatFilteredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} {...cardHandlers} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Search className="w-8 h-8 opacity-40" />
                  </div>
                  <p className="font-medium text-foreground">No products found</p>
                  <p className="text-sm mt-1">
                    {searchTerm ? "Try a different search." : "Nothing matches this filter right now."}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── SOLD HISTORY TAB ─────────────────────────── */}
      {mainTab === "sold" && (
        <div className="space-y-4">
          {/* Summary + search */}
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <p className="text-xs text-muted-foreground font-medium">Total revenue from sales</p>
              <p className="text-xl font-bold text-primary mt-0.5">{formatCurrency(totalSalesRevenue)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{allSales?.length ?? 0} sale{(allSales?.length ?? 0) !== 1 ? "s" : ""} recorded</p>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search sales..."
                className="pl-9 bg-muted/50 border-none"
                value={soldSearch}
                onChange={(e) => setSoldSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Sales list */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {isLoadingSales ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-5 w-20 shrink-0" />
                  </div>
                ))}
              </div>
            ) : filteredSales.length > 0 ? (
              filteredSales.map((sale) => <SaleRow key={sale.id} sale={sale} />)
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ShoppingBag className="w-10 h-10 opacity-20 mb-3" />
                <p className="font-medium text-foreground text-sm">No sales yet</p>
                <p className="text-xs mt-1">
                  {soldSearch ? "Try a different search." : "Open a product and tap 'Record a sale'."}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
      />

      <AddProductDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />

      <RecordSaleDialog
        productId={sellProductId ?? 0}
        open={sellProductId !== null}
        onOpenChange={(open) => !open && setSellProductId(null)}
      />
    </div>
  );
}

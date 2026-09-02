import React, { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateProduct, getListProductsQueryKey } from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload, X, Loader2, Check, ChevronLeft, ChevronRight, Package, Plus,
} from "lucide-react";

import {
  CATEGORY_TEMPLATES, sumSizeQuantities,
  type CategoryTemplate, type SizeQuantity,
} from "@/lib/category-templates";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";

// ─── step plan — varies by category, since not every template needs a
// dedicated Variants step (accessories has neither color variants nor
// per-size stock) ──────────────────────────────────────────────────────────
type StepKey = "category" | "basics" | "attributes" | "variants" | "inventory" | "images" | "review";

const STEP_META: Record<StepKey, string> = {
  category: "Category",
  basics: "Basics",
  attributes: "Attributes",
  variants: "Variants",
  inventory: "Inventory",
  images: "Photos",
  review: "Review",
};

function buildSteps(template: CategoryTemplate | null): StepKey[] {
  const steps: StepKey[] = ["category"];
  if (!template) return steps;
  steps.push("basics", "attributes");
  if (template.hasColorVariants || template.stockMode === "sizes") steps.push("variants");
  steps.push("inventory", "images", "review");
  return steps;
}

// ─── form schema — a superset of every template's fields; each template
// only renders (and therefore only fills in) the ones relevant to it ───────
const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  brand: z.string().optional(),
  description: z.string().optional(),
  price: z.coerce.number().min(0.01, "Selling price is required"),
  material: z.string().optional(),
  color: z.string().optional(),
  style: z.string().optional(),
  closureType: z.string().optional(),
  compartments: z.coerce.number().min(0).optional(),
  pattern: z.string().optional(),
  sleeveType: z.string().optional(),
  fit: z.string().optional(),
  season: z.string().optional(),
  shoeType: z.string().optional(),
  stock: z.coerce.number().min(0).optional(),
  lowStockThreshold: z.coerce.number().min(0).optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const defaultValues: FormValues = {
  name: "", brand: "", description: "", price: 0,
  material: "", color: "", style: "", closureType: "", compartments: undefined,
  pattern: "", sleeveType: "", fit: "", season: "", shoeType: "",
  stock: 0, lowStockThreshold: 5, sku: "", barcode: "",
};

interface ImageEntry {
  id: string;
  previewUrl: string;
  uploadedUrl?: string;
  uploading: boolean;
  error?: boolean;
}

// ─── step indicator — dot-per-step, length varies by category ──────────────
function StepIndicator({ steps, currentIndex }: { steps: StepKey[]; currentIndex: number }) {
  return (
    <div className="flex items-center gap-1">
      {steps.map((key, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        return (
          <React.Fragment key={key}>
            <div
              className={cn(
                "flex items-center justify-center w-2 h-2 rounded-full shrink-0 transition-all",
                isDone ? "bg-primary w-2" : isActive ? "bg-primary w-5" : "bg-muted",
              )}
            />
            {i < steps.length - 1 && <div className="h-px flex-1 bg-transparent" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── generic tag-chip input (used for color variants) ──────────────────────
function TagListInput({
  value, onChange, placeholder,
}: { value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={add}><Plus className="w-4 h-4" /></Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── size × quantity table (dresses, shoes) — preset sizes, live total ─────
function SizeQuantityTable({
  sizeOptions, value, onChange,
}: { sizeOptions: string[]; value: SizeQuantity[]; onChange: (v: SizeQuantity[]) => void }) {
  const getQty = (size: string) => value.find((v) => v.size === size)?.quantity ?? 0;
  const setQty = (size: string, quantity: number) => {
    const next = value.filter((v) => v.size !== size);
    if (quantity > 0) next.push({ size, quantity });
    onChange(next);
  };
  const total = sumSizeQuantities(value);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {sizeOptions.map((size) => (
          <div key={size} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
            <span className="text-sm font-semibold text-foreground w-10 shrink-0">{size}</span>
            <Input
              type="number"
              min={0}
              value={getQty(size) || ""}
              onChange={(e) => setQty(size, Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0"
              className="h-8"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
        <span className="text-xs font-semibold text-primary">Total stock</span>
        <span className="text-sm font-bold text-primary">{total} units</span>
      </div>
    </div>
  );
}

// ─── image dropzone step (unchanged from the previous version) ─────────────
function ImageStep({
  images, setImages,
}: { images: ImageEntry[]; setImages: React.Dispatch<React.SetStateAction<ImageEntry[]>> }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const uploadFile = async (entryId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setImages((prev) => prev.map((e) => (e.id === entryId ? { ...e, uploadedUrl: url, uploading: false } : e)));
    } catch {
      setImages((prev) => prev.map((e) => (e.id === entryId ? { ...e, uploading: false, error: true } : e)));
      toast({ title: "One image failed to upload", variant: "destructive" });
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const validFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newEntries: ImageEntry[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      previewUrl: URL.createObjectURL(file),
      uploading: true,
    }));
    setImages((prev) => [...prev, ...newEntries]);
    validFiles.forEach((file, i) => uploadFile(newEntries[i].id, file));
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const entry = prev.find((e) => e.id === id);
      if (entry) URL.revokeObjectURL(entry.previewUrl);
      return prev.filter((e) => e.id !== id);
    });
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 py-10 cursor-pointer transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
      >
        <Upload className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Drag & drop photos here</p>
        <p className="text-xs text-muted-foreground">or click to browse · JPG, PNG, WebP · max 5MB each</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted group">
              <img src={img.previewUrl} alt="" className="w-full h-full object-cover" />
              {i === 0 && !img.uploading && !img.error && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-black/60 text-white">
                  Cover
                </span>
              )}
              {img.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
              {img.error && (
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-red-600 bg-white/90 px-1.5 py-0.5 rounded">Failed</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddProductDialog({ open, onOpenChange }: AddProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();

  const [templateKey, setTemplateKey] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [colorVariants, setColorVariants] = useState<string[]>([]);
  const [sizeQuantities, setSizeQuantities] = useState<SizeQuantity[]>([]);

  const template = useMemo(
    () => CATEGORY_TEMPLATES.find((t) => t.key === templateKey) ?? null,
    [templateKey],
  );
  const steps = useMemo(() => buildSteps(template), [template]);
  const currentStep = steps[stepIndex];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Full reset every time the dialog opens.
  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
      setTemplateKey(null);
      setStepIndex(0);
      setImages([]);
      setColorVariants([]);
      setSizeQuantities([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const price = form.watch("price");
  const flatStock = form.watch("stock");
  const stillUploading = images.some((i) => i.uploading);
  const sizeTotal = sumSizeQuantities(sizeQuantities);

  const stepFieldsFor = (key: StepKey): (keyof FormValues)[] => {
    if (key === "basics") return ["name", "price"];
    if (key === "inventory" && template?.stockMode === "quantity") return ["stock"];
    return [];
  };

  const goNext = async () => {
    if (currentStep === "category" && !template) return;
    const fields = stepFieldsFor(currentStep);
    const valid = fields.length === 0 || (await form.trigger(fields));
    if (valid) setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  const onSubmit = (values: FormValues) => {
    if (!template) return;
    const uploadedUrls = images.filter((i) => i.uploadedUrl).map((i) => i.uploadedUrl!);
    const finalStock = template.stockMode === "sizes" ? sizeTotal : (values.stock ?? 0);

    const payload = {
      name: values.name,
      category: template.label,
      brand: values.brand || undefined,
      description: values.description || undefined,
      price: values.price,
      stock: finalStock,
      lowStockThreshold: values.lowStockThreshold,
      sku: template.hasSku ? (values.sku || undefined) : undefined,
      barcode: template.hasBarcode ? (values.barcode || undefined) : undefined,
      imageUrl: uploadedUrls[0] || undefined,
      images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      material: values.material || undefined,
      color: values.color || undefined,
      style: values.style || undefined,
      closureType: values.closureType || undefined,
      compartments: values.compartments || undefined,
      colorVariants: template.hasColorVariants && colorVariants.length > 0 ? colorVariants : undefined,
      pattern: values.pattern || undefined,
      sleeveType: values.sleeveType || undefined,
      fit: values.fit || undefined,
      season: values.season || undefined,
      shoeType: values.shoeType || undefined,
      sizeQuantities: template.stockMode === "sizes" && sizeQuantities.length > 0 ? sizeQuantities : undefined,
    };

    createProduct.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        toast({ title: "Product added to your collection" });
        onOpenChange(false);
      },
      onError: () => toast({ title: "Failed to create product", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>
            {STEP_META[currentStep]}{template ? ` — ${template.label}` : ""}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator steps={steps} currentIndex={stepIndex} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">

            {/* ── Category ── */}
            {currentStep === "category" && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-right-2 duration-200">
                {CATEGORY_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTemplateKey(t.key)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-2xl border-2 p-5 transition-all",
                      templateKey === t.key
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-muted/30",
                    )}
                  >
                    <span className="text-3xl">{t.emoji}</span>
                    <span className="text-sm font-semibold text-foreground text-center">{t.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ── Basics ── */}
            {currentStep === "basics" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Leather Tote Bag" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Input placeholder="e.g. Michael Kors" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Selling Price (KSh)</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Textarea placeholder="Details a customer would want to know..." rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            )}

            {/* ── Attributes (dynamic per template) ── */}
            {currentStep === "attributes" && template && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                {template.attributes.map((attr) => (
                  <FormField
                    key={attr.key}
                    control={form.control}
                    name={attr.key as keyof FormValues}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{attr.label}</FormLabel>
                        <FormControl>
                          <Input
                            type={attr.type === "number" ? "number" : "text"}
                            placeholder={attr.placeholder}
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}

            {/* ── Variants (color variants OR size×quantity, per template) ── */}
            {currentStep === "variants" && template && (
              <div className="space-y-2 animate-in fade-in slide-in-from-right-2 duration-200">
                {template.hasColorVariants && (
                  <div>
                    <label className="text-sm font-medium leading-none">
                      Color Variants <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">Other colors this item is also available in.</p>
                    <TagListInput value={colorVariants} onChange={setColorVariants} placeholder="e.g. Black — press Enter to add" />
                  </div>
                )}
                {template.stockMode === "sizes" && template.sizeOptions && (
                  <div>
                    <label className="text-sm font-medium leading-none">Sizes & Quantity</label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">Enter how many of each size you have — total stock is calculated automatically.</p>
                    <SizeQuantityTable sizeOptions={template.sizeOptions} value={sizeQuantities} onChange={setSizeQuantities} />
                  </div>
                )}
              </div>
            )}

            {/* ── Inventory ── */}
            {currentStep === "inventory" && template && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="grid grid-cols-2 gap-3">
                  {template.stockMode === "quantity" && (
                    <FormField control={form.control} name="stock" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  )}
                  <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Low Stock Alert</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                {(template.hasSku || template.hasBarcode) && (
                  <div className="grid grid-cols-2 gap-3">
                    {template.hasSku && (
                      <FormField control={form.control} name="sku" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">SKU <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl><Input placeholder="Your own reference code" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    {template.hasBarcode && (
                      <FormField control={form.control} name="barcode" render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Barcode <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl><Input placeholder="If it has one" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                  </div>
                )}
                {template.stockMode === "sizes" && (
                  <p className="text-xs text-muted-foreground">
                    Quantity comes from the sizes you entered on the previous step ({sizeTotal} units total).
                  </p>
                )}
              </div>
            )}

            {/* ── Photos ── */}
            {currentStep === "images" && (
              <div className="animate-in fade-in slide-in-from-right-2 duration-200">
                <ImageStep images={images} setImages={setImages} />
                <p className="text-xs text-center text-muted-foreground mt-2">
                  Photos are optional here — you can always add them later.
                </p>
              </div>
            )}

            {/* ── Review ── */}
            {currentStep === "review" && template && (
              <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-200">
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex gap-3 p-3 border-b border-border">
                    <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                      {images[0]?.previewUrl ? (
                        <img src={images[0].previewUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{form.getValues("name") || "Untitled product"}</p>
                      <p className="text-xs text-muted-foreground">
                        {template.emoji} {template.label}
                        {form.getValues("brand") ? ` · ${form.getValues("brand")}` : ""}
                      </p>
                      <p className="text-sm font-bold text-primary mt-1">{formatCurrency(price ?? 0)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-border text-sm">
                    <div className="p-3 space-y-1">
                      <p className="text-[11px] text-muted-foreground">Stock</p>
                      <p className="font-medium">
                        {template.stockMode === "sizes" ? sizeTotal : (flatStock ?? 0)} units
                      </p>
                    </div>
                    <div className="p-3 space-y-1">
                      <p className="text-[11px] text-muted-foreground">Low stock alert</p>
                      <p className="font-medium">{form.getValues("lowStockThreshold") ?? 5} units</p>
                    </div>
                  </div>
                  <div className="p-3 border-t border-border text-sm space-y-1">
                    {template.attributes.map((attr) => {
                      const val = form.getValues(attr.key as keyof FormValues);
                      if (!val) return null;
                      return <p key={attr.key}><span className="text-muted-foreground">{attr.label}:</span> {String(val)}</p>;
                    })}
                    {colorVariants.length > 0 && (
                      <p><span className="text-muted-foreground">Color variants:</span> {colorVariants.join(", ")}</p>
                    )}
                  </div>
                  {images.length > 1 && (
                    <div className="p-3 border-t border-border text-xs text-muted-foreground">
                      + {images.length - 1} more photo{images.length - 1 !== 1 ? "s" : ""}
                    </div>
                  )}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Check everything looks right, then tap Save to add it to your inventory.
                </p>
              </div>
            )}

            {/* ── Navigation ── */}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <div>
                {stepIndex > 0 && (
                  <Button type="button" variant="ghost" onClick={goBack}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                {stepIndex < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    disabled={(currentStep === "category" && !template) || (currentStep === "images" && stillUploading)}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button type="submit" disabled={createProduct.isPending}>
                    {createProduct.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Save Product
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

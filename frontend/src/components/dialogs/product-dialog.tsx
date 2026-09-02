import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateProduct, useUpdateProduct, Product } from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { getListProductsQueryKey } from "@workspace/api-client";
import { ImageIcon, X, Upload, Link as LinkIcon, Loader2 } from "lucide-react";

import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  buyingPrice: z.coerce.number().min(0).optional(),
  price: z.coerce.number().min(0, "Asking price is required"),
  expectedSellingPrice: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().min(0, "Stock must be 0 or more"),
  lowStockThreshold: z.coerce.number().min(0).optional(),
});

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductDialog({ open, onOpenChange, product }: ProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "", category: "", description: "", imageUrl: "",
      buyingPrice: undefined, price: 0, expectedSellingPrice: undefined,
      stock: 0, lowStockThreshold: 5,
    },
  });

  React.useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          name: product.name,
          category: product.category,
          description: product.description || "",
          imageUrl: product.imageUrl || "",
          buyingPrice: product.buyingPrice ?? undefined,
          price: product.price,
          expectedSellingPrice: product.expectedSellingPrice ?? undefined,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold || 5,
        });
        setImagePreview(product.imageUrl || "");
      } else {
        form.reset({ name: "", category: "", description: "", imageUrl: "", buyingPrice: undefined, price: 0, expectedSellingPrice: undefined, stock: 0, lowStockThreshold: 5 });
        setImagePreview("");
      }
    }
  }, [open, product, form]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      form.setValue("imageUrl", url);
      setImagePreview(url);
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearImage = () => {
    setImagePreview("");
    form.setValue("imageUrl", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const payload = {
      ...values,
      imageUrl: values.imageUrl || undefined,
      buyingPrice: values.buyingPrice || undefined,
      expectedSellingPrice: values.expectedSellingPrice || undefined,
    };
    if (product) {
      updateProduct.mutate({ id: product.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Product updated" });
          onOpenChange(false);
        },
        onError: () => toast({ title: "Failed to update product", variant: "destructive" }),
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          toast({ title: "Product added" });
          onOpenChange(false);
          form.reset();
          setImagePreview("");
        },
        onError: () => toast({ title: "Failed to create product", variant: "destructive" }),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Edit Product" : "Add Product"}</DialogTitle>
          <DialogDescription>
            {product ? "Update product details." : "Add a new product to your inventory."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input placeholder="e.g. Leather Tote Bag" {...field} data-testid="input-product-name" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="category" render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <FormControl><Input placeholder="e.g. Handbags, Blouses" {...field} data-testid="input-product-category" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea placeholder="Optional details..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {/* Image */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Product Image</label>
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border w-full h-40 bg-muted">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" onError={clearImage} />
                  <button type="button" onClick={clearImage} className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 hover:bg-background border border-border" data-testid="button-clear-image">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border w-full h-20 flex items-center justify-center bg-muted/40 text-muted-foreground text-xs gap-2">
                  <ImageIcon className="w-4 h-4" /><span>No image selected</span>
                </div>
              )}
              <Tabs value={imageTab} onValueChange={(v) => setImageTab(v as "upload" | "url")}>
                <TabsList className="h-8 text-xs">
                  <TabsTrigger value="upload" className="text-xs gap-1.5"><Upload className="w-3 h-3" /> Upload from device</TabsTrigger>
                  <TabsTrigger value="url" className="text-xs gap-1.5"><LinkIcon className="w-3 h-3" /> Paste URL</TabsTrigger>
                </TabsList>
              </Tabs>
              {imageTab === "upload" ? (
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" id="product-image-upload" onChange={handleFileChange} data-testid="input-product-image-file" />
                  <Button type="button" variant="outline" size="sm" className="w-full" disabled={isUploading} onClick={() => fileInputRef.current?.click()} data-testid="button-choose-image">
                    {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Choose photo from phone or computer</>}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1 text-center">JPG, PNG, WebP · max 5MB</p>
                </div>
              ) : (
                <FormField control={form.control} name="imageUrl" render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="https://example.com/image.jpg" {...field} data-testid="input-product-image-url"
                        onChange={(e) => { field.onChange(e); setImagePreview(e.target.value); }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>

            {/* Prices */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Prices (KSh)</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="buyingPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Buying Price</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="Cost" {...field} data-testid="input-product-buying-price" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Asking Price ✱</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="Listed" {...field} data-testid="input-product-price" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="expectedSellingPrice" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Expected Sell</FormLabel>
                    <FormControl><Input type="number" step="0.01" placeholder="After bargain" {...field} data-testid="input-product-expected-price" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Stock */}
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>Stock</FormLabel>
                  <FormControl><Input type="number" {...field} data-testid="input-product-stock" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lowStockThreshold" render={({ field }) => (
                <FormItem>
                  <FormLabel>Min Stock Alert</FormLabel>
                  <FormControl><Input type="number" {...field} data-testid="input-product-threshold" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending || isUploading} data-testid="button-save-product">
                {product ? "Save Changes" : "Create Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

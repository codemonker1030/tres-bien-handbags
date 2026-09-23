import React, { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useCreateProduct,
  useUpdateProduct,
  Product,
  getListProductsQueryKey,
} from "@workspace/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  ImageIcon,
  X,
  Upload,
  Link as LinkIcon,
  Loader2,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  getTemplateForCategory,
  sumSizeQuantities,
  type SizeQuantity,
} from "@/lib/category-templates";
import { cn } from "@/lib/utils";

// Empty locally -> "/api/uploads" goes through the Vite proxy.
// Production -> points directly to the Render API.
const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? ""
).replace(/\/+$/, "");

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  buyingPrice: z.coerce.number().min(0).optional(),
  price: z.coerce
    .number()
    .min(0, "Asking price is required"),
  expectedSellingPrice: z.coerce
    .number()
    .min(0)
    .optional(),
  stock: z.coerce
    .number()
    .min(0, "Stock must be 0 or more"),
  lowStockThreshold: z.coerce
    .number()
    .min(0)
    .optional(),

  // Category-specific product attributes.
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

  // Rich attributes stored inside product.attributes.
  accessoryType: z.string().optional(),
  clothingType: z.string().optional(),
  gender: z.string().optional(),
  heelType: z.string().optional(),
  length: z.string().optional(),
  neckline: z.string().optional(),
  occasion: z.string().optional(),
  strapType: z.string().optional(),
  toeStyle: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
});

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
}: ProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [imagePreview, setImagePreview] =
    useState<string>("");

  const [imageTab, setImageTab] =
    useState<"upload" | "url">("upload");

  const [isUploading, setIsUploading] =
    useState(false);

  const [colorVariants, setColorVariants] =
    useState<string[]>([]);

  const [sizeQuantities, setSizeQuantities] =
    useState<SizeQuantity[]>([]);

  const template = product
    ? getTemplateForCategory(product.category)
    : null;

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const form = useForm<
    z.infer<typeof formSchema>
  >({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "",
      description: "",
      imageUrl: "",
      buyingPrice: undefined,
      price: 0,
      expectedSellingPrice: undefined,
      stock: 0,
      lowStockThreshold: 5,
      material: "",
      color: "",
      style: "",
      closureType: "",
      compartments: undefined,
      pattern: "",
      sleeveType: "",
      fit: "",
      season: "",
      shoeType: "",
      accessoryType: "",
      clothingType: "",
      gender: "",
      heelType: "",
      length: "",
      neckline: "",
      occasion: "",
      strapType: "",
      toeStyle: "",
      sku: "",
      barcode: "",
    },
  });

  const readProductAttribute = (
    key: string,
  ): string | number | undefined => {
    if (!product) return undefined;

    const fromAttributes =
      product.attributes?.[key];

    if (
      typeof fromAttributes === "string" ||
      typeof fromAttributes === "number"
    ) {
      return fromAttributes;
    }

    const legacyProduct =
      product as Product &
        Record<string, unknown>;

    const legacyValue =
      legacyProduct[key];

    if (
      typeof legacyValue === "string" ||
      typeof legacyValue === "number"
    ) {
      return legacyValue;
    }

    return undefined;
  };

  React.useEffect(() => {
    if (open) {
      if (product) {
        form.reset({
          name: product.name,
          category: product.category,
          description:
            product.description || "",
          imageUrl:
            product.imageUrl || "",
          buyingPrice:
            product.buyingPrice ?? undefined,
          price: product.price,
          expectedSellingPrice:
            product.expectedSellingPrice ??
            undefined,
          stock: product.stock,
          lowStockThreshold:
            product.lowStockThreshold ?? 5,

          material:
            String(readProductAttribute("material") ?? ""),
          color:
            String(readProductAttribute("color") ?? ""),
          style:
            String(readProductAttribute("style") ?? ""),
          closureType:
            String(readProductAttribute("closureType") ?? ""),
          compartments:
            typeof readProductAttribute("compartments") === "number"
              ? Number(readProductAttribute("compartments"))
              : undefined,
          pattern:
            String(readProductAttribute("pattern") ?? ""),
          sleeveType:
            String(readProductAttribute("sleeveType") ?? ""),
          fit:
            String(readProductAttribute("fit") ?? ""),
          season:
            String(readProductAttribute("season") ?? ""),
          shoeType:
            String(readProductAttribute("shoeType") ?? ""),
          accessoryType:
            String(readProductAttribute("accessoryType") ?? ""),
          clothingType:
            String(readProductAttribute("clothingType") ?? ""),
          gender:
            String(readProductAttribute("gender") ?? ""),
          heelType:
            String(readProductAttribute("heelType") ?? ""),
          length:
            String(readProductAttribute("length") ?? ""),
          neckline:
            String(readProductAttribute("neckline") ?? ""),
          occasion:
            String(readProductAttribute("occasion") ?? ""),
          strapType:
            String(readProductAttribute("strapType") ?? ""),
          toeStyle:
            String(readProductAttribute("toeStyle") ?? ""),
          sku: product.sku ?? "",
          barcode: product.barcode ?? "",
        });

        setImagePreview(
          product.imageUrl || "",
        );

        setColorVariants(
          product.colorVariants ?? [],
        );

        setSizeQuantities(
          product.sizeQuantities ?? [],
        );
      } else {
        form.reset({
          name: "",
          category: "",
          description: "",
          imageUrl: "",
          buyingPrice: undefined,
          price: 0,
          expectedSellingPrice: undefined,
          stock: 0,
          lowStockThreshold: 5,
          material: "",
          color: "",
          style: "",
          closureType: "",
          compartments: undefined,
          pattern: "",
          sleeveType: "",
          fit: "",
          season: "",
          shoeType: "",
          accessoryType: "",
          clothingType: "",
          gender: "",
          heelType: "",
          length: "",
          neckline: "",
          occasion: "",
          strapType: "",
          toeStyle: "",
          sku: "",
          barcode: "",
        });

        setImagePreview("");
        setColorVariants([]);
        setSizeQuantities([]);
      }
    }
  }, [open, product, form]);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        `${API_BASE_URL}/api/uploads`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!res.ok) {
        const message = await res
          .text()
          .catch(() => "");

        throw new Error(
          message ||
            `Upload failed with status ${res.status}`,
        );
      }

      const { url } = await res.json();

      form.setValue("imageUrl", url);
      setImagePreview(url);
    } catch (error) {
      console.error(
        "Product image upload failed:",
        error,
      );

      toast({
        title: "Image upload failed",
        description:
          error instanceof Error
            ? error.message
            : "Unable to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const clearImage = () => {
    setImagePreview("");
    form.setValue("imageUrl", "");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sizeTotal =
    sumSizeQuantities(sizeQuantities);

  const onSubmit = (
    values: z.infer<typeof formSchema>,
  ) => {
    const attributes: Record<
      string,
      string | number
    > = {
      ...(product?.attributes ?? {}),
    };

    if (template) {
      for (const attr of template.attributes) {
        const rawValue =
          values[
            attr.key as keyof typeof values
          ];

        if (
          typeof rawValue === "string"
        ) {
          const value = rawValue.trim();

          if (value) {
            attributes[attr.key] = value;
          } else {
            delete attributes[attr.key];
          }
        } else if (
          typeof rawValue === "number" &&
          Number.isFinite(rawValue)
        ) {
          attributes[attr.key] = rawValue;
        } else {
          delete attributes[attr.key];
        }
      }
    }

    const payload = {
      name: values.name,
      category: values.category,
      description:
        values.description || undefined,
      imageUrl:
        values.imageUrl || undefined,
      buyingPrice:
        values.buyingPrice ?? undefined,
      price: values.price,
      expectedSellingPrice:
        values.expectedSellingPrice ??
        undefined,
      stock:
        template?.stockMode === "sizes"
          ? sizeTotal
          : values.stock,
      lowStockThreshold:
        values.lowStockThreshold,

      // Keep legacy top-level fields in sync while
      // Product Details transitions to attributes JSON.
      material:
        values.material || undefined,
      color:
        values.color || undefined,
      style:
        values.style || undefined,
      closureType:
        values.closureType || undefined,
      compartments:
        values.compartments ?? undefined,
      pattern:
        values.pattern || undefined,
      sleeveType:
        values.sleeveType || undefined,
      fit:
        values.fit || undefined,
      season:
        values.season || undefined,
      shoeType:
        values.shoeType || undefined,

      colorVariants:
        template?.hasColorVariants
          ? colorVariants
          : undefined,

      sizeQuantities:
        template?.stockMode === "sizes"
          ? sizeQuantities
          : undefined,

      sku:
        template?.hasSku
          ? values.sku || undefined
          : undefined,

      barcode:
        template?.hasBarcode
          ? values.barcode || undefined
          : undefined,

      attributes,
    };

    if (product) {
      updateProduct.mutate(
        {
          id: product.id,
          data: payload,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey:
                getListProductsQueryKey(),
            });

            toast({
              title: "Product updated",
            });

            onOpenChange(false);
          },

          onError: () =>
            toast({
              title:
                "Failed to update product",
              variant: "destructive",
            }),
        },
      );
    } else {
      createProduct.mutate(
        {
          data: payload,
        },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey:
                getListProductsQueryKey(),
            });

            toast({
              title: "Product added",
            });

            onOpenChange(false);
            form.reset();
            setImagePreview("");
          },

          onError: () =>
            toast({
              title:
                "Failed to create product",
              variant: "destructive",
            }),
        },
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product
              ? "Edit Product"
              : "Add Product"}
          </DialogTitle>

          <DialogDescription>
            {product
              ? "Update product details."
              : "Add a new product to your inventory."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(
              onSubmit,
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name
                  </FormLabel>

                  <FormControl>
                    <Input
                      placeholder="e.g. Leather Tote Bag"
                      {...field}
                      data-testid="input-product-name"
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Category
                  </FormLabel>

                  <FormControl>
                    <Input
                      placeholder="e.g. Handbags, Blouses"
                      {...field}
                      data-testid="input-product-category"
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {product && template && (
              <div className="space-y-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Product details
                  </p>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Tap the values that describe this product.
                  </p>
                </div>

                {template.attributes.map((attr) => (
                  <FormField
                    key={attr.key}
                    control={form.control}
                    name={
                      attr.key as keyof z.infer<
                        typeof formSchema
                      >
                    }
                    render={({ field }) => {
                      const currentValue =
                        field.value == null
                          ? ""
                          : String(field.value);

                      const isPresetValue =
                        attr.type === "select" &&
                        attr.options?.some(
                          (option) =>
                            option !== "Other" &&
                            option === currentValue,
                        );

                      const isCustomValue =
                        attr.type === "select" &&
                        attr.allowOther === true &&
                        currentValue !== "" &&
                        !isPresetValue;

                      return (
                        <FormItem className="space-y-2">
                          <FormLabel>
                            {attr.label}

                            <span className="ml-1 font-normal text-muted-foreground">
                              (optional)
                            </span>
                          </FormLabel>

                          {attr.type === "select" &&
                          attr.options ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2">
                                {attr.options.map(
                                  (option) => {
                                    const isOther =
                                      option === "Other";

                                    const selected =
                                      isOther
                                        ? isCustomValue
                                        : currentValue ===
                                          option;

                                    return (
                                      <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                          if (isOther) {
                                            field.onChange(
                                              isCustomValue
                                                ? ""
                                                : "Other",
                                            );

                                            return;
                                          }

                                          field.onChange(
                                            selected
                                              ? ""
                                              : option,
                                          );
                                        }}
                                        className={cn(
                                          "min-h-9 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                                          selected
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                        )}
                                      >
                                        {option}
                                      </button>
                                    );
                                  },
                                )}
                              </div>

                                {isCustomValue && (
                                  <Input
                                    autoFocus={
                                      currentValue ===
                                      "Other"
                                    }
                                    value={
                                      currentValue ===
                                      "Other"
                                        ? ""
                                        : currentValue
                                    }
                                    onChange={(event) =>
                                      field.onChange(
                                        event.target.value ||
                                          "Other",
                                      )
                                    }
                                    placeholder={`Enter ${attr.label.toLowerCase()}`}
                                  />
                                )}
                              </div>
                            ) : (
                              <FormControl>
                                <Input
                                  type={
                                    attr.type === "number"
                                      ? "number"
                                      : "text"
                                  }
                                  placeholder={
                                    attr.placeholder
                                  }
                                  {...field}
                                  value={
                                    field.value ?? ""
                                  }
                                />
                              </FormControl>
                            )}

                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description
                  </FormLabel>

                  <FormControl>
                    <Textarea
                      placeholder="Optional details..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Image */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                Product Image
              </label>

              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border w-full h-40 bg-muted">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={clearImage}
                  />

                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 hover:bg-background border border-border"
                    data-testid="button-clear-image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border w-full h-20 flex items-center justify-center bg-muted/40 text-muted-foreground text-xs gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span>
                    No image selected
                  </span>
                </div>
              )}

              <Tabs
                value={imageTab}
                onValueChange={(v) =>
                  setImageTab(
                    v as "upload" | "url",
                  )
                }
              >
                <TabsList className="h-8 text-xs">
                  <TabsTrigger
                    value="upload"
                    className="text-xs gap-1.5"
                  >
                    <Upload className="w-3 h-3" />
                    Upload from device
                  </TabsTrigger>

                  <TabsTrigger
                    value="url"
                    className="text-xs gap-1.5"
                  >
                    <LinkIcon className="w-3 h-3" />
                    Paste URL
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {imageTab === "upload" ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="product-image-upload"
                    onChange={
                      handleFileChange
                    }
                    data-testid="input-product-image-file"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={isUploading}
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    data-testid="button-choose-image"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose photo from
                        phone or computer
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground mt-1 text-center">
                    JPG, PNG, WebP · max
                    5MB
                  </p>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          {...field}
                          data-testid="input-product-image-url"
                          onChange={(
                            e,
                          ) => {
                            field.onChange(
                              e,
                            );

                            setImagePreview(
                              e.target
                                .value,
                            );
                          }}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Prices */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Prices (KSh)
              </p>

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="buyingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Buying Price
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Cost"
                          {...field}
                          data-testid="input-product-buying-price"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Asking Price ✱
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Listed"
                          {...field}
                          data-testid="input-product-price"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expectedSellingPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Expected Sell
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="After bargain"
                          {...field}
                          data-testid="input-product-expected-price"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Inventory */}
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Inventory
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Update stock and product references.
                </p>
              </div>

              {/* Color variants */}
              {template?.hasColorVariants && (
                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    Other available colors
                  </label>

                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a color and press Enter"
                      onKeyDown={(event) => {
                        if (
                          event.key !== "Enter" &&
                          event.key !== ","
                        ) {
                          return;
                        }

                        event.preventDefault();

                        const input =
                          event.currentTarget;

                        const value =
                          input.value.trim();

                        if (
                          value &&
                          !colorVariants.includes(value)
                        ) {
                          setColorVariants(
                            (current) => [
                              ...current,
                              value,
                            ],
                          );
                        }

                        input.value = "";
                      }}
                    />
                  </div>

                  {colorVariants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {colorVariants.map(
                        (color) => (
                          <span
                            key={color}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground"
                          >
                            {color}

                            <button
                              type="button"
                              aria-label={`Remove ${color}`}
                              onClick={() =>
                                setColorVariants(
                                  (current) =>
                                    current.filter(
                                      (item) =>
                                        item !== color,
                                    ),
                                )
                              }
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Stock */}
              {template?.stockMode === "sizes" &&
              template.sizeOptions ? (
                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    Stock by size
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {template.sizeOptions.map(
                      (size) => {
                        const quantity =
                          sizeQuantities.find(
                            (item) =>
                              item.size === size,
                          )?.quantity ?? 0;

                        return (
                          <div
                            key={size}
                            className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5"
                          >
                            <span className="w-10 shrink-0 text-sm font-semibold text-foreground">
                              {size}
                            </span>

                            <Input
                              type="number"
                              min={0}
                              value={
                                quantity || ""
                              }
                              placeholder="0"
                              className="h-8"
                              onChange={(event) => {
                                const nextQuantity =
                                  Math.max(
                                    0,
                                    parseInt(
                                      event.target.value,
                                      10,
                                    ) || 0,
                                  );

                                setSizeQuantities(
                                  (current) => {
                                    const next =
                                      current.filter(
                                        (item) =>
                                          item.size !==
                                          size,
                                      );

                                    if (
                                      nextQuantity > 0
                                    ) {
                                      next.push({
                                        size,
                                        quantity:
                                          nextQuantity,
                                      });
                                    }

                                    return next;
                                  },
                                );
                              }}
                            />
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                    <span className="text-xs font-semibold text-primary">
                      Total stock
                    </span>

                    <span className="text-sm font-bold text-primary">
                      {sizeTotal} units
                    </span>
                  </div>
                </div>
              ) : (
                <FormField
                  control={form.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Stock
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          data-testid="input-product-stock"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Inventory metadata */}
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="lowStockThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        Min Stock Alert
                      </FormLabel>

                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          data-testid="input-product-threshold"
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {template?.hasSku && (
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          SKU
                        </FormLabel>

                        <FormControl>
                          <Input
                            placeholder="Reference code"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {template?.hasBarcode && (
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">
                          Barcode
                        </FormLabel>

                        <FormControl>
                          <Input
                            placeholder="Barcode"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  onOpenChange(false)
                }
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={
                  createProduct.isPending ||
                  updateProduct.isPending ||
                  isUploading
                }
                data-testid="button-save-product"
              >
                {product
                  ? "Save Changes"
                  : "Create Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

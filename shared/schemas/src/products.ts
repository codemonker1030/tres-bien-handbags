import * as zod from "zod";

const sizeQuantitySchema = zod.object({
  size: zod.string(),
  quantity: zod.number().min(0),
});

// A product, as returned by the API.
const productShape = {
  id: zod.number(),
  name: zod.string(),
  category: zod.string(),
  brand: zod.string().nullish(),
  description: zod.string().nullish(),
  imageUrl: zod.string().nullish(),
  images: zod.array(zod.string()).nullish(),
  buyingPrice: zod.number().nullish(),
  price: zod.number(),
  expectedSellingPrice: zod.number().nullish(),
  stock: zod.number(),
  lowStockThreshold: zod.number().optional(),
  supplier: zod.string().nullish(),
  purchaseDate: zod.string().nullish(),
  transportCost: zod.number().nullish(),
  otherCosts: zod.number().nullish(),
  sku: zod.string().nullish(),
  barcode: zod.string().nullish(),
  sizes: zod.array(zod.string()).nullish(),
  material: zod.string().nullish(),
  color: zod.string().nullish(),
  style: zod.string().nullish(),
  closureType: zod.string().nullish(),
  compartments: zod.number().nullish(),
  colorVariants: zod.array(zod.string()).nullish(),
  pattern: zod.string().nullish(),
  sleeveType: zod.string().nullish(),
  fit: zod.string().nullish(),
  season: zod.string().nullish(),
  shoeType: zod.string().nullish(),
  sizeQuantities: zod.array(sizeQuantitySchema).nullish(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
};

export const ListProductsResponseItem = zod.object(productShape);
export const ListProductsResponse = zod.array(ListProductsResponseItem);
export const ListLowStockProductsResponseItem = zod.object(productShape);
export const ListLowStockProductsResponse = zod.array(ListLowStockProductsResponseItem);

export const GetProductParams = zod.object({ id: zod.coerce.number() });
export const GetProductResponse = zod.object(productShape);

export const CreateProductBody = zod.object({
  name: zod.string().min(1),
  category: zod.string().min(1),
  brand: zod.string().optional(),
  description: zod.string().optional(),
  imageUrl: zod.string().optional(),
  images: zod.array(zod.string()).optional(),
  buyingPrice: zod.number().min(0).optional(),
  price: zod.number().min(0),
  expectedSellingPrice: zod.number().min(0).optional(),
  stock: zod.number().min(0),
  lowStockThreshold: zod.number().min(0).optional(),
  supplier: zod.string().optional(),
  // Coerced to a real Date object (not left as a string) — drizzle's
  // timestamp column calls .toISOString() on whatever value it's given
  // when inserting, which only works on an actual Date instance.
  purchaseDate: zod.coerce.date().optional(),
  transportCost: zod.number().min(0).optional(),
  otherCosts: zod.number().min(0).optional(),
  sku: zod.string().optional(),
  barcode: zod.string().optional(),
  sizes: zod.array(zod.string()).optional(),
  material: zod.string().optional(),
  color: zod.string().optional(),
  style: zod.string().optional(),
  closureType: zod.string().optional(),
  compartments: zod.number().min(0).optional(),
  colorVariants: zod.array(zod.string()).optional(),
  pattern: zod.string().optional(),
  sleeveType: zod.string().optional(),
  fit: zod.string().optional(),
  season: zod.string().optional(),
  shoeType: zod.string().optional(),
  sizeQuantities: zod.array(sizeQuantitySchema).optional(),
});

export const UpdateProductParams = zod.object({ id: zod.coerce.number() });
export const UpdateProductBody = zod.object({
  name: zod.string().min(1).optional(),
  category: zod.string().optional(),
  brand: zod.string().optional(),
  description: zod.string().optional(),
  imageUrl: zod.string().optional(),
  images: zod.array(zod.string()).optional(),
  buyingPrice: zod.number().min(0).optional(),
  price: zod.number().min(0).optional(),
  expectedSellingPrice: zod.number().min(0).optional(),
  stock: zod.number().min(0).optional(),
  lowStockThreshold: zod.number().min(0).optional(),
  supplier: zod.string().optional(),
  purchaseDate: zod.coerce.date().optional(),
  transportCost: zod.number().min(0).optional(),
  otherCosts: zod.number().min(0).optional(),
  sku: zod.string().optional(),
  barcode: zod.string().optional(),
  sizes: zod.array(zod.string()).optional(),
  material: zod.string().optional(),
  color: zod.string().optional(),
  style: zod.string().optional(),
  closureType: zod.string().optional(),
  compartments: zod.number().min(0).optional(),
  colorVariants: zod.array(zod.string()).optional(),
  pattern: zod.string().optional(),
  sleeveType: zod.string().optional(),
  fit: zod.string().optional(),
  season: zod.string().optional(),
  shoeType: zod.string().optional(),
  sizeQuantities: zod.array(sizeQuantitySchema).optional(),
});
export const UpdateProductResponse = zod.object(productShape);

export const DeleteProductParams = zod.object({ id: zod.coerce.number() });

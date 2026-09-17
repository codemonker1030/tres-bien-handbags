import * as zod from "zod";

// ─── New product ──────────────────────────────────────────────────────────────

/**
 * Minimum product information required when a completely new
 * catalog product is introduced during procurement.
 *
 * The owner can enrich the product later from Inventory.
 */
export const NewStockPurchaseProductInput = zod.object({
  name: zod
    .string()
    .trim()
    .min(1, "Product name is required"),

  category: zod
    .string()
    .trim()
    .min(1, "Product category is required"),

  /**
   * Intended/current selling price.
   * Buying cost is kept on the purchase line because it belongs
   * to this specific procurement.
   */
  price: zod.number().min(0),

  imageUrl: zod
    .string()
    .trim()
    .optional(),

  brand: zod
    .string()
    .trim()
    .optional(),

  description: zod
    .string()
    .trim()
    .optional(),

  lowStockThreshold: zod
    .number()
    .int()
    .min(0)
    .optional(),
});

// ─── Purchase item variants ───────────────────────────────────────────────────

export const ExistingStockPurchaseItemInput = zod.object({
  type: zod.literal("existing"),

  productId: zod
    .number()
    .int()
    .positive(),

  quantity: zod
    .number()
    .int()
    .positive(),

  unitBuyingPrice: zod
    .number()
    .min(0),
});

export const NewStockPurchaseItemInput = zod.object({
  type: zod.literal("new"),

  product: NewStockPurchaseProductInput,

  quantity: zod
    .number()
    .int()
    .positive(),

  unitBuyingPrice: zod
    .number()
    .min(0),
});

/**
 * A procurement line can either replenish an existing catalog
 * product or create a completely new product.
 */
export const StockPurchaseItemInput =
  zod.discriminatedUnion("type", [
    ExistingStockPurchaseItemInput,
    NewStockPurchaseItemInput,
  ]);

// ─── Shared purchase costs ────────────────────────────────────────────────────

export const StockPurchaseCostInput = zod.object({
  label: zod
    .string()
    .trim()
    .min(1, "Cost label is required"),

  amount: zod
    .number()
    .min(0),
});

// ─── Create purchase ──────────────────────────────────────────────────────────

export const CreateStockPurchaseBody = zod
  .object({
    supplierName: zod
      .string()
      .trim()
      .min(1, "Supplier name is required"),

    supplierPhone: zod
      .string()
      .trim()
      .optional(),

    /**
     * ISO date/datetime string from the frontend.
     * Example: 2026-09-14
     */
    purchaseDate: zod
      .string()
      .min(1),

    items: zod
      .array(StockPurchaseItemInput)
      .min(
        1,
        "At least one product is required",
      ),

    /**
     * Flexible direct procurement costs:
     * transport, packaging, handling, etc.
     */
    sharedCosts: zod
      .array(StockPurchaseCostInput)
      .default([]),

    /**
     * Cash actually paid toward this procurement.
     *
     * It may be lower than the final procurement total,
     * in which case the backend creates supplier debt.
     */
    amountPaid: zod
      .number()
      .min(0),

    notes: zod
      .string()
      .trim()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const goodsTotal =
      data.items.reduce(
        (sum, item) =>
          sum +
          item.quantity *
            item.unitBuyingPrice,
        0,
      );

    const sharedCostsTotal =
      data.sharedCosts.reduce(
        (sum, cost) =>
          sum + cost.amount,
        0,
      );

    const totalCost =
      goodsTotal + sharedCostsTotal;

    if (data.amountPaid > totalCost) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        path: ["amountPaid"],
        message:
          "Amount paid cannot exceed the total procurement cost",
      });
    }

    /**
     * Prevent the same existing product from being entered twice
     * in one procurement. The owner should change its quantity
     * instead.
     *
     * New products are intentionally excluded because they do not
     * have database IDs yet.
     */
    const existingProductIds =
      data.items
        .filter(
          (
            item,
          ): item is zod.infer<
            typeof ExistingStockPurchaseItemInput
          > => item.type === "existing",
        )
        .map(
          (item) => item.productId,
        );

    const duplicateExistingProduct =
      existingProductIds.find(
        (productId, index) =>
          existingProductIds.indexOf(
            productId,
          ) !== index,
      );

    if (
      duplicateExistingProduct !==
      undefined
    ) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        path: ["items"],
        message:
          "The same existing product cannot appear more than once in a stock purchase",
      });
    }
  });

// ─── Route params ─────────────────────────────────────────────────────────────

export const GetStockPurchaseParams =
  zod.object({
    id: zod.coerce
      .number()
      .int()
      .positive(),
  });

// ─── Response schemas ─────────────────────────────────────────────────────────

export const StockPurchaseCostResponse =
  zod.object({
    id: zod.number(),
    purchaseId: zod.number(),
    label: zod.string(),
    amount: zod.number(),
    createdAt: zod.string(),
  });

export const StockPurchaseItemResponse =
  zod.object({
    id: zod.number(),
    purchaseId: zod.number(),
    productId: zod.number(),

    productName: zod
      .string()
      .optional(),

    quantity: zod.number(),

    unitBuyingPrice: zod.number(),

    goodsSubtotal: zod.number(),

    allocatedSharedCost:
      zod.number(),

    landedSubtotal: zod.number(),

    landedUnitCost: zod.number(),

    createdAt: zod.string(),
  });

export const StockPurchaseResponse =
  zod.object({
    id: zod.number(),

    supplierName: zod.string(),

    supplierPhone: zod
      .string()
      .nullish(),

    purchaseDate: zod.string(),

    goodsTotal: zod.number(),

    sharedCostsTotal:
      zod.number(),

    totalCost: zod.number(),

    amountPaid: zod.number(),

    supplierBalance: zod.number(),

    supplierDebtId: zod
      .number()
      .nullish(),

    notes: zod
      .string()
      .nullish(),

    createdAt: zod.string(),

    updatedAt: zod.string(),

    items: zod.array(
      StockPurchaseItemResponse,
    ),

    sharedCosts: zod.array(
      StockPurchaseCostResponse,
    ),
  });

export const ListStockPurchasesResponse =
  zod.array(
    StockPurchaseResponse,
  );
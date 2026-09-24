import * as zod from "zod";

// ─── New lightweight stock groups ─────────────────────────────────────────────

/**
 * Broad stock information captured during procurement.
 *
 * This intentionally does NOT represent an Inventory product.
 *
 * Example:
 * Handbags -> 20
 * Shoes    -> 6
 */
export const StockPurchaseGroupInput = zod.object({
  category: zod.string().trim().min(1, "Category is required"),

  quantity: zod.number().int().positive("Quantity must be at least 1"),

  /**
   * Supplier price for one unit before transport
   * and other shared procurement costs.
   */
  unitBuyingPrice: zod.number().nonnegative("Buying price cannot be negative"),

  description: zod.string().trim().optional(),
});

// ─── Additional procurement costs ─────────────────────────────────────────────

export const StockPurchaseCostInput = zod.object({
  label: zod.string().trim().min(1, "Cost label is required"),

  amount: zod.number().positive("Cost amount must be greater than 0"),
});

// ─── Create purchase ──────────────────────────────────────────────────────────

export const CreateStockPurchaseBody = zod
  .object({
    supplierName: zod.string().trim().min(1, "Supplier name is required"),

    supplierPhone: zod.string().trim().optional(),

    /**
     * Business date of the purchase.
     *
     * Usually defaults to today in the frontend, but can be changed
     * when the owner records an earlier purchase later.
     */
    purchaseDate: zod.string().min(1, "Purchase date is required"),

    /**
     * Lightweight description of what came into the business.
     *
     * Example:
     * [
     *   { category: "Handbags", quantity: 20 },
     *   { category: "Shoes", quantity: 6 }
     * ]
     *
     * These DO NOT create or update Inventory products.
     */
    stockGroups: zod
      .array(StockPurchaseGroupInput)
      .min(1, "Add at least one stock group"),

    /**
     * Total supplier cost of the stock itself.
     *
     * Entered once for the entire procurement.
     */
    goodsTotal: zod.number().positive("Stock cost must be greater than 0"),

    /**
     * Optional additional direct procurement costs:
     * transport, packaging, loading, delivery, etc.
     */
    sharedCosts: zod.array(StockPurchaseCostInput).default([]),

    /**
     * Amount actually paid toward the complete procurement.
     *
     * If lower than totalCost, the backend creates supplier debt.
     */
    amountPaid: zod.number().min(0, "Amount paid cannot be negative"),

    /**
     * Optional invoice, receipt, M-Pesa or supplier reference.
     */
    reference: zod.string().trim().optional(),

    notes: zod.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const sharedCostsTotal = data.sharedCosts.reduce(
      (sum, cost) => sum + cost.amount,
      0,
    );

    const totalCost = data.goodsTotal + sharedCostsTotal;

    if (data.amountPaid > totalCost) {
      ctx.addIssue({
        code: zod.ZodIssueCode.custom,
        path: ["amountPaid"],
        message: "Amount paid cannot exceed the total purchase cost",
      });
    }
  });

// ─── Update purchase ─────────────────────────────────────────────────────────

/**
 * Editable procurement details.
 *
 * amountPaid is deliberately excluded.
 * Payments are financial events and must be recorded through the
 * supplier-debt payment workflow so payment history remains accurate.
 */
export const UpdateStockPurchaseBody = zod.object({
  supplierName: zod.string().trim().min(1, "Supplier name is required"),

  supplierPhone: zod.string().trim().optional(),

  purchaseDate: zod.string().min(1, "Purchase date is required"),

  stockGroups: zod
    .array(StockPurchaseGroupInput)
    .min(1, "Add at least one stock group"),

  goodsTotal: zod.number().positive("Stock cost must be greater than 0"),

  sharedCosts: zod.array(StockPurchaseCostInput).default([]),

  reference: zod.string().trim().optional(),

  notes: zod.string().trim().optional(),
});

// ─── Route params ─────────────────────────────────────────────────────────────

export const GetStockPurchaseParams = zod.object({
  id: zod.coerce.number().int().positive(),
});

// ─── Response: additional cost ────────────────────────────────────────────────

export const StockPurchaseCostResponse = zod.object({
  id: zod.number(),

  purchaseId: zod.number(),

  label: zod.string(),

  amount: zod.number(),

  createdAt: zod.string(),
});

// ─── Response: new lightweight stock group ────────────────────────────────────

export const StockPurchaseGroupResponse = zod.object({
  id: zod.number(),

  purchaseId: zod.number(),

  category: zod.string(),

  quantity: zod.number(),

  unitBuyingPrice: zod.number(),

  description: zod.string().nullish(),

  createdAt: zod.string(),
});

// ─── Legacy product-level purchase item ───────────────────────────────────────
//
// Existing purchases may contain these because Tres Bien originally linked
// procurement directly to Inventory.
//
// New purchases will NOT create these records.

export const StockPurchaseLegacyItemResponse = zod.object({
  id: zod.number(),

  purchaseId: zod.number(),

  productId: zod.number(),

  productName: zod.string().optional(),

  quantity: zod.number(),

  unitBuyingPrice: zod.number(),

  goodsSubtotal: zod.number(),

  allocatedSharedCost: zod.number(),

  landedSubtotal: zod.number(),

  landedUnitCost: zod.number(),

  createdAt: zod.string(),
});

// ─── Main purchase response ───────────────────────────────────────────────────

export const StockPurchaseResponse = zod.object({
  id: zod.number(),

  /**
   * New purchases receive values such as PUR-2026-0002.
   *
   * Nullable temporarily because historical records created before
   * this system may not yet have a purchase number.
   */
  purchaseNumber: zod.string().nullish(),

  supplierName: zod.string(),

  supplierPhone: zod.string().nullish(),

  purchaseDate: zod.string(),

  /**
   * Sum of stockGroups.quantity.
   */
  totalQuantity: zod.number(),

  goodsTotal: zod.number(),

  sharedCostsTotal: zod.number(),

  totalCost: zod.number(),

  amountPaid: zod.number(),

  /**
   * Current remaining balance.
   *
   * When linked supplier debt exists, the backend can derive this
   * from that debt so later repayments are reflected here.
   */
  supplierBalance: zod.number(),

  paymentStatus: zod.enum(["paid", "partially_paid", "unpaid"]),

  supplierDebtId: zod.number().nullish(),

  reference: zod.string().nullish(),

  notes: zod.string().nullish(),

  createdAt: zod.string(),

  updatedAt: zod.string(),

  /**
   * New procurement model.
   */
  stockGroups: zod.array(StockPurchaseGroupResponse),

  sharedCosts: zod.array(StockPurchaseCostResponse),

  /**
   * Historical product-level data.
   *
   * Normally [] for purchases created using the new workflow.
   */
  legacyItems: zod.array(StockPurchaseLegacyItemResponse),
});

// ─── List response ─────────────────────────────────────────────────────────────

export const ListStockPurchasesResponse = zod.array(StockPurchaseResponse);

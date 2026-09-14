import {
  pgTable,
  serial,
  integer,
  numeric,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { supplierDebtsTable } from "./debts";

/**
 * One procurement / stock-buying event.
 *
 * Example:
 * - Supplier: Kamukunji Fashion
 * - Goods total: 26,800
 * - Shared costs: 3,900
 * - Procurement total: 30,700
 * - Amount paid: 20,000
 * - Supplier balance: 10,700
 *
 * Individual products bought in this purchase live in
 * stock_purchase_items below.
 */
export const stockPurchasesTable = pgTable(
  "stock_purchases",
  {
    id: serial("id").primaryKey(),

    supplierName: text("supplier_name").notNull(),

    supplierPhone: text("supplier_phone"),

    /**
     * Business date of the procurement.
     *
     * Kept separately from createdAt because the owner may record
     * yesterday's purchase today.
     */
    purchaseDate: timestamp("purchase_date", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    /**
     * Sum of quantity × unit buying price for all purchase items.
     */
    goodsTotal: numeric("goods_total", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),

    /**
     * Total shared procurement costs:
     * transport + packaging + handling + any other direct costs.
     */
    sharedCostsTotal: numeric("shared_costs_total", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),

    /**
     * goodsTotal + sharedCostsTotal
     */
    totalCost: numeric("total_cost", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),

    /**
     * Amount actually paid to the supplier / toward the procurement.
     *
     * This is NOT necessarily the same as totalCost.
     */
    amountPaid: numeric("amount_paid", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),

    /**
     * Linked supplier debt when the procurement is not fully paid.
     *
     * If fully paid, this stays null.
     */
    supplierDebtId: integer("supplier_debt_id").references(
      () => supplierDebtsTable.id,
      { onDelete: "set null" },
    ),

    notes: text("notes"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("stock_purchases_purchase_date_idx").on(
      table.purchaseDate,
    ),
    index("stock_purchases_supplier_debt_id_idx").on(
      table.supplierDebtId,
    ),
  ],
);

/**
 * A product line inside one procurement.
 *
 * Example:
 * Black Chain Bag
 * quantity: 12
 * unitBuyingPrice: 850
 *
 * The allocation fields are calculated by Tres Bien, not typed manually
 * by the business owner.
 */
export const stockPurchaseItemsTable = pgTable(
  "stock_purchase_items",
  {
    id: serial("id").primaryKey(),

    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => stockPurchasesTable.id, {
        onDelete: "cascade",
      }),

    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, {
        onDelete: "restrict",
      }),

    quantity: integer("quantity").notNull(),

    /**
     * Supplier's price for ONE unit, before shared procurement costs.
     */
    unitBuyingPrice: numeric("unit_buying_price", {
      precision: 12,
      scale: 2,
    }).notNull(),

    /**
     * quantity × unitBuyingPrice
     */
    goodsSubtotal: numeric("goods_subtotal", {
      precision: 12,
      scale: 2,
    }).notNull(),

    /**
     * This product line's allocated portion of transport/handling/etc.
     */
    allocatedSharedCost: numeric(
      "allocated_shared_cost",
      {
        precision: 12,
        scale: 2,
      },
    )
      .notNull()
      .default("0"),

    /**
     * goodsSubtotal + allocatedSharedCost
     */
    landedSubtotal: numeric("landed_subtotal", {
      precision: 12,
      scale: 2,
    }).notNull(),

    /**
     * landedSubtotal / quantity
     *
     * This will later become the important cost basis for profit.
     */
    landedUnitCost: numeric("landed_unit_cost", {
      precision: 12,
      scale: 2,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_purchase_items_purchase_id_idx").on(
      table.purchaseId,
    ),
    index("stock_purchase_items_product_id_idx").on(
      table.productId,
    ),
  ],
);

/**
 * Flexible extra procurement costs.
 *
 * We do not hard-code every possible cost into stock_purchases.
 * The owner can record:
 * - Transport
 * - Packaging
 * - Loading
 * - Customs
 * - Agent fee
 * - Other
 */
export const stockPurchaseCostsTable = pgTable(
  "stock_purchase_costs",
  {
    id: serial("id").primaryKey(),

    purchaseId: integer("purchase_id")
      .notNull()
      .references(() => stockPurchasesTable.id, {
        onDelete: "cascade",
      }),

    label: text("label").notNull(),

    amount: numeric("amount", {
      precision: 12,
      scale: 2,
    }).notNull(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("stock_purchase_costs_purchase_id_idx").on(
      table.purchaseId,
    ),
  ],
);

export type StockPurchase =
  typeof stockPurchasesTable.$inferSelect;

export type StockPurchaseItem =
  typeof stockPurchaseItemsTable.$inferSelect;

export type StockPurchaseCost =
  typeof stockPurchaseCostsTable.$inferSelect;
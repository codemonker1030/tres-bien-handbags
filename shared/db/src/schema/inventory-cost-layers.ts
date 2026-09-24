import {
  pgTable,
  serial,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";

import { productsTable } from "./products";
import { stockPurchaseGroupsTable } from "./stock-purchases";

/**
 * Preserves the acquisition cost of inventory received from purchases.
 *
 * A product can have multiple cost layers because the same product may be
 * purchased repeatedly at different prices.
 *
 * products.stock remains the authoritative stock quantity used by the app.
 * quantityRemaining exists specifically for FIFO costing.
 */
export const inventoryCostLayersTable = pgTable(
  "inventory_cost_layers",
  {
    id: serial("id").primaryKey(),

    productId: integer("product_id")
      .notNull()
      .references(() => productsTable.id, {
        onDelete: "cascade",
      }),

    purchaseGroupId: integer("purchase_group_id").references(
      () => stockPurchaseGroupsTable.id,
      {
        onDelete: "set null",
      },
    ),

    quantityReceived: integer("quantity_received").notNull(),

    quantityRemaining: integer("quantity_remaining").notNull(),

    unitGoodsCost: numeric("unit_goods_cost", {
      precision: 12,
      scale: 2,
    }).notNull(),

    unitSharedCost: numeric("unit_shared_cost", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0"),

    landedUnitCost: numeric("landed_unit_cost", {
      precision: 12,
      scale: 2,
    }).notNull(),

    receivedAt: timestamp("received_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
);

export type InventoryCostLayer =
  typeof inventoryCostLayersTable.$inferSelect;

export type InsertInventoryCostLayer =
  typeof inventoryCostLayersTable.$inferInsert;

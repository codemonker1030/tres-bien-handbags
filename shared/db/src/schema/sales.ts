import { pgTable, serial, integer, numeric, text, timestamp, index } from "drizzle-orm/pg-core";
import { productsTable } from "./products";
import { customerDebtsTable } from "./debts";

export const salesTable = pgTable("sales", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  exactSellingPrice: numeric("exact_selling_price", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull(),
  debtAmount: numeric("debt_amount", { precision: 10, scale: 2 }),
  customerName: text("customer_name"),
  // Links to the customer_debts row created for this sale (if it was partial/credit),
  // so a payment recorded on the Debts page is reflected back here automatically.
  debtId: integer("debt_id").references(() => customerDebtsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Speeds up "sales for this product" lookups (product-detail page)
  index("sales_product_id_idx").on(table.productId),
  // Speeds up the sales<->debts join used to compute live remaining balances
  index("sales_debt_id_idx").on(table.debtId),
  // Speeds up the all-sales list, which always orders by most recent first
  index("sales_sold_at_idx").on(table.soldAt),
]);

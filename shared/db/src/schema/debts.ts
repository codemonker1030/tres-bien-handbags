import {
  pgTable,
  serial,
  integer,
  text,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

// ─── Customer debts ───────────────────────────────────────────────────────────

export const customerDebtsTable = pgTable(
  "customer_debts",
  {
    id: serial("id").primaryKey(),

    customerName: text("customer_name").notNull(),

    phone: text("phone"),

    description: text("description").notNull(),

    amount: numeric("amount", {
      precision: 10,
      scale: 2,
    }).notNull(),

    amountPaid: numeric("amount_paid", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),

    dueDate: text("due_date"),

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
);

// ─── Supplier debts ───────────────────────────────────────────────────────────

export const supplierDebtsTable = pgTable(
  "supplier_debts",
  {
    id: serial("id").primaryKey(),

    supplierName: text("supplier_name").notNull(),

    phone: text("phone"),

    description: text("description").notNull(),

    amount: numeric("amount", {
      precision: 10,
      scale: 2,
    }).notNull(),

    /**
     * Cached cumulative amount paid.
     *
     * Payment history lives in supplier_debt_payments.
     * Keeping this value makes balance calculations fast and preserves
     * compatibility with existing supplier debts.
     */
    amountPaid: numeric("amount_paid", {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default("0"),

    dueDate: text("due_date"),

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
);

// ─── Supplier debt payments ───────────────────────────────────────────────────

/**
 * One actual payment made toward a supplier debt.
 *
 * Example:
 * Purchase total: KSh 30,000
 * Initial amount paid: KSh 20,000
 *
 * Later:
 * 22 Sep -> KSh 5,000
 * 25 Sep -> KSh 5,000
 *
 * Those later payments become individual rows here instead of
 * destroying the payment history by simply overwriting amountPaid.
 */
export const supplierDebtPaymentsTable = pgTable(
  "supplier_debt_payments",
  {
    id: serial("id").primaryKey(),

    supplierDebtId: integer("supplier_debt_id")
      .notNull()
      .references(() => supplierDebtsTable.id, {
        onDelete: "cascade",
      }),

    amount: numeric("amount", {
      precision: 10,
      scale: 2,
    }).notNull(),

    /**
     * Business date of the payment.
     *
     * Separate from createdAt because the owner may record yesterday's
     * payment today.
     */
    paymentDate: timestamp("payment_date", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),

    /**
     * Optional payment method.
     *
     * Examples:
     * Cash
     * M-Pesa
     * Bank
     */
    method: text("method"),

    reference: text("reference"),

    notes: text("notes"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index(
      "supplier_debt_payments_debt_id_idx",
    ).on(table.supplierDebtId),

    index(
      "supplier_debt_payments_payment_date_idx",
    ).on(table.paymentDate),
  ],
);

export type SupplierDebtPayment =
  typeof supplierDebtPaymentsTable.$inferSelect;

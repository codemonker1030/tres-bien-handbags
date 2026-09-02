import { pgTable, text, serial, timestamp, numeric, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  brand: text("brand"),
  description: text("description"),
  buyingPrice: numeric("buying_price", { precision: 10, scale: 2 }),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  expectedSellingPrice: numeric("expected_selling_price", { precision: 10, scale: 2 }),
  // Authoritative stock count everywhere in the app (sales, low-stock badges,
  // restock, dashboard). For size-based categories (dresses, shoes) this is
  // the auto-summed total of sizeQuantities below — kept as a plain number
  // so every existing stock-related feature keeps working unchanged; the
  // size breakdown is additional structured detail on top, not a
  // replacement for this field.
  stock: integer("stock").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  // Cover image (backward compatible with every existing card/detail view).
  // `images` holds the full gallery, cover image included, for the
  // multi-image upload step — nothing existing needs to change to keep
  // working off `imageUrl` alone.
  imageUrl: text("image_url"),
  images: text("images").array(),
  // ── Purchases-module fields (Phase B) ──────────────────────────────────
  // Deliberately NOT surfaced anywhere in the Inventory module anymore —
  // inventory is purchased in bulk, not per-product, so these belong to a
  // future dedicated Purchases module. Left in place (unused) rather than
  // dropped, so that module can pick them up later without another migration.
  supplier: text("supplier"),
  purchaseDate: timestamp("purchase_date", { withTimezone: true }),
  transportCost: numeric("transport_cost", { precision: 10, scale: 2 }),
  otherCosts: numeric("other_costs", { precision: 10, scale: 2 }),
  sku: text("sku"),
  barcode: text("barcode"),
  // ── Category attributes ────────────────────────────────────────────────
  // Superset of every category template's fields — each template only
  // collects/displays the ones relevant to it (see
  // frontend/src/lib/category-templates.ts), so this stays a flat list of
  // plain optional columns rather than a polymorphic per-category schema.
  material: text("material"),
  color: text("color"),
  style: text("style"),                 // handbags, accessories
  closureType: text("closure_type"),    // handbags, shoes
  compartments: integer("compartments"), // handbags
  colorVariants: text("color_variants").array(), // handbags — extra color options, informational only
  pattern: text("pattern"),             // dresses
  sleeveType: text("sleeve_type"),      // dresses
  fit: text("fit"),                     // dresses
  season: text("season"),               // dresses
  shoeType: text("shoe_type"),          // shoes
  // Deprecated by sizeQuantities below (kept, unused, for backward
  // compatibility with any product saved before this change).
  sizes: text("sizes").array(),
  // Per-size stock for dresses/shoes: [{ size: "M", quantity: 4 }, ...].
  // `stock` above is kept in sync as the sum of these at save time.
  sizeQuantities: jsonb("size_quantities").$type<{ size: string; quantity: number }[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProductSchema = createInsertSchema(productsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;

// Reusable category templates for the Inventory module.
//
// Each template declares which fields apply to that category — the Add
// Product form and the Product Details page both read from here rather
// than hardcoding per-category logic, so adding a new category later means
// adding one entry to CATEGORY_TEMPLATES, not touching form/detail code.
//
// `category` on a Product is still stored as free text (matches existing
// grouping/filtering elsewhere in Inventory) — `matches()` classifies that
// text into a template, both for new products (via the fixed category
// picker in the Add form) and for existing/legacy products when rendering
// their Details page.

export type CategoryKey = "handbags" | "dresses" | "shoes" | "accessories";

export interface SizeQuantity {
  size: string;
  quantity: number;
}

export interface AttributeFieldDef {
  /** Matches a field name on Product/ProductInput. */
  key: string;
  label: string;
  type: "text" | "number";
  placeholder?: string;
}

export interface CategoryTemplate {
  key: CategoryKey;
  /** Shown in the category picker and as the stored `category` value. */
  label: string;
  emoji: string;
  /** Classifies a free-text category string into this template. */
  matches: (category: string) => boolean;

  attributes: AttributeFieldDef[];

  /**
   * "quantity" = a single flat stock number (handbags, accessories).
   * "sizes" = per-size quantities that auto-sum to the total stock
   * (dresses, shoes) — see sumSizeQuantities below.
   */
  stockMode: "quantity" | "sizes";
  /** Preset size choices, only meaningful when stockMode is "sizes". */
  sizeOptions?: string[];

  /** Handbags-style optional list of alternate colors this item also comes in. */
  hasColorVariants: boolean;
  hasSku: boolean;
  hasBarcode: boolean;
}

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    key: "handbags",
    label: "Handbags",
    emoji: "👜",
    matches: (c) => /(hand)?bag|purse|clutch|tote/i.test(c),
    attributes: [
      { key: "material", label: "Material", type: "text", placeholder: "e.g. Genuine leather" },
      { key: "color", label: "Color", type: "text", placeholder: "e.g. Tan" },
      { key: "style", label: "Style", type: "text", placeholder: "e.g. Tote, Crossbody, Satchel" },
      { key: "closureType", label: "Closure Type", type: "text", placeholder: "e.g. Zipper, Magnetic snap" },
      { key: "compartments", label: "Number of Compartments", type: "number" },
    ],
    stockMode: "quantity",
    hasColorVariants: true,
    hasSku: true,
    hasBarcode: true,
  },
  {
    key: "dresses",
    label: "Dresses / Clothing",
    emoji: "👗",
    matches: (c) => /dress|gown|clothing/i.test(c),
    attributes: [
      { key: "material", label: "Material", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "pattern", label: "Pattern", type: "text", placeholder: "e.g. Floral, Solid, Striped" },
      { key: "sleeveType", label: "Sleeve Type", type: "text", placeholder: "e.g. Short sleeve, Sleeveless" },
      { key: "fit", label: "Fit", type: "text", placeholder: "e.g. Bodycon, Loose, A-line" },
      { key: "season", label: "Season", type: "text", placeholder: "e.g. Summer, All-season" },
    ],
    stockMode: "sizes",
    sizeOptions: ["XS", "S", "M", "L", "XL", "XXL"],
    hasColorVariants: false,
    hasSku: true,
    hasBarcode: true,
  },
  {
    key: "shoes",
    label: "Shoes",
    emoji: "👠",
    matches: (c) => /shoe|heel|sandal|boot|sneaker/i.test(c),
    attributes: [
      { key: "shoeType", label: "Shoe Type", type: "text", placeholder: "e.g. Heels, Flats, Sneakers" },
      { key: "material", label: "Material", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "closureType", label: "Closure Type", type: "text", placeholder: "e.g. Lace-up, Slip-on, Buckle" },
    ],
    stockMode: "sizes",
    sizeOptions: ["36", "37", "38", "39", "40", "41", "42"],
    hasColorVariants: false,
    hasSku: true,
    hasBarcode: true,
  },
  {
    key: "accessories",
    label: "Accessories",
    emoji: "🧣",
    matches: (c) => /accessor|scarf|jewel|belt|hat|watch|wallet|sunglass/i.test(c),
    attributes: [
      { key: "material", label: "Material", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "style", label: "Style", type: "text" },
    ],
    stockMode: "quantity",
    hasColorVariants: false,
    hasSku: false,
    hasBarcode: false,
  },
];

/**
 * Generic fallback for a category that doesn't match any template above
 * (e.g. a shop owner types something unexpected). Keeps the app usable for
 * any category rather than crashing or hiding fields entirely.
 */
const FALLBACK_TEMPLATE: CategoryTemplate = {
  key: "accessories",
  label: "Other",
  emoji: "🏷️",
  matches: () => true,
  attributes: [
    { key: "material", label: "Material", type: "text" },
    { key: "color", label: "Color", type: "text" },
  ],
  stockMode: "quantity",
  hasColorVariants: false,
  hasSku: true,
  hasBarcode: true,
};

/** Finds the template matching a free-text category string, falling back
 * to a generic template if nothing matches. */
export function getTemplateForCategory(category: string): CategoryTemplate {
  return CATEGORY_TEMPLATES.find((t) => t.matches(category)) ?? FALLBACK_TEMPLATE;
}

/** Single source of truth for "total stock = sum of per-size quantities" —
 * used both when saving a product and anywhere the total needs recomputing. */
export function sumSizeQuantities(sizeQuantities: SizeQuantity[]): number {
  return sizeQuantities.reduce((sum, sq) => sum + (sq.quantity || 0), 0);
}

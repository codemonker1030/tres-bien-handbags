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

  /**
   * text   = normal text input
   * number = numeric input
   * select = fast preset choices rendered by the product form
   */
  type: "text" | "number" | "select";

  placeholder?: string;

  /**
   * Common values the owner can tap instead of typing.
   *
   * Keep these broad and practical. "Other" allows unusual
   * products without forcing us to maintain enormous lists.
   */
  options?: string[];

  /**
   * When true, selecting "Other" can reveal a small custom
   * value input in the product form.
   */
  allowOther?: boolean;
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
    matches: (c) =>
      /(hand)?bag|purse|clutch|tote/i.test(c),

    attributes: [
      {
        key: "style",
        label: "Bag Type",
        type: "select",
        options: [
          "Tote",
          "Crossbody",
          "Shoulder Bag",
          "Handbag",
          "Backpack",
          "Clutch",
          "Satchel",
          "Bucket Bag",
          "Wallet",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "material",
        label: "Material",
        type: "select",
        options: [
          "Leather",
          "PU Leather",
          "Canvas",
          "Nylon",
          "Fabric",
          "Suede",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: [
          "Black",
          "Brown",
          "White",
          "Beige",
          "Red",
          "Blue",
          "Green",
          "Pink",
          "Grey",
          "Multi-color",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "pattern",
        label: "Pattern / Finish",
        type: "select",
        options: [
          "Plain",
          "Textured",
          "Printed",
          "Quilted",
          "Woven",
          "Patterned",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "closureType",
        label: "Closure",
        type: "select",
        options: [
          "Zipper",
          "Magnetic Snap",
          "Buckle",
          "Drawstring",
          "Flap",
          "Open",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "strapType",
        label: "Strap / Handle",
        type: "select",
        options: [
          "Top Handle",
          "Shoulder Strap",
          "Crossbody Strap",
          "Chain Strap",
          "Adjustable Strap",
          "Detachable Strap",
          "No Strap",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "compartments",
        label: "Compartments",
        type: "number",
        placeholder: "e.g. 3",
      },
      {
        key: "occasion",
        label: "Best For",
        type: "select",
        options: [
          "Everyday",
          "Work",
          "Casual",
          "Travel",
          "Party",
          "Formal",
          "Other",
        ],
        allowOther: true,
      },
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
    matches: (c) =>
      /dress|gown|clothing/i.test(c),

    attributes: [
      {
        key: "clothingType",
        label: "Clothing Type",
        type: "select",
        options: [
          "Dress",
          "Top",
          "Shirt",
          "Blouse",
          "T-Shirt",
          "Skirt",
          "Trousers",
          "Jeans",
          "Jacket",
          "Sweater",
          "Gown",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "material",
        label: "Material / Fabric",
        type: "select",
        options: [
          "Cotton",
          "Polyester",
          "Denim",
          "Linen",
          "Silk",
          "Satin",
          "Chiffon",
          "Knit",
          "Lace",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: [
          "Black",
          "White",
          "Blue",
          "Red",
          "Green",
          "Pink",
          "Brown",
          "Beige",
          "Grey",
          "Multi-color",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "pattern",
        label: "Pattern",
        type: "select",
        options: [
          "Solid",
          "Floral",
          "Striped",
          "Checked",
          "Polka Dot",
          "Animal Print",
          "Graphic",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "fit",
        label: "Fit",
        type: "select",
        options: [
          "Regular",
          "Slim",
          "Bodycon",
          "Loose",
          "Oversized",
          "A-Line",
          "Relaxed",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "sleeveType",
        label: "Sleeve",
        type: "select",
        options: [
          "Sleeveless",
          "Short Sleeve",
          "Long Sleeve",
          "Three Quarter",
          "Off Shoulder",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "neckline",
        label: "Neckline",
        type: "select",
        options: [
          "Round Neck",
          "V-Neck",
          "Collared",
          "Square Neck",
          "High Neck",
          "Off Shoulder",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "length",
        label: "Length",
        type: "select",
        options: [
          "Mini",
          "Knee Length",
          "Midi",
          "Maxi",
          "Cropped",
          "Regular",
          "Long",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "occasion",
        label: "Best For",
        type: "select",
        options: [
          "Casual",
          "Work",
          "Party",
          "Formal",
          "Wedding",
          "Everyday",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "season",
        label: "Season",
        type: "select",
        options: [
          "All Season",
          "Warm Weather",
          "Cold Weather",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "gender",
        label: "For",
        type: "select",
        options: [
          "Women",
          "Men",
          "Girls",
          "Boys",
          "Unisex",
        ],
      },
    ],

    stockMode: "sizes",
    sizeOptions: [
      "XS",
      "S",
      "M",
      "L",
      "XL",
      "XXL",
    ],
    hasColorVariants: false,
    hasSku: true,
    hasBarcode: true,
  },

  {
    key: "shoes",
    label: "Shoes",
    emoji: "👠",
    matches: (c) =>
      /shoe|heel|sandal|boot|sneaker/i.test(c),

    attributes: [
      {
        key: "shoeType",
        label: "Shoe Type",
        type: "select",
        options: [
          "Heels",
          "Flats",
          "Sneakers",
          "Sandals",
          "Boots",
          "Loafers",
          "Slippers",
          "Formal Shoes",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "material",
        label: "Material",
        type: "select",
        options: [
          "Leather",
          "PU Leather",
          "Suede",
          "Canvas",
          "Mesh",
          "Fabric",
          "Rubber",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: [
          "Black",
          "White",
          "Brown",
          "Beige",
          "Red",
          "Blue",
          "Green",
          "Pink",
          "Grey",
          "Multi-color",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "closureType",
        label: "Closure",
        type: "select",
        options: [
          "Slip-On",
          "Lace-Up",
          "Buckle",
          "Zipper",
          "Velcro",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "heelType",
        label: "Heel Type",
        type: "select",
        options: [
          "Flat",
          "Block Heel",
          "Stiletto",
          "Wedge",
          "Platform",
          "Kitten Heel",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "toeStyle",
        label: "Toe Style",
        type: "select",
        options: [
          "Round Toe",
          "Pointed Toe",
          "Square Toe",
          "Open Toe",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "occasion",
        label: "Best For",
        type: "select",
        options: [
          "Casual",
          "Work",
          "Sports",
          "Party",
          "Formal",
          "Everyday",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "gender",
        label: "For",
        type: "select",
        options: [
          "Women",
          "Men",
          "Girls",
          "Boys",
          "Unisex",
        ],
      },
    ],

    stockMode: "sizes",
    sizeOptions: [
      "36",
      "37",
      "38",
      "39",
      "40",
      "41",
      "42",
    ],
    hasColorVariants: false,
    hasSku: true,
    hasBarcode: true,
  },

  {
    key: "accessories",
    label: "Accessories",
    emoji: "🧣",
    matches: (c) =>
      /accessor|scarf|jewel|belt|hat|watch|wallet|sunglass/i.test(c),

    attributes: [
      {
        key: "accessoryType",
        label: "Accessory Type",
        type: "select",
        options: [
          "Jewellery",
          "Watch",
          "Belt",
          "Scarf",
          "Hat",
          "Wallet",
          "Sunglasses",
          "Hair Accessory",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "material",
        label: "Material",
        type: "select",
        options: [
          "Metal",
          "Leather",
          "PU Leather",
          "Fabric",
          "Plastic",
          "Stainless Steel",
          "Beads",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "color",
        label: "Color",
        type: "select",
        options: [
          "Black",
          "White",
          "Brown",
          "Gold",
          "Silver",
          "Beige",
          "Red",
          "Blue",
          "Pink",
          "Multi-color",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "style",
        label: "Style",
        type: "select",
        options: [
          "Classic",
          "Casual",
          "Minimal",
          "Statement",
          "Formal",
          "Trendy",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "occasion",
        label: "Best For",
        type: "select",
        options: [
          "Everyday",
          "Work",
          "Casual",
          "Party",
          "Formal",
          "Gift",
          "Other",
        ],
        allowOther: true,
      },
      {
        key: "gender",
        label: "For",
        type: "select",
        options: [
          "Women",
          "Men",
          "Girls",
          "Boys",
          "Unisex",
        ],
      },
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

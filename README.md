# Business Hub — project map

A quick orientation so you know exactly where to click for any given change.
See `LOCAL_SETUP.md` for how to install/run it.

## The shape of the project

This is a **pnpm monorepo**: one repo, several packages, each with its own
`package.json`, wired together with `workspace:*` links.

```
frontend/            ← the React app — what you see in the browser
└── src/
    ├── pages/         ← one file per screen
    ├── components/
    │   ├── ui/         ← shadcn/ui primitives (button, input, dialog shell, etc.) — generic, not feature-specific
    │   ├── dialogs/     ← feature-specific "add/edit" dialogs (one per feature: debt, expense, product, task)
    │   └── app-shell/   ← app-wide chrome: sidebar layout, theme provider
    ├── hooks/
    └── lib/

backend/              ← the Express API — handles requests, talks to the DB
└── src/
    ├── routes/        ← one file per feature (the actual endpoints)
    ├── middlewares/    ← cross-cutting request handling (404s, error formatting)
    └── lib/            ← small internal utilities (currently just the logger)

shared/               ← code both frontend and backend depend on
├── db/                ← the data model (every database table lives here)
├── schemas/            ← Zod validation schemas — the backend's source of truth for request/response shapes
└── api-client/          ← React Query hooks the frontend uses to call the API
```

## Where do I click to change X?

| I want to... | Go to |
|---|---|
| Change how a screen looks/reads | `frontend/src/pages/*.tsx` |
| Change an "add/edit X" dialog | `frontend/src/components/dialogs/*.tsx` |
| Change the sidebar or overall page chrome | `frontend/src/components/app-shell/` |
| Change a generic UI primitive (button styling, etc.) | `frontend/src/components/ui/` |
| Change what happens when the server receives a request | `backend/src/routes/*.ts` |
| Change how errors/404s are returned by the API | `backend/src/middlewares/` |
| Add/change a database column or table | `shared/db/src/schema/*.ts`, then run `pnpm db:push` |
| Add/change what a request or response looks like | `shared/schemas/src/*.ts` (backend validation), then mirror the field in `shared/api-client/src/types.ts` (frontend types) |
| Add a brand-new field to a form *and* have it saved | Needs 4 edits: `shared/db/src/schema` (storage) → `shared/schemas` (validation) → `backend/src/routes` (backend logic) → `frontend/src/pages` or `components/dialogs` (the form) — ask me and I'll handle all four together |

### Frontend pages (`frontend/src/pages/`)
- `dashboard.tsx` — overview/home screen
- `inventory.tsx` / `product-detail.tsx` — products list and single-product view (incl. recording sales)
- `sales.tsx` — all sales across products
- `debts.tsx` — customer & supplier debts
- `expenses.tsx` — expenses
- `tasks.tsx` — task list
- `not-found.tsx` — 404 page

### Backend routes (`backend/src/routes/`)
One file per feature: `products.ts`, `sales.ts`, `debts.ts`,
`expenses.ts`, `tasks.ts`, `dashboard.ts`, `uploads.ts`, `health.ts`.

### Data model (`shared/db/src/schema/`)
One file per table, matching the routes above.

### How the frontend and backend stay in sync

`shared/schemas` (Zod, used by the backend to validate every request) and
`shared/api-client/src/types.ts` (plain TypeScript, used by the frontend)
describe the same shapes side by side, hand-written — no code generation
step, no separate spec file. If you add a field to one, add it to the other.
This used to go through an OpenAPI-spec-plus-codegen pipeline (3 separate
packages); it was simplified to this because a formal generated contract
is more valuable across separate frontend/backend teams than for one
developer maintaining one app.

## Inventory v2 — Phase D3: simplified card + tabbed Details page

**Product cards** now show exactly what the spec asked for — Cover Image,
Name, Selling Price, Current Stock (via the status badge), Category Badge —
and nothing else. Hover quick actions are down to View, Edit, Sell (Restock
is gone — it always just opened the same Edit form anyway, so nothing was
lost). **Delete moved off the card entirely**, onto the Details page, since
the spec's hover list didn't include it — a destructive action now lives
somewhere more deliberate than a quick hover icon on a grid.

**Product Details page rebuilt** with the header the spec describes (large
image, name, category, status, stock) followed by 5 tabs:
- **Overview** — name, category, brand, description, date added, last updated
- **Inventory** — quantity, low stock alert, SKU/barcode (only shown if the
  product's category template actually uses them)
- **Attributes** — generated directly from the category template, same
  approach as the Add form: loop over `template.attributes`, show whatever
  the product has. Color variants and the size × quantity breakdown appear
  here too, for the categories that have them.
- **Gallery** — every uploaded photo
- **History** — see note below

**History tab — built with real data, but scoped honestly.** It shows the
product's creation date, its last-updated date, and every sale as a
"stock sold" event (reusing data already being fetched, including the
existing delete-a-sale action) — all genuinely real, not placeholder. What
it does *not* have is a field-by-field edit log (distinct "Price changed
from X to Y" / "Edited Details" entries) — that needs its own tracking
mechanism recording each change as it happens, which hasn't been built.
Said plainly in the tab itself so it's not mistaken for a gap. Happy to
build the fuller version as its own next step if you want it.

## Inventory v2 — Phase D2: template-driven Add Product form

`add-product-dialog.tsx` fully rewritten around the Phase D1 category
templates. Category is now step 1 — pick Handbags, Dresses/Clothing, Shoes,
or Accessories, and every step after that renders only what that category's
template declares:

- **Attributes step** is generated directly from `template.attributes` —
  no per-category branching in the form code, just a loop.
- **Variants step** is skipped entirely for Accessories (no color variants,
  no size stock). Handbags gets an optional Color Variants tag list. Dresses
  and Shoes get a size × quantity table (preset sizes from the template —
  XS–XXL for dresses, 36–42 for shoes) with the total calculated live as
  you type — that computed total becomes the product's real `stock` value
  on save, so nothing else in the app needs to know sizes exist.
- **Inventory step** shows Quantity only for flat-stock categories (it's
  skipped for Dresses/Shoes, since stock comes from the size table instead),
  and SKU/Barcode only for the categories whose template asks for them
  (Accessories has neither, per the template).

**Scope note — a judgment call worth knowing about:** the original v1 form
also collected Cost Price and Suggested Selling Price. Neither appears
anywhere in the new category templates, and per the "Inventory shouldn't
manage purchase data" instruction, I've left both out of this form
entirely — only **Selling Price** is collected now (under Basics, since
every product needs one regardless of category). Those two fields, like
Supplier/Purchase Date/Transport Cost before them, still exist in the
database unused, ready for the future Purchases module.

Because the dialog keeps the same name and props (`open`, `onOpenChange`),
this was a drop-in swap — `inventory.tsx` didn't need a single line changed
to use the new version.

## Inventory v2 — Phase D1: category templates (foundation)

The Inventory module is being rebuilt around **category templates**
(`frontend/src/lib/category-templates.ts`) instead of one generic form for
every product. Each of the 4 categories — Handbags, Dresses/Clothing, Shoes,
Accessories — declares its own attributes, whether stock is a flat quantity
or per-size, and which fields it needs. Adding a 5th category later means
adding one entry to that file, not touching form or detail-page code.

**Data model additions** (all new columns, nothing removed): `style`,
`closureType`, `compartments`, `colorVariants`, `pattern`, `sleeveType`,
`fit`, `season`, `shoeType`, and `sizeQuantities` (a JSON array like
`[{ size: "M", quantity: 4 }]` for dresses/shoes). `stock` stays the single
authoritative total everywhere else in the app (sales, low-stock badges,
restock) — for size-based categories it's kept in sync as the sum of
`sizeQuantities` at save time, so nothing already built needs to know sizes
exist at all.

**Purchases-related fields are hidden from Inventory, not deleted.**
`supplier`, `purchaseDate`, `transportCost`, `otherCosts` (added in Phase B)
stay in the database, unused by this module going forward — they'll be
picked up by a dedicated Purchases module later without another migration.
Nothing currently in the UI shows them yet regardless.

**This phase is foundation only** — the new fields and template config
exist, but nothing in the Add Product form, product cards, or Details page
uses them yet. That's next: a template-driven Add Product form, then a
simplified card + tabbed Details page.

## Inventory redesign — refinements after first real use

Two changes based on actually using the redesigned Inventory page:

- **Stat cards double as filters, instead of duplicating as chips too.**
  Low Stock / Out of Stock / Recently Added used to exist both as overview
  stat cards *and* as separate filter chips below — same information, two
  places. Now the stat cards themselves are clickable (tap to filter, tap
  again to clear back to "All"); the chip row underneath is just categories.
  Recently Added is now also a stat card (it wasn't before).
- **Selling moved onto the product card itself**, via a new
  `record-sale-dialog.tsx` — extracted from what used to be an inline form
  that took over the whole Product Detail page. That page now leads with
  the actual product details (including everything from Phase B: brand,
  supplier, purchase date, cost breakdown, sizes, material, color, extra
  photos) and has a "Record a Sale" button that opens the same dialog,
  rather than a form you had to scroll past your own product info to reach.
  Every product card in the grid now has an always-visible "Sell" button
  (not hover-only, so it works on mobile too) that opens the identical
  dialog directly — recording a sale no longer requires opening the
  product's detail page first.

## Inventory redesign — Phase C: guided Add Product flow

A new 5-step guided dialog (`components/dialogs/add-product-dialog.tsx`) for
adding products: Basics → Photos → Pricing & Purchase → Stock → Review, with
live profit/margin calculation and category-aware fields (Sizes for
shoes/dresses; Material & Color for handbags — matched by a simple keyword
heuristic against the category name, shared with the Phase A card/section
grouping logic).

**Deliberately separate from editing**: the existing single-page
`product-dialog.tsx` still handles Edit and the card's "Restock" action
completely unchanged — this redesign only replaces the "Add Product" button's
flow. Two dialogs exist side by side on purpose: a quick single-page form
for editing something that already exists, and a guided multi-step flow for
the more involved job of adding something new (with photos, cost breakdown,
category-specific attributes) end to end.

Photos upload immediately on drop/select (to R2, same as everywhere else in
the app) with inline previews and per-image progress/error states; the first
photo becomes the product's cover image, matching every other place in the
app that already displays a single `imageUrl`.

## Inventory redesign — Phase B: new product fields

Added to support the upcoming multi-step "Add Product" form (Phase C) and
the richer product cards from Phase A:

- `brand`, `supplier`, `purchaseDate`, `transportCost`, `otherCosts`,
  `sku`, `barcode` — all optional
- `images` (string array) — the full photo gallery; `imageUrl` still holds
  the single cover image and works exactly as before, so nothing existing
  needed to change
- `sizes` (string array, for shoes/dresses), `material` and `color`
  (for handbags) — simple optional columns rather than a separate
  per-category schema, since this is one shop's catalog, not a multi-tenant
  one

This is a schema-only change — no form UI uses these fields yet (that's
Phase C). Every new field is optional, so nothing existing broke. Run
`pnpm db:push` after pulling this to add the new columns.

## What's gone from the original Replit export

To cut the clutter, this cleaned version removes purely Replit-specific
scaffolding that had no effect on the app itself:
- `.replit`, `.replitignore`, `.agents/` — Replit's own run/deploy config
- `replit.md` — was an empty, never-filled-in placeholder
- `scripts/` — an unused "hello world" scaffold + a Replit git-merge hook
- `artifacts/mockup-sandbox/` — a separate, unwired prototyping app, not part of the real app
- `node_modules/` — regenerate anytime with `pnpm install`

Nothing about how the app works changed — only files that Replit added around
it and that don't do anything for you locally.

## Code organization

To make the codebase easier for another developer to navigate cold:

- **Frontend components** are now split into 3 clear groups instead of one
  flat folder: `components/ui/` (generic primitives), `components/dialogs/`
  (the 4 feature-specific add/edit forms), and `components/app-shell/`
  (sidebar layout + theme provider — the app's outer chrome).
- **Backend error handling** used to not exist at all — an unmatched route or
  an unexpected server error would leak a raw Express HTML page instead of
  JSON. Added `middlewares/not-found.ts` and `middlewares/error-handler.ts`
  (the `middlewares/` folder existed as an empty placeholder before this;
  it now does what its name says).
- **Removed a dead duplicate file**: `backend/src/lib/lib/logger.ts` was
  an exact, unused copy of `backend/src/lib/logger.ts` sitting one folder too deep —
  the kind of thing that makes a new developer wonder which one is real.
  Deleted; nothing imported it.
- **Flattened the top-level layout**: `artifacts/business-hub` → `frontend/`,
  `artifacts/api-server` → `backend/`, and `lib/` → `shared/`, so the three
  parts of the system (UI, API, shared code) are obvious from the root
  folder listing alone, with no guessing about what `artifacts/` means.

## Performance fixes

- **Every page navigation was re-fetching from scratch.** `QueryClient` had no
  caching configured, so its default `staleTime` of `0` meant every remount
  (i.e. every time you clicked to a page) treated cached data as instantly
  stale and re-fetched over the network, showing a loading skeleton again
  even for a page you'd just visited. Now cached data is considered fresh for
  30 seconds and shown instantly, while still quietly refetching in the
  background to stay current. Actions (adding a sale, paying a debt, etc.)
  still update instantly everywhere regardless of this timer, since they
  explicitly invalidate the exact data they changed.
- **Added database indexes** on the columns the app actually filters/joins/sorts
  by (`sales.product_id`, `sales.debt_id`, `sales.sold_at`), so those lookups
  stay fast as your sales history grows instead of scanning the whole table
  every time.

## Photo storage: Cloudflare R2, not local disk

Product photos are uploaded to Cloudflare R2 (S3-compatible object storage),
not saved on this server's own disk. This matters because most hosting
platforms (Render, Railway, etc.) wipe local disk on every deploy — photos
saved locally would silently disappear the next time you ship an update.
R2 storage is decoupled from wherever the app happens to run, so this isn't
a concern regardless of host. See `LOCAL_SETUP.md` for how to set up a
bucket. `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET_NAME`, and `R2_PUBLIC_URL` are required in `.env` — the app
won't start without them.

## Architecture simplification: dropped OpenAPI codegen

The project originally kept the frontend and backend in sync via a formal
OpenAPI spec (`api-spec/openapi.yaml`) plus a code generation step producing
`api-zod` (backend validation) and `api-client-react` (frontend hooks) —
3 separate packages, none of them hand-editable without breaking the
"generated" fiction (we'd been hand-editing them all session since the
actual `orval` codegen tool was never wired up).

That pattern earns its keep when a frontend team and a backend team need a
strict, enforced contract between them. For one developer maintaining one
app, it was net overhead: a YAML file to keep in sync by hand, 3 packages
instead of 1, and files pretending to be generated that never actually were.

Replaced with 2 plain, hand-written packages:
- **`shared/schemas`** — Zod validation schemas, one file per feature, used
  directly by the backend routes.
- **`shared/api-client`** — TypeScript types + React Query hooks, one file
  per feature, used directly by the frontend pages.

Every hook name, query key function, and type name kept its exact original
name, so no page or route file's actual logic changed — only where the
underlying code lives.

## Feature removed: Invoices

The Sales page used to have a separate "Invoices" tab (its own dialogs,
routes, and database table) for tracking money owed by customers. Since the
**Debts** page already covers "who owes me what," Invoices was removed
entirely — the schema, API routes, spec, generated types, and UI components
are all gone. The dashboard's old "Invoices" stat card is now a "Debts" card
pulling from the same numbers you see on the Debts page.

import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";

import {
  db,
  productsTable,
  supplierDebtsTable,
  supplierDebtPaymentsTable,
  stockPurchasesTable,
  stockPurchaseGroupsTable,
  stockPurchaseItemsTable,
  stockPurchaseCostsTable,
  inventoryCostLayersTable,
} from "@workspace/db";

import {
  CreateStockPurchaseBody,
  UpdateStockPurchaseBody,
  GetStockPurchaseParams,
  AllocatePurchaseGroupParams,
  AllocatePurchaseGroupBody,
  StockPurchaseResponse,
  ListStockPurchasesResponse,
} from "@workspace/schemas";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyString(value: number): string {
  return roundMoney(value).toFixed(2);
}

function getPaymentStatus(
  totalCost: number,
  supplierBalance: number,
): "paid" | "partially_paid" | "unpaid" {
  if (supplierBalance <= 0) {
    return "paid";
  }

  if (supplierBalance >= totalCost) {
    return "unpaid";
  }

  return "partially_paid";
}

/**
 * Human-facing purchase identifier.
 *
 * Example:
 * PUR-2026-0007
 *
 * We generate it only after PostgreSQL has assigned the internal id.
 * The database id remains the authoritative unique sequence.
 */
function makePurchaseNumber(id: number, purchaseDate: Date): string {
  const year = purchaseDate.getUTCFullYear();

  return `PUR-${year}-${String(id).padStart(4, "0")}`;
}

function mapCost(cost: typeof stockPurchaseCostsTable.$inferSelect) {
  return {
    ...cost,

    amount: Number(cost.amount),

    createdAt: cost.createdAt.toISOString(),
  };
}

function mapGroup(group: typeof stockPurchaseGroupsTable.$inferSelect) {
  return {
    ...group,

    unitBuyingPrice: Number(group.unitBuyingPrice),

    createdAt: group.createdAt.toISOString(),
  };
}

/**
 * Old product-level purchase data.
 *
 * New purchases do not create these rows.
 * We retain the mapper so historical purchases remain readable.
 */
function mapLegacyItem(
  item: typeof stockPurchaseItemsTable.$inferSelect,
  productName?: string,
) {
  return {
    ...item,

    productName,

    unitBuyingPrice: Number(item.unitBuyingPrice),

    goodsSubtotal: Number(item.goodsSubtotal),

    allocatedSharedCost: Number(item.allocatedSharedCost),

    landedSubtotal: Number(item.landedSubtotal),

    landedUnitCost: Number(item.landedUnitCost),

    createdAt: item.createdAt.toISOString(),
  };
}

function mapPurchase(
  purchase: typeof stockPurchasesTable.$inferSelect,

  stockGroups: Array<ReturnType<typeof mapGroup>>,

  sharedCosts: Array<ReturnType<typeof mapCost>>,

  legacyItems: Array<ReturnType<typeof mapLegacyItem>>,

  supplierBalance: number,
) {
  const goodsTotal = Number(purchase.goodsTotal);

  const sharedCostsTotal = Number(purchase.sharedCostsTotal);

  const totalCost = Number(purchase.totalCost);

  const amountPaid = Number(purchase.amountPaid);

  /**
   * New purchases derive quantity from stock groups.
   *
   * Historical purchases do not have stock groups, so fall back to
   * the quantities stored in the old product-level purchase items.
   */
  const totalQuantity =
    stockGroups.length > 0
      ? stockGroups.reduce((sum, group) => sum + group.quantity, 0)
      : legacyItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    ...purchase,

    goodsTotal,

    sharedCostsTotal,

    totalCost,

    amountPaid,

    totalQuantity,

    supplierBalance,

    paymentStatus: getPaymentStatus(totalCost, supplierBalance),

    purchaseDate: purchase.purchaseDate.toISOString(),

    createdAt: purchase.createdAt.toISOString(),

    updatedAt: purchase.updatedAt.toISOString(),

    stockGroups,

    sharedCosts,

    legacyItems,
  };
}

// ─── Read helpers ─────────────────────────────────────────────────────────────

async function getSupplierBalance(
  purchase: typeof stockPurchasesTable.$inferSelect,
): Promise<number> {
  let balance = Math.max(
    0,
    roundMoney(Number(purchase.totalCost) - Number(purchase.amountPaid)),
  );

  /**
   * If a supplier debt exists, use it as the current source of truth.
   *
   * That means repayments made later through Debts are reflected
   * automatically when the purchase is viewed again.
   */
  if (purchase.supplierDebtId != null) {
    const [debt] = await db
      .select()
      .from(supplierDebtsTable)
      .where(eq(supplierDebtsTable.id, purchase.supplierDebtId));

    if (debt) {
      balance = Math.max(
        0,
        roundMoney(Number(debt.amount) - Number(debt.amountPaid)),
      );
    }
  }

  return balance;
}

async function loadPurchaseDetails(
  purchase: typeof stockPurchasesTable.$inferSelect,
) {
  const groupRows = await db
    .select()
    .from(stockPurchaseGroupsTable)
    .where(eq(stockPurchaseGroupsTable.purchaseId, purchase.id));

  const costRows = await db
    .select()
    .from(stockPurchaseCostsTable)
    .where(eq(stockPurchaseCostsTable.purchaseId, purchase.id));

  /**
   * Historical product-level rows.
   *
   * LEFT JOIN is intentional:
   * if an old product ever becomes unavailable, the procurement
   * history itself should still remain readable.
   */
  const legacyRows = await db
    .select({
      item: stockPurchaseItemsTable,
      productName: productsTable.name,
    })
    .from(stockPurchaseItemsTable)
    .leftJoin(
      productsTable,
      eq(stockPurchaseItemsTable.productId, productsTable.id),
    )
    .where(eq(stockPurchaseItemsTable.purchaseId, purchase.id));

  const supplierBalance = await getSupplierBalance(purchase);

  return mapPurchase(
    purchase,

    groupRows.map(mapGroup),

    costRows.map(mapCost),

    legacyRows.map(({ item, productName }) =>
      mapLegacyItem(item, productName ?? undefined),
    ),

    supplierBalance,
  );
}

// ─── CREATE STOCK PURCHASE ────────────────────────────────────────────────────

router.post(
  "/stock-purchases",

  async (req, res): Promise<void> => {
    const parsed = CreateStockPurchaseBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.message,
      });

      return;
    }

    const data = parsed.data;

    try {
      const created = await db.transaction(async (tx) => {
        const purchaseDate = new Date(data.purchaseDate);

        if (Number.isNaN(purchaseDate.getTime())) {
          throw new Error("Invalid purchase date");
        }

        // ── Calculate totals ──────────────────────

        const goodsTotal = roundMoney(
          data.stockGroups.reduce(
            (sum, group) => sum + group.quantity * group.unitBuyingPrice,
            0,
          ),
        );

        const sharedCostsTotal = roundMoney(
          data.sharedCosts.reduce((sum, cost) => sum + cost.amount, 0),
        );

        const totalCost = roundMoney(goodsTotal + sharedCostsTotal);

        if (data.amountPaid > totalCost) {
          throw new Error("Amount paid cannot exceed total purchase cost");
        }

        const supplierBalance = roundMoney(totalCost - data.amountPaid);

        // ── Create purchase header ────────────────

        const [purchase] = await tx
          .insert(stockPurchasesTable)
          .values({
            supplierName: data.supplierName,

            supplierPhone: data.supplierPhone || null,

            purchaseDate,

            goodsTotal: moneyString(goodsTotal),

            sharedCostsTotal: moneyString(sharedCostsTotal),

            totalCost: moneyString(totalCost),

            amountPaid: moneyString(data.amountPaid),

            reference: data.reference || null,

            notes: data.notes || null,
          })
          .returning();

        // ── Generate readable purchase number ─────

        const purchaseNumber = makePurchaseNumber(purchase.id, purchaseDate);

        const [numberedPurchase] = await tx
          .update(stockPurchasesTable)
          .set({
            purchaseNumber,
          })
          .where(eq(stockPurchasesTable.id, purchase.id))
          .returning();

        // ── Store lightweight stock groups ─────────

        const insertedGroups = await tx
          .insert(stockPurchaseGroupsTable)
          .values(
            data.stockGroups.map((group) => ({
              purchaseId: purchase.id,

              category: group.category,

              quantity: group.quantity,

              unitBuyingPrice: moneyString(group.unitBuyingPrice),

              description: group.description || null,
            })),
          )
          .returning();

        // ── Store optional additional costs ────────

        let insertedCosts: Array<typeof stockPurchaseCostsTable.$inferSelect> =
          [];

        if (data.sharedCosts.length > 0) {
          insertedCosts = await tx
            .insert(stockPurchaseCostsTable)
            .values(
              data.sharedCosts.map((cost) => ({
                purchaseId: purchase.id,

                label: cost.label,

                amount: moneyString(cost.amount),
              })),
            )
            .returning();
        }

        // ── Automatically create supplier debt ────

        let supplierDebtId: number | null = null;

        if (supplierBalance > 0) {
          const [debt] = await tx
            .insert(supplierDebtsTable)
            .values({
              supplierName: data.supplierName,

              phone: data.supplierPhone || null,

              description: `Stock purchase ${purchaseNumber}`,

              /**
               * Keep the complete procurement amount and the
               * amount already paid.
               *
               * The Debts module can therefore calculate the
               * outstanding amount and track later repayments.
               */
              amount: moneyString(totalCost),

              amountPaid: moneyString(data.amountPaid),

              notes: data.notes || undefined,
            })
            .returning();

          supplierDebtId = debt.id;

          /**
           * Record money paid at the time of purchase as the
           * first payment-history entry.
           *
           * supplierDebts.amountPaid remains the cumulative
           * cached total, while this row preserves what
           * actually happened and when.
           */
          if (data.amountPaid > 0) {
            await tx.insert(supplierDebtPaymentsTable).values({
              supplierDebtId: debt.id,

              amount: moneyString(data.amountPaid),

              paymentDate: purchaseDate,

              method: null,

              reference: data.reference || null,

              notes: "Initial purchase payment",
            });
          }

          await tx
            .update(stockPurchasesTable)
            .set({
              supplierDebtId,
            })
            .where(eq(stockPurchasesTable.id, purchase.id));
        }

        const purchaseWithDebt = {
          ...numberedPurchase,
          supplierDebtId,
        };

        return mapPurchase(
          purchaseWithDebt,

          insertedGroups.map(mapGroup),

          insertedCosts.map(mapCost),

          [],

          supplierBalance,
        );
      });

      res.status(201).json(StockPurchaseResponse.parse(created));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create stock purchase";

      res.status(400).json({
        error: message,
      });
    }
  },
);

// ─── LIST STOCK PURCHASES ─────────────────────────────────────────────────────

router.get(
  "/stock-purchases",

  async (_req, res): Promise<void> => {
    try {
      const purchases = await db
        .select()
        .from(stockPurchasesTable)
        .orderBy(
          desc(stockPurchasesTable.purchaseDate),
          desc(stockPurchasesTable.id),
        );

      const result = [];

      for (const purchase of purchases) {
        result.push(await loadPurchaseDetails(purchase));
      }

      res.json(ListStockPurchasesResponse.parse(result));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load stock purchases";

      res.status(500).json({
        error: message,
      });
    }
  },
);

// ─── GET ONE STOCK PURCHASE ──────────────────────────────────────────────────

router.get(
  "/stock-purchases/:id",

  async (req, res): Promise<void> => {
    const params = GetStockPurchaseParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        error: params.error.message,
      });

      return;
    }

    try {
      const [purchase] = await db
        .select()
        .from(stockPurchasesTable)
        .where(eq(stockPurchasesTable.id, params.data.id));

      if (!purchase) {
        res.status(404).json({
          error: "Stock purchase not found",
        });

        return;
      }

      const result = await loadPurchaseDetails(purchase);

      res.json(StockPurchaseResponse.parse(result));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load stock purchase";

      res.status(500).json({
        error: message,
      });
    }
  },
);

// ─── ALLOCATE PURCHASE GROUP TO INVENTORY ─────────────────────────────────────

router.post(
  "/stock-purchases/groups/:groupId/allocate",

  async (req, res): Promise<void> => {
    const params = AllocatePurchaseGroupParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        error: params.error.message,
      });
      return;
    }

    const body = AllocatePurchaseGroupBody.safeParse(req.body);

    if (!body.success) {
      res.status(400).json({
        error: body.error.message,
      });
      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const groupId = params.data.groupId;
        const productId = body.data.productId;
        const quantity = body.data.quantity;

        /**
         * Serialize allocations for this purchase group.
         *
         * Without this row lock, two requests could both read the same
         * available quantity and over-allocate the purchase.
         */
        await tx.execute(
          sql`select id
              from stock_purchase_groups
              where id = ${groupId}
              for update`,
        );

        const [group] = await tx
          .select()
          .from(stockPurchaseGroupsTable)
          .where(eq(stockPurchaseGroupsTable.id, groupId));

        if (!group) {
          throw new Error("Purchase group not found");
        }

        const [purchase] = await tx
          .select()
          .from(stockPurchasesTable)
          .where(eq(stockPurchasesTable.id, group.purchaseId));

        if (!purchase) {
          throw new Error("Stock purchase not found");
        }

        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, productId));

        if (!product) {
          throw new Error("Inventory product not found");
        }

        /**
         * Size-based products require allocation into individual sizes.
         * Updating only products.stock would make their size breakdown
         * disagree with the authoritative total.
         */
        if (
          Array.isArray(product.sizeQuantities) &&
          product.sizeQuantities.length > 0
        ) {
          throw new Error(
            "Size-based inventory cannot be allocated through this workflow yet",
          );
        }

        /**
         * Cost layers themselves are the allocation ledger.
         * SUM(quantityReceived) tells us exactly how many units from
         * this purchase group have already entered Inventory.
         */
        const [allocation] = await tx
          .select({
            quantity: sql<number>`coalesce(sum(${inventoryCostLayersTable.quantityReceived}), 0)::int`,
          })
          .from(inventoryCostLayersTable)
          .where(eq(inventoryCostLayersTable.purchaseGroupId, group.id));

        const alreadyAllocated = Number(allocation?.quantity ?? 0);

        const available = group.quantity - alreadyAllocated;

        if (quantity > available) {
          throw new Error(
            `Only ${available} unit${available === 1 ? "" : "s"} remain available to add to Inventory`,
          );
        }

        /**
         * Allocate purchase-wide shared costs in proportion to
         * this group's goods value.
         *
         * Example:
         * group goods value / purchase goods total = group's share
         * of transport and other shared purchase costs.
         */
        const unitGoodsCost = Number(group.unitBuyingPrice);

        const groupGoodsTotal = group.quantity * unitGoodsCost;

        const purchaseGoodsTotal = Number(purchase.goodsTotal);

        const purchaseSharedCostsTotal = Number(purchase.sharedCostsTotal);

        const groupShare =
          purchaseGoodsTotal > 0 ? groupGoodsTotal / purchaseGoodsTotal : 0;

        const groupSharedCost = purchaseSharedCostsTotal * groupShare;

        const unitSharedCost =
          group.quantity > 0 ? groupSharedCost / group.quantity : 0;

        const roundedUnitGoodsCost = roundMoney(unitGoodsCost);

        const roundedUnitSharedCost = roundMoney(unitSharedCost);

        const landedUnitCost = roundMoney(
          roundedUnitGoodsCost + roundedUnitSharedCost,
        );

        /**
         * products.stock remains the authoritative quantity used
         * throughout the existing app.
         *
         * Increment it atomically rather than calculating a new stock
         * value in application memory.
         */
        const [updatedProduct] = await tx
          .update(productsTable)
          .set({
            stock: sql`${productsTable.stock} + ${quantity}`,
          })
          .where(eq(productsTable.id, product.id))
          .returning();

        if (!updatedProduct) {
          throw new Error("Failed to update Inventory stock");
        }

        const [costLayer] = await tx
          .insert(inventoryCostLayersTable)
          .values({
            productId: product.id,
            purchaseGroupId: group.id,

            quantityReceived: quantity,
            quantityRemaining: quantity,

            unitGoodsCost: moneyString(roundedUnitGoodsCost),

            unitSharedCost: moneyString(roundedUnitSharedCost),

            landedUnitCost: moneyString(landedUnitCost),

            receivedAt: new Date(),
          })
          .returning();

        if (!costLayer) {
          throw new Error("Failed to create inventory cost layer");
        }

        return {
          product: {
            id: updatedProduct.id,
            name: updatedProduct.name,
            stock: updatedProduct.stock,
          },

          allocation: {
            purchaseGroupId: group.id,
            quantityAllocated: quantity,
            quantityPreviouslyAllocated: alreadyAllocated,
            quantityRemaining: available - quantity,
          },

          costLayer: {
            id: costLayer.id,
            quantityReceived: costLayer.quantityReceived,
            quantityRemaining: costLayer.quantityRemaining,
            unitGoodsCost: Number(costLayer.unitGoodsCost),
            unitSharedCost: Number(costLayer.unitSharedCost),
            landedUnitCost: Number(costLayer.landedUnitCost),
          },
        };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("PURCHASE GROUP ALLOCATION FAILED:", error);

      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to add purchased stock to Inventory";

      res.status(400).json({
        error: message,
      });
    }
  },
);

// ─── UPDATE STOCK PURCHASE ────────────────────────────────────────────────────

router.patch(
  "/stock-purchases/:id",

  async (req, res): Promise<void> => {
    const params = GetStockPurchaseParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        error: params.error.message,
      });

      return;
    }

    const body = UpdateStockPurchaseBody.safeParse(req.body);

    if (!body.success) {
      res.status(400).json({
        error: body.error.message,
      });

      return;
    }

    try {
      const result = await db.transaction(async (tx) => {
        const [purchase] = await tx
          .select()
          .from(stockPurchasesTable)
          .where(eq(stockPurchasesTable.id, params.data.id));

        if (!purchase) {
          throw new Error("Stock purchase not found");
        }

        /**
         * Only the new lightweight group-based
         * purchase model is editable.
         *
         * Historical product-level purchases remain
         * readable but should not be rewritten through
         * the new procurement form.
         */
        const existingGroups = await tx
          .select()
          .from(stockPurchaseGroupsTable)
          .where(eq(stockPurchaseGroupsTable.purchaseId, purchase.id));

        if (existingGroups.length === 0) {
          throw new Error(
            "Historical purchases cannot be edited with the new purchase form",
          );
        }

        /**
         * Once any stock from this purchase has entered Inventory,
         * its cost-defining data becomes accounting history.
         *
         * The current edit flow replaces purchase-group rows, so
         * editing an allocated purchase would break provenance and
         * could make previously allocated units allocatable again.
         */
        const [allocation] = await tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(inventoryCostLayersTable)
          .innerJoin(
            stockPurchaseGroupsTable,
            eq(
              inventoryCostLayersTable.purchaseGroupId,
              stockPurchaseGroupsTable.id,
            ),
          )
          .where(eq(stockPurchaseGroupsTable.purchaseId, purchase.id));

        if (Number(allocation?.count ?? 0) > 0) {
          throw new Error(
            "This purchase cannot be edited because stock from it has already been added to Inventory",
          );
        }

        const sharedCostsTotal = roundMoney(
          body.data.sharedCosts.reduce((sum, cost) => sum + cost.amount, 0),
        );

        const goodsTotal = roundMoney(
          body.data.stockGroups.reduce(
            (sum, group) => sum + group.quantity * group.unitBuyingPrice,
            0,
          ),
        );

        const totalCost = roundMoney(goodsTotal + sharedCostsTotal);

        const totalQuantity = body.data.stockGroups.reduce(
          (sum, group) => sum + group.quantity,
          0,
        );

        /**
         * Preserve actual money already paid.
         *
         * If a supplier debt exists, its amountPaid is
         * authoritative because later payments are
         * recorded against that debt.
         *
         * If there is no debt, the purchase's original
         * amountPaid is the amount that was paid when
         * the purchase was created.
         */
        let amountAlreadyPaid = Number(purchase.amountPaid);

        let linkedDebt: typeof supplierDebtsTable.$inferSelect | undefined;

        if (purchase.supplierDebtId) {
          const [debt] = await tx
            .select()
            .from(supplierDebtsTable)
            .where(eq(supplierDebtsTable.id, purchase.supplierDebtId));

          linkedDebt = debt;

          if (debt) {
            amountAlreadyPaid = Number(debt.amountPaid);
          }
        }

        amountAlreadyPaid = roundMoney(amountAlreadyPaid);

        if (totalCost < amountAlreadyPaid) {
          throw new Error(
            `Purchase total cannot be lower than the amount already paid (${moneyString(
              amountAlreadyPaid,
            )})`,
          );
        }

        const supplierBalance = roundMoney(totalCost - amountAlreadyPaid);

        const purchaseDate = new Date(body.data.purchaseDate);

        if (Number.isNaN(purchaseDate.getTime())) {
          throw new Error("Invalid purchase date");
        }

        /**
         * Replace lightweight stock groups and shared
         * costs with the edited values.
         */
        await tx
          .delete(stockPurchaseGroupsTable)
          .where(eq(stockPurchaseGroupsTable.purchaseId, purchase.id));

        await tx
          .delete(stockPurchaseCostsTable)
          .where(eq(stockPurchaseCostsTable.purchaseId, purchase.id));

        await tx.insert(stockPurchaseGroupsTable).values(
          body.data.stockGroups.map((group) => ({
            purchaseId: purchase.id,

            category: group.category,

            quantity: group.quantity,

            unitBuyingPrice: moneyString(group.unitBuyingPrice),

            description: group.description || null,
          })),
        );

        if (body.data.sharedCosts.length > 0) {
          await tx.insert(stockPurchaseCostsTable).values(
            body.data.sharedCosts.map((cost) => ({
              purchaseId: purchase.id,

              label: cost.label,

              amount: moneyString(cost.amount),
            })),
          );
        }

        /**
         * Keep the purchase's cached amountPaid aligned
         * with the authoritative cumulative amount.
         */
        await tx
          .update(stockPurchasesTable)
          .set({
            supplierName: body.data.supplierName,

            supplierPhone: body.data.supplierPhone || null,

            purchaseDate,

            goodsTotal: moneyString(goodsTotal),

            sharedCostsTotal: moneyString(sharedCostsTotal),

            totalCost: moneyString(totalCost),

            amountPaid: moneyString(amountAlreadyPaid),

            reference: body.data.reference || null,

            notes: body.data.notes || null,
          })
          .where(eq(stockPurchasesTable.id, purchase.id));

        let supplierDebtId = purchase.supplierDebtId;

        if (linkedDebt) {
          /**
           * Keep the debt even when the new balance is
           * zero so its payment history remains intact.
           */
          await tx
            .update(supplierDebtsTable)
            .set({
              supplierName: body.data.supplierName,

              phone: body.data.supplierPhone || null,

              description: `Stock purchase ${
                purchase.purchaseNumber ?? `#${purchase.id}`
              }`,

              amount: moneyString(totalCost),

              amountPaid: moneyString(amountAlreadyPaid),
            })
            .where(eq(supplierDebtsTable.id, linkedDebt.id));
        } else if (supplierBalance > 0) {
          /**
           * A previously fully-paid purchase became more
           * expensive after editing. Create a debt only
           * for the newly outstanding purchase total.
           *
           * No payment-history row is created here:
           * amountAlreadyPaid represents money that was
           * already paid before this debt existed.
           */
          const [debt] = await tx
            .insert(supplierDebtsTable)
            .values({
              supplierName: body.data.supplierName,

              description: `Stock purchase ${
                purchase.purchaseNumber ?? `#${purchase.id}`
              }`,

              amount: moneyString(totalCost),

              amountPaid: moneyString(amountAlreadyPaid),

              notes: body.data.notes || "",
            })
            .returning();

          supplierDebtId = debt.id;

          await tx
            .update(stockPurchasesTable)
            .set({
              supplierDebtId: debt.id,
            })
            .where(eq(stockPurchasesTable.id, purchase.id));
        }

        const [updatedPurchase] = await tx
          .select()
          .from(stockPurchasesTable)
          .where(eq(stockPurchasesTable.id, purchase.id));

        const updatedGroups = await tx
          .select()
          .from(stockPurchaseGroupsTable)
          .where(eq(stockPurchaseGroupsTable.purchaseId, purchase.id));

        const updatedCosts = await tx
          .select()
          .from(stockPurchaseCostsTable)
          .where(eq(stockPurchaseCostsTable.purchaseId, purchase.id));

        const legacyRows = await tx
          .select({
            item: stockPurchaseItemsTable,
            productName: productsTable.name,
          })
          .from(stockPurchaseItemsTable)
          .leftJoin(
            productsTable,
            eq(stockPurchaseItemsTable.productId, productsTable.id),
          )
          .where(eq(stockPurchaseItemsTable.purchaseId, purchase.id));

        return mapPurchase(
          {
            ...updatedPurchase,
            supplierDebtId,
          },
          updatedGroups.map(mapGroup),
          updatedCosts.map(mapCost),
          legacyRows.map(({ item, productName }) =>
            mapLegacyItem(item, productName ?? undefined),
          ),
          supplierBalance,
        );
      });

      res.json(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update stock purchase";

      if (message === "Stock purchase not found") {
        res.status(404).json({
          error: message,
        });

        return;
      }

      res.status(400).json({
        error: message,
      });
    }
  },
);

// ─── DELETE STOCK PURCHASE ────────────────────────────────────────────────────

router.delete(
  "/stock-purchases/:id",

  async (req, res): Promise<void> => {
    const params = GetStockPurchaseParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({
        error: params.error.message,
      });

      return;
    }

    try {
      await db.transaction(async (tx) => {
        const [purchase] = await tx
          .select()
          .from(stockPurchasesTable)
          .where(eq(stockPurchasesTable.id, params.data.id));

        if (!purchase) {
          throw new Error("Stock purchase not found");
        }

        const supplierDebtId = purchase.supplierDebtId;

        /**
         * Once stock from this purchase has entered Inventory,
         * preserve the purchase as part of the inventory cost trail.
         */
        const [allocation] = await tx
          .select({
            count: sql<number>`count(*)::int`,
          })
          .from(inventoryCostLayersTable)
          .innerJoin(
            stockPurchaseGroupsTable,
            eq(
              inventoryCostLayersTable.purchaseGroupId,
              stockPurchaseGroupsTable.id,
            ),
          )
          .where(eq(stockPurchaseGroupsTable.purchaseId, purchase.id));

        if (Number(allocation?.count ?? 0) > 0) {
          throw new Error(
            "This purchase cannot be deleted because stock from it has already been added to Inventory",
          );
        }

        /**
         * Delete the purchase first.
         *
         * PostgreSQL automatically removes:
         * - stock_purchase_groups
         * - stock_purchase_items (legacy)
         * - stock_purchase_costs
         *
         * through their ON DELETE CASCADE
         * relationships.
         *
         * The purchase only references the supplier
         * debt with ON DELETE SET NULL, so deleting
         * the purchase does not destroy the debt.
         */
        await tx
          .delete(stockPurchasesTable)
          .where(eq(stockPurchasesTable.id, purchase.id));

        /**
         * A supplier debt linked from a purchase was
         * generated by that purchase, so remove it too.
         *
         * supplier_debt_payments uses ON DELETE CASCADE,
         * therefore all payment-history rows belonging
         * to this debt are removed automatically.
         */
        if (supplierDebtId) {
          await tx
            .delete(supplierDebtsTable)
            .where(eq(supplierDebtsTable.id, supplierDebtId));
        }
      });

      res.status(204).send();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete stock purchase";

      if (message === "Stock purchase not found") {
        res.status(404).json({
          error: message,
        });

        return;
      }

      res.status(400).json({
        error: message,
      });
    }
  },
);

export default router;

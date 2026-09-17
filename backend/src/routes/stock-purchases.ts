import { Router, type IRouter } from "express";
import {
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";

import {
  db,
  productsTable,
  supplierDebtsTable,
  stockPurchasesTable,
  stockPurchaseItemsTable,
  stockPurchaseCostsTable,
} from "@workspace/db";

import {
  CreateStockPurchaseBody,
  GetStockPurchaseParams,
  StockPurchaseResponse,
  ListStockPurchasesResponse,
} from "@workspace/schemas";

const router: IRouter = Router();

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function moneyString(value: number): string {
  return roundMoney(value).toFixed(2);
}

function mapCost(
  cost: typeof stockPurchaseCostsTable.$inferSelect,
) {
  return {
    ...cost,
    amount: Number(cost.amount),
    createdAt: cost.createdAt.toISOString(),
  };
}

function mapItem(
  item: typeof stockPurchaseItemsTable.$inferSelect,
  productName?: string,
) {
  return {
    ...item,
    productName,
    unitBuyingPrice: Number(
      item.unitBuyingPrice,
    ),
    goodsSubtotal: Number(
      item.goodsSubtotal,
    ),
    allocatedSharedCost: Number(
      item.allocatedSharedCost,
    ),
    landedSubtotal: Number(
      item.landedSubtotal,
    ),
    landedUnitCost: Number(
      item.landedUnitCost,
    ),
    createdAt: item.createdAt.toISOString(),
  };
}

function mapPurchase(
  purchase: typeof stockPurchasesTable.$inferSelect,
  items: Array<
    ReturnType<typeof mapItem>
  >,
  sharedCosts: Array<
    ReturnType<typeof mapCost>
  >,
  supplierBalance: number,
) {
  return {
    ...purchase,

    goodsTotal: Number(
      purchase.goodsTotal,
    ),

    sharedCostsTotal: Number(
      purchase.sharedCostsTotal,
    ),

    totalCost: Number(
      purchase.totalCost,
    ),

    amountPaid: Number(
      purchase.amountPaid,
    ),

    supplierBalance,

    purchaseDate:
      purchase.purchaseDate.toISOString(),

    createdAt:
      purchase.createdAt.toISOString(),

    updatedAt:
      purchase.updatedAt.toISOString(),

    items,

    sharedCosts,
  };
}

/**
 * Allocates shared procurement costs across purchase lines.
 *
 * Normal rule:
 *   allocation is proportional to each line's goods value.
 *
 * Example:
 *   Product A goods value = 60% of purchase
 *   → receives 60% of transport/shared costs.
 *
 * Edge case:
 *   if all goods values are zero, allocation falls back to quantity share.
 *
 * The final line receives the rounding remainder so that allocations add up
 * exactly to sharedCostsTotal.
 */
function allocateSharedCosts(
  lines: Array<{
    productId: number;
    quantity: number;
    unitBuyingPrice: number;
    goodsSubtotal: number;
  }>,
  sharedCostsTotal: number,
) {
  const goodsTotal = roundMoney(
    lines.reduce(
      (sum, line) =>
        sum + line.goodsSubtotal,
      0,
    ),
  );

  const totalQuantity = lines.reduce(
    (sum, line) =>
      sum + line.quantity,
    0,
  );

  let allocatedSoFar = 0;

  return lines.map(
    (line, index) => {
      let allocatedSharedCost: number;

      const isLast =
        index === lines.length - 1;

      if (isLast) {
        allocatedSharedCost =
          roundMoney(
            sharedCostsTotal -
              allocatedSoFar,
          );
      } else {
        const share =
          goodsTotal > 0
            ? line.goodsSubtotal /
              goodsTotal
            : line.quantity /
              totalQuantity;

        allocatedSharedCost =
          roundMoney(
            sharedCostsTotal * share,
          );

        allocatedSoFar =
          roundMoney(
            allocatedSoFar +
              allocatedSharedCost,
          );
      }

      const landedSubtotal =
        roundMoney(
          line.goodsSubtotal +
            allocatedSharedCost,
        );

      const landedUnitCost =
        roundMoney(
          landedSubtotal /
            line.quantity,
        );

      return {
        ...line,
        allocatedSharedCost,
        landedSubtotal,
        landedUnitCost,
      };
    },
  );
}

// ─── CREATE STOCK PURCHASE ───────────────────────────────────────────────────

router.post(
  "/stock-purchases",
  async (req, res): Promise<void> => {
    const parsed =
      CreateStockPurchaseBody.safeParse(
        req.body,
      );

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.message,
      });
      return;
    }

    const data = parsed.data;

    try {
      const created =
        await db.transaction(
          async (tx) => {
            // ── Resolve purchase products ─────────────
            //
            // Existing lines reference products already in the catalog.
            // New lines create their catalog product inside THIS transaction.
            // Nothing is committed unless the entire procurement succeeds.

            const existingItems =
              data.items.filter(
                (item) =>
                  item.type === "existing",
              );

            const existingProductIds =
              existingItems.map(
                (item) => item.productId,
              );

            const uniqueProductIds = [
              ...new Set(existingProductIds),
            ];

            const existingProducts =
              uniqueProductIds.length > 0
                ? await tx
                    .select()
                    .from(productsTable)
                    .where(
                      inArray(
                        productsTable.id,
                        uniqueProductIds,
                      ),
                    )
                : [];

            if (
              existingProducts.length !==
              uniqueProductIds.length
            ) {
              throw new Error(
                "One or more selected products do not exist",
              );
            }

            const productMap =
              new Map(
                existingProducts.map(
                  (product) => [
                    product.id,
                    product,
                  ],
                ),
              );

            const resolvedItems: Array<{
              productId: number;
              quantity: number;
              unitBuyingPrice: number;
            }> = [];

            for (const item of data.items) {
              if (item.type === "existing") {
                resolvedItems.push({
                  productId: item.productId,
                  quantity: item.quantity,
                  unitBuyingPrice:
                    item.unitBuyingPrice,
                });

                continue;
              }

              const [newProduct] =
                await tx
                  .insert(productsTable)
                  .values({
                    name: item.product.name,
                    category:
                      item.product.category,
                    brand:
                      item.product.brand ||
                      null,
                    description:
                      item.product.description ||
                      "",
                    imageUrl:
                      item.product.imageUrl ||
                      null,
                    price: moneyString(
                      item.product.price,
                    ),
                    stock: 0,
                    lowStockThreshold:
                      item.product
                        .lowStockThreshold ??
                      1,
                    buyingPrice:
                      moneyString(
                        item.unitBuyingPrice,
                      ),
                    supplier:
                      data.supplierName,
                    purchaseDate:
                      new Date(
                        data.purchaseDate,
                      ),
                  })
                  .returning();

              productMap.set(
                newProduct.id,
                newProduct,
              );

              resolvedItems.push({
                productId: newProduct.id,
                quantity: item.quantity,
                unitBuyingPrice:
                  item.unitBuyingPrice,
              });
            }

            // ── Calculate goods totals ──────────────
            const baseLines =
              resolvedItems.map(
                (item) => {
                  const goodsSubtotal =
                    roundMoney(
                      item.quantity *
                        item.unitBuyingPrice,
                    );

                  return {
                    productId:
                      item.productId,

                    quantity:
                      item.quantity,

                    unitBuyingPrice:
                      item.unitBuyingPrice,

                    goodsSubtotal,
                  };
                },
              );

            const goodsTotal =
              roundMoney(
                baseLines.reduce(
                  (sum, line) =>
                    sum +
                    line.goodsSubtotal,
                  0,
                ),
              );

            // ── Calculate shared costs ──────────────
            const sharedCostsTotal =
              roundMoney(
                data.sharedCosts.reduce(
                  (sum, cost) =>
                    sum +
                    cost.amount,
                  0,
                ),
              );

            const totalCost =
              roundMoney(
                goodsTotal +
                  sharedCostsTotal,
              );

            if (
              data.amountPaid >
              totalCost
            ) {
              throw new Error(
                "Amount paid cannot exceed procurement total",
              );
            }

            const supplierBalance =
              roundMoney(
                totalCost -
                  data.amountPaid,
              );

            // ── Allocate shared costs ───────────────
            const allocatedLines =
              allocateSharedCosts(
                baseLines,
                sharedCostsTotal,
              );

            // ── Create purchase header ──────────────
            const [purchase] =
              await tx
                .insert(
                  stockPurchasesTable,
                )
                .values({
                  supplierName:
                    data.supplierName,

                  supplierPhone:
                    data.supplierPhone ||
                    null,

                  purchaseDate:
                    new Date(
                      data.purchaseDate,
                    ),

                  goodsTotal:
                    moneyString(
                      goodsTotal,
                    ),

                  sharedCostsTotal:
                    moneyString(
                      sharedCostsTotal,
                    ),

                  totalCost:
                    moneyString(
                      totalCost,
                    ),

                  amountPaid:
                    moneyString(
                      data.amountPaid,
                    ),

                  notes:
                    data.notes || null,
                })
                .returning();

            // ── Store purchase items ────────────────
            const insertedItems =
              await tx
                .insert(
                  stockPurchaseItemsTable,
                )
                .values(
                  allocatedLines.map(
                    (line) => ({
                      purchaseId:
                        purchase.id,

                      productId:
                        line.productId,

                      quantity:
                        line.quantity,

                      unitBuyingPrice:
                        moneyString(
                          line.unitBuyingPrice,
                        ),

                      goodsSubtotal:
                        moneyString(
                          line.goodsSubtotal,
                        ),

                      allocatedSharedCost:
                        moneyString(
                          line.allocatedSharedCost,
                        ),

                      landedSubtotal:
                        moneyString(
                          line.landedSubtotal,
                        ),

                      landedUnitCost:
                        moneyString(
                          line.landedUnitCost,
                        ),
                    }),
                  ),
                )
                .returning();

            // ── Store flexible shared costs ─────────
            let insertedCosts:
              Array<
                typeof stockPurchaseCostsTable.$inferSelect
              > = [];

            if (
              data.sharedCosts.length >
              0
            ) {
              insertedCosts =
                await tx
                  .insert(
                    stockPurchaseCostsTable,
                  )
                  .values(
                    data.sharedCosts.map(
                      (cost) => ({
                        purchaseId:
                          purchase.id,

                        label:
                          cost.label,

                        amount:
                          moneyString(
                            cost.amount,
                          ),
                      }),
                    ),
                  )
                  .returning();
            }

            // ── Increase stock ──────────────────────
            //
            // Also update the product's latest supplier buying-price metadata.
            // Purchase history itself remains preserved in stock_purchase_items.
            for (
              const line of allocatedLines
            ) {
              await tx
                .update(productsTable)
                .set({
                  stock:
                    sql`${productsTable.stock} + ${line.quantity}`,

                  buyingPrice:
                    moneyString(
                      line.unitBuyingPrice,
                    ),

                  supplier:
                    data.supplierName,

                  purchaseDate:
                    new Date(
                      data.purchaseDate,
                    ),
                })
                .where(
                  eq(
                    productsTable.id,
                    line.productId,
                  ),
                );
            }

            // ── Supplier debt ───────────────────────
            let supplierDebtId:
              | number
              | null = null;

            if (
              supplierBalance > 0
            ) {
              const [debt] =
                await tx
                  .insert(
                    supplierDebtsTable,
                  )
                  .values({
                    supplierName:
                      data.supplierName,

                    phone:
                      data.supplierPhone ||
                      null,

                    description:
                      `Stock purchase #${purchase.id}`,

                    /**
                     * Store the COMPLETE procurement total and what was already
                     * paid. This lets the Debts page display the correct
                     * remaining supplier balance.
                     */
                    amount:
                      moneyString(
                        totalCost,
                      ),

                    amountPaid:
                      moneyString(
                        data.amountPaid,
                      ),

                    notes:
                      data.notes ||
                      undefined,
                  })
                  .returning();

              supplierDebtId =
                debt.id;

              await tx
                .update(
                  stockPurchasesTable,
                )
                .set({
                  supplierDebtId,
                })
                .where(
                  eq(
                    stockPurchasesTable.id,
                    purchase.id,
                  ),
                );
            }

            const purchaseWithDebt = {
              ...purchase,
              supplierDebtId,
            };

            const mappedItems =
              insertedItems.map(
                (item) =>
                  mapItem(
                    item,
                    productMap.get(
                      item.productId,
                    )?.name,
                  ),
              );

            const mappedCosts =
              insertedCosts.map(
                mapCost,
              );

            return mapPurchase(
              purchaseWithDebt,
              mappedItems,
              mappedCosts,
              supplierBalance,
            );
          },
        );

      res.status(201).json(
        StockPurchaseResponse.parse(
          created,
        ),
      );
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

// ─── LIST STOCK PURCHASES ────────────────────────────────────────────────────

router.get(
  "/stock-purchases",
  async (_req, res): Promise<void> => {
    const purchases =
      await db
        .select()
        .from(stockPurchasesTable)
        .orderBy(
          desc(
            stockPurchasesTable.purchaseDate,
          ),
        );

    const result = [];

    for (
      const purchase of purchases
    ) {
      const itemRows =
        await db
          .select({
            item:
              stockPurchaseItemsTable,
            productName:
              productsTable.name,
          })
          .from(
            stockPurchaseItemsTable,
          )
          .innerJoin(
            productsTable,
            eq(
              stockPurchaseItemsTable.productId,
              productsTable.id,
            ),
          )
          .where(
            eq(
              stockPurchaseItemsTable.purchaseId,
              purchase.id,
            ),
          );

      const costRows =
        await db
          .select()
          .from(
            stockPurchaseCostsTable,
          )
          .where(
            eq(
              stockPurchaseCostsTable.purchaseId,
              purchase.id,
            ),
          );

      let supplierBalance =
        Math.max(
          0,
          Number(
            purchase.totalCost,
          ) -
            Number(
              purchase.amountPaid,
            ),
        );

      if (
        purchase.supplierDebtId !=
        null
      ) {
        const [debt] =
          await db
            .select()
            .from(
              supplierDebtsTable,
            )
            .where(
              eq(
                supplierDebtsTable.id,
                purchase.supplierDebtId,
              ),
            );

        if (debt) {
          supplierBalance =
            Math.max(
              0,
              Number(debt.amount) -
                Number(
                  debt.amountPaid,
                ),
            );
        }
      }

      result.push(
        mapPurchase(
          purchase,

          itemRows.map(
            ({ item, productName }) =>
              mapItem(
                item,
                productName,
              ),
          ),

          costRows.map(mapCost),

          supplierBalance,
        ),
      );
    }

    res.json(
      ListStockPurchasesResponse.parse(
        result,
      ),
    );
  },
);

// ─── GET ONE STOCK PURCHASE ──────────────────────────────────────────────────

router.get(
  "/stock-purchases/:id",
  async (req, res): Promise<void> => {
    const params =
      GetStockPurchaseParams.safeParse(
        req.params,
      );

    if (!params.success) {
      res.status(400).json({
        error: params.error.message,
      });
      return;
    }

    const [purchase] =
      await db
        .select()
        .from(stockPurchasesTable)
        .where(
          eq(
            stockPurchasesTable.id,
            params.data.id,
          ),
        );

    if (!purchase) {
      res.status(404).json({
        error:
          "Stock purchase not found",
      });
      return;
    }

    const itemRows =
      await db
        .select({
          item:
            stockPurchaseItemsTable,
          productName:
            productsTable.name,
        })
        .from(
          stockPurchaseItemsTable,
        )
        .innerJoin(
          productsTable,
          eq(
            stockPurchaseItemsTable.productId,
            productsTable.id,
          ),
        )
        .where(
          eq(
            stockPurchaseItemsTable.purchaseId,
            purchase.id,
          ),
        );

    const costRows =
      await db
        .select()
        .from(
          stockPurchaseCostsTable,
        )
        .where(
          eq(
            stockPurchaseCostsTable.purchaseId,
            purchase.id,
          ),
        );

    let supplierBalance =
      Math.max(
        0,
        Number(purchase.totalCost) -
          Number(
            purchase.amountPaid,
          ),
      );

    if (
      purchase.supplierDebtId !=
      null
    ) {
      const [debt] =
        await db
          .select()
          .from(supplierDebtsTable)
          .where(
            eq(
              supplierDebtsTable.id,
              purchase.supplierDebtId,
            ),
          );

      if (debt) {
        supplierBalance =
          Math.max(
            0,
            Number(debt.amount) -
              Number(
                debt.amountPaid,
              ),
          );
      }
    }

    res.json(
      StockPurchaseResponse.parse(
        mapPurchase(
          purchase,

          itemRows.map(
            ({
              item,
              productName,
            }) =>
              mapItem(
                item,
                productName,
              ),
          ),

          costRows.map(mapCost),

          supplierBalance,
        ),
      ),
    );
  },
);

export default router;
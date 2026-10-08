import { Router, type IRouter } from "express";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import {
  db,
  salesTable,
  productsTable,
  customerDebtsTable,
} from "@workspace/db";
import {
  CreateSaleParams,
  CreateSaleBody,
  ListProductSalesParams,
  ListProductSalesResponse,
  ListProductSalesResponseItem,
  UpdateSaleParams,
  UpdateSaleBody,
  UpdateSaleResponse,
  DeleteSaleParams,
} from "@workspace/schemas";

const router: IRouter = Router();

function mapSale(
  s: typeof salesTable.$inferSelect,
  debtRemaining: number | null = null,
) {
  return {
    ...s,
    exactSellingPrice: Number(s.exactSellingPrice),
    debtAmount:
      s.debtAmount != null
        ? Number(s.debtAmount)
        : null,
    // Live balance from the linked debt (if any) — reflects payments made on the Debts page.
    // Falls back to the original debtAmount snapshot for sales with no linked debt record.
    debtRemaining:
      debtRemaining ??
      (s.debtAmount != null
        ? Number(s.debtAmount)
        : null),
    soldAt: s.soldAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  };
}

/**
 * When a sale is made on partial or full credit, mirror it into the customer
 * debts ledger so it shows up on the Debts page and can be tracked/settled there.
 * Returns the new debt's id so the sale record can link back to it — that link
 * is what keeps the two features in sync in both directions afterwards.
 */
async function createDebtForSale(params: {
  productName: string;
  customerName: string;
  debtAmount: number;
  notes?: string | null;
}): Promise<number> {
  const [debt] = await db
    .insert(customerDebtsTable)
    .values({
      customerName: params.customerName,
      description: `Credit sale — ${params.productName}`,
      amount: params.debtAmount.toFixed(2),
      amountPaid: "0",
      notes: params.notes ?? undefined,
    })
    .returning();

  return debt.id;
}

router.get("/sales", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: salesTable.id,
      productId: salesTable.productId,
      productName: productsTable.name,
      productImageUrl: productsTable.imageUrl,
      exactSellingPrice: salesTable.exactSellingPrice,
      quantity: salesTable.quantity,
      paymentMethod: salesTable.paymentMethod,
      debtAmount: salesTable.debtAmount,
      customerName: salesTable.customerName,
      notes: salesTable.notes,
      soldAt: salesTable.soldAt,
      createdAt: salesTable.createdAt,
      debtId: salesTable.debtId,
      debtTotal: customerDebtsTable.amount,
      debtPaid: customerDebtsTable.amountPaid,
    })
    .from(salesTable)
    .innerJoin(
      productsTable,
      eq(salesTable.productId, productsTable.id),
    )
    .leftJoin(
      customerDebtsTable,
      eq(salesTable.debtId, customerDebtsTable.id),
    )
    .orderBy(desc(salesTable.soldAt));

  const mapped = rows.map(
    ({ debtTotal, debtPaid, ...r }) => ({
      ...r,
      exactSellingPrice: Number(r.exactSellingPrice),
      debtAmount:
        r.debtAmount != null
          ? Number(r.debtAmount)
          : null,
      debtRemaining:
        debtTotal != null
          ? Math.max(
              0,
              Number(debtTotal) -
                Number(debtPaid ?? 0),
            )
          : r.debtAmount != null
            ? Number(r.debtAmount)
            : null,
      soldAt: r.soldAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
    }),
  );

  res.json(mapped);
});

router.get(
  "/products/:id/sales",
  async (req, res): Promise<void> => {
    const params =
      ListProductSalesParams.safeParse(req.params);

    if (!params.success) {
      res
        .status(400)
        .json({ error: params.error.message });
      return;
    }

    const rows = await db
      .select({
        sale: salesTable,
        debtTotal: customerDebtsTable.amount,
        debtPaid: customerDebtsTable.amountPaid,
      })
      .from(salesTable)
      .leftJoin(
        customerDebtsTable,
        eq(salesTable.debtId, customerDebtsTable.id),
      )
      .where(
        eq(salesTable.productId, params.data.id),
      )
      .orderBy(salesTable.soldAt);

    const mapped = rows.map(
      ({ sale, debtTotal, debtPaid }) =>
        mapSale(
          sale,
          debtTotal != null
            ? Math.max(
                0,
                Number(debtTotal) -
                  Number(debtPaid ?? 0),
              )
            : null,
        ),
    );

    res.json(
      ListProductSalesResponse.parse(mapped),
    );
  },
);

router.post("/products/:id/sales", async (req, res): Promise<void> => {
  const params = CreateSaleParams.safeParse(req.params);

  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateSaleBody.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const customerName = data.customerName?.trim();
  const debtAmount = data.debtAmount ?? 0;

  // Work in cents to avoid floating-point comparison errors.
  const saleTotalCents =
    Math.round(data.exactSellingPrice * 100) * data.quantity;
  const debtCents = Math.round(debtAmount * 100);

  if (
    !Number.isSafeInteger(saleTotalCents) ||
    !Number.isSafeInteger(debtCents) ||
    debtCents > saleTotalCents
  ) {
    res.status(400).json({
      error: "Customer debt cannot exceed the total sale amount",
    });
    return;
  }

  if (debtCents > 0 && !customerName) {
    res.status(400).json({
      error: "customerName is required for partial or credit sales",
    });
    return;
  }

  try {
    const sale = await db.transaction(async (tx) => {
      // Conditional update prevents concurrent sales from overselling.
      const [updatedProduct] = await tx
        .update(productsTable)
        .set({
          stock: sql`${productsTable.stock} - ${data.quantity}`,
        })
        .where(
          and(
            eq(productsTable.id, params.data.id),
            gte(productsTable.stock, data.quantity),
          ),
        )
        .returning();

      if (!updatedProduct) {
        const [product] = await tx
          .select({ stock: productsTable.stock })
          .from(productsTable)
          .where(eq(productsTable.id, params.data.id));

        if (!product) {
          throw new Error("Product not found");
        }

        throw new Error(
          `Only ${product.stock} unit${product.stock === 1 ? "" : "s"} available in stock`,
        );
      }

      let debtId: number | undefined;

      if (debtCents > 0 && customerName) {
        const [debt] = await tx
          .insert(customerDebtsTable)
          .values({
            customerName,
            description: `Credit sale — ${updatedProduct.name}`,
            amount: (debtCents / 100).toFixed(2),
            amountPaid: "0",
            notes: data.notes ?? undefined,
          })
          .returning();

        if (!debt) {
          throw new Error("Failed to create customer debt");
        }

        debtId = debt.id;
      }

      const [createdSale] = await tx
        .insert(salesTable)
        .values({
          productId: params.data.id,
          exactSellingPrice: data.exactSellingPrice.toFixed(2),
          quantity: data.quantity,
          paymentMethod: data.paymentMethod,
          debtAmount: debtCents > 0 ? (debtCents / 100).toFixed(2) : null,
          customerName: debtCents > 0 ? customerName : null,
          notes: data.notes ?? null,
          debtId,
        })
        .returning();

      if (!createdSale) {
        throw new Error("Failed to create sale");
      }

      return createdSale;
    });

    res.status(201).json(ListProductSalesResponseItem.parse(mapSale(sale)));
  } catch (error) {
    console.error("SALE CREATION FAILED:", error);

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Failed to create sale";

    res.status(400).json({ error: message });
  }
});

router.patch(
  "/sales/:id",
  async (req, res): Promise<void> => {
    const params = UpdateSaleParams.safeParse(req.params);

    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateSaleBody.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existingSale] = await db
      .select()
      .from(salesTable)
      .where(eq(salesTable.id, params.data.id));

    if (!existingSale) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, existingSale.productId));

    if (!product) {
      res.status(404).json({ error: "Product not found" });
      return;
    }

    const oldQuantity = existingSale.quantity;
    const newQuantity = parsed.data.quantity;
    const quantityDelta = newQuantity - oldQuantity;

    // Increasing an existing sale consumes only the additional units.
    // Decreasing it restores the difference.
    if (quantityDelta > 0 && product.stock < quantityDelta) {
      res.status(400).json({
        error: `Only ${product.stock} additional unit${product.stock === 1 ? "" : "s"} available in stock`,
      });
      return;
    }

    if (quantityDelta !== 0) {
      await db
        .update(productsTable)
        .set({
          stock: product.stock - quantityDelta,
        })
        .where(eq(productsTable.id, product.id));
    }

    const remainingDebt = parsed.data.debtAmount ?? 0;
    const hasDebt = remainingDebt > 0;
    const customerName = parsed.data.customerName?.trim();

    if (hasDebt && !customerName) {
      res.status(400).json({
        error:
          "customerName is required for partial or credit sales",
      });
      return;
    }

    let debtId: number | null = existingSale.debtId;

    if (hasDebt && customerName) {
      if (debtId != null) {
        const [existingDebt] = await db
          .select()
          .from(customerDebtsTable)
          .where(eq(customerDebtsTable.id, debtId));

        if (existingDebt) {
          const alreadyPaid = Number(existingDebt.amountPaid ?? 0);

          await db
            .update(customerDebtsTable)
            .set({
              customerName,
              description: `Credit sale — ${product.name}`,
              // UpdateSaleBody.debtAmount represents the amount still owed.
              // Preserve payments already recorded on the Debts page by
              // rebuilding the debt total as paid-so-far + remaining.
              amount: (alreadyPaid + remainingDebt).toFixed(2),
              notes: parsed.data.notes ?? null,
            })
            .where(eq(customerDebtsTable.id, debtId));
        } else {
          debtId = await createDebtForSale({
            productName: product.name,
            customerName,
            debtAmount: remainingDebt,
            notes: parsed.data.notes,
          });
        }
      } else {
        debtId = await createDebtForSale({
          productName: product.name,
          customerName,
          debtAmount: remainingDebt,
          notes: parsed.data.notes,
        });
      }
    } else if (debtId != null) {
      await db
        .delete(customerDebtsTable)
        .where(eq(customerDebtsTable.id, debtId));

      debtId = null;
    }

    const [updatedSale] = await db
      .update(salesTable)
      .set({
        exactSellingPrice:
          parsed.data.exactSellingPrice.toFixed(2),
        quantity: parsed.data.quantity,
        paymentMethod: parsed.data.paymentMethod,
        debtAmount: hasDebt
          ? remainingDebt.toFixed(2)
          : null,
        customerName: hasDebt
          ? customerName!
          : null,
        notes: parsed.data.notes ?? null,
        debtId,
      })
      .where(eq(salesTable.id, params.data.id))
      .returning();

    res.json(
      UpdateSaleResponse.parse(
        mapSale(
          updatedSale,
          hasDebt ? remainingDebt : null,
        ),
      ),
    );
  },
);

router.delete(
  "/sales/:id",
  async (req, res): Promise<void> => {
    const params =
      DeleteSaleParams.safeParse(req.params);

    if (!params.success) {
      res
        .status(400)
        .json({ error: params.error.message });
      return;
    }

    const [deleted] = await db
      .delete(salesTable)
      .where(
        eq(salesTable.id, params.data.id),
      )
      .returning();

    if (!deleted) {
      res
        .status(404)
        .json({ error: "Sale not found" });
      return;
    }

    // Deleting a sale reverses its inventory movement.
    // If 3 units were sold, all 3 return to available stock.
    const [product] = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.id, deleted.productId));

    if (product) {
      await db
        .update(productsTable)
        .set({
          stock: product.stock + deleted.quantity,
        })
        .where(eq(productsTable.id, deleted.productId));
    }

    // Removing the sale removes its debt too — the underlying transaction no longer
    // exists, so there's nothing left to owe. Each debt belongs to exactly one sale.
    if (deleted.debtId != null) {
      await db
        .delete(customerDebtsTable)
        .where(
          eq(
            customerDebtsTable.id,
            deleted.debtId,
          ),
        );
    }

    res.status(204).send();
  },
);

export default router;
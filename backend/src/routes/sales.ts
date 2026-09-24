import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
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

router.post(
  "/products/:id/sales",
  async (req, res): Promise<void> => {
    const params =
      CreateSaleParams.safeParse(req.params);

    if (!params.success) {
      res
        .status(400)
        .json({ error: params.error.message });
      return;
    }

    const parsed =
      CreateSaleBody.safeParse(req.body);

    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.message });
      return;
    }

    const hasDebt =
      (parsed.data.debtAmount ?? 0) > 0;

    const customerName =
      parsed.data.customerName?.trim();

    if (hasDebt && !customerName) {
      res.status(400).json({
        error:
          "customerName is required for partial or credit sales",
      });
      return;
    }

    const [product] = await db
      .select()
      .from(productsTable)
      .where(
        eq(productsTable.id, params.data.id),
      );

    if (!product) {
      res
        .status(404)
        .json({ error: "Product not found" });
      return;
    }

    // Create the debt first (if any) so the sale can be linked to it from the start.
    let debtId: number | undefined;

    if (hasDebt && customerName) {
      debtId = await createDebtForSale({
        productName: product.name,
        customerName,
        debtAmount: parsed.data.debtAmount!,
        notes: parsed.data.notes,
      });
    }

    const {
      exactSellingPrice,
      debtAmount,
      customerName: _customerName,
      ...saleData
    } = parsed.data;

    const [sale] = await db
      .insert(salesTable)
      .values({
        ...saleData,
        exactSellingPrice:
          exactSellingPrice.toFixed(2),
        debtAmount:
          debtAmount !== undefined
            ? debtAmount.toFixed(2)
            : undefined,
        customerName:
          customerName ?? undefined,
        productId: params.data.id,
        debtId,
      })
      .returning();

    const quantity = parsed.data.quantity;

    if (product.stock < quantity) {
      res.status(400).json({
        error: `Only ${product.stock} unit${product.stock === 1 ? "" : "s"} available in stock`,
      });
      return;
    }

    await db
      .update(productsTable)
      .set({
        stock: product.stock - quantity,
      })
      .where(
        eq(productsTable.id, params.data.id),
      );

    res.status(201).json(
      ListProductSalesResponseItem.parse(
        mapSale(sale),
      ),
    );
  },
);


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
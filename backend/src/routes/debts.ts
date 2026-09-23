import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  customerDebtsTable,
  supplierDebtsTable,
  supplierDebtPaymentsTable,
} from "@workspace/db";

const router: IRouter = Router();

// ─── shared helpers ───────────────────────────────────────────────────────────
interface DebtBody {
  name: string;
  phone?: string;
  description: string;
  amount: number;
  amountPaid?: number;
  dueDate?: string;
  notes?: string;
}

function parseDebtBody(body: unknown): { data: DebtBody } | { error: string } {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") return { error: "Invalid body" };
  if (typeof b.name !== "string" || !b.name.trim()) return { error: "name is required" };
  if (typeof b.description !== "string" || !b.description.trim()) return { error: "description is required" };
  if (typeof b.amount !== "number" || b.amount <= 0) return { error: "amount must be a positive number" };
  const amountPaid = b.amountPaid !== undefined ? Number(b.amountPaid) : 0;
  if (isNaN(amountPaid) || amountPaid < 0) return { error: "amountPaid must be >= 0" };
  return {
    data: {
      name: b.name.trim(),
      phone: typeof b.phone === "string" ? b.phone.trim() || undefined : undefined,
      description: b.description.trim(),
      amount: b.amount,
      amountPaid,
      dueDate: typeof b.dueDate === "string" && b.dueDate ? b.dueDate : undefined,
      notes: typeof b.notes === "string" && b.notes ? b.notes : undefined,
    },
  };
}

function parsePartialDebtBody(body: unknown): { data: Partial<DebtBody> } | { error: string } {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") return { error: "Invalid body" };
  const data: Partial<DebtBody> = {};
  if (b.name !== undefined) {
    if (typeof b.name !== "string" || !b.name.trim()) return { error: "name must be a non-empty string" };
    data.name = b.name.trim();
  }
  if (b.description !== undefined) {
    if (typeof b.description !== "string" || !b.description.trim()) return { error: "description must be a non-empty string" };
    data.description = b.description.trim();
  }
  if (b.amount !== undefined) {
    const n = Number(b.amount);
    if (isNaN(n) || n <= 0) return { error: "amount must be positive" };
    data.amount = n;
  }
  if (b.amountPaid !== undefined) {
    const n = Number(b.amountPaid);
    if (isNaN(n) || n < 0) return { error: "amountPaid must be >= 0" };
    data.amountPaid = n;
  }
  if (b.phone !== undefined) data.phone = typeof b.phone === "string" ? b.phone || undefined : undefined;
  if (b.dueDate !== undefined) data.dueDate = typeof b.dueDate === "string" && b.dueDate ? b.dueDate : undefined;
  if (b.notes !== undefined) data.notes = typeof b.notes === "string" && b.notes ? b.notes : undefined;
  return { data };
}

function parseId(params: unknown): number | null {
  const id = Number((params as Record<string, unknown>)?.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePaymentBody(body: unknown): number | null {
  const b = body as Record<string, unknown>;
  const n = Number(b?.amountPaid);
  return isNaN(n) || n < 0 ? null : n;
}

function mapCustomer(r: typeof customerDebtsTable.$inferSelect) {
  return {
    ...r,
    amount: Number(r.amount),
    amountPaid: Number(r.amountPaid),
    remaining: Number(r.amount) - Number(r.amountPaid),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function mapSupplier(r: typeof supplierDebtsTable.$inferSelect) {
  return {
    ...r,
    amount: Number(r.amount),
    amountPaid: Number(r.amountPaid),
    remaining: Number(r.amount) - Number(r.amountPaid),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

// ─── Customer debts (receivables) ─────────────────────────────────────────────
router.get("/debts/customers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(customerDebtsTable).orderBy(customerDebtsTable.createdAt);
  res.json(rows.map(mapCustomer));
});

router.post("/debts/customers", async (req, res): Promise<void> => {
  const parsed = parseDebtBody(req.body);
  if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const { name, amountPaid, amount, ...rest } = parsed.data;
  const [row] = await db.insert(customerDebtsTable)
    .values({ customerName: name, amount: String(amount), amountPaid: String(amountPaid ?? 0), ...rest })
    .returning();
  res.status(201).json(mapCustomer(row));
});

router.patch("/debts/customers/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = parsePartialDebtBody(req.body);
  if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const { name, amountPaid, amount, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (name !== undefined) updateData.customerName = name;
  if (amount !== undefined) updateData.amount = String(amount);
  if (amountPaid !== undefined) updateData.amountPaid = String(amountPaid);
  const [row] = await db.update(customerDebtsTable).set(updateData).where(eq(customerDebtsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(mapCustomer(row));
});

router.patch("/debts/customers/:id/payment", async (req, res): Promise<void> => {
  const id = parseId(req.params);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const amountPaid = parsePaymentBody(req.body);
  if (amountPaid === null) { res.status(400).json({ error: "amountPaid must be >= 0" }); return; }
  const [existing] = await db.select().from(customerDebtsTable).where(eq(customerDebtsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const newPaid = Math.min(Number(existing.amount), amountPaid);
  const [row] = await db.update(customerDebtsTable)
    .set({ amountPaid: String(newPaid) })
    .where(eq(customerDebtsTable.id, id))
    .returning();
  res.json(mapCustomer(row));
});

router.delete("/debts/customers/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(customerDebtsTable).where(eq(customerDebtsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ─── Supplier debts (payables) ────────────────────────────────────────────────
router.get("/debts/suppliers", async (_req, res): Promise<void> => {
  const rows = await db.select().from(supplierDebtsTable).orderBy(supplierDebtsTable.createdAt);
  res.json(rows.map(mapSupplier));
});

router.post("/debts/suppliers", async (req, res): Promise<void> => {
  const parsed = parseDebtBody(req.body);
  if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const { name, amountPaid, amount, ...rest } = parsed.data;
  const [row] = await db.insert(supplierDebtsTable)
    .values({ supplierName: name, amount: String(amount), amountPaid: String(amountPaid ?? 0), ...rest })
    .returning();
  res.status(201).json(mapSupplier(row));
});

router.patch("/debts/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = parsePartialDebtBody(req.body);
  if ("error" in parsed) { res.status(400).json({ error: parsed.error }); return; }
  const { name, amountPaid, amount, ...rest } = parsed.data;
  const updateData: Record<string, unknown> = { ...rest };
  if (name !== undefined) updateData.supplierName = name;
  if (amount !== undefined) updateData.amount = String(amount);
  if (amountPaid !== undefined) updateData.amountPaid = String(amountPaid);
  const [row] = await db.update(supplierDebtsTable).set(updateData).where(eq(supplierDebtsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(mapSupplier(row));
});

router.patch("/debts/suppliers/:id/payment", async (req, res): Promise<void> => {
  const id = parseId(req.params);

  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const paymentAmount = Number(
    body?.amount ?? body?.amountPaid,
  );

  if (
    !Number.isFinite(paymentAmount) ||
    paymentAmount <= 0
  ) {
    res.status(400).json({
      error: "Payment amount must be greater than 0",
    });
    return;
  }

  const paymentDate =
    typeof body?.paymentDate === "string" &&
    body.paymentDate
      ? new Date(body.paymentDate)
      : new Date();

  if (Number.isNaN(paymentDate.getTime())) {
    res.status(400).json({
      error: "Invalid payment date",
    });
    return;
  }

  const method =
    typeof body?.method === "string" &&
    body.method.trim()
      ? body.method.trim()
      : undefined;

  const reference =
    typeof body?.reference === "string" &&
    body.reference.trim()
      ? body.reference.trim()
      : undefined;

  const notes =
    typeof body?.notes === "string" &&
    body.notes.trim()
      ? body.notes.trim()
      : undefined;

  try {
    const result = await db.transaction(
      async (tx) => {
        const [existing] = await tx
          .select()
          .from(supplierDebtsTable)
          .where(
            eq(
              supplierDebtsTable.id,
              id,
            ),
          )
          .for("update");

        if (!existing) {
          return null;
        }

        const debtTotal = Number(
          existing.amount,
        );

        const alreadyPaid = Number(
          existing.amountPaid,
        );

        const remaining =
          debtTotal - alreadyPaid;

        if (remaining <= 0) {
          throw new Error(
            "DEBT_ALREADY_PAID",
          );
        }

        if (paymentAmount > remaining) {
          throw new Error(
            "PAYMENT_EXCEEDS_BALANCE",
          );
        }

        const newPaid =
          alreadyPaid + paymentAmount;

        const [payment] = await tx
          .insert(
            supplierDebtPaymentsTable,
          )
          .values({
            supplierDebtId: id,
            amount: String(
              paymentAmount,
            ),
            paymentDate,
            method,
            reference,
            notes,
          })
          .returning();

        const [updatedDebt] = await tx
          .update(supplierDebtsTable)
          .set({
            amountPaid: String(newPaid),
          })
          .where(
            eq(
              supplierDebtsTable.id,
              id,
            ),
          )
          .returning();

        return {
          debt: updatedDebt,
          payment,
        };
      },
    );

    if (!result) {
      res.status(404).json({
        error: "Not found",
      });
      return;
    }

    res.json({
      ...mapSupplier(result.debt),

      payment: {
        ...result.payment,
        amount: Number(
          result.payment.amount,
        ),
        paymentDate:
          result.payment.paymentDate.toISOString(),
        createdAt:
          result.payment.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "DEBT_ALREADY_PAID"
    ) {
      res.status(400).json({
        error:
          "This supplier debt is already fully paid",
      });
      return;
    }

    if (
      error instanceof Error &&
      error.message ===
        "PAYMENT_EXCEEDS_BALANCE"
    ) {
      res.status(400).json({
        error:
          "Payment cannot exceed the remaining supplier balance",
      });
      return;
    }

    throw error;
  }
});

router.get("/debts/suppliers/:id/payments", async (req, res): Promise<void> => {
  const id = parseId(req.params);

  if (!id) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [debt] = await db
    .select()
    .from(supplierDebtsTable)
    .where(eq(supplierDebtsTable.id, id));

  if (!debt) {
    res.status(404).json({
      error: "Supplier debt not found",
    });
    return;
  }

  const payments = await db
    .select()
    .from(supplierDebtPaymentsTable)
    .where(
      eq(
        supplierDebtPaymentsTable.supplierDebtId,
        id,
      ),
    )
    .orderBy(
      supplierDebtPaymentsTable.paymentDate,
    );

  res.json(
    payments.map((payment) => ({
      ...payment,
      amount: Number(payment.amount),
      paymentDate:
        payment.paymentDate.toISOString(),
      createdAt:
        payment.createdAt.toISOString(),
    })),
  );
});

router.delete("/debts/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(supplierDebtsTable).where(eq(supplierDebtsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

export default router;

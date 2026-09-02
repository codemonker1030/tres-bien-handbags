import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, customerDebtsTable, supplierDebtsTable } from "@workspace/db";

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
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const amountPaid = parsePaymentBody(req.body);
  if (amountPaid === null) { res.status(400).json({ error: "amountPaid must be >= 0" }); return; }
  const [existing] = await db.select().from(supplierDebtsTable).where(eq(supplierDebtsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const newPaid = Math.min(Number(existing.amount), amountPaid);
  const [row] = await db.update(supplierDebtsTable)
    .set({ amountPaid: String(newPaid) })
    .where(eq(supplierDebtsTable.id, id))
    .returning();
  res.json(mapSupplier(row));
});

router.delete("/debts/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseId(req.params);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(supplierDebtsTable).where(eq(supplierDebtsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

export default router;

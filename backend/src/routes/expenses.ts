import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, expensesTable } from "@workspace/db";
import {
  CreateExpenseBody,
  UpdateExpenseBody,
  GetExpenseParams,
  UpdateExpenseParams,
  DeleteExpenseParams,
  GetExpenseResponse,
  UpdateExpenseResponse,
  ListExpensesResponse,
} from "@workspace/schemas";

const router: IRouter = Router();

function mapExpense(exp: typeof expensesTable.$inferSelect) {
  return {
    ...exp,
    amount: Number(exp.amount),
    createdAt: exp.createdAt.toISOString(),
    updatedAt: exp.updatedAt.toISOString(),
  };
}

router.get("/expenses", async (req, res): Promise<void> => {
  const expenses = await db.select().from(expensesTable).orderBy(expensesTable.date);
  res.json(ListExpensesResponse.parse(expenses.map(mapExpense)));
});

router.post("/expenses", async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await db.insert(expensesTable).values(parsed.data).returning();
  res.status(201).json(GetExpenseResponse.parse(mapExpense(expense)));
});

router.get("/expenses/:id", async (req, res): Promise<void> => {
  const params = GetExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [expense] = await db.select().from(expensesTable).where(eq(expensesTable.id, params.data.id));
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(GetExpenseResponse.parse(mapExpense(expense)));
});

router.patch("/expenses/:id", async (req, res): Promise<void> => {
  const params = UpdateExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [expense] = await db
    .update(expensesTable)
    .set(parsed.data)
    .where(eq(expensesTable.id, params.data.id))
    .returning();
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.json(UpdateExpenseResponse.parse(mapExpense(expense)));
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const params = DeleteExpenseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [expense] = await db.delete(expensesTable).where(eq(expensesTable.id, params.data.id)).returning();
  if (!expense) {
    res.status(404).json({ error: "Expense not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;

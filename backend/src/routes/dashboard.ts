import { Router, type IRouter } from "express";
import { eq, lte } from "drizzle-orm";
import { db, productsTable, customerDebtsTable, expensesTable, tasksTable, salesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetSalesByMonthResponse,
} from "@workspace/schemas";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [products, debts, expenses, tasks, salesWithProducts] = await Promise.all([
    db.select().from(productsTable),
    db.select().from(customerDebtsTable),
    db.select().from(expensesTable),
    db.select().from(tasksTable),
    db
      .select({
        exactSellingPrice: salesTable.exactSellingPrice,
        buyingPrice: productsTable.buyingPrice,
      })
      .from(salesTable)
      .innerJoin(productsTable, eq(salesTable.productId, productsTable.id)),
  ]);

  // Revenue = sum of all recorded selling prices
  const totalRevenue = salesWithProducts.reduce(
    (sum, s) => sum + Number(s.exactSellingPrice),
    0,
  );

  // Gross profit = (selling price - buying price) per sale; treat null buying price as 0
  const grossProfit = salesWithProducts.reduce(
    (sum, s) =>
      sum + (Number(s.exactSellingPrice) - (s.buyingPrice != null ? Number(s.buyingPrice) : 0)),
    0,
  );

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Net profit = gross profit from sales minus operating expenses
  const netProfit = grossProfit - totalExpenses;

  const outstandingDebtRows = debts.filter(
    (d) => Number(d.amount) - Number(d.amountPaid) > 0,
  );
  const totalOwedToYou = outstandingDebtRows.reduce(
    (sum, d) => sum + (Number(d.amount) - Number(d.amountPaid)),
    0,
  );

  const lowStockProducts = products.filter(p => p.stock <= p.lowStockThreshold);
  const outstandingDebts = outstandingDebtRows.length;
  const openTasksCount = tasks.filter(t => t.status !== "done").length;
  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);

  res.json(
    GetDashboardSummaryResponse.parse({
      totalRevenue,
      totalExpenses,
      netProfit,
      totalProducts: totalStockUnits,
      lowStockCount: lowStockProducts.length,
      outstandingDebts,
      totalOwedToYou,
      openTasksCount,
    }),
  );
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const debts = await db.select().from(customerDebtsTable).orderBy(customerDebtsTable.updatedAt);
  const expenses = await db.select().from(expensesTable).orderBy(expensesTable.createdAt);
  const tasks = await db.select().from(tasksTable).orderBy(tasksTable.updatedAt);

  const items = [
    ...debts.slice(-5).map(d => ({
      id: `debt-${d.id}`,
      type: "debt" as const,
      description: `Debt: ${d.customerName} — ${d.description}`,
      amount: Number(d.amount) - Number(d.amountPaid),
      timestamp: d.updatedAt.toISOString(),
    })),
    ...expenses.slice(-5).map(e => ({
      id: `expense-${e.id}`,
      type: "expense" as const,
      description: `${e.category}: ${e.description}`,
      amount: Number(e.amount),
      timestamp: e.createdAt.toISOString(),
    })),
    ...tasks.slice(-5).map(t => ({
      id: `task-${t.id}`,
      type: "task" as const,
      description: `Task: ${t.title} — ${t.status}`,
      amount: null,
      timestamp: t.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);

  res.json(GetRecentActivityResponse.parse(items));
});

router.get("/dashboard/sales-by-month", async (req, res): Promise<void> => {
  const rawMonths = Number(req.query.months);
  const numMonths = [1, 3, 6, 12].includes(rawMonths) ? rawMonths : 6;

  const [salesWithProducts, expenses] = await Promise.all([
    db
      .select({
        exactSellingPrice: salesTable.exactSellingPrice,
        buyingPrice: productsTable.buyingPrice,
        soldAt: salesTable.soldAt,
      })
      .from(salesTable)
      .innerJoin(productsTable, eq(salesTable.productId, productsTable.id)),
    db.select().from(expensesTable),
  ]);

  const months: { month: string; revenue: number; expenses: number }[] = [];
  const now = new Date();

  for (let i = numMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("default", { month: "short", year: "numeric" });

    // Revenue = sum of selling prices for sales in this month
    const revenue = salesWithProducts
      .filter(s => s.soldAt.toISOString().startsWith(monthKey))
      .reduce((sum, s) => sum + Number(s.exactSellingPrice), 0);

    const expTotal = expenses
      .filter(exp => exp.date.startsWith(monthKey))
      .reduce((sum, exp) => sum + Number(exp.amount), 0);

    months.push({ month: label, revenue, expenses: expTotal });
  }

  res.json(GetSalesByMonthResponse.parse(months));
});

export default router;

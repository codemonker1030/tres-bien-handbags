import * as zod from "zod";

export const GetDashboardSummaryResponse = zod.object({
  totalRevenue: zod.number(),
  totalExpenses: zod.number(),
  netProfit: zod.number(),
  totalProducts: zod.number(),
  lowStockCount: zod.number(),
  outstandingDebts: zod.number(),
  totalOwedToYou: zod.number(),
  openTasksCount: zod.number(),
});

export const GetRecentActivityResponseItem = zod.object({
  id: zod.string(),
  type: zod.enum(["debt", "expense", "product", "task"]),
  description: zod.string(),
  amount: zod.number().nullish(),
  timestamp: zod.string(),
});
export const GetRecentActivityResponse = zod.array(GetRecentActivityResponseItem);

export const getSalesByMonthQueryMonthsDefault = 6;

export const GetSalesByMonthQueryParams = zod.object({
  months: zod
    .union([zod.literal(1), zod.literal(3), zod.literal(6), zod.literal(12)])
    .default(getSalesByMonthQueryMonthsDefault)
    .describe("Number of past months to include (1, 3, 6, or 12)"),
});

export const GetSalesByMonthResponseItem = zod.object({
  month: zod.string(),
  revenue: zod.number(),
  expenses: zod.number(),
});
export const GetSalesByMonthResponse = zod.array(GetSalesByMonthResponseItem);

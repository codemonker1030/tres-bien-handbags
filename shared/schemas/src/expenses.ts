import * as zod from "zod";

const expenseShape = {
  id: zod.number(),
  description: zod.string(),
  amount: zod.number(),
  category: zod.string(),
  vendor: zod.string().nullish(),
  date: zod.string(),
  notes: zod.string().nullish(),
  createdAt: zod.string(),
  updatedAt: zod.string(),
};

export const ListExpensesResponseItem = zod.object(expenseShape);
export const ListExpensesResponse = zod.array(ListExpensesResponseItem);

export const GetExpenseParams = zod.object({ id: zod.coerce.number() });
export const GetExpenseResponse = zod.object(expenseShape);

export const CreateExpenseBody = zod.object({
  description: zod.string().min(1),
  amount: zod.number().min(0),
  category: zod.string().min(1),
  vendor: zod.string().optional(),
  date: zod.string(),
  notes: zod.string().optional(),
});

export const UpdateExpenseParams = zod.object({ id: zod.coerce.number() });
export const UpdateExpenseBody = zod.object({
  description: zod.string().optional(),
  amount: zod.number().min(0).optional(),
  category: zod.string().optional(),
  vendor: zod.string().optional(),
  date: zod.string().optional(),
  notes: zod.string().optional(),
});
export const UpdateExpenseResponse = zod.object(expenseShape);

export const DeleteExpenseParams = zod.object({ id: zod.coerce.number() });

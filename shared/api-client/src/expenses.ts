import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGet, apiSend } from "./core";
import type { Expense, ExpenseInput, ExpenseUpdate } from "./types";

export const getListExpensesQueryKey = () => ["/api/expenses"] as const;
export const getGetExpenseQueryKey = (id: number) => ["/api/expenses", id] as const;

export function useListExpenses(options?: { query?: Partial<UseQueryOptions<Expense[]>> }) {
  return useQuery({
    queryKey: getListExpensesQueryKey(),
    queryFn: () => apiGet<Expense[]>("/expenses"),
    ...options?.query,
  });
}

export function useGetExpense(id: number, options?: { query?: Partial<UseQueryOptions<Expense>> }) {
  return useQuery({
    queryKey: getGetExpenseQueryKey(id),
    queryFn: () => apiGet<Expense>(`/expenses/${id}`),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateExpense(options?: {
  mutation?: Partial<UseMutationOptions<Expense, Error, { data: ExpenseInput }>>;
}) {
  return useMutation({
    mutationFn: ({ data }: { data: ExpenseInput }) => apiSend<Expense>("/expenses", "POST", data),
    ...options?.mutation,
  });
}

export function useUpdateExpense(options?: {
  mutation?: Partial<UseMutationOptions<Expense, Error, { id: number; data: ExpenseUpdate }>>;
}) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseUpdate }) =>
      apiSend<Expense>(`/expenses/${id}`, "PATCH", data),
    ...options?.mutation,
  });
}

export function useDeleteExpense(options?: {
  mutation?: Partial<UseMutationOptions<void, Error, { id: number }>>;
}) {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => apiSend<void>(`/expenses/${id}`, "DELETE"),
    ...options?.mutation,
  });
}

import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGet, apiSend } from "./core";
import type { SaleWithProduct, Sale, SaleInput } from "./types";

export const getListAllSalesQueryKey = () => ["/api/sales"] as const;
export const getListProductSalesQueryKey = (productId: number) => ["/api/products", productId, "sales"] as const;

export function useListAllSales(options?: { query?: Partial<UseQueryOptions<SaleWithProduct[]>> }) {
  return useQuery({
    queryKey: getListAllSalesQueryKey(),
    queryFn: () => apiGet<SaleWithProduct[]>("/sales"),
    ...options?.query,
  });
}

export function useListProductSales(
  productId: number,
  options?: { query?: Partial<UseQueryOptions<Sale[]>> },
) {
  return useQuery({
    queryKey: getListProductSalesQueryKey(productId),
    queryFn: () => apiGet<Sale[]>(`/products/${productId}/sales`),
    enabled: !!productId,
    ...options?.query,
  });
}

export function useCreateSale(options?: {
  mutation?: Partial<UseMutationOptions<Sale, Error, { id: number; data: SaleInput }>>;
}) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaleInput }) =>
      apiSend<Sale>(`/products/${id}/sales`, "POST", data),
    ...options?.mutation,
  });
}

export function useDeleteSale(options?: {
  mutation?: Partial<UseMutationOptions<void, Error, { id: number }>>;
}) {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => apiSend<void>(`/sales/${id}`, "DELETE"),
    ...options?.mutation,
  });
}

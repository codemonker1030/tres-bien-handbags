import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGet, apiSend } from "./core";
import type { Product, ProductInput, ProductUpdate } from "./types";

export const getListProductsQueryKey = () => ["/api/products"] as const;
export const getGetProductQueryKey = (id: number) => ["/api/products", id] as const;
export const getListLowStockProductsQueryKey = () => ["/api/products/low-stock"] as const;

export function useListProducts(options?: { query?: Partial<UseQueryOptions<Product[]>> }) {
  return useQuery({
    queryKey: getListProductsQueryKey(),
    queryFn: () => apiGet<Product[]>("/products"),
    ...options?.query,
  });
}

export function useListLowStockProducts(options?: { query?: Partial<UseQueryOptions<Product[]>> }) {
  return useQuery({
    queryKey: getListLowStockProductsQueryKey(),
    queryFn: () => apiGet<Product[]>("/products/low-stock"),
    ...options?.query,
  });
}

export function useGetProduct(id: number, options?: { query?: Partial<UseQueryOptions<Product>> }) {
  return useQuery({
    queryKey: getGetProductQueryKey(id),
    queryFn: () => apiGet<Product>(`/products/${id}`),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateProduct(options?: {
  mutation?: Partial<UseMutationOptions<Product, Error, { data: ProductInput }>>;
}) {
  return useMutation({
    mutationFn: ({ data }: { data: ProductInput }) => apiSend<Product>("/products", "POST", data),
    ...options?.mutation,
  });
}

export function useUpdateProduct(options?: {
  mutation?: Partial<UseMutationOptions<Product, Error, { id: number; data: ProductUpdate }>>;
}) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductUpdate }) =>
      apiSend<Product>(`/products/${id}`, "PATCH", data),
    ...options?.mutation,
  });
}

export function useDeleteProduct(options?: {
  mutation?: Partial<UseMutationOptions<void, Error, { id: number }>>;
}) {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => apiSend<void>(`/products/${id}`, "DELETE"),
    ...options?.mutation,
  });
}

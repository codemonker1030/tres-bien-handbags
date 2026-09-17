import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiSend } from "./core";

// ─── Create types ─────────────────────────────────────────────────────────────

export interface CreateNewStockPurchaseProduct {
  name: string;
  category: string;

  /**
   * Intended/current selling price.
   * The supplier buying price belongs to the purchase line itself.
   */
  price: number;

  imageUrl?: string;
  brand?: string;
  description?: string;
  lowStockThreshold?: number;
}

export interface CreateExistingStockPurchaseItem {
  type: "existing";

  productId: number;

  quantity: number;

  unitBuyingPrice: number;
}

export interface CreateNewStockPurchaseItem {
  type: "new";

  product: CreateNewStockPurchaseProduct;

  quantity: number;

  unitBuyingPrice: number;
}

export type CreateStockPurchaseItem =
  | CreateExistingStockPurchaseItem
  | CreateNewStockPurchaseItem;

export interface CreateStockPurchaseCost {
  label: string;
  amount: number;
}

export interface CreateStockPurchaseInput {
  supplierName: string;

  supplierPhone?: string;

  purchaseDate: string;

  items: CreateStockPurchaseItem[];

  sharedCosts: CreateStockPurchaseCost[];

  amountPaid: number;

  notes?: string;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface StockPurchaseItem {
  id: number;

  purchaseId: number;

  productId: number;

  productName?: string;

  quantity: number;

  unitBuyingPrice: number;

  goodsSubtotal: number;

  allocatedSharedCost: number;

  landedSubtotal: number;

  landedUnitCost: number;

  createdAt: string;
}

export interface StockPurchaseCost {
  id: number;

  purchaseId: number;

  label: string;

  amount: number;

  createdAt: string;
}

export interface StockPurchase {
  id: number;

  supplierName: string;

  supplierPhone?: string | null;

  purchaseDate: string;

  goodsTotal: number;

  sharedCostsTotal: number;

  totalCost: number;

  amountPaid: number;

  supplierBalance: number;

  supplierDebtId?: number | null;

  notes?: string | null;

  createdAt: string;

  updatedAt: string;

  items: StockPurchaseItem[];

  sharedCosts: StockPurchaseCost[];
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const getListStockPurchasesQueryKey =
  () =>
    ["/api/stock-purchases"] as const;

export const getGetStockPurchaseQueryKey = (
  id: number,
) =>
  ["/api/stock-purchases", id] as const;

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useListStockPurchases(
  options?: {
    query?: Partial<
      UseQueryOptions<
        StockPurchase[]
      >
    >;
  },
) {
  return useQuery({
    queryKey:
      getListStockPurchasesQueryKey(),

    queryFn: () =>
      apiGet<StockPurchase[]>(
        "/stock-purchases",
      ),

    ...options?.query,
  });
}

export function useGetStockPurchase(
  id: number,
  options?: {
    query?: Partial<
      UseQueryOptions<StockPurchase>
    >;
  },
) {
  return useQuery({
    queryKey:
      getGetStockPurchaseQueryKey(id),

    queryFn: () =>
      apiGet<StockPurchase>(
        `/stock-purchases/${id}`,
      ),

    enabled: !!id,

    ...options?.query,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateStockPurchase(
  options?: {
    mutation?: Partial<
      UseMutationOptions<
        StockPurchase,
        Error,
        {
          data: CreateStockPurchaseInput;
        }
      >
    >;
  },
) {
  return useMutation({
    mutationFn: ({
      data,
    }: {
      data: CreateStockPurchaseInput;
    }) =>
      apiSend<StockPurchase>(
        "/stock-purchases",
        "POST",
        data,
      ),

    ...options?.mutation,
  });
}
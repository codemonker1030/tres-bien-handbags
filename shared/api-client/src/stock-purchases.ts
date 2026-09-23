import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from "@tanstack/react-query";

import { apiGet, apiSend } from "./core";

// ─── Create purchase ──────────────────────────────────────────────────────────

export interface CreateStockPurchaseGroup {
  category: string;
  quantity: number;
  description?: string;
}

export interface CreateStockPurchaseCost {
  label: string;
  amount: number;
}

export interface CreateStockPurchaseInput {
  supplierName: string;
  supplierPhone?: string;

  purchaseDate: string;

  stockGroups: CreateStockPurchaseGroup[];

  /**
   * Total supplier cost of all stock in this procurement.
   */
  goodsTotal: number;

  sharedCosts: CreateStockPurchaseCost[];

  amountPaid: number;

  reference?: string;
  notes?: string;
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface StockPurchaseGroup {
  id: number;
  purchaseId: number;

  category: string;
  quantity: number;

  description?: string | null;

  createdAt: string;
}

export interface StockPurchaseCost {
  id: number;
  purchaseId: number;

  label: string;
  amount: number;

  createdAt: string;
}

/**
 * Historical product-level purchase data.
 *
 * New purchases no longer create these records, but we keep the type
 * so old purchase history remains readable.
 */
export interface StockPurchaseLegacyItem {
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

export type StockPurchasePaymentStatus =
  | "paid"
  | "partially_paid"
  | "unpaid";

export interface StockPurchase {
  id: number;

  /**
   * Example: PUR-2026-0007
   *
   * Nullable temporarily for purchases created before purchase
   * numbers were introduced.
   */
  purchaseNumber?: string | null;

  supplierName: string;
  supplierPhone?: string | null;

  purchaseDate: string;

  totalQuantity: number;

  goodsTotal: number;
  sharedCostsTotal: number;
  totalCost: number;

  amountPaid: number;
  supplierBalance: number;

  paymentStatus: StockPurchasePaymentStatus;

  supplierDebtId?: number | null;

  reference?: string | null;
  notes?: string | null;

  createdAt: string;
  updatedAt: string;

  stockGroups: StockPurchaseGroup[];

  sharedCosts: StockPurchaseCost[];

  legacyItems: StockPurchaseLegacyItem[];
}

// ─── Query keys ───────────────────────────────────────────────────────────────

export const getListStockPurchasesQueryKey = () =>
  ["/api/stock-purchases"] as const;

export const getGetStockPurchaseQueryKey = (
  id: number,
) => ["/api/stock-purchases", id] as const;

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useListStockPurchases(options?: {
  query?: Partial<
    UseQueryOptions<StockPurchase[]>
  >;
}) {
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
// ─── Delete purchase ──────────────────────────────────────────────────────────

export function useDeleteStockPurchase(
  options?: {
    mutation?: Partial<
      UseMutationOptions<
        void,
        Error,
        {
          id: number;
        }
      >
    >;
  },
) {
  return useMutation({
    mutationFn: async ({
      id,
    }: {
      id: number;
    }) => {
      await apiSend<void>(
        `/stock-purchases/${id}`,
        "DELETE",
      );
    },

    ...options?.mutation,
  });
}

// ─── Update purchase ──────────────────────────────────────────────────────────

export interface UpdateStockPurchaseInput {
  supplierName: string;
  supplierPhone?: string;

  purchaseDate: string;

  stockGroups: CreateStockPurchaseGroup[];

  goodsTotal: number;

  sharedCosts: CreateStockPurchaseCost[];

  reference?: string;
  notes?: string;
}

export function useUpdateStockPurchase(
  options?: {
    mutation?: Partial<
      UseMutationOptions<
        StockPurchase,
        Error,
        {
          id: number;
          data: UpdateStockPurchaseInput;
        }
      >
    >;
  },
) {
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateStockPurchaseInput;
    }) =>
      apiSend<StockPurchase>(
        `/stock-purchases/${id}`,
        "PATCH",
        data,
      ),

    ...options?.mutation,
  });
}

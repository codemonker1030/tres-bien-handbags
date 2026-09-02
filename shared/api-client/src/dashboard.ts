import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiGet } from "./core";
import type { DashboardSummary, ActivityItem, MonthlySales, GetSalesByMonthParams } from "./types";

export const getGetDashboardSummaryQueryKey = () => ["/api/dashboard/summary"] as const;
export const getGetRecentActivityQueryKey = () => ["/api/dashboard/recent-activity"] as const;
export const getGetSalesByMonthQueryKey = (params?: GetSalesByMonthParams) =>
  ["/api/dashboard/sales-by-month", params?.months] as const;

export function useGetDashboardSummary(options?: { query?: Partial<UseQueryOptions<DashboardSummary>> }) {
  return useQuery({
    queryKey: getGetDashboardSummaryQueryKey(),
    queryFn: () => apiGet<DashboardSummary>("/dashboard/summary"),
    ...options?.query,
  });
}

export function useGetRecentActivity(options?: { query?: Partial<UseQueryOptions<ActivityItem[]>> }) {
  return useQuery({
    queryKey: getGetRecentActivityQueryKey(),
    queryFn: () => apiGet<ActivityItem[]>("/dashboard/recent-activity"),
    ...options?.query,
  });
}

export function useGetSalesByMonth(
  params?: GetSalesByMonthParams,
  options?: { query?: Partial<UseQueryOptions<MonthlySales[]>> },
) {
  return useQuery({
    queryKey: getGetSalesByMonthQueryKey(params),
    queryFn: () =>
      apiGet<MonthlySales[]>(`/dashboard/sales-by-month${params?.months ? `?months=${params.months}` : ""}`),
    ...options?.query,
  });
}

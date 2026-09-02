import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { apiGet, apiSend } from "./core";
import type { Task, TaskInput, TaskUpdate } from "./types";

export const getListTasksQueryKey = () => ["/api/tasks"] as const;
export const getGetTaskQueryKey = (id: number) => ["/api/tasks", id] as const;

export function useListTasks(options?: { query?: Partial<UseQueryOptions<Task[]>> }) {
  return useQuery({
    queryKey: getListTasksQueryKey(),
    queryFn: () => apiGet<Task[]>("/tasks"),
    ...options?.query,
  });
}

export function useGetTask(id: number, options?: { query?: Partial<UseQueryOptions<Task>> }) {
  return useQuery({
    queryKey: getGetTaskQueryKey(id),
    queryFn: () => apiGet<Task>(`/tasks/${id}`),
    enabled: !!id,
    ...options?.query,
  });
}

export function useCreateTask(options?: {
  mutation?: Partial<UseMutationOptions<Task, Error, { data: TaskInput }>>;
}) {
  return useMutation({
    mutationFn: ({ data }: { data: TaskInput }) => apiSend<Task>("/tasks", "POST", data),
    ...options?.mutation,
  });
}

export function useUpdateTask(options?: {
  mutation?: Partial<UseMutationOptions<Task, Error, { id: number; data: TaskUpdate }>>;
}) {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: TaskUpdate }) =>
      apiSend<Task>(`/tasks/${id}`, "PATCH", data),
    ...options?.mutation,
  });
}

export function useDeleteTask(options?: {
  mutation?: Partial<UseMutationOptions<void, Error, { id: number }>>;
}) {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => apiSend<void>(`/tasks/${id}`, "DELETE"),
    ...options?.mutation,
  });
}

export function useCompleteTask(options?: {
  mutation?: Partial<UseMutationOptions<Task, Error, { id: number }>>;
}) {
  return useMutation({
    mutationFn: ({ id }: { id: number }) => apiSend<Task>(`/tasks/${id}/complete`, "PATCH"),
    ...options?.mutation,
  });
}

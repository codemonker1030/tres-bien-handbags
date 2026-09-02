import { customFetch } from "./custom-fetch";

const API_BASE = "/api";

/** GET request returning parsed JSON, typed as T. Throws ApiError on failure. */
export function apiGet<T>(path: string): Promise<T> {
  return customFetch<T>(`${API_BASE}${path}`);
}

/** POST/PATCH/DELETE request with an optional JSON body, typed response. */
export function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  return customFetch<T>(`${API_BASE}${path}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export { customFetch, ApiError, setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { ErrorType, AuthTokenGetter } from "./custom-fetch";

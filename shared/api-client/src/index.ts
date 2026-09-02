// Hand-written React Query hooks + fetch wrapper for talking to the backend.
// One file per feature domain, mirroring @workspace/schemas on the backend.
// No code generation — these are plain, readable hooks over `fetch`.
export * from "./types";
export * from "./core";
export * from "./products";
export * from "./sales";
export * from "./expenses";
export * from "./tasks";
export * from "./dashboard";

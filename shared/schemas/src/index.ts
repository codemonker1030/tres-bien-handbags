// Hand-written Zod validation schemas, organized one file per feature.
// This is the single source of truth for what a request/response looks
// like — the backend routes import directly from here, and the frontend's
// TypeScript types (in @workspace/api-client) are kept in sync by hand to
// match. No code generation step, no separate spec file to fall out of sync.
export * from "./health";
export * from "./products";
export * from "./sales";
export * from "./expenses";
export * from "./tasks";
export * from "./dashboard";

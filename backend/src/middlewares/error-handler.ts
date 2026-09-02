import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

/**
 * Catches every error thrown (or rejected) anywhere in a route handler.
 * Express 5 automatically forwards async errors here — no need to wrap
 * every route in a try/catch just to get a clean response out of it.
 *
 * Mount this LAST, after every other app.use() — Express identifies
 * error-handling middleware by its 4-argument signature (err, req, res, next),
 * and it only runs when something upstream calls next(err) or throws.
 *
 * Without this, an unhandled error falls through to Express's default error
 * handler, which returns a raw HTML stack-trace page instead of JSON — the
 * frontend's fetch() then fails to parse it as the expected error shape,
 * which is why some failures earlier looked "silent" rather than showing a
 * clear message.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
): void {
  const message = err instanceof Error ? err.message : "Internal server error";

  logger.error({ err, method: req.method, url: req.originalUrl }, "Unhandled request error");

  if (res.headersSent) return;
  res.status(500).json({ error: message });
}

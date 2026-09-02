import type { Request, Response } from "express";

/**
 * Catches any request under /api that didn't match a route above it.
 * Mount this AFTER all real routes, so it only runs when nothing else did.
 * Without this, an unmatched route falls through to Express's default
 * handler, which returns an HTML page instead of JSON — annoying to debug
 * from the frontend, since fetch() then has to parse HTML as an error body.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `No route matches ${req.method} ${req.originalUrl}` });
}

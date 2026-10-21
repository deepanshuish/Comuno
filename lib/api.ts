import "server-only";
import { HttpError, requireApiCtx, type Ctx } from "./auth";

type Handler<P> = (args: { req: Request; ctx: Ctx; params: P }) => Promise<unknown>;

/**
 * Wrap an authenticated route handler: resolves the session (or API key),
 * serializes the return value as JSON, and maps thrown errors to JSON responses.
 *
 *   export const GET = route(async ({ ctx }) => listThings(ctx.workspace.id));
 *   export const PATCH = route<{ id: string }>(async ({ req, ctx, params }) => ...);
 */
export function route<P = Record<string, never>>(fn: Handler<P>) {
  return async (req: Request, routeCtx?: { params?: Promise<P> }) => {
    try {
      const ctx = await requireApiCtx();
      const params = ((await routeCtx?.params) ?? {}) as P;
      const result = await fn({ req, ctx, params });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Same as route() but without requiring a session (public endpoints). */
export function publicRoute<P = Record<string, never>>(fn: (args: { req: Request; params: P }) => Promise<unknown>) {
  return async (req: Request, routeCtx?: { params?: Promise<P> }) => {
    try {
      const params = ((await routeCtx?.params) ?? {}) as P;
      const result = await fn({ req, params });
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  const err = e as { status?: number; message?: string };
  console.error(e);
  // Surface Gemini API errors (bad key, quota) with a readable message.
  // Database misconfiguration or outage: say so instead of a generic error.
  const code = (e as { code?: string })?.code;
  if (/DATABASE_URL/.test(err?.message || "") || ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "28P01", "XX000", "3D000"].includes(code || "")) {
    return Response.json({ error: "Database unavailable. Check DATABASE_URL in your deployment settings (see /api/health)." }, { status: 503 });
  }
  if (err?.status === 503 || err?.status === 500) {
    return Response.json(
      { error: "Gemini is busy right now (Google reports high demand). Please try again in a minute." },
      { status: 503 },
    );
  }
  if (err?.status === 429) {
    return Response.json(
      { error: "Gemini quota reached for this API key. Wait a minute and retry, or enable billing on the key in Google AI Studio." },
      { status: 429 },
    );
  }
  if (typeof err?.status === "number" && err.status >= 400 && err.status < 600) {
    return Response.json({ error: `AI engine error: ${err.message || "request failed"}` }, { status: 502 });
  }
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export function bad(message: string): never {
  throw new HttpError(400, message);
}

export function notFound(what = "Not found"): never {
  throw new HttpError(404, what);
}

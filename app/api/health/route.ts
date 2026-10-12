import { one } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Deployment health check. Reports whether required configuration is present and
 * whether the database is reachable. Never returns secret values.
 */
export async function GET() {
  const url = process.env.DATABASE_URL || "";
  let parsed: URL | null = null;
  try {
    parsed = url ? new URL(url) : null;
  } catch {
    parsed = null;
  }
  const database: Record<string, unknown> = {
    configured: !!url,
    valid_url: !!parsed && /^postgres(ql)?:$/.test(parsed.protocol),
    host: parsed?.hostname || null,
    port: parsed?.port || null,
    // A raw "@" in the password breaks the URL; it must be written as %40.
    password_looks_encoded: parsed ? !/@.*@/.test(url.replace(/^[a-z]+:\/\//, "")) : null,
  };
  try {
    const started = Date.now();
    await one("SELECT 1 AS ok");
    database.reachable = true;
    database.latency_ms = Date.now() - started;
  } catch (e) {
    database.reachable = false;
    database.error = describe(e);
  }
  return Response.json(
    {
      ok: database.reachable === true,
      database,
      gemini: { configured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) },
      cron_secret: { configured: !!process.env.CRON_SECRET },
      app_url: process.env.APP_URL || null,
    },
    { status: database.reachable ? 200 : 503 },
  );
}

function describe(e: unknown) {
  const err = e as { code?: string; message?: string };
  // Strip anything that looks like a connection string before returning it.
  const msg = (err.message || String(e)).replace(/postgres(ql)?:\/\/\S+/g, "postgres://***").split(" [SQL:")[0];
  return { code: err.code || null, message: msg.slice(0, 300) };
}

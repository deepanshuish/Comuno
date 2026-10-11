import { HttpError } from "@/lib/auth";
import { rateLimited, recordVisit } from "@/lib/services/signals";

/**
 * Public, CORS-enabled page-view collector for the website tracking script (/t.js).
 * POST body (JSON, sent as text/plain to avoid a preflight):
 *   { k: trackingKey, v: visitorId, u: url, t?: title, r?: referrer, e?: email, c?: contactId }
 * GET returns a 1×1 GIF (no-JS / email pixel fallback) with the same fields as query params.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

type Beacon = { type?: string; k?: string; v?: string; u?: string; t?: string; r?: string; e?: string; c?: string };

function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip") || "").trim();
}

async function handle(req: Request, b: Beacon): Promise<{ status: number; error?: string }> {
  const ip = clientIp(req);
  if (typeof b.k !== "string" || typeof b.v !== "string" || typeof b.u !== "string") return { status: 400, error: "Missing k, v or u" };
  if (rateLimited(`ip:${ip}|${b.k}`, 120) || rateLimited(`v:${b.v}`, 60)) return { status: 429, error: "Too many events" };
  try {
    await recordVisit({
      trackingKey: b.k,
      visitorId: b.v,
      url: b.u,
      title: typeof b.t === "string" ? b.t : undefined,
      referrer: typeof b.r === "string" ? b.r : undefined,
      email: typeof b.e === "string" ? b.e : undefined,
      contactId: typeof b.c === "string" ? b.c : undefined,
      identifyOnly: b.type === "identify",
      ip,
      userAgent: req.headers.get("user-agent") || undefined,
    });
    return { status: 204 };
  } catch (e) {
    if (e instanceof HttpError) return { status: e.status, error: e.message };
    console.error("track error", e);
    return { status: 500, error: "Could not record visit" };
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  let b: Beacon;
  try {
    const text = await req.text();
    if (text.length > 8000) return Response.json({ error: "Payload too large" }, { status: 413, headers: CORS });
    b = JSON.parse(text) as Beacon;
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400, headers: CORS });
  }
  const r = await handle(req, b);
  return r.error ? Response.json({ error: r.error }, { status: r.status, headers: CORS }) : new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const b: Beacon = {
    k: q.get("k") ?? undefined,
    v: q.get("v") ?? undefined,
    u: q.get("u") ?? req.headers.get("referer") ?? undefined,
    t: q.get("t") ?? undefined,
    r: q.get("r") ?? undefined,
    e: q.get("e") ?? undefined,
    c: q.get("c") ?? undefined,
  };
  await handle(req, b);
  return new Response(GIF, {
    headers: { ...CORS, "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" },
  });
}

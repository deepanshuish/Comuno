import { body, route } from "@/lib/api";
import { ingestInbound } from "@/lib/services/engage";

/**
 * Inbound reply webhook for email providers / forwarding rules.
 *   POST /api/inbox/inbound
 *   Authorization: Bearer <Comuno API key>
 *   { "from": "Jane <jane@acme.com>", "subject": "Re: ...", "text": "..." }
 * Also accepts common provider field names (sender, From, body-plain, stripped-text, plain).
 */
export const POST = route(async ({ req, ctx }) => {
  const type = req.headers.get("content-type") || "";
  let b: Record<string, string> = {};
  if (type.includes("application/json")) b = await body<Record<string, string>>(req);
  else {
    const form = await req.formData();
    form.forEach((v, k) => typeof v === "string" && (b[k] = v));
  }
  const from = b.from || b.sender || b.From || b.envelope_from || "";
  const subject = b.subject || b.Subject || "";
  const text = b["stripped-text"] || b.text || b["body-plain"] || b.plain || b.body || "";
  const res = await ingestInbound(ctx.workspace, { from, subject, text });
  return Response.json(res, { status: res.matched ? 200 : 202 });
});

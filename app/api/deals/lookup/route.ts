import { route } from "@/lib/api";
import { lookup } from "@/lib/services/crm";

/** Picker search for the deal form: ?type=company|contact&q=...&company_id=... */
export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url);
  const kind = u.searchParams.get("type") === "contact" ? "contact" : "company";
  const q = (u.searchParams.get("q") || "").slice(0, 100);
  return { results: await lookup(ctx.workspace.id, kind, q, u.searchParams.get("company_id")) };
});

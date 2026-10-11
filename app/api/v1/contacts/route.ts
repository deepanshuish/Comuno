import { bad, body, route } from "@/lib/api";
import { saveProspects, searchContacts, type ProspectResult } from "@/lib/services/prospect";

/** Public API: list/search people. */
export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url);
  return searchContacts(ctx.workspace.id, {
    q: u.searchParams.get("q") || undefined,
    status: u.searchParams.get("status") || undefined,
    limit: Math.min(Number(u.searchParams.get("limit")) || 50, 200),
    offset: Number(u.searchParams.get("offset")) || 0,
  });
});

/** Public API: create people (deduplicated). Accepts one object or an array. */
export const POST = route(async ({ req, ctx }) => {
  const input = await body<Partial<ProspectResult> | Partial<ProspectResult>[]>(req);
  const rows = (Array.isArray(input) ? input : [input]).slice(0, 500);
  if (!rows.length) bad("Provide at least one person");
  const results: ProspectResult[] = rows.map((r) => ({
    first_name: r.first_name || "",
    last_name: r.last_name || "",
    title: r.title || "",
    company: r.company || "",
    domain: r.domain ?? null,
    linkedin_url: r.linkedin_url ?? null,
    location: r.location ?? null,
    reason: r.reason || "",
    source_url: r.source_url ?? null,
  }));
  return saveProspects(ctx.workspace, results, { source: "api" });
});

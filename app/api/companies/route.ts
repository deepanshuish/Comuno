import { body, route } from "@/lib/api";
import { createCompany, searchCompanies } from "@/lib/services/prospect";

type Sort = "created" | "score" | "name" | "people";

/** GET ?q&industry&minScore&sort&limit&offset */
export const GET = route(async ({ req, ctx }) => {
  const s = new URL(req.url).searchParams;
  const num = (k: string) => (s.get(k) ? Number(s.get(k)) : undefined);
  return searchCompanies(ctx.workspace.id, {
    q: s.get("q") || undefined,
    industry: s.get("industry") || undefined,
    minScore: num("minScore"),
    sort: (s.get("sort") as Sort) || undefined,
    limit: num("limit"),
    offset: num("offset"),
  });
});

/** POST { name, domain?, industry?, size?, location? } */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ name?: string; domain?: string; industry?: string; size?: string; location?: string }>(req);
  return { id: await createCompany(ctx.workspace.id, { ...b, name: b.name || "" }) };
});

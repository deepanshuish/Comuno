import { bad, body, route } from "@/lib/api";
import { discoverCompanies, discoverProspects } from "@/lib/services/prospect";
import type { ICP } from "@/lib/types";

/** POST { query, mode: "people" | "companies", icp?, limit? } — search-grounded lead discovery. */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ query?: string; mode?: string; icp?: ICP; limit?: number }>(req);
  const query = (b.query || "").slice(0, 2000);
  if (b.mode && b.mode !== "people" && b.mode !== "companies") bad("mode must be 'people' or 'companies'");
  const input = { query, icp: b.icp, limit: b.limit };
  const res = b.mode === "companies" ? await discoverCompanies(ctx.workspace, input) : await discoverProspects(ctx.workspace, input);
  return { ...res, mode: b.mode || "people", credits: ctx.workspace.credits };
});

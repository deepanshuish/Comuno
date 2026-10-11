import { bad, body, route } from "@/lib/api";
import { deleteCompanies, enrichCompany, runBulk, scoreCompanies } from "@/lib/services/prospect";

/** POST { action: "delete" | "score" | "enrich", ids, withPeople? } */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ action?: string; ids?: string[]; withPeople?: boolean }>(req);
  const ids = Array.isArray(b.ids) ? b.ids.filter((x) => typeof x === "string") : [];
  if (!ids.length) bad("Select at least one company");
  const ws = ctx.workspace;
  switch (b.action) {
    case "delete":
      return { deleted: await deleteCompanies(ws.id, ids, { withPeople: !!b.withPeople }) };
    case "score":
      return { scores: await scoreCompanies(ws, ids), credits: ws.credits };
    case "enrich":
      return { ...(await runBulk(ids, 20, (id) => enrichCompany(ws, id).then(() => true))), credits: ws.credits };
    default:
      bad("Unknown action");
  }
});

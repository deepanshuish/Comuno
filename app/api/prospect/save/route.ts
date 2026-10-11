import { bad, body, route } from "@/lib/api";
import { createList, saveCompanies, saveProspects, type CompanyResult, type ProspectResult } from "@/lib/services/prospect";

/** POST { mode, results, listId?, newListName? } — save selected discovery results (deduped). */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ mode?: string; results?: unknown[]; listId?: string; newListName?: string }>(req);
  if (!Array.isArray(b.results) || !b.results.length) bad("Select at least one result to save");
  if (b.mode === "companies") {
    const r = await saveCompanies(ctx.workspace, b.results as CompanyResult[]);
    return r;
  }
  let listId = b.listId || undefined;
  if (!listId && b.newListName?.trim()) listId = await createList(ctx.workspace.id, b.newListName);
  const r = await saveProspects(ctx.workspace, b.results as ProspectResult[], { listId });
  return { ...r, listId: listId ?? null };
});

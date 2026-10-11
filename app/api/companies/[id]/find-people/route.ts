import { body, route } from "@/lib/api";
import { findPeopleAtCompany } from "@/lib/services/prospect";

/** POST { query?, limit? } — search-grounded discovery of people at this company. Save via /api/prospect/save. */
export const POST = route<{ id: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ query?: string; limit?: number }>(req).catch(() => ({}) as { query?: string; limit?: number });
  return { ...(await findPeopleAtCompany(ctx.workspace, params.id, b)), credits: ctx.workspace.credits };
});

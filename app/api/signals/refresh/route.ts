import { bad, body, route } from "@/lib/api";
import { refreshCompanySignals, refreshTopCompanies } from "@/lib/services/signals";

/** { company_id } refreshes one company; { top: N } refreshes the N best-scored companies. */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ company_id?: string; top?: number }>(req);
  if (b.company_id) {
    const created = await refreshCompanySignals(ctx.workspace, b.company_id);
    return { created: created.length, signals: created, credits: ctx.workspace.credits };
  }
  if (b.top) return { ...(await refreshTopCompanies(ctx.workspace, b.top)), credits: ctx.workspace.credits };
  bad("Pass company_id or top");
});

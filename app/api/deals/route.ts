import { body, route } from "@/lib/api";
import { createDeal, listDeals, pipelineSummary } from "@/lib/services/crm";
import type { DealStage } from "@/lib/types";

export const GET = route(async ({ ctx }) => {
  const [deals, summary] = await Promise.all([listDeals(ctx.workspace.id), pipelineSummary(ctx.workspace.id)]);
  return { deals, summary };
});

export const POST = route(async ({ req, ctx }) => {
  const b = await body<{
    name: string;
    value?: number;
    stage?: DealStage;
    company_id?: string | null;
    contact_id?: string | null;
    close_date?: string | null;
    notes?: string | null;
    probability?: number | null;
  }>(req);
  const id = await createDeal(ctx.workspace.id, b);
  return { id };
});

import { body, notFound, route } from "@/lib/api";
import { dealTimeline, deleteDeal, getDeal, parseInsight, updateDeal } from "@/lib/services/crm";
import type { Deal } from "@/lib/types";

export const GET = route<{ id: string }>(async ({ ctx, params }) => {
  const deal = await getDeal(ctx.workspace.id, params.id);
  if (!deal) notFound("Deal not found");
  const timeline = await dealTimeline(ctx.workspace.id, params.id);
  return { deal, insight: parseInsight(deal.ai_insight), timeline };
});

export const PATCH = route<{ id: string }>(async ({ req, ctx, params }) => {
  const patch = await body<Partial<Deal>>(req);
  await updateDeal(ctx.workspace.id, params.id, patch);
  return { deal: await getDeal(ctx.workspace.id, params.id) };
});

export const DELETE = route<{ id: string }>(async ({ ctx, params }) => {
  await deleteDeal(ctx.workspace.id, params.id);
  return { ok: true };
});

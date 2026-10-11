import { route } from "@/lib/api";
import { dealInsight, getDeal, parseInsight } from "@/lib/services/crm";

export const POST = route<{ id: string }>(async ({ ctx, params }) => {
  const text = await dealInsight(ctx.workspace, params.id);
  const deal = await getDeal(ctx.workspace.id, params.id);
  return { text, insight: parseInsight(deal?.ai_insight), credits: ctx.workspace.credits };
});

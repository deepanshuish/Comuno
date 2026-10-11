import { body, route } from "@/lib/api";
import { addDealActivity, dealTimeline } from "@/lib/services/crm";

export const GET = route<{ id: string }>(async ({ ctx, params }) => ({ timeline: await dealTimeline(ctx.workspace.id, params.id) }));

export const POST = route<{ id: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ type?: string; title?: string; body?: string }>(req);
  const id = await addDealActivity(ctx.workspace.id, params.id, b);
  return { id };
});

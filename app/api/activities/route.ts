import { body, route } from "@/lib/api";
import { logGenericActivity, recentActivity } from "@/lib/services/crm";

export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url);
  const activities = await recentActivity(ctx.workspace.id, {
    limit: Number(u.searchParams.get("limit")) || 30,
    deal_id: u.searchParams.get("deal_id") || undefined,
    contact_id: u.searchParams.get("contact_id") || undefined,
    company_id: u.searchParams.get("company_id") || undefined,
  });
  return { activities };
});

export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ type?: string; title?: string; body?: string; contact_id?: string; company_id?: string; deal_id?: string }>(req);
  return { id: await logGenericActivity(ctx.workspace.id, b) };
});

import { route } from "@/lib/api";
import { analytics } from "@/lib/services/crm";

export const GET = route(async ({ req, ctx }) => {
  const d = Number(new URL(req.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(d) ? d : 30;
  return analytics(ctx.workspace.id, days);
});

import { body, route } from "@/lib/api";
import { summarizeCall } from "@/lib/services/engage";

export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ contactId: string; notes: string; outcome?: string }>(req);
  return summarizeCall(ctx.workspace, b);
});

import { bad, body, route } from "@/lib/api";
import { callScript } from "@/lib/services/engage";

export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ contactId: string }>(req);
  if (!b.contactId) bad("contactId is required");
  return { script: await callScript(ctx.workspace, b.contactId) };
});

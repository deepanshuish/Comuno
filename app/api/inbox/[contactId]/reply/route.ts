import { body, route } from "@/lib/api";
import { logReply } from "@/lib/services/engage";

/** Log a prospect's reply (pasted by the user). Stops their sequences and classifies it when AI is available. */
export const POST = route<{ contactId: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ subject?: string; body: string; channel?: "email" | "linkedin" }>(req);
  return logReply(ctx.workspace, params.contactId, b);
});

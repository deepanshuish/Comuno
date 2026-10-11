import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { checkJobChanges, jobChangeCandidates } from "@/lib/services/signals";

/** { contact_ids?: string[], limit?: number } — defaults to the most engaged / highest-scored contacts. */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ contact_ids?: string[]; limit?: number }>(req);
  const ids = b.contact_ids?.length ? b.contact_ids : await jobChangeCandidates(ctx.workspace.id, Math.min(Math.max(Number(b.limit) || 5, 1), 25));
  if (!ids.length) throw new HttpError(400, "No contacts to check yet — add people with a name and company first.");
  return { ...(await checkJobChanges(ctx.workspace, ids)), credits: ctx.workspace.credits };
});

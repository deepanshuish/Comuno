import { bad, body, route } from "@/lib/api";
import { draftEmail } from "@/lib/services/engage";

/** AI-draft a personalized email to a contact. */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ contactId: string; goal?: string; instructions?: string }>(req);
  if (!b.contactId) bad("Pick a contact first");
  return draftEmail(ctx.workspace, b);
});

import { route } from "@/lib/api";
import { pickContacts } from "@/lib/services/engage";

/** Contact picker: ?q=search&list=<listId>&sequence=<id>&phone=1&limit=N */
export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url).searchParams;
  return pickContacts(ctx.workspace.id, {
    q: u.get("q") || undefined,
    listId: u.get("list") || undefined,
    sequenceId: u.get("sequence") || undefined,
    withPhone: u.get("phone") === "1",
    limit: Number(u.get("limit")) || undefined,
  });
});

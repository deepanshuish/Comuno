import { route } from "@/lib/api";
import { dialerQueue } from "@/lib/services/engage";

/** Call queue: contacts with phone numbers, open call tasks first, then by score. ?list=<id>&recent=1 */
export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url).searchParams;
  const queue = await dialerQueue(ctx.workspace.id, { listId: u.get("list") || undefined, includeRecent: u.get("recent") === "1" });
  return { queue };
});

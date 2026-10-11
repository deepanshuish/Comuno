import { route } from "@/lib/api";
import { mailerStatus } from "@/lib/mailer";
import { inboxThreads, type InboxFilter } from "@/lib/services/engage";

export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url).searchParams;
  const res = await inboxThreads(ctx.workspace.id, (u.get("filter") as InboxFilter) || "all", u.get("q") || undefined);
  return { ...res, mailer: mailerStatus(ctx.workspace) };
});

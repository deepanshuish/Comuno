import { body, route } from "@/lib/api";
import { listSignals, markSignalsSeen, signalCounts } from "@/lib/services/signals";

export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url);
  const [signals, counts] = await Promise.all([
    listSignals(ctx.workspace.id, {
      type: u.searchParams.get("type") || undefined,
      unseenOnly: u.searchParams.get("unseen") === "1",
      companyId: u.searchParams.get("company_id") || undefined,
      limit: Number(u.searchParams.get("limit")) || 100,
    }),
    signalCounts(ctx.workspace.id),
  ]);
  return { signals, counts };
});

/** Bulk mark seen/unseen: { ids?: string[], all?: boolean, seen?: boolean } */
export const PATCH = route(async ({ req, ctx }) => {
  const b = await body<{ ids?: string[]; all?: boolean; seen?: boolean }>(req);
  return { updated: await markSignalsSeen(ctx.workspace.id, b) };
});

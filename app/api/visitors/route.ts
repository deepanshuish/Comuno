import { route } from "@/lib/api";
import { visitorsReport } from "@/lib/services/signals";

export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url);
  const d = Number(u.searchParams.get("days"));
  const report = await visitorsReport(ctx.workspace.id, [1, 7, 30, 90].includes(d) ? d : 30);
  const origin = req.headers.get("x-forwarded-host")
    ? `${req.headers.get("x-forwarded-proto") || "https"}://${req.headers.get("x-forwarded-host")}`
    : u.origin;
  return {
    ...report,
    tracking_key: ctx.workspace.tracking_key,
    snippet: `<script async src="${origin}/t.js" data-key="${ctx.workspace.tracking_key}"></script>`,
  };
});

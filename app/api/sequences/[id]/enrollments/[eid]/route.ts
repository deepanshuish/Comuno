import { body, route } from "@/lib/api";
import { enrollmentAction } from "@/lib/services/engage";

export const PATCH = route<{ id: string; eid: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ action: "pause" | "resume" | "unenroll" }>(req);
  await enrollmentAction(ctx.workspace.id, params.id, params.eid, b.action);
  return { ok: true };
});

export const DELETE = route<{ id: string; eid: string }>(async ({ ctx, params }) => {
  await enrollmentAction(ctx.workspace.id, params.id, params.eid, "unenroll");
  return { ok: true };
});

import { body, route } from "@/lib/api";
import { deleteSignal, markSignalsSeen } from "@/lib/services/signals";

export const PATCH = route<{ id: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ seen?: boolean }>(req);
  const updated = await markSignalsSeen(ctx.workspace.id, { ids: [params.id], seen: b.seen !== false });
  return { updated };
});

export const DELETE = route<{ id: string }>(async ({ ctx, params }) => {
  await deleteSignal(ctx.workspace.id, params.id);
  return { ok: true };
});

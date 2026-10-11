import { route } from "@/lib/api";
import { deleteThread, threadEvents } from "@/lib/services/agent";

export const GET = route<{ id: string }>(async ({ ctx, params }) => threadEvents(ctx, params.id));

export const DELETE = route<{ id: string }>(async ({ ctx, params }) => {
  await deleteThread(ctx, params.id);
  return { ok: true };
});

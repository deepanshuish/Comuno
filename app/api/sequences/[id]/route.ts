import { body, route } from "@/lib/api";
import { deleteSequence, getSequence, updateSequence } from "@/lib/services/engage";
import type { SequenceStep } from "@/lib/types";

export const GET = route<{ id: string }>(async ({ ctx, params }) => getSequence(ctx.workspace, params.id));

export const PATCH = route<{ id: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ name?: string; goal?: string | null; status?: string; steps?: (Partial<SequenceStep> & { id?: string })[] }>(req);
  await updateSequence(ctx.workspace.id, params.id, b);
  return getSequence(ctx.workspace, params.id);
});

export const DELETE = route<{ id: string }>(async ({ ctx, params }) => {
  await deleteSequence(ctx.workspace.id, params.id);
  return { ok: true };
});

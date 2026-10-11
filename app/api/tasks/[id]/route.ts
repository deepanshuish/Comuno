import { body, route } from "@/lib/api";
import { deleteTask, updateTask } from "@/lib/services/engage";

export const PATCH = route<{ id: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ status?: string; title?: string; body?: string | null; due_at?: string | null }>(req);
  const task = await updateTask(ctx.workspace.id, params.id, b);
  return { task };
});

export const DELETE = route<{ id: string }>(async ({ ctx, params }) => {
  await deleteTask(ctx.workspace.id, params.id);
  return { ok: true };
});

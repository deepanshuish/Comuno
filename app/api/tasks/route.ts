import { body, route } from "@/lib/api";
import { createTask, listTasks } from "@/lib/services/engage";

/** ?status=open|done|skipped|all&type=call|linkedin|todo|email&contact=<id> */
export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url).searchParams;
  const tasks = await listTasks(ctx.workspace.id, { status: u.get("status") || "open", type: u.get("type") || undefined, contactId: u.get("contact") || undefined });
  return { tasks };
});

export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ type?: string; title: string; body?: string; due_at?: string | null; contactId?: string | null }>(req);
  const id = await createTask(ctx.workspace.id, b);
  return { id };
});

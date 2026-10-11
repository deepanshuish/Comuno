import { body, route } from "@/lib/api";
import { listCalls, logCall } from "@/lib/services/engage";
import type { CallOutcome } from "@/components/engage/types";

export const GET = route(async ({ req, ctx }) => {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 50, 200);
  return { calls: await listCalls(ctx.workspace.id, limit) };
});

export const POST = route(async ({ req, ctx }) => {
  const b = await body<{
    contactId: string;
    outcome: CallOutcome;
    duration_sec?: number;
    notes?: string;
    summary?: string;
    taskId?: string;
    followUp?: { title: string; due_at?: string } | null;
  }>(req);
  const id = await logCall(ctx.workspace, b);
  return { id };
});

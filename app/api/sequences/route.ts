import { body, route } from "@/lib/api";
import { mailerStatus } from "@/lib/mailer";
import { createSequence, engageStats, listSequences } from "@/lib/services/engage";
import type { SequenceStep } from "@/lib/types";

export const GET = route(async ({ ctx }) => {
  const [sequences, stats] = await Promise.all([listSequences(ctx.workspace.id), engageStats(ctx.workspace.id)]);
  return { sequences, stats, mailer: mailerStatus(ctx.workspace) };
});

export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ name: string; goal?: string; steps?: Omit<SequenceStep, "id" | "sequence_id">[] }>(req);
  const id = await createSequence(ctx.workspace.id, { name: b.name, goal: b.goal, steps: b.steps || [] });
  return { id };
});

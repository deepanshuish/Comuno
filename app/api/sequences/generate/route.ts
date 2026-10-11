import { body, route } from "@/lib/api";
import { createSequence, generateSequence } from "@/lib/services/engage";
import type { StepType } from "@/lib/types";

/** Generate a sequence with Gemini. Saves it as a draft unless `save: false`. */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ goal: string; steps?: number; channels?: StepType[]; tone?: string; save?: boolean }>(req);
  const generated = await generateSequence(ctx.workspace, b);
  if (b.save === false) return generated;
  const id = await createSequence(ctx.workspace.id, { name: generated.name, goal: b.goal, steps: generated.steps });
  return { id, ...generated };
});

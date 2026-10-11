import { body, route } from "@/lib/api";
import { setSentiment } from "@/lib/services/engage";
import type { Sentiment } from "@/components/engage/types";

/** Manually label a reply's sentiment (updates the contact and stops sequences). */
export const PATCH = route<{ id: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ sentiment: Sentiment }>(req);
  await setSentiment(ctx.workspace.id, params.id, b.sentiment);
  return { ok: true };
});

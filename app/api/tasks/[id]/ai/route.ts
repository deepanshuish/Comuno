import { route } from "@/lib/api";
import { aiTaskContent } from "@/lib/services/engage";

/** Write (or rewrite) the task's LinkedIn note / call talk-track with AI. */
export const POST = route<{ id: string }>(async ({ ctx, params }) => ({ task: await aiTaskContent(ctx.workspace, params.id) }));

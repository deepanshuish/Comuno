import { route } from "@/lib/api";
import { classifyReply } from "@/lib/services/engage";

export const POST = route<{ id: string }>(async ({ ctx, params }) => classifyReply(ctx.workspace, params.id));

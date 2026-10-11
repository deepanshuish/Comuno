import { route } from "@/lib/api";
import { draftReply } from "@/lib/services/engage";

export const POST = route<{ contactId: string }>(async ({ ctx, params }) => draftReply(ctx.workspace, params.contactId));

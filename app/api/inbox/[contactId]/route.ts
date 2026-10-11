import { route } from "@/lib/api";
import { threadDetail } from "@/lib/services/engage";

export const GET = route<{ contactId: string }>(async ({ ctx, params }) => threadDetail(ctx.workspace.id, params.contactId));

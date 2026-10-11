import { route } from "@/lib/api";
import { verifyContactEmail } from "@/lib/services/prospect";

export const POST = route<{ id: string }>(async ({ ctx, params }) => ({ ...(await verifyContactEmail(ctx.workspace, params.id)), credits: ctx.workspace.credits }));

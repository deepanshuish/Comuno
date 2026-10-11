import { route } from "@/lib/api";
import { findEmail } from "@/lib/services/prospect";

export const POST = route<{ id: string }>(async ({ ctx, params }) => ({ ...(await findEmail(ctx.workspace, params.id)), credits: ctx.workspace.credits }));

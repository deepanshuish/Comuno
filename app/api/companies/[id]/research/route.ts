import { route } from "@/lib/api";
import { researchAccount } from "@/lib/services/prospect";

export const POST = route<{ id: string }>(async ({ ctx, params }) => ({ ...(await researchAccount(ctx.workspace, params.id)), credits: ctx.workspace.credits }));

import { route } from "@/lib/api";
import { enrichContact } from "@/lib/services/prospect";

export const POST = route<{ id: string }>(async ({ ctx, params }) => ({ contact: await enrichContact(ctx.workspace, params.id), credits: ctx.workspace.credits }));

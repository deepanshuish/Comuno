import { route } from "@/lib/api";
import { enrichCompany } from "@/lib/services/prospect";

export const POST = route<{ id: string }>(async ({ ctx, params }) => ({ company: await enrichCompany(ctx.workspace, params.id), credits: ctx.workspace.credits }));

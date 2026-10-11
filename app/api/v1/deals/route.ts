import { route } from "@/lib/api";
import { listDeals } from "@/lib/services/crm";

export const GET = route(async ({ ctx }) => listDeals(ctx.workspace.id));

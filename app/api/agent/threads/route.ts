import { route } from "@/lib/api";
import { listThreads } from "@/lib/services/agent";

export const GET = route(async ({ ctx }) => listThreads(ctx));

import { route } from "@/lib/api";
import { workspaceIcp } from "@/lib/services/prospect";

/** GET — the workspace ICP, used to prefill discovery filters. */
export const GET = route(async ({ ctx }) => ({ icp: workspaceIcp(ctx.workspace) }));

import { route } from "@/lib/api";
import { run } from "@/lib/db";

export const DELETE = route<{ id: string }>(async ({ ctx, params }) => {
  await run("DELETE FROM api_keys WHERE id = ? AND workspace_id = ?", [params.id, ctx.workspace.id]);
  return { ok: true };
});

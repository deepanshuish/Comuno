import { body, route } from "@/lib/api";
import { createApiKey } from "@/lib/auth";
import { all } from "@/lib/db";

export const GET = route(async ({ ctx }) =>
  all("SELECT id, name, prefix, last_used_at, created_at FROM api_keys WHERE workspace_id = ? ORDER BY created_at DESC", [
    ctx.workspace.id,
  ]),
);

export const POST = route(async ({ req, ctx }) => {
  const { name } = await body<{ name?: string }>(req);
  // The full key is returned exactly once; only its hash is stored.
  return createApiKey(ctx.workspace.id, name?.trim() || "API key");
});

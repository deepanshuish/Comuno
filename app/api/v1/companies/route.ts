import { route } from "@/lib/api";
import { all } from "@/lib/db";

export const GET = route(async ({ req, ctx }) => {
  const u = new URL(req.url);
  const limit = Math.min(Number(u.searchParams.get("limit")) || 50, 200);
  const offset = Number(u.searchParams.get("offset")) || 0;
  return all(
    "SELECT id, name, domain, website, industry, size, location, description, funding, score, created_at FROM companies WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [ctx.workspace.id, limit, offset],
  );
});

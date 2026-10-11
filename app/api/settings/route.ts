import { body, route } from "@/lib/api";
import { all, update } from "@/lib/db";
import type { Workspace } from "@/lib/types";

const EDITABLE = [
  "name", "company_name", "company_website", "product_description", "value_prop", "icp_json",
  "sender_name", "sender_email", "signature", "smtp_json", "gemini_api_key",
] as const;

export const GET = route(async ({ ctx }) => {
  const ws = ctx.workspace;
  const ledger = await all(
    "SELECT amount, reason, created_at FROM credit_ledger WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50",
    [ws.id],
  );
  return {
    workspace: {
      ...ws,
      // Never send secrets back to the browser; only say whether they're set.
      gemini_api_key: ws.gemini_api_key ? `••••${ws.gemini_api_key.slice(-4)}` : null,
      smtp_json: ws.smtp_json ? maskSmtp(ws.smtp_json) : null,
    },
    env: {
      gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
      smtp: !!process.env.SMTP_HOST,
      model: process.env.GEMINI_MODEL || "gemini-flash-latest",
    },
    user: ctx.user,
    ledger,
  };
});

export const PATCH = route(async ({ req, ctx }) => {
  const input = await body<Partial<Record<(typeof EDITABLE)[number], string | null>>>(req);
  const patch: Partial<Workspace> = {};
  for (const k of EDITABLE) {
    if (!(k in input)) continue;
    const v = input[k];
    // Masked secrets come back unchanged from the form; ignore them.
    if ((k === "gemini_api_key" || k === "smtp_json") && typeof v === "string" && v.includes("••••")) continue;
    (patch as Record<string, unknown>)[k] = typeof v === "string" ? v.trim() || null : v;
  }
  if (patch.smtp_json) {
    try {
      JSON.parse(patch.smtp_json);
    } catch {
      return Response.json({ error: "SMTP settings must be valid JSON" }, { status: 400 });
    }
  }
  if (patch.name === null) delete patch.name;
  await update("workspaces", ctx.workspace.id, patch as Record<string, string | null>);
  return { ok: true };
});

function maskSmtp(json: string) {
  try {
    const s = JSON.parse(json);
    return JSON.stringify({ ...s, pass: s.pass ? "••••" : undefined });
  } catch {
    return null;
  }
}

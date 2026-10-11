import { route } from "@/lib/api";
import { one } from "@/lib/db";
import { dashboardStats, recentActivity } from "@/lib/services/crm";
import { listSignals } from "@/lib/services/signals";

export const GET = route(async ({ ctx }) => {
  const ws = ctx.workspace;
  const [stats, signals, activity, counts] = await Promise.all([
    dashboardStats(ws.id),
    listSignals(ws.id, { limit: 6 }),
    recentActivity(ws.id, { limit: 12 }),
    one<{ sequences: number; visits: number; deals: number }>(
      `SELECT (SELECT COUNT(*) FROM sequences WHERE workspace_id = :ws) AS sequences,
              (SELECT COUNT(*) FROM visits WHERE workspace_id = :ws) AS visits,
              (SELECT COUNT(*) FROM deals WHERE workspace_id = :ws) AS deals`,
      { ws: ws.id },
    ),
  ]);
  const icp = (() => {
    try {
      const j = JSON.parse(ws.icp_json || "{}") as Record<string, unknown>;
      return Object.values(j).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
    } catch {
      return false;
    }
  })();
  const checklist = [
    {
      id: "profile",
      label: "Set your company profile & ICP",
      body: "Tell Comuno what you sell and who you sell to, so every AI action is tailored.",
      href: "/settings",
      done: !!(ws.company_name && ws.product_description && icp),
    },
    { id: "leads", label: "Find your first leads", body: "Discover people that match your ICP and add them to People.", href: "/prospect", done: stats.people > 0 },
    { id: "sequence", label: "Create a sequence", body: "Build a multi-step, AI-personalized outreach cadence.", href: "/sequences", done: Number(counts?.sequences) > 0 },
    {
      id: "pixel",
      label: "Install the tracking pixel",
      body: "See which companies and people visit your website.",
      href: "/visitors",
      done: Number(counts?.visits) > 0,
    },
    {
      id: "gemini",
      label: "Add a Gemini API key",
      body: "Power research, writing and insights with Google Gemini.",
      href: "/settings?tab=ai",
      done: !!(ws.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    },
  ];
  return {
    user: { name: ctx.user.name, email: ctx.user.email },
    workspace: { name: ws.name, company_name: ws.company_name },
    stats: { ...stats, deals: Number(counts?.deals) || 0 },
    checklist,
    signals,
    activity,
  };
});

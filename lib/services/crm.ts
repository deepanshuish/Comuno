import "server-only";
import { HttpError } from "../auth";
import { withCredits } from "../credits";
import { all, insert, one, parseJson, run, update } from "../db";
import { generateJSON, geminiClient, sellerContext } from "../gemini";
import { DEAL_STAGES, type Activity, type Deal, type DealStage, type Workspace } from "../types";
import { contactBrief, getCompany, logActivity } from "./core";

/* ───────────────────────── Deals ───────────────────────── */

export type DealRow = Deal & { company_name: string | null; contact_name: string | null };

export type DealInsight = {
  summary: string;
  next_best_action: string;
  risks: string[];
  meddicc_gaps: { element: string; gap: string }[];
  follow_up_email: { subject: string; body: string };
  generated_at?: string;
};

const STAGE_IDS = new Set<string>(DEAL_STAGES.map((s) => s.id));

export function isDealStage(s: unknown): s is DealStage {
  return typeof s === "string" && STAGE_IDS.has(s);
}

export function stageProbability(stage: DealStage): number {
  return DEAL_STAGES.find((s) => s.id === stage)?.probability ?? 10;
}

function stageLabel(stage: string) {
  return DEAL_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

const DEAL_SELECT = `SELECT d.*, co.name AS company_name,
  NULLIF(TRIM(COALESCE(ct.first_name, '') || ' ' || COALESCE(ct.last_name, '')), '') AS contact_name,
  ct.email AS contact_email, ct.title AS contact_title, co.domain AS company_domain
  FROM deals d
  LEFT JOIN companies co ON co.id = d.company_id AND co.workspace_id = d.workspace_id
  LEFT JOIN contacts ct ON ct.id = d.contact_id AND ct.workspace_id = d.workspace_id`;

export async function listDeals(workspaceId: string): Promise<DealRow[]> {
  const rows = await all<DealRow>(`${DEAL_SELECT} WHERE d.workspace_id = ? ORDER BY d.updated_at DESC`, [workspaceId]);
  return rows.map(normalizeDeal);
}

export async function getDeal(workspaceId: string, id: string) {
  const d = await one<DealRow & { contact_email: string | null; contact_title: string | null; company_domain: string | null }>(
    `${DEAL_SELECT} WHERE d.id = ? AND d.workspace_id = ?`,
    [id, workspaceId],
  );
  return d ? normalizeDeal(d) : null;
}

function normalizeDeal<T extends Deal>(d: T): T {
  return { ...d, value: Number(d.value) || 0, probability: d.probability == null ? null : Number(d.probability) };
}

async function assertOwned(workspaceId: string, table: "companies" | "contacts", id: string | null | undefined) {
  if (!id) return null;
  const row = await one<{ id: string }>(`SELECT id FROM ${table} WHERE id = ? AND workspace_id = ?`, [id, workspaceId]);
  if (!row) throw new HttpError(400, table === "companies" ? "Company not found" : "Contact not found");
  return id;
}

function cleanValue(v: unknown): number {
  const n = typeof v === "string" ? Number(v.replace(/[^0-9.-]/g, "")) : Number(v);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, "Deal value must be a positive number");
  return Math.round(n * 100) / 100;
}

function cleanProbability(p: unknown): number | null {
  if (p === null || p === undefined || p === "") return null;
  const n = Math.round(Number(p));
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new HttpError(400, "Probability must be between 0 and 100");
  return n;
}

function cleanDate(d: unknown): string | null {
  if (d === null || d === undefined || d === "") return null;
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(d) || Number.isNaN(Date.parse(d))) {
    throw new HttpError(400, "Close date must be a valid date (YYYY-MM-DD)");
  }
  return d.slice(0, 10);
}

export async function createDeal(
  workspaceId: string,
  input: {
    name: string;
    value?: number;
    stage?: DealStage;
    company_id?: string | null;
    contact_id?: string | null;
    close_date?: string | null;
    notes?: string | null;
    probability?: number | null;
  },
): Promise<string> {
  const name = input.name?.trim();
  if (!name) throw new HttpError(400, "Deal name is required");
  const stage: DealStage = input.stage ?? "lead";
  if (!isDealStage(stage)) throw new HttpError(400, "Unknown deal stage");
  const contactId = await assertOwned(workspaceId, "contacts", input.contact_id);
  let companyId = await assertOwned(workspaceId, "companies", input.company_id);
  if (!companyId && contactId) {
    companyId = (await one<{ company_id: string | null }>("SELECT company_id FROM contacts WHERE id = ?", [contactId]))?.company_id ?? null;
  }
  const probability = cleanProbability(input.probability) ?? stageProbability(stage);
  const id = await insert("deals", {
    workspace_id: workspaceId,
    name: name.slice(0, 200),
    stage,
    value: cleanValue(input.value ?? 0),
    probability,
    company_id: companyId,
    contact_id: contactId,
    close_date: cleanDate(input.close_date),
    notes: input.notes?.trim() || null,
  });
  await logActivity(workspaceId, {
    type: "deal",
    title: `Deal created: ${name}`,
    body: `Stage: ${stageLabel(stage)}`,
    deal_id: id,
    company_id: companyId,
    contact_id: contactId,
  });
  return id;
}

const PATCHABLE = ["name", "value", "stage", "company_id", "contact_id", "close_date", "notes", "probability", "ai_insight"] as const;

export async function updateDeal(workspaceId: string, id: string, patch: Partial<Deal>): Promise<void> {
  const deal = await one<Deal>("SELECT * FROM deals WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
  if (!deal) throw new HttpError(404, "Deal not found");
  const data: Record<string, string | number | null> = {};
  for (const k of PATCHABLE) {
    if (!(k in patch) || patch[k] === undefined) continue;
    const v = patch[k];
    switch (k) {
      case "name": {
        const n = String(v ?? "").trim();
        if (!n) throw new HttpError(400, "Deal name is required");
        data.name = n.slice(0, 200);
        break;
      }
      case "value":
        data.value = cleanValue(v);
        break;
      case "stage":
        if (!isDealStage(v)) throw new HttpError(400, "Unknown deal stage");
        data.stage = v;
        break;
      case "company_id":
        data.company_id = await assertOwned(workspaceId, "companies", (v as string | null) || null);
        break;
      case "contact_id":
        data.contact_id = await assertOwned(workspaceId, "contacts", (v as string | null) || null);
        break;
      case "close_date":
        data.close_date = cleanDate(v);
        break;
      case "probability":
        data.probability = cleanProbability(v);
        break;
      case "notes":
      case "ai_insight":
        data[k] = typeof v === "string" && v.trim() ? v : null;
        break;
    }
  }
  const stageChanged = typeof data.stage === "string" && data.stage !== deal.stage;
  // Moving stage resets probability to the stage default unless the caller set one explicitly.
  if (stageChanged && !("probability" in data)) data.probability = stageProbability(data.stage as DealStage);
  if (!Object.keys(data).length) return;
  await update("deals", id, data, workspaceId);

  if (stageChanged) {
    await logActivity(workspaceId, {
      type: "stage_change",
      title: `${data.name ?? deal.name} moved to ${stageLabel(String(data.stage))}`,
      body: `From ${stageLabel(deal.stage)} → ${stageLabel(String(data.stage))}`,
      deal_id: id,
      company_id: (data.company_id as string | null | undefined) ?? deal.company_id,
      contact_id: (data.contact_id as string | null | undefined) ?? deal.contact_id,
    });
    if (data.stage === "won" && deal.contact_id) {
      await run("UPDATE contacts SET status = 'customer', updated_at = datetime('now') WHERE id = ? AND workspace_id = ?", [
        deal.contact_id,
        workspaceId,
      ]);
    }
  } else if ("value" in data && Number(data.value) !== Number(deal.value)) {
    await logActivity(workspaceId, {
      type: "deal",
      title: `Deal value updated to $${Number(data.value).toLocaleString("en-US")}`,
      deal_id: id,
      company_id: deal.company_id,
      contact_id: deal.contact_id,
    });
  }
}

export async function deleteDeal(workspaceId: string, id: string) {
  const n = await run("DELETE FROM deals WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
  if (!n) throw new HttpError(404, "Deal not found");
  await run("UPDATE activities SET deal_id = NULL WHERE deal_id = ? AND workspace_id = ?", [id, workspaceId]);
}

/** Timeline for a deal: activities on the deal itself, its contact, or its company. */
export async function dealTimeline(workspaceId: string, dealId: string, limit = 100) {
  const deal = await one<Deal>("SELECT * FROM deals WHERE id = ? AND workspace_id = ?", [dealId, workspaceId]);
  if (!deal) throw new HttpError(404, "Deal not found");
  return all<Activity>(
    `SELECT * FROM activities WHERE workspace_id = ? AND (deal_id = ? OR (? IS NOT NULL AND contact_id = ?) OR (? IS NOT NULL AND company_id = ?))
     ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    [workspaceId, dealId, deal.contact_id, deal.contact_id, deal.company_id, deal.company_id, limit],
  );
}

export const ACTIVITY_TYPES = ["note", "call", "email", "meeting", "task"] as const;

export async function addDealActivity(workspaceId: string, dealId: string, a: { type?: string; title?: string; body?: string }) {
  const deal = await one<Deal>("SELECT * FROM deals WHERE id = ? AND workspace_id = ?", [dealId, workspaceId]);
  if (!deal) throw new HttpError(404, "Deal not found");
  const type = (ACTIVITY_TYPES as readonly string[]).includes(a.type || "") ? (a.type as string) : "note";
  const body = a.body?.trim() || null;
  const title = a.title?.trim() || (type === "note" ? "Note added" : `${type[0].toUpperCase()}${type.slice(1)} logged`);
  if (!body && !a.title?.trim()) throw new HttpError(400, "Write something to log");
  const id = await logActivity(workspaceId, {
    type,
    title: title.slice(0, 200),
    body,
    deal_id: dealId,
    contact_id: deal.contact_id,
    company_id: deal.company_id,
  });
  await run("UPDATE deals SET updated_at = datetime('now') WHERE id = ?", [dealId]);
  return id;
}

/** Throws the standard 503 before any credits are charged when Gemini isn't configured. */
export function assertAI(ws: Workspace) {
  geminiClient(ws);
}

const INSIGHT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Two-sentence read on where the deal stands." },
    next_best_action: { type: "string", description: "The single most valuable next step, concrete and specific." },
    risks: { type: "array", items: { type: "string" }, description: "Up to 4 concrete risks to the deal." },
    meddicc_gaps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          element: {
            type: "string",
            enum: ["Metrics", "Economic buyer", "Decision criteria", "Decision process", "Identify pain", "Champion", "Competition"],
          },
          gap: { type: "string" },
        },
        required: ["element", "gap"],
      },
      description: "MEDDICC elements that are unknown or weak, with what to find out.",
    },
    follow_up_email: {
      type: "object",
      properties: { subject: { type: "string" }, body: { type: "string" } },
      required: ["subject", "body"],
    },
  },
  required: ["summary", "next_best_action", "risks", "meddicc_gaps", "follow_up_email"],
};

/** Parse a stored ai_insight (JSON, or legacy plain text). */
export function parseInsight(raw: string | null | undefined): DealInsight | null {
  if (!raw) return null;
  const j = parseJson<DealInsight | null>(raw, null);
  if (j && typeof j === "object" && "next_best_action" in j) return j;
  return { summary: raw, next_best_action: "", risks: [], meddicc_gaps: [], follow_up_email: { subject: "", body: "" } };
}

export function insightToText(i: DealInsight): string {
  return [
    i.summary && `Summary: ${i.summary}`,
    i.next_best_action && `Next best action: ${i.next_best_action}`,
    i.risks.length ? `Risks:\n${i.risks.map((r) => `- ${r}`).join("\n")}` : null,
    i.meddicc_gaps.length ? `MEDDICC gaps:\n${i.meddicc_gaps.map((g) => `- ${g.element}: ${g.gap}`).join("\n")}` : null,
    i.follow_up_email?.body ? `Suggested follow-up email:\nSubject: ${i.follow_up_email.subject}\n\n${i.follow_up_email.body}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * AI deal coaching: next best action, risks, MEDDICC gaps and a follow-up email.
 * Stores the structured result (JSON) in deals.ai_insight and returns a readable text version.
 */
export async function dealInsight(ws: Workspace, dealId: string): Promise<string> {
  const deal = await getDeal(ws.id, dealId);
  if (!deal) throw new HttpError(404, "Deal not found");
  assertAI(ws);
  const [brief, company, timeline] = await Promise.all([
    deal.contact_id ? contactBrief(ws.id, deal.contact_id) : Promise.resolve(""),
    deal.company_id && !deal.contact_id ? getCompany(ws.id, deal.company_id) : Promise.resolve(null),
    dealTimeline(ws.id, dealId, 30),
  ]);
  const daysOpen = Math.max(0, Math.round((Date.now() - Date.parse(deal.created_at.replace(" ", "T") + "Z")) / 864e5));
  const prompt = [
    `Analyze this B2B sales deal and coach the rep. Today is ${new Date().toISOString().slice(0, 10)}.`,
    "",
    `Deal: ${deal.name}`,
    `Stage: ${stageLabel(deal.stage)} (probability ${deal.probability ?? stageProbability(deal.stage)}%)`,
    `Value: $${deal.value.toLocaleString("en-US")}`,
    deal.close_date ? `Expected close date: ${deal.close_date}` : "Expected close date: not set",
    `Days open: ${daysOpen}`,
    deal.notes ? `Rep notes: ${deal.notes}` : null,
    "",
    brief ? `Primary contact & account context:\n${brief}` : company ? `Account: ${company.name}${company.industry ? ` (${company.industry})` : ""}${company.description ? ` — ${company.description}` : ""}` : "No contact linked to this deal yet.",
    "",
    timeline.length
      ? `Deal timeline (newest first):\n${timeline.map((a) => `- ${a.created_at} [${a.type}] ${a.title}${a.body ? `: ${a.body.slice(0, 240)}` : ""}`).join("\n")}`
      : "No activity logged on this deal yet.",
    "",
    "Be specific to this deal — no generic advice. Only reference facts given above; where information is missing, say it is unknown and list it as a MEDDICC gap.",
    "The follow-up email must be short (under 120 words), plain text, written from the seller to the primary contact, and move the deal to the next stage.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const { data } = await withCredits(ws, "ai_generate", 1, () =>
    generateJSON<DealInsight>({
      workspace: ws,
      system: `You are a world-class B2B sales coach using the MEDDICC framework.\n${sellerContext(ws)}`,
      prompt,
      schema: INSIGHT_SCHEMA,
      temperature: 0.4,
    }),
  );
  const insight: DealInsight = {
    summary: String(data.summary || ""),
    next_best_action: String(data.next_best_action || ""),
    risks: Array.isArray(data.risks) ? data.risks.map(String).slice(0, 6) : [],
    meddicc_gaps: Array.isArray(data.meddicc_gaps) ? data.meddicc_gaps.filter((g) => g?.element).slice(0, 7) : [],
    follow_up_email: { subject: String(data.follow_up_email?.subject || ""), body: String(data.follow_up_email?.body || "") },
    generated_at: new Date().toISOString(),
  };
  await update("deals", dealId, { ai_insight: JSON.stringify(insight) }, ws.id);
  await logActivity(ws.id, { type: "ai", title: "AI deal insight generated", body: insight.next_best_action, deal_id: dealId });
  return insightToText(insight);
}

/* ───────────────────────── Pipeline & stats ───────────────────────── */

export async function pipelineSummary(workspaceId: string): Promise<{
  stages: { stage: DealStage; count: number; value: number }[];
  total: number;
  weighted: number;
  winRate: number;
  wonValue: number;
  openCount: number;
  avgDealSize: number;
}> {
  const rows = await all<{ stage: string; count: number; value: number; weighted: number }>(
    `SELECT stage, COUNT(*) AS count, COALESCE(SUM(value), 0) AS value,
       COALESCE(SUM(value * COALESCE(probability, 0) / 100.0), 0) AS weighted
     FROM deals WHERE workspace_id = ? GROUP BY stage`,
    [workspaceId],
  );
  const by = new Map(rows.map((r) => [r.stage, r]));
  const stages = DEAL_STAGES.map((s) => ({ stage: s.id, count: Number(by.get(s.id)?.count ?? 0), value: Number(by.get(s.id)?.value ?? 0) }));
  const open = rows.filter((r) => r.stage !== "won" && r.stage !== "lost");
  const total = open.reduce((a, r) => a + Number(r.value), 0);
  const weighted = open.reduce((a, r) => a + Number(r.weighted), 0);
  const won = Number(by.get("won")?.count ?? 0);
  const lost = Number(by.get("lost")?.count ?? 0);
  const wonValue = Number(by.get("won")?.value ?? 0);
  return {
    stages,
    total,
    weighted: Math.round(weighted),
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : 0,
    wonValue,
    openCount: open.reduce((a, r) => a + Number(r.count), 0),
    avgDealSize: won ? Math.round(wonValue / won) : 0,
  };
}

const n = (v: unknown) => Number(v) || 0;

export async function dashboardStats(workspaceId: string): Promise<Record<string, number>> {
  const row = await one<Record<string, number>>(
    `SELECT
      (SELECT COUNT(*) FROM contacts WHERE workspace_id = :ws) AS people,
      (SELECT COUNT(*) FROM companies WHERE workspace_id = :ws) AS companies,
      (SELECT COUNT(*) FROM contacts WHERE workspace_id = :ws AND datetime(created_at) >= datetime('now', '-7 days')) AS people_added_week,
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent'
         AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', '-7 days')) AS emails_sent_week,
      (SELECT COUNT(DISTINCT contact_id) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent'
         AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', '-30 days')) AS contacted_30d,
      (SELECT COUNT(DISTINCT contact_id) FROM messages WHERE workspace_id = :ws AND direction = 'in'
         AND datetime(created_at) >= datetime('now', '-30 days')) AS replied_30d,
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent'
         AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', '-30 days')) AS sent_30d,
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent' AND opened_at IS NOT NULL
         AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', '-30 days')) AS opened_30d,
      (SELECT COUNT(*) FROM tasks WHERE workspace_id = :ws AND status = 'open') AS open_tasks,
      (SELECT COUNT(*) FROM tasks WHERE workspace_id = :ws AND status = 'open' AND due_at IS NOT NULL AND datetime(due_at) < datetime('now')) AS overdue_tasks,
      (SELECT COUNT(*) FROM signals WHERE workspace_id = :ws AND seen = 0) AS unseen_signals,
      (SELECT COUNT(DISTINCT visitor_id) FROM visits WHERE workspace_id = :ws AND datetime(created_at) >= datetime('now', '-7 days')) AS visitors_week,
      (SELECT COUNT(*) FROM sequences WHERE workspace_id = :ws AND status = 'active') AS active_sequences,
      (SELECT credits FROM workspaces WHERE id = :ws) AS credits`,
    { ws: workspaceId },
  );
  const p = await pipelineSummary(workspaceId);
  const r = row ?? {};
  const contacted = n(r.contacted_30d);
  const sent = n(r.sent_30d);
  return {
    people: n(r.people),
    companies: n(r.companies),
    people_added_week: n(r.people_added_week),
    pipeline_value: p.total,
    weighted_pipeline: p.weighted,
    open_deals: p.openCount,
    won_value: p.wonValue,
    win_rate: p.winRate,
    emails_sent_week: n(r.emails_sent_week),
    reply_rate: contacted ? Math.min(100, Math.round((n(r.replied_30d) / contacted) * 100)) : 0,
    open_rate: sent ? Math.round((n(r.opened_30d) / sent) * 100) : 0,
    open_tasks: n(r.open_tasks),
    overdue_tasks: n(r.overdue_tasks),
    unseen_signals: n(r.unseen_signals),
    visitors_week: n(r.visitors_week),
    active_sequences: n(r.active_sequences),
    credits: n(r.credits),
  };
}

/* ───────────────────────── Analytics ───────────────────────── */

export type AnalyticsReport = Awaited<ReturnType<typeof analytics>>;

function lastNDays(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export async function analytics(workspaceId: string, days = 30) {
  const ws = { ws: workspaceId };
  const since = `-${days} days`;
  const funnelRow = await one<Record<string, number>>(
    `SELECT
      (SELECT COUNT(*) FROM contacts WHERE workspace_id = :ws) AS contacts,
      (SELECT COUNT(*) FROM contacts c WHERE c.workspace_id = :ws AND (c.status != 'new'
         OR EXISTS (SELECT 1 FROM messages m WHERE m.workspace_id = :ws AND m.contact_id = c.id AND m.direction = 'out' AND m.status = 'sent')
         OR EXISTS (SELECT 1 FROM calls k WHERE k.workspace_id = :ws AND k.contact_id = c.id))) AS contacted,
      (SELECT COUNT(*) FROM contacts c WHERE c.workspace_id = :ws AND (c.status IN ('replied', 'interested', 'not_interested', 'customer')
         OR EXISTS (SELECT 1 FROM messages m WHERE m.workspace_id = :ws AND m.contact_id = c.id AND m.direction = 'in'))) AS replied,
      (SELECT COUNT(*) FROM contacts WHERE workspace_id = :ws AND status IN ('interested', 'customer')) AS interested,
      (SELECT COUNT(*) FROM deals WHERE workspace_id = :ws) AS deals,
      (SELECT COUNT(*) FROM deals WHERE workspace_id = :ws AND stage = 'won') AS won`,
    ws,
  );
  const f = funnelRow ?? {};
  const funnel = [
    { id: "contacts", label: "People", value: n(f.contacts) },
    { id: "contacted", label: "Contacted", value: n(f.contacted) },
    { id: "replied", label: "Replied", value: n(f.replied) },
    { id: "interested", label: "Interested", value: n(f.interested) },
    { id: "deals", label: "Deals", value: n(f.deals) },
    { id: "won", label: "Won", value: n(f.won) },
  ];

  const outreachRow = await one<Record<string, number>>(
    `SELECT
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent'
         AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', :since)) AS sent,
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent' AND opened_at IS NOT NULL
         AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', :since)) AS opened,
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'in'
         AND datetime(created_at) >= datetime('now', :since)) AS replies,
      (SELECT COUNT(DISTINCT contact_id) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent'
         AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', :since)) AS contacted,
      (SELECT COUNT(DISTINCT contact_id) FROM messages WHERE workspace_id = :ws AND direction = 'in'
         AND datetime(created_at) >= datetime('now', :since)) AS replied_contacts,
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'failed'
         AND datetime(created_at) >= datetime('now', :since)) AS failed,
      (SELECT COUNT(*) FROM messages WHERE workspace_id = :ws AND direction = 'in' AND sentiment IN ('positive', 'interested')
         AND datetime(created_at) >= datetime('now', :since)) AS positive`,
    { ...ws, since },
  );
  const o = outreachRow ?? {};
  const sentByDay = await all<{ day: string; sent: number; opened: number }>(
    `SELECT substr(datetime(COALESCE(sent_at, created_at)), 1, 10) AS day, COUNT(*) AS sent,
       SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opened
     FROM messages WHERE workspace_id = :ws AND direction = 'out' AND status = 'sent'
       AND datetime(COALESCE(sent_at, created_at)) >= datetime('now', :since)
     GROUP BY day`,
    { ...ws, since },
  );
  const repliesByDay = await all<{ day: string; replies: number }>(
    `SELECT substr(datetime(created_at), 1, 10) AS day, COUNT(*) AS replies
     FROM messages WHERE workspace_id = :ws AND direction = 'in' AND datetime(created_at) >= datetime('now', :since)
     GROUP BY day`,
    { ...ws, since },
  );
  const sMap = new Map(sentByDay.map((r) => [r.day, r]));
  const rMap = new Map(repliesByDay.map((r) => [r.day, n(r.replies)]));
  const byDay = lastNDays(days).map((day) => ({
    day,
    sent: n(sMap.get(day)?.sent),
    opened: n(sMap.get(day)?.opened),
    replies: rMap.get(day) ?? 0,
  }));

  const calls = await all<{ outcome: string; count: number; duration: number }>(
    `SELECT COALESCE(NULLIF(outcome, ''), 'unlogged') AS outcome, COUNT(*) AS count, COALESCE(SUM(duration_sec), 0) AS duration
     FROM calls WHERE workspace_id = ? AND datetime(created_at) >= datetime('now', ?) GROUP BY 1 ORDER BY count DESC`,
    [workspaceId, since],
  );

  const ledger = await all<{ reason: string; amount: number }>(
    `SELECT COALESCE(reason, 'other') AS reason, SUM(amount) AS amount FROM credit_ledger
     WHERE workspace_id = ? AND datetime(created_at) >= datetime('now', ?) GROUP BY 1`,
    [workspaceId, since],
  );
  const usage = new Map<string, number>();
  for (const l of ledger) {
    const amt = n(l.amount);
    if (l.reason.startsWith("refund: ")) {
      const key = l.reason.slice(8);
      usage.set(key, (usage.get(key) ?? 0) - amt);
    } else if (amt < 0) {
      usage.set(l.reason, (usage.get(l.reason) ?? 0) - amt);
    }
  }
  const creditsByAction = [...usage.entries()]
    .filter(([, v]) => v > 0)
    .map(([action, used]) => ({ action, used }))
    .sort((a, b) => b.used - a.used);
  const balance = n((await one<{ credits: number }>("SELECT credits FROM workspaces WHERE id = ?", [workspaceId]))?.credits);

  const pipeline = await pipelineSummary(workspaceId);
  const sent = n(o.sent);
  const contacted = n(o.contacted);
  return {
    days,
    funnel,
    outreach: {
      sent,
      opened: n(o.opened),
      openRate: sent ? Math.round((n(o.opened) / sent) * 100) : 0,
      replies: n(o.replies),
      replyRate: contacted ? Math.min(100, Math.round((n(o.replied_contacts) / contacted) * 100)) : 0,
      positive: n(o.positive),
      failed: n(o.failed),
      byDay,
    },
    pipeline,
    calls: calls.map((c) => ({ outcome: c.outcome, count: n(c.count), minutes: Math.round(n(c.duration) / 60) })),
    credits: { balance, used: creditsByAction.reduce((a, c) => a + c.used, 0), byAction: creditsByAction },
  };
}

/* ───────────────────────── Activity feed & lookups ───────────────────────── */

export async function recentActivity(
  workspaceId: string,
  f: { limit?: number; deal_id?: string; contact_id?: string; company_id?: string } = {},
) {
  const where = ["a.workspace_id = ?"];
  const args: (string | number)[] = [workspaceId];
  if (f.deal_id) { where.push("a.deal_id = ?"); args.push(f.deal_id); }
  if (f.contact_id) { where.push("a.contact_id = ?"); args.push(f.contact_id); }
  if (f.company_id) { where.push("a.company_id = ?"); args.push(f.company_id); }
  args.push(Math.min(Math.max(f.limit ?? 30, 1), 200));
  return all<Activity & { contact_name: string | null; company_name: string | null; deal_name: string | null }>(
    `SELECT a.*, NULLIF(TRIM(COALESCE(ct.first_name, '') || ' ' || COALESCE(ct.last_name, '')), '') AS contact_name,
       co.name AS company_name, d.name AS deal_name
     FROM activities a
     LEFT JOIN contacts ct ON ct.id = a.contact_id AND ct.workspace_id = a.workspace_id
     LEFT JOIN companies co ON co.id = a.company_id AND co.workspace_id = a.workspace_id
     LEFT JOIN deals d ON d.id = a.deal_id AND d.workspace_id = a.workspace_id
     WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC, a.rowid DESC LIMIT ?`,
    args,
  );
}

export async function logGenericActivity(
  workspaceId: string,
  a: { type?: string; title?: string; body?: string; contact_id?: string | null; company_id?: string | null; deal_id?: string | null },
) {
  if (a.deal_id) return addDealActivity(workspaceId, a.deal_id, a);
  const contactId = await assertOwned(workspaceId, "contacts", a.contact_id);
  const companyId = await assertOwned(workspaceId, "companies", a.company_id);
  if (!contactId && !companyId) throw new HttpError(400, "Pick a contact, company or deal to log against");
  const title = a.title?.trim() || (a.body?.trim() ? "Note added" : "");
  if (!title) throw new HttpError(400, "Write something to log");
  const type = (ACTIVITY_TYPES as readonly string[]).includes(a.type || "") ? (a.type as string) : "note";
  return logActivity(workspaceId, { type, title: title.slice(0, 200), body: a.body?.trim() || null, contact_id: contactId, company_id: companyId });
}

/** Lightweight search used by the deal form pickers. */
export async function lookup(workspaceId: string, kind: "company" | "contact", q: string, companyId?: string | null) {
  const like = `%${q.trim().toLowerCase()}%`;
  if (kind === "company") {
    return all<{ id: string; label: string; sub: string | null }>(
      `SELECT id, name AS label, COALESCE(domain, industry) AS sub FROM companies
       WHERE workspace_id = ? AND (? = '%%' OR lower(name) LIKE ? OR lower(COALESCE(domain, '')) LIKE ?)
       ORDER BY COALESCE(score, -1) DESC, name LIMIT 20`,
      [workspaceId, like, like, like],
    );
  }
  return all<{ id: string; label: string; sub: string | null; company_id: string | null; company_name: string | null }>(
    `SELECT c.id, COALESCE(NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), ''), c.email, 'Unnamed') AS label,
       TRIM(COALESCE(c.title, '') || CASE WHEN co.name IS NOT NULL THEN ' · ' || co.name ELSE '' END, ' ·') AS sub, c.company_id, co.name AS company_name
     FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
     WHERE c.workspace_id = ? AND (? = '%%' OR lower(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')) LIKE ? OR lower(COALESCE(c.email, '')) LIKE ?)
     ORDER BY CASE WHEN ? IS NOT NULL AND c.company_id = ? THEN 0 ELSE 1 END, COALESCE(c.score, -1) DESC, c.first_name LIMIT 20`,
    [workspaceId, like, like, like, companyId ?? null, companyId ?? null],
  );
}


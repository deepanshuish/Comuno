import "server-only";
import type { Ctx } from "../auth";
import { HttpError } from "../auth";
import { withCredits } from "../credits";
import { all, one, update } from "../db";
import { generateText, PRO_MODEL } from "../gemini";
import type { DealStage } from "../types";
import { getCompany, getContact, upsertCompany } from "./core";
import * as prospect from "./prospect";
import * as engage from "./engage";
import * as crm from "./crm";
import * as signals from "./signals";

/**
 * The Comuno Agent's tool belt. Each tool wraps a module service.
 * Shared by the in-app Agent (Gemini function calling) and the MCP server.
 *
 * Tools with `approval: true` have outward-facing side effects (sending email,
 * enrolling people in live sequences). The in-app agent queues them for the
 * user to approve; MCP clients apply their own confirmation UX.
 */
export type AgentTool = {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  approval?: boolean;
  run: (ctx: Ctx, args: Record<string, unknown>) => Promise<unknown>;
};

const str = (description: string) => ({ type: "string", description });
const num = (description: string) => ({ type: "number", description });
const strArr = (description: string) => ({ type: "array", items: { type: "string" }, description });

async function resolveCompanyId(ctx: Ctx, args: Record<string, unknown>): Promise<string> {
  const wsId = ctx.workspace.id;
  if (typeof args.company_id === "string" && args.company_id) {
    if (!(await getCompany(wsId, args.company_id))) throw new HttpError(404, `No company with id ${args.company_id}`);
    return args.company_id;
  }
  const name = String(args.company_name || args.domain || "").trim();
  if (!name) throw new HttpError(400, "Provide company_id or company_name");
  const found = await one<{ id: string }>(
    "SELECT id FROM companies WHERE workspace_id = ? AND (lower(name) = lower(?) OR domain = lower(?)) LIMIT 1",
    [wsId, name, name],
  );
  return found?.id ?? upsertCompany(wsId, { name, domain: typeof args.domain === "string" ? args.domain : null });
}

async function listIdByName(ctx: Ctx, name: string): Promise<string> {
  const found = await one<{ id: string }>("SELECT id FROM lists WHERE workspace_id = ? AND lower(name) = lower(?)", [
    ctx.workspace.id,
    name,
  ]);
  return found?.id ?? prospect.createList(ctx.workspace.id, name);
}

const slimContact = (c: Record<string, unknown>) => ({
  id: c.id,
  name: [c.first_name, c.last_name].filter(Boolean).join(" "),
  title: c.title,
  company: c.company_name,
  email: c.email,
  email_status: c.email_status,
  phone: c.phone,
  linkedin_url: c.linkedin_url,
  status: c.status,
  score: c.score,
});

export const AGENT_TOOLS: AgentTool[] = [
  // ── Prospect ────────────────────────────────────────────────────────────
  {
    name: "find_prospects",
    description:
      "Discover REAL people matching a target description using live web search (e.g. 'Heads of Sales at Series A fintechs in Berlin'). Returns people with sources. Set save=true to add them to the People database (optionally into a list).",
    parameters: {
      type: "object",
      properties: {
        query: str("Natural-language description of who to find"),
        limit: num("Max people to return (default 10, max 25)"),
        save: { type: "boolean", description: "Save the results to People" },
        list_name: str("Optional list to add saved people to (created if missing)"),
      },
      required: ["query"],
    },
    run: async (ctx, a) => {
      const limit = Math.min(Number(a.limit) || 10, 25);
      const { results, sources } = await prospect.discoverProspects(ctx.workspace, { query: String(a.query), limit });
      let saved: unknown = undefined;
      if (a.save && results.length) {
        const listId = a.list_name ? await listIdByName(ctx, String(a.list_name)) : undefined;
        saved = await prospect.saveProspects(ctx.workspace, results, { listId, source: "agent" });
      }
      return { results, saved, sources: sources.slice(0, 6) };
    },
  },
  {
    name: "find_companies",
    description: "Discover REAL companies (accounts) matching a description using live web search. Set save=true to add them to Companies.",
    parameters: {
      type: "object",
      properties: { query: str("Description of target accounts"), limit: num("Max companies (default 10, max 25)"), save: { type: "boolean", description: "Save to Companies" } },
      required: ["query"],
    },
    run: async (ctx, a) => {
      const { results, sources } = await prospect.discoverCompanies(ctx.workspace, { query: String(a.query), limit: Math.min(Number(a.limit) || 10, 25) });
      const savedIds: string[] = [];
      if (a.save) {
        for (const c of results) savedIds.push(await upsertCompany(ctx.workspace.id, c));
      }
      return { results, saved_company_ids: a.save ? savedIds : undefined, sources: sources.slice(0, 6) };
    },
  },
  {
    name: "search_people",
    description: "Search the People database already in Comuno. Filters are optional.",
    parameters: {
      type: "object",
      properties: {
        q: str("Text to match against name, title, email or company"),
        status: str("new | contacted | replied | interested | not_interested | customer | bounced"),
        list_name: str("Only people in this list"),
        min_score: num("Minimum ICP fit score 0-100"),
        limit: num("Max results (default 25)"),
      },
    },
    run: async (ctx, a) => {
      let listId: string | undefined;
      if (a.list_name) {
        const l = await one<{ id: string }>("SELECT id FROM lists WHERE workspace_id = ? AND lower(name) = lower(?)", [ctx.workspace.id, String(a.list_name)]);
        if (!l) return { contacts: [], total: 0, note: `No list named ${a.list_name}` };
        listId = l.id;
      }
      const r = await prospect.searchContacts(ctx.workspace.id, {
        q: a.q ? String(a.q) : undefined,
        status: a.status ? String(a.status) : undefined,
        listId,
        minScore: a.min_score != null ? Number(a.min_score) : undefined,
        limit: Math.min(Number(a.limit) || 25, 100),
      });
      return { total: r.total, contacts: r.contacts.map(slimContact) };
    },
  },
  {
    name: "search_companies",
    description: "Search Companies already in Comuno by name, domain or industry.",
    parameters: { type: "object", properties: { q: str("Text to match"), limit: num("Max results (default 25)") } },
    run: async (ctx, a) => {
      const q = `%${String(a.q || "").toLowerCase()}%`;
      return all(
        `SELECT id, name, domain, industry, size, location, score,
                (SELECT COUNT(*) FROM contacts c WHERE c.company_id = companies.id) AS people
         FROM companies WHERE workspace_id = ? AND (lower(name) LIKE ? OR lower(coalesce(domain,'')) LIKE ? OR lower(coalesce(industry,'')) LIKE ?)
         ORDER BY coalesce(score, -1) DESC, updated_at DESC LIMIT ?`,
        [ctx.workspace.id, q, q, q, Math.min(Number(a.limit) || 25, 100)],
      );
    },
  },
  {
    name: "enrich_company",
    description: "Enrich a company with firmographics, funding, tech stack and recent news via web research.",
    parameters: { type: "object", properties: { company_id: str("Company id"), company_name: str("Or the company name/domain") } },
    run: async (ctx, a) => {
      const c = await prospect.enrichCompany(ctx.workspace, await resolveCompanyId(ctx, a));
      return { id: c.id, name: c.name, domain: c.domain, industry: c.industry, size: c.size, location: c.location, funding: c.funding, description: c.description };
    },
  },
  {
    name: "enrich_person",
    description: "Enrich a person (contact) with public professional information and talking points.",
    parameters: { type: "object", properties: { contact_id: str("Contact id") }, required: ["contact_id"] },
    run: async (ctx, a) => slimContact(await prospect.enrichContact(ctx.workspace, String(a.contact_id))),
  },
  {
    name: "find_email",
    description: "Find and verify a work email for a person (pattern generation + MX verification).",
    parameters: { type: "object", properties: { contact_id: str("Contact id") }, required: ["contact_id"] },
    run: async (ctx, a) => prospect.findEmail(ctx.workspace, String(a.contact_id)),
  },
  {
    name: "score_people",
    description: "Score people 0-100 for fit against the ideal customer profile.",
    parameters: { type: "object", properties: { contact_ids: strArr("Contact ids (max 50)") }, required: ["contact_ids"] },
    run: async (ctx, a) => prospect.scoreContacts(ctx.workspace, (a.contact_ids as string[]).slice(0, 50)),
  },
  {
    name: "research_account",
    description: "Produce a sales research briefing on a company: priorities, news, likely pains and an outreach angle.",
    parameters: { type: "object", properties: { company_id: str("Company id"), company_name: str("Or company name/domain") } },
    run: async (ctx, a) => prospect.researchAccount(ctx.workspace, await resolveCompanyId(ctx, a)),
  },
  {
    name: "market_research",
    description: "Answer an open market-research question with live web search (competitors, market size, trends, who uses X…).",
    parameters: { type: "object", properties: { question: str("The research question") }, required: ["question"] },
    run: async (ctx, a) =>
      withCredits(ctx.workspace, "research", 1, () =>
        generateText({
          workspace: ctx.workspace,
          search: true,
          model: PRO_MODEL,
          system: "You are a precise B2B market researcher. Cite concrete facts, names and numbers. Be concise and structured.",
          prompt: String(a.question),
        }),
      ),
  },
  {
    name: "add_to_list",
    description: "Add people to a list (created if it doesn't exist).",
    parameters: { type: "object", properties: { list_name: str("List name"), contact_ids: strArr("Contact ids") }, required: ["list_name", "contact_ids"] },
    run: async (ctx, a) => {
      const listId = await listIdByName(ctx, String(a.list_name));
      return { list_id: listId, added: await prospect.addToList(ctx.workspace.id, listId, a.contact_ids as string[]) };
    },
  },
  {
    name: "update_person",
    description: "Update fields on a person: status, title, email, phone, notes, tags.",
    parameters: {
      type: "object",
      properties: {
        contact_id: str("Contact id"),
        status: str("new | contacted | replied | interested | not_interested | customer | bounced"),
        title: str("Job title"),
        email: str("Email"),
        phone: str("Phone"),
        notes: str("Notes"),
        tags: str("Comma-separated tags"),
      },
      required: ["contact_id"],
    },
    run: async (ctx, a) => {
      const { contact_id, ...fields } = a as Record<string, string>;
      await update("contacts", contact_id, fields, ctx.workspace.id);
      const c = await getContact(ctx.workspace.id, contact_id);
      if (!c) throw new HttpError(404, "Contact not found");
      return slimContact(c);
    },
  },

  // ── Engage ──────────────────────────────────────────────────────────────
  {
    name: "draft_email",
    description: "Write a personalized cold or follow-up email for a person, using their profile, company research and history.",
    parameters: { type: "object", properties: { contact_id: str("Contact id"), goal: str("Goal, e.g. 'book a 15-min demo'"), instructions: str("Tone/length/angle instructions") }, required: ["contact_id"] },
    run: async (ctx, a) => engage.draftEmail(ctx.workspace, { contactId: String(a.contact_id), goal: a.goal as string, instructions: a.instructions as string }),
  },
  {
    name: "send_email",
    description: "Send an email to a person from the user's connected mailbox. Requires user approval.",
    approval: true,
    parameters: { type: "object", properties: { contact_id: str("Contact id"), subject: str("Subject"), body: str("Plain-text body") }, required: ["contact_id", "subject", "body"] },
    run: async (ctx, a) => {
      const m = await engage.sendEmail(ctx.workspace, { contactId: String(a.contact_id), subject: String(a.subject), body: String(a.body) });
      return { message_id: m.id, status: m.status };
    },
  },
  {
    name: "list_sequences",
    description: "List outreach sequences with their status.",
    parameters: { type: "object", properties: {} },
    run: async (ctx) =>
      all(
        `SELECT s.id, s.name, s.status, s.goal,
                (SELECT COUNT(*) FROM sequence_steps st WHERE st.sequence_id = s.id) AS steps,
                (SELECT COUNT(*) FROM enrollments e WHERE e.sequence_id = s.id) AS enrolled
         FROM sequences s WHERE s.workspace_id = ? ORDER BY s.created_at DESC`,
        [ctx.workspace.id],
      ),
  },
  {
    name: "create_sequence",
    description: "Generate a multi-step, multi-channel outreach sequence with AI from a goal and save it as a draft.",
    parameters: {
      type: "object",
      properties: {
        goal: str("What the sequence should achieve and for whom"),
        steps: num("Number of steps (default 5)"),
        channels: strArr("Allowed step types: email, linkedin_connect, linkedin_message, call, task"),
        tone: str("Tone, e.g. 'casual and concise'"),
      },
      required: ["goal"],
    },
    run: async (ctx, a) => {
      const gen = await engage.generateSequence(ctx.workspace, {
        goal: String(a.goal),
        steps: a.steps ? Number(a.steps) : undefined,
        channels: a.channels as never,
        tone: a.tone as string,
      });
      const id = await engage.createSequence(ctx.workspace.id, { name: gen.name, goal: String(a.goal), steps: gen.steps });
      return { sequence_id: id, name: gen.name, status: "draft", steps: gen.steps.map((s) => ({ type: s.type, delay_days: s.delay_days, subject: s.subject })) };
    },
  },
  {
    name: "enroll_in_sequence",
    description: "Enroll people into a sequence and activate it, which starts real outreach. Requires user approval.",
    approval: true,
    parameters: { type: "object", properties: { sequence_id: str("Sequence id"), contact_ids: strArr("Contact ids") }, required: ["sequence_id", "contact_ids"] },
    run: async (ctx, a) => {
      const seqId = String(a.sequence_id);
      const r = await engage.enrollContacts(ctx.workspace.id, seqId, a.contact_ids as string[]);
      await update("sequences", seqId, { status: "active" }, ctx.workspace.id);
      return r;
    },
  },
  {
    name: "call_script",
    description: "Generate a cold-call talk track with objection handling for a person.",
    parameters: { type: "object", properties: { contact_id: str("Contact id") }, required: ["contact_id"] },
    run: async (ctx, a) => ({ script: await engage.callScript(ctx.workspace, String(a.contact_id)) }),
  },
  {
    name: "outreach_stats",
    description: "Get outreach performance: sent, opened, replied, interested, active enrollments, open tasks, calls.",
    parameters: { type: "object", properties: {} },
    run: async (ctx) => engage.engageStats(ctx.workspace.id),
  },

  // ── Manage ──────────────────────────────────────────────────────────────
  {
    name: "list_deals",
    description: "List deals in the pipeline.",
    parameters: { type: "object", properties: { stage: str("Optional stage filter") } },
    run: async (ctx, a) => {
      const deals = await crm.listDeals(ctx.workspace.id);
      return (a.stage ? deals.filter((d) => d.stage === a.stage) : deals).map((d) => ({
        id: d.id, name: d.name, stage: d.stage, value: d.value, company: d.company_name, contact: d.contact_name, close_date: d.close_date,
      }));
    },
  },
  {
    name: "create_deal",
    description: "Create a deal in the pipeline.",
    parameters: {
      type: "object",
      properties: {
        name: str("Deal name"),
        value: num("Deal value in USD"),
        stage: str("lead | qualified | meeting | proposal | negotiation | won | lost"),
        company_id: str("Company id"),
        contact_id: str("Primary contact id"),
        close_date: str("Expected close date YYYY-MM-DD"),
        notes: str("Notes"),
      },
      required: ["name"],
    },
    run: async (ctx, a) => ({
      deal_id: await crm.createDeal(ctx.workspace.id, {
        name: String(a.name),
        value: a.value != null ? Number(a.value) : undefined,
        stage: a.stage as DealStage | undefined,
        company_id: (a.company_id as string) || null,
        contact_id: (a.contact_id as string) || null,
        close_date: (a.close_date as string) || null,
        notes: (a.notes as string) || null,
      }),
    }),
  },
  {
    name: "update_deal",
    description: "Update a deal's stage, value, close date or notes.",
    parameters: {
      type: "object",
      properties: { deal_id: str("Deal id"), stage: str("New stage"), value: num("Value"), close_date: str("YYYY-MM-DD"), notes: str("Notes") },
      required: ["deal_id"],
    },
    run: async (ctx, a) => {
      const { deal_id, ...patch } = a;
      await crm.updateDeal(ctx.workspace.id, String(deal_id), patch as never);
      return { ok: true };
    },
  },
  {
    name: "pipeline_summary",
    description: "Summarize the pipeline: deals and value per stage, total, weighted value and win rate.",
    parameters: { type: "object", properties: {} },
    run: async (ctx) => crm.pipelineSummary(ctx.workspace.id),
  },
  {
    name: "deal_insight",
    description: "AI analysis of a deal: next best action, risks and a suggested follow-up.",
    parameters: { type: "object", properties: { deal_id: str("Deal id") }, required: ["deal_id"] },
    run: async (ctx, a) => ({ insight: await crm.dealInsight(ctx.workspace, String(a.deal_id)) }),
  },

  // ── Signals ─────────────────────────────────────────────────────────────
  {
    name: "list_signals",
    description: "List recent buying signals (website visits, funding, hiring, job changes, news).",
    parameters: { type: "object", properties: { type: str("Optional signal type"), limit: num("Max (default 20)") } },
    run: async (ctx, a) =>
      (await signals.listSignals(ctx.workspace.id, { type: a.type as string, limit: Number(a.limit) || 20 })).map((s) => ({
        id: s.id, type: s.type, title: s.title, company: s.company_name, score: s.score, url: s.url, created_at: s.created_at,
      })),
  },
  {
    name: "refresh_signals",
    description: "Search the web for fresh buying signals (funding, hiring, leadership changes, launches) for a company.",
    parameters: { type: "object", properties: { company_id: str("Company id"), company_name: str("Or company name/domain") } },
    run: async (ctx, a) =>
      (await signals.refreshCompanySignals(ctx.workspace, await resolveCompanyId(ctx, a))).map((s) => ({ type: s.type, title: s.title, url: s.url, score: s.score })),
  },
];

export const TOOLS_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));

/** Run a tool, converting errors into a result the model can read and recover from. */
export async function runTool(ctx: Ctx, name: string, args: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return { ok: false, error: `Unknown tool ${name}` };
  try {
    return { ok: true, result: await tool.run(ctx, args) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

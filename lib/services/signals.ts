import "server-only";
import { HttpError } from "../auth";
import { withCredits } from "../credits";
import { all, insert, one, run, update } from "../db";
import { generateJSON, geminiClient, sellerContext, type Source } from "../gemini";
import type { Company, Contact, Signal, SignalType, Workspace } from "../types";
import { getCompany, logActivity, normalizeDomain } from "./core";

/* ───────────────────────── Feed ───────────────────────── */

export const SIGNAL_TYPES: SignalType[] = ["visit", "funding", "hiring", "job_change", "news", "intent", "leadership", "product", "expansion"];

export type SignalRow = Signal & {
  company_name: string | null;
  company_domain: string | null;
  contact_name: string | null;
  /** The linked contact, or the best-scored contact at the signal's company — used by "Engage". */
  engage_contact_id: string | null;
};

export async function listSignals(
  workspaceId: string,
  f: { type?: string; limit?: number; unseenOnly?: boolean; companyId?: string } = {},
): Promise<SignalRow[]> {
  const where = ["s.workspace_id = ?"];
  const args: (string | number)[] = [workspaceId];
  if (f.type && SIGNAL_TYPES.includes(f.type as SignalType)) { where.push("s.type = ?"); args.push(f.type); }
  if (f.unseenOnly) where.push("s.seen = 0");
  if (f.companyId) { where.push("s.company_id = ?"); args.push(f.companyId); }
  args.push(Math.min(Math.max(f.limit ?? 100, 1), 500));
  return all<SignalRow>(
    `SELECT s.*, co.name AS company_name, co.domain AS company_domain,
       NULLIF(TRIM(COALESCE(ct.first_name, '') || ' ' || COALESCE(ct.last_name, '')), '') AS contact_name,
       COALESCE(s.contact_id, (SELECT c2.id FROM contacts c2 WHERE c2.workspace_id = s.workspace_id AND c2.company_id = s.company_id
         AND s.company_id IS NOT NULL ORDER BY (c2.email IS NOT NULL) DESC, COALESCE(c2.score, -1) DESC LIMIT 1)) AS engage_contact_id
     FROM signals s
     LEFT JOIN companies co ON co.id = s.company_id AND co.workspace_id = s.workspace_id
     LEFT JOIN contacts ct ON ct.id = s.contact_id AND ct.workspace_id = s.workspace_id
     WHERE ${where.join(" AND ")}
     ORDER BY s.created_at DESC, COALESCE(s.score, 0) DESC LIMIT ?`,
    args,
  );
}

export async function signalCounts(workspaceId: string) {
  const rows = await all<{ type: string; total: number; unseen: number }>(
    "SELECT type, COUNT(*) AS total, SUM(CASE WHEN seen = 0 THEN 1 ELSE 0 END) AS unseen FROM signals WHERE workspace_id = ? GROUP BY type",
    [workspaceId],
  );
  return Object.fromEntries(rows.map((r) => [r.type, { total: Number(r.total), unseen: Number(r.unseen) }]));
}

export async function markSignalsSeen(workspaceId: string, f: { ids?: string[]; all?: boolean; seen?: boolean }) {
  const seen = f.seen === false ? 0 : 1;
  if (f.all) return run("UPDATE signals SET seen = ? WHERE workspace_id = ?", [seen, workspaceId]);
  const ids = (f.ids || []).filter((x) => typeof x === "string").slice(0, 500);
  if (!ids.length) return 0;
  return run(`UPDATE signals SET seen = ? WHERE workspace_id = ? AND id IN (${ids.map(() => "?").join(",")})`, [seen, workspaceId, ...ids]);
}

export async function deleteSignal(workspaceId: string, id: string) {
  const n = await run("DELETE FROM signals WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
  if (!n) throw new HttpError(404, "Signal not found");
}

/* ───────────────────────── AI: company buying signals ───────────────────────── */

type FoundSignal = { type: string; title: string; summary?: string; url?: string; date?: string; strength?: number };

const FOUND_TYPES: SignalType[] = ["funding", "hiring", "leadership", "product", "expansion", "news", "intent"];

const SIGNALS_SCHEMA = {
  type: "object",
  properties: {
    signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: FOUND_TYPES },
          title: { type: "string", description: "Short headline, e.g. 'Raised $20M Series B led by Accel'" },
          summary: { type: "string", description: "1–2 sentences: what happened and why it matters for a seller." },
          url: { type: "string", description: "URL of the source article / page" },
          date: { type: "string", description: "YYYY-MM-DD when it happened, if known" },
          strength: { type: "integer", minimum: 0, maximum: 100, description: "How strongly this indicates buying intent for the seller's product" },
        },
        required: ["type", "title", "summary", "strength"],
      },
    },
  },
  required: ["signals"],
};

function assertAI(ws: Workspace) {
  geminiClient(ws); // throws the standard 503 when Gemini isn't configured
}

function cleanUrl(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const url = new URL(u.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const normTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Search the live web (Gemini + Google Search) for recent buying signals at a company:
 * funding, hiring, leadership changes, launches, expansion, news. Dedupes against
 * existing signals and stores new ones. Charges `signals_refresh` once.
 */
export async function refreshCompanySignals(ws: Workspace, companyId: string): Promise<Signal[]> {
  const company = await getCompany(ws.id, companyId);
  if (!company) throw new HttpError(404, "Company not found");
  assertAI(ws);
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

  const { data, sources } = await withCredits(ws, "signals_refresh", 1, () =>
    generateJSON<{ signals: FoundSignal[] }>({
      workspace: ws,
      search: true,
      system: `You are a B2B sales intelligence analyst. You only report verifiable facts found via search, with sources.\n${sellerContext(ws)}`,
      prompt: [
        `Today is ${today}. Search the web for RECENT buying signals (from ${since} to ${today}) at this company:`,
        `Company: ${company.name}${company.domain ? ` (${company.domain})` : ""}${company.industry ? `, industry: ${company.industry}` : ""}${company.location ? `, ${company.location}` : ""}`,
        "",
        "Look for: funding rounds (funding), hiring — especially sales, revenue, marketing or roles related to what the seller sells (hiring), new executives or leadership changes (leadership), product launches (product), expansion into new markets/offices/acquisitions (expansion), other notable news (news), and evidence they are evaluating solutions like the seller's (intent).",
        "Rules: only include events that actually happened in that window and that you found a source for; put the source URL in `url`. Do not invent anything. If nothing recent is found, return an empty list. Return at most 8 signals, strongest first.",
        "Score `strength` 0–100 by how strongly it suggests they may buy the seller's product now.",
      ].join("\n"),
      schema: SIGNALS_SCHEMA,
      temperature: 0.2,
    }),
  );

  const existing = await all<{ title: string; url: string | null }>(
    "SELECT title, url FROM signals WHERE workspace_id = ? AND company_id = ?",
    [ws.id, companyId],
  );
  const seenTitles = new Set(existing.map((e) => normTitle(e.title)));
  const seenUrls = new Set(existing.map((e) => e.url).filter(Boolean) as string[]);
  const created: Signal[] = [];
  const list = Array.isArray(data?.signals) ? data.signals : [];
  for (const s of list.slice(0, 10)) {
    if (!s || typeof s.title !== "string" || !s.title.trim()) continue;
    const type = (FOUND_TYPES as string[]).includes(s.type) ? (s.type as SignalType) : "news";
    if (s.date && /^\d{4}-\d{2}-\d{2}/.test(s.date) && s.date.slice(0, 10) < since) continue; // too old
    const url = cleanUrl(s.url) ?? pickSource(sources, s.title);
    const key = normTitle(s.title);
    if (seenTitles.has(key) || (url && seenUrls.has(url))) continue;
    seenTitles.add(key);
    if (url) seenUrls.add(url);
    const score = Math.max(0, Math.min(100, Math.round(Number(s.strength) || 50)));
    const body = [s.summary?.trim(), s.date ? `(${s.date.slice(0, 10)})` : null].filter(Boolean).join(" ") || null;
    const id = await insert("signals", {
      workspace_id: ws.id,
      company_id: companyId,
      type,
      title: s.title.trim().slice(0, 240),
      body,
      url,
      score,
    });
    created.push((await one<Signal>("SELECT * FROM signals WHERE id = ?", [id]))!);
  }
  await logActivity(ws.id, {
    type: "signal",
    title: created.length ? `${created.length} new buying signal${created.length > 1 ? "s" : ""} found` : "Signals checked — nothing new",
    body: created.map((c) => `[${c.type}] ${c.title}`).join("\n") || null,
    company_id: companyId,
  });
  return created;
}

function pickSource(sources: Source[], title: string): string | null {
  if (!sources.length) return null;
  const words = normTitle(title).split(" ").filter((w) => w.length > 3);
  const best = sources.find((s) => words.some((w) => s.title.toLowerCase().includes(w)));
  return cleanUrl((best ?? sources[0]).url);
}

/** Refresh the N highest-scoring (then most recently active) companies. */
export async function refreshTopCompanies(ws: Workspace, top = 5) {
  assertAI(ws);
  const n = Math.min(Math.max(Math.round(top) || 5, 1), 20);
  const companies = await all<{ id: string; name: string }>(
    `SELECT co.id, co.name FROM companies co WHERE co.workspace_id = ?
     ORDER BY COALESCE(co.score, -1) DESC,
       (SELECT COUNT(*) FROM visits v WHERE v.workspace_id = co.workspace_id AND v.company_id = co.id) DESC,
       co.updated_at DESC LIMIT ?`,
    [ws.id, n],
  );
  const results: { company_id: string; company_name: string; created: number; error?: string }[] = [];
  for (const c of companies) {
    try {
      const created = await refreshCompanySignals(ws, c.id);
      results.push({ company_id: c.id, company_name: c.name, created: created.length });
    } catch (e) {
      const err = e as { status?: number; message?: string };
      results.push({ company_id: c.id, company_name: c.name, created: 0, error: err.message || "Failed" });
      if (err.status === 402 || err.status === 503) break; // out of credits / not configured: stop early
    }
  }
  return { companies: results, created: results.reduce((a, r) => a + r.created, 0) };
}

/* ───────────────────────── AI: job-change alerts ───────────────────────── */

type JobCheck = {
  still_in_role: boolean | null;
  current_title?: string | null;
  current_company?: string | null;
  current_company_domain?: string | null;
  evidence?: string | null;
  evidence_url?: string | null;
  confidence?: number;
};

const JOB_SCHEMA = {
  type: "object",
  properties: {
    still_in_role: { type: ["boolean", "null"], description: "true if they still hold this role at this company, false if they moved, null if unknown" },
    current_title: { type: ["string", "null"] },
    current_company: { type: ["string", "null"] },
    current_company_domain: { type: ["string", "null"] },
    evidence: { type: ["string", "null"], description: "One sentence citing what the search showed" },
    evidence_url: { type: ["string", "null"] },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
  required: ["still_in_role", "confidence"],
};

/**
 * For each contact, check via search-grounded Gemini whether they still hold their title at their company.
 * When a move is found (confidence ≥ 60), creates a `job_change` signal and updates the contact.
 * Charges `signals_refresh` per contact checked.
 */
export async function checkJobChanges(ws: Workspace, contactIds: string[]): Promise<{ changed: number; checked: number; results: { contact_id: string; name: string; status: "same" | "changed" | "unknown" | "error"; detail?: string }[] }> {
  assertAI(ws);
  const ids = [...new Set(contactIds.filter((x) => typeof x === "string"))].slice(0, 25);
  const results: { contact_id: string; name: string; status: "same" | "changed" | "unknown" | "error"; detail?: string }[] = [];
  let changed = 0;
  for (const id of ids) {
    const c = await one<Contact & { company_name: string | null; company_domain: string | null }>(
      `SELECT c.*, co.name AS company_name, co.domain AS company_domain FROM contacts c
       LEFT JOIN companies co ON co.id = c.company_id WHERE c.id = ? AND c.workspace_id = ?`,
      [id, ws.id],
    );
    if (!c) continue;
    const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
    if (!name || !c.company_name) {
      results.push({ contact_id: id, name: name || c.email || "Unnamed", status: "unknown", detail: "Needs a name and a company to check" });
      continue;
    }
    try {
      const { data, sources } = await withCredits(ws, "signals_refresh", 1, () =>
        generateJSON<JobCheck>({
          workspace: ws,
          search: true,
          system: "You verify people's current employment using web search (LinkedIn, company sites, press). Never guess: if you can't find evidence, return still_in_role: null.",
          prompt: [
            `Today is ${new Date().toISOString().slice(0, 10)}. Is this person still in this role?`,
            `Name: ${name}`,
            `Last known title: ${c.title || "unknown"}`,
            `Last known company: ${c.company_name}${c.company_domain ? ` (${c.company_domain})` : ""}`,
            c.linkedin_url ? `LinkedIn: ${c.linkedin_url}` : null,
            c.location ? `Location: ${c.location}` : null,
            "If they changed jobs (new company, or a materially different title at the same company), set still_in_role=false and give their current title and company.",
          ]
            .filter(Boolean)
            .join("\n"),
          schema: JOB_SCHEMA,
          temperature: 0.1,
        }),
      );
      const conf = Number(data.confidence) || 0;
      const newCompany = data.current_company?.trim() || null;
      const newTitle = data.current_title?.trim() || null;
      if (data.still_in_role === false && conf >= 60 && (newCompany || newTitle)) {
        const movedCompany = !!newCompany && newCompany.toLowerCase() !== c.company_name.toLowerCase();
        let newCompanyId = c.company_id;
        if (movedCompany) newCompanyId = await findOrCreateCompany(ws.id, newCompany!, data.current_company_domain);
        const url = cleanUrl(data.evidence_url) ?? (sources[0] ? cleanUrl(sources[0].url) : null);
        const title = movedCompany
          ? `${name} moved to ${newCompany}${newTitle ? ` as ${newTitle}` : ""}`
          : `${name} is now ${newTitle} at ${c.company_name}`;
        await insert("signals", {
          workspace_id: ws.id,
          company_id: newCompanyId,
          contact_id: id,
          type: "job_change",
          title: title.slice(0, 240),
          body: [`Previously ${c.title || "at"} ${c.title ? `at ${c.company_name}` : c.company_name}.`, data.evidence?.trim()].filter(Boolean).join(" "),
          url,
          score: movedCompany ? 80 : 60,
        });
        await update(
          "contacts",
          id,
          {
            title: newTitle ?? c.title,
            company_id: newCompanyId,
            notes: [c.notes, `Job change detected ${new Date().toISOString().slice(0, 10)}: was ${c.title || "—"} at ${c.company_name}.`].filter(Boolean).join("\n"),
          },
          ws.id,
        );
        await logActivity(ws.id, { type: "job_change", title, body: data.evidence ?? null, contact_id: id, company_id: newCompanyId });
        changed++;
        results.push({ contact_id: id, name, status: "changed", detail: title });
      } else {
        results.push({
          contact_id: id,
          name,
          status: data.still_in_role === true ? "same" : "unknown",
          detail: data.evidence?.trim() || undefined,
        });
      }
    } catch (e) {
      const err = e as { status?: number; message?: string };
      results.push({ contact_id: id, name, status: "error", detail: err.message });
      if (err.status === 402 || err.status === 503) break;
    }
  }
  return { changed, checked: results.filter((r) => r.status !== "error").length, results };
}

/** Contacts most worth checking for job changes: engaged / high-score people with a title and company. */
export async function jobChangeCandidates(workspaceId: string, limit = 10) {
  const rows = await all<{ id: string }>(
    `SELECT c.id FROM contacts c WHERE c.workspace_id = ? AND c.company_id IS NOT NULL AND c.first_name IS NOT NULL
     ORDER BY (c.status IN ('interested', 'customer', 'replied')) DESC, COALESCE(c.score, -1) DESC, c.updated_at ASC LIMIT ?`,
    [workspaceId, limit],
  );
  return rows.map((r) => r.id);
}

/* ───────────────────────── Website visitor tracking ───────────────────────── */

const ipCache = new Map<string, { at: number; info: IpInfo | null }>();
const rate = new Map<string, { at: number; count: number }>();
const IP_TTL = 6 * 3600 * 1000;

type IpInfo = { org: string | null; isp: string | null; city: string | null; country: string | null };

export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^::ffff:/, "");
  if (!v || v === "unknown" || v === "::1" || v === "localhost") return true;
  if (v.includes(":")) return v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v === "::";
  const p = v.split(".").map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    p[0] >= 224
  );
}

/** Network operators that are not the visitor's employer (ISPs, mobile carriers, clouds, VPNs). */
const ISP_RE =
  /\b(telecom|telekom|telco|communications?|broadband|cable|cablevision|fib(er|re)|wireless|mobile|cellular|isp|internet|net(work)?s?|dsl|satellite|hosting|cloud|data ?cent(er|re)|datacenter|server|vps|colo(cation)?|vpn|proxy|comcast|verizon|at&t|att|charter|spectrum|cox|centurylink|lumen|frontier|t-mobile|tmobile|sprint|vodafone|orange|airtel|bharti|jio|reliance|bsnl|hathway|telstra|optus|bt|sky|virgin|telefonica|movistar|claro|swisscom|kpn|ziggo|free sas|bouygues|sfr|rogers|bell canada|shaw|telus|amazon|aws|google|microsoft|azure|cloudflare|digitalocean|ovh|hetzner|akamai|fastly|linode|vultr|oracle|alibaba|tencent|choopa|m247|leaseweb|zscaler|starlink)\b/i;

function cleanOrgName(org: string): string {
  return org
    .replace(/^AS\d+\s+/i, "")
    .replace(/[,.]?\s+(inc|llc|ltd|limited|corp|corporation|co|gmbh|ag|s\.?a\.?|plc|pvt|private|b\.?v\.?|pty)\.?$/gi, "")
    .replace(/[,.]?\s+(inc|llc|ltd|limited|corp|corporation|gmbh|plc)\.?$/gi, "")
    .trim();
}

export function isBusinessOrg(org: string | null | undefined): boolean {
  if (!org || org.length < 2) return false;
  return !ISP_RE.test(org);
}

async function lookupIp(ip: string): Promise<IpInfo | null> {
  const hit = ipCache.get(ip);
  if (hit && Date.now() - hit.at < IP_TTL) return hit.info;
  let info: IpInfo | null = null;
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,org,isp,city,country`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    if (res.ok) {
      const j = (await res.json()) as { status?: string; org?: string; isp?: string; city?: string; country?: string };
      if (j.status === "success") info = { org: j.org || null, isp: j.isp || null, city: j.city || null, country: j.country || null };
    }
  } catch {
    /* lookup is best-effort */
  }
  ipCache.set(ip, { at: Date.now(), info });
  if (ipCache.size > 5000) ipCache.delete(ipCache.keys().next().value!);
  return info;
}

async function findOrCreateCompany(workspaceId: string, name: string, domainHint?: string | null, source?: string): Promise<string> {
  const domain = normalizeDomain(domainHint);
  const clean = cleanOrgName(name);
  const existing = await one<{ id: string }>(
    `SELECT id FROM companies WHERE workspace_id = ? AND (
       (? IS NOT NULL AND domain = ?) OR lower(name) = lower(?) OR lower(name) = lower(?)) LIMIT 1`,
    [workspaceId, domain, domain, name, clean],
  );
  if (existing) return existing.id;
  // Loose match: "Acme" vs "Acme Corporation".
  if (clean.length >= 4) {
    const loose = await one<{ id: string }>(
      "SELECT id FROM companies WHERE workspace_id = ? AND (lower(name) LIKE lower(?) OR lower(?) LIKE lower(name) || ' %') LIMIT 1",
      [workspaceId, `${clean} %`, clean],
    );
    if (loose) return loose.id;
  }
  return insert("companies", {
    workspace_id: workspaceId,
    name: clean || name,
    domain,
    website: domain ? `https://${domain}` : null,
    enrichment_json: source ? JSON.stringify({ source }) : null,
  });
}

/** Basic abuse guard for the public tracking endpoint. */
export function rateLimited(key: string, max = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const r = rate.get(key);
  if (!r || now - r.at > windowMs) {
    rate.set(key, { at: now, count: 1 });
    if (rate.size > 20000) rate.clear();
    return false;
  }
  r.count++;
  return r.count > max;
}

function trunc(s: string | undefined | null, n: number) {
  if (!s) return null;
  const t = String(s).trim();
  return t ? t.slice(0, n) : null;
}

function pathOf(url: string) {
  try {
    const u = new URL(url);
    return u.pathname || "/";
  } catch {
    return url;
  }
}

const PRICING_RE = /(pricing|plans|price|demo|contact|quote|buy|checkout|trial|signup|sign-up|get-started)/i;

/**
 * Record a page view from the tracking script. Identifies the person (cid / email / identify())
 * and the company (contact's company, or IP → organization), and upserts a daily `visit` signal.
 */
export async function recordVisit(input: {
  trackingKey: string;
  visitorId: string;
  url: string;
  title?: string;
  referrer?: string;
  ip?: string;
  userAgent?: string;
  email?: string;
  contactId?: string;
  /** identify() call: link the visitor to a person without counting a page view. */
  identifyOnly?: boolean;
}): Promise<void> {
  const ws = await one<{ id: string }>("SELECT id FROM workspaces WHERE tracking_key = ?", [input.trackingKey]);
  if (!ws) throw new HttpError(403, "Unknown tracking key");
  const visitorId = trunc(input.visitorId, 64);
  const url = trunc(input.url, 2000);
  if (!visitorId || !url || !/^https?:\/\//i.test(url)) throw new HttpError(400, "Invalid page view");
  if (/bot|crawler|spider|headless|lighthouse|preview/i.test(input.userAgent || "")) return;

  // ── Person-level identification
  let contactId: string | null = null;
  let contact: Pick<Contact, "id" | "company_id" | "first_name" | "last_name"> | null = null;
  const fromUrl = (() => {
    try {
      const u = new URL(url);
      return { cid: u.searchParams.get("cid"), email: u.searchParams.get("email") };
    } catch {
      return { cid: null, email: null };
    }
  })();
  const cid = input.contactId || fromUrl.cid;
  const email = (input.email || fromUrl.email || "").trim().toLowerCase();
  if (cid) {
    contact = await one("SELECT id, company_id, first_name, last_name FROM contacts WHERE id = ? AND workspace_id = ?", [cid, ws.id]);
  }
  if (!contact && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    contact = await one("SELECT id, company_id, first_name, last_name FROM contacts WHERE workspace_id = ? AND lower(email) = ?", [ws.id, email]);
  }
  const prior = await one<{ contact_id: string | null; company_id: string | null }>(
    `SELECT contact_id, company_id FROM visits WHERE workspace_id = ? AND visitor_id = ?
     ORDER BY (contact_id IS NOT NULL) DESC, (company_id IS NOT NULL) DESC, created_at DESC LIMIT 1`,
    [ws.id, visitorId],
  );
  if (contact) {
    contactId = contact.id;
    if (prior?.contact_id !== contactId) {
      // Newly identified: attribute this visitor's earlier anonymous page views to the person.
      await run(
        "UPDATE visits SET contact_id = ?, company_id = COALESCE(?, company_id) WHERE workspace_id = ? AND visitor_id = ? AND contact_id IS NULL",
        [contactId, contact.company_id, ws.id, visitorId],
      );
    }
  } else if (prior?.contact_id) {
    contactId = prior.contact_id;
    contact = await one("SELECT id, company_id, first_name, last_name FROM contacts WHERE id = ? AND workspace_id = ?", [contactId, ws.id]);
  }

  if (input.identifyOnly) {
    if (contact) {
      const latest = await one<{ company_id: string | null }>(
        "SELECT company_id FROM visits WHERE workspace_id = ? AND visitor_id = ? ORDER BY created_at DESC LIMIT 1",
        [ws.id, visitorId],
      );
      if (latest) await upsertVisitSignal(ws.id, contact.company_id ?? latest.company_id, contact);
    }
    return;
  }

  // ── Company-level identification
  const ip = trunc(input.ip, 64);
  let ipInfo: IpInfo | null = null;
  if (ip && !isPrivateIp(ip)) {
    const cached = await one<IpInfo>(
      `SELECT org, NULL AS isp, city, country FROM visits WHERE workspace_id = ? AND ip = ? AND (org IS NOT NULL OR city IS NOT NULL)
       AND datetime(created_at) >= datetime('now', '-7 days') ORDER BY created_at DESC LIMIT 1`,
      [ws.id, ip],
    );
    ipInfo = cached ?? (await lookupIp(ip));
  }
  let companyId: string | null = contact?.company_id ?? null;
  if (!companyId && ipInfo?.org && isBusinessOrg(ipInfo.org)) {
    companyId = await findOrCreateCompany(ws.id, ipInfo.org, null, "website visitor");
  }
  if (!companyId && prior?.company_id) companyId = prior.company_id;

  await insert("visits", {
    workspace_id: ws.id,
    visitor_id: visitorId,
    contact_id: contactId,
    company_id: companyId,
    url,
    title: trunc(input.title, 300),
    referrer: trunc(input.referrer, 1000),
    ip,
    org: ipInfo?.org ?? null,
    city: ipInfo?.city ?? null,
    country: ipInfo?.country ?? null,
    user_agent: trunc(input.userAgent, 400),
  });

  if (companyId || contactId) await upsertVisitSignal(ws.id, companyId, contact);
}

async function upsertVisitSignal(
  workspaceId: string,
  companyId: string | null,
  contact: Pick<Contact, "id" | "first_name" | "last_name"> | null,
) {
  const scopeSql = companyId ? "company_id = ?" : "contact_id = ? AND company_id IS NULL";
  const scopeArg = companyId ?? contact!.id;
  const pages = await all<{ url: string; contact_id: string | null }>(
    `SELECT url, contact_id FROM visits WHERE workspace_id = ? AND ${scopeSql} AND date(created_at) = date('now') ORDER BY created_at, rowid`,
    [workspaceId, scopeArg],
  );
  const paths = pages.map((p) => pathOf(p.url));
  const unique = [...new Set(paths)];
  const highIntent = unique.filter((p) => PRICING_RE.test(p));
  const people = new Set(pages.map((p) => p.contact_id).filter(Boolean));
  const score = Math.min(100, 15 + pages.length * 6 + unique.length * 4 + highIntent.length * 20 + (people.size ? 15 : 0));
  const company = companyId ? await one<Pick<Company, "name">>("SELECT name FROM companies WHERE id = ?", [companyId]) : null;
  const personName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "A known contact" : null;
  const who =
    company && people.size > 1
      ? `${company.name} (${people.size} known people)`
      : personName && company
        ? `${personName} (${company.name})`
        : (personName ?? company?.name ?? "Someone");
  const title = `${who} viewed ${pages.length} page${pages.length === 1 ? "" : "s"} on your site${highIntent.length ? " incl. high-intent pages" : ""}`;
  const body = `Pages today: ${unique.slice(0, 8).join(", ")}${unique.length > 8 ? ` +${unique.length - 8} more` : ""}${highIntent.length ? ` · High-intent: ${highIntent.join(", ")}` : ""}`;
  const existing = await one<{ id: string; contact_id: string | null }>(
    `SELECT id, contact_id FROM signals WHERE workspace_id = ? AND type = 'visit' AND ${scopeSql} AND date(created_at) = date('now') LIMIT 1`,
    [workspaceId, scopeArg],
  );
  if (existing) {
    await run("UPDATE signals SET title = ?, body = ?, score = ?, url = ?, contact_id = COALESCE(?, contact_id), seen = 0 WHERE id = ?", [
      title,
      body,
      score,
      pages[pages.length - 1]?.url ?? null,
      contact?.id ?? null,
      existing.id,
    ]);
  } else {
    await insert("signals", {
      workspace_id: workspaceId,
      company_id: companyId,
      contact_id: contact?.id ?? null,
      type: "visit",
      title,
      body,
      url: pages[pages.length - 1]?.url ?? null,
      score,
    });
    await logActivity(workspaceId, {
      type: "visit",
      title: `${who} is on your website`,
      body: pages[0] ? pathOf(pages[0].url) : null,
      company_id: companyId,
      contact_id: contact?.id ?? null,
    });
  }
}

/* ───────────────────────── Visitors report ───────────────────────── */

export async function visitorsReport(workspaceId: string, days = 30) {
  const since = `-${Math.min(Math.max(days, 1), 365)} days`;
  const totals = await one<Record<string, number>>(
    `SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors,
       COUNT(DISTINCT company_id) AS companies, COUNT(DISTINCT contact_id) AS people,
       SUM(CASE WHEN company_id IS NULL AND contact_id IS NULL THEN 1 ELSE 0 END) AS anonymous_views
     FROM visits WHERE workspace_id = ? AND datetime(created_at) >= datetime('now', ?)`,
    [workspaceId, since],
  );
  const companies = await all<{
    company_id: string; name: string; domain: string | null; industry: string | null; score: number | null;
    views: number; visitors: number; people: number; last_seen: string; first_seen: string; location: string | null; urls: string | null;
  }>(
    `SELECT v.company_id, co.name, co.domain, co.industry, co.score,
       COUNT(*) AS views, COUNT(DISTINCT v.visitor_id) AS visitors, COUNT(DISTINCT v.contact_id) AS people,
       MAX(v.created_at) AS last_seen, MIN(v.created_at) AS first_seen,
       MAX(TRIM(COALESCE(v.city, '') || CASE WHEN v.city IS NOT NULL AND v.country IS NOT NULL THEN ', ' ELSE '' END || COALESCE(v.country, ''))) AS location,
       GROUP_CONCAT(v.url, '\n') AS urls
     FROM visits v JOIN companies co ON co.id = v.company_id AND co.workspace_id = v.workspace_id
     WHERE v.workspace_id = ? AND datetime(v.created_at) >= datetime('now', ?)
     GROUP BY v.company_id, co.id ORDER BY last_seen DESC LIMIT 200`,
    [workspaceId, since],
  );
  const people = await all<{
    contact_id: string; name: string | null; email: string | null; title: string | null; company_id: string | null; company_name: string | null;
    views: number; last_seen: string; urls: string | null;
  }>(
    `SELECT v.contact_id, NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), '') AS name, c.email, c.title,
       c.company_id, co.name AS company_name, COUNT(*) AS views, MAX(v.created_at) AS last_seen, GROUP_CONCAT(v.url, '\n') AS urls
     FROM visits v JOIN contacts c ON c.id = v.contact_id AND c.workspace_id = v.workspace_id
     LEFT JOIN companies co ON co.id = c.company_id
     WHERE v.workspace_id = ? AND datetime(v.created_at) >= datetime('now', ?)
     GROUP BY v.contact_id, c.id, co.id ORDER BY last_seen DESC LIMIT 200`,
    [workspaceId, since],
  );
  const recent = await all<{ id: string; url: string; title: string | null; referrer: string | null; created_at: string; org: string | null; city: string | null; country: string | null; company_name: string | null; contact_name: string | null; visitor_id: string }>(
    `SELECT v.id, v.url, v.title, v.referrer, v.created_at, v.org, v.city, v.country, v.visitor_id, co.name AS company_name,
       NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), '') AS contact_name
     FROM visits v LEFT JOIN companies co ON co.id = v.company_id LEFT JOIN contacts c ON c.id = v.contact_id
     WHERE v.workspace_id = ? ORDER BY v.created_at DESC, v.rowid DESC LIMIT 50`,
    [workspaceId],
  );
  const topPages = await all<{ url: string; views: number }>(
    `SELECT url, COUNT(*) AS views FROM visits WHERE workspace_id = ? AND datetime(created_at) >= datetime('now', ?)
     GROUP BY url ORDER BY views DESC LIMIT 10`,
    [workspaceId, since],
  );
  const pagesOf = (urls: string | null) => {
    const counts = new Map<string, number>();
    for (const u of (urls || "").split("\n").filter(Boolean)) counts.set(pathOf(u), (counts.get(pathOf(u)) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([path, views]) => ({ path, views, high_intent: PRICING_RE.test(path) }));
  };
  const t = totals ?? {};
  return {
    days,
    totals: {
      views: Number(t.views) || 0,
      visitors: Number(t.visitors) || 0,
      companies: Number(t.companies) || 0,
      people: Number(t.people) || 0,
      anonymous_views: Number(t.anonymous_views) || 0,
    },
    companies: companies.map(({ urls, ...c }) => ({ ...c, views: Number(c.views), visitors: Number(c.visitors), people: Number(c.people), pages: pagesOf(urls) })),
    people: people.map(({ urls, ...p }) => ({ ...p, views: Number(p.views), pages: pagesOf(urls) })),
    recent: recent.map((r) => ({ ...r, path: pathOf(r.url) })),
    topPages: topPages.map((p) => ({ path: pathOf(p.url), url: p.url, views: Number(p.views) })),
    installed: (await one<{ n: number }>("SELECT COUNT(*) AS n FROM visits WHERE workspace_id = ?", [workspaceId]))!.n > 0,
  };
}

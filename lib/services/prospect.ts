import "server-only";
import { resolveMx } from "node:dns/promises";
import { HttpError } from "../auth";
import { withCredits } from "../credits";
import { all, insert, one, parseJson, run, update, type InValue } from "../db";
import { generateJSON, generateText, sellerContext, type Source } from "../gemini";
import type { Activity, Company, Contact, ContactStatus, EmailStatus, ICP, Workspace } from "../types";
import { getCompany, getContact, logActivity, normalizeDomain, upsertCompany } from "./core";

/* ────────────────────────────────────────────────────────────────────────────
 * Prospect module: AI lead discovery, people/company records, enrichment,
 * email finding + verification, ICP scoring, account research and lists.
 * ──────────────────────────────────────────────────────────────────────────── */

export type { Source };

export type ProspectResult = {
  first_name: string;
  last_name: string;
  title: string;
  company: string;
  domain: string | null;
  linkedin_url: string | null;
  location: string | null;
  reason: string;
  source_url: string | null;
};

export type CompanyResult = {
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  description: string | null;
  reason: string;
  source_url: string | null;
};

export const CONTACT_STATUSES: ContactStatus[] = ["new", "contacted", "replied", "interested", "not_interested", "customer", "bounced"];
const EMAIL_STATUSES: EmailStatus[] = ["unknown", "valid", "risky", "invalid"];

/* ───────────────────────────── helpers ───────────────────────────── */

export function workspaceIcp(ws: Workspace): ICP {
  return parseJson<ICP>(ws.icp_json, {});
}

function icpText(icp?: ICP): string {
  if (!icp) return "";
  const parts = [
    icp.industries?.length && `Industries: ${icp.industries.join(", ")}`,
    icp.company_sizes?.length && `Company sizes (employees): ${icp.company_sizes.join(", ")}`,
    icp.locations?.length && `Locations: ${icp.locations.join(", ")}`,
    icp.titles?.length && `Job titles: ${icp.titles.join(", ")}`,
    icp.seniorities?.length && `Seniority: ${icp.seniorities.join(", ")}`,
    icp.keywords?.length && `Keywords: ${icp.keywords.join(", ")}`,
    icp.notes && `Notes: ${icp.notes}`,
  ].filter(Boolean);
  return parts.join("\n");
}

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || /^(null|n\/a|unknown|none|-)$/i.test(s)) return null;
  return s;
}

function cleanUrl(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

function cleanLinkedIn(v: unknown): string | null {
  const u = cleanUrl(v);
  return u && /linkedin\.com\//i.test(u) ? u.replace(/\/$/, "") : null;
}

function clampLimit(n: number | undefined, def: number, max: number) {
  const v = Math.floor(Number(n) || def);
  return Math.max(1, Math.min(max, v));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function placeholders(n: number) {
  return Array.from({ length: n }, () => "?").join(", ");
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/* ───────────────────────────── discovery ───────────────────────────── */

const PROSPECT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          first_name: { type: "string" },
          last_name: { type: "string" },
          title: { type: "string" },
          company: { type: "string" },
          domain: { type: "string", description: "Company website domain, e.g. acme.com" },
          linkedin_url: { type: "string" },
          location: { type: "string" },
          reason: { type: "string", description: "One sentence on why this person matches the target" },
          source_url: { type: "string", description: "Public URL where this person and role are listed" },
        },
        required: ["first_name", "last_name", "title", "company", "reason"],
      },
    },
  },
  required: ["results"],
};

const COMPANY_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          domain: { type: "string" },
          industry: { type: "string" },
          size: { type: "string", description: "Employee range, e.g. 51-200" },
          location: { type: "string", description: "HQ city, country" },
          description: { type: "string" },
          reason: { type: "string" },
          source_url: { type: "string" },
        },
        required: ["name", "reason"],
      },
    },
  },
  required: ["results"],
};

const DISCOVERY_SYSTEM = `You are a meticulous B2B sales researcher. You use Google Search to find REAL companies and REAL, publicly listed people.
Rules:
- Only return people and companies you actually found in search results. Never invent names, titles, domains or URLs.
- Prefer sources like company team/leadership pages, press releases, conference speaker pages, news articles and LinkedIn profiles.
- If you cannot verify a field, leave it as an empty string.
- Never include personal email addresses or phone numbers.`;

function targetDescription(query: string, icp?: ICP) {
  const icpStr = icpText(icp);
  return [query.trim() && `Target description: ${query.trim()}`, icpStr && `Filters:\n${icpStr}`].filter(Boolean).join("\n\n");
}

/** Search-grounded discovery of real decision makers matching a description / ICP. */
export async function discoverProspects(
  ws: Workspace,
  input: { query: string; icp?: ICP; limit?: number },
): Promise<{ results: ProspectResult[]; sources: Source[] }> {
  const target = targetDescription(input.query || "", input.icp);
  if (!target) throw new HttpError(400, "Describe who you're looking for or set at least one filter.");
  const limit = clampLimit(input.limit, 10, 25);
  return withCredits(ws, "prospect_search", 1, async () => {
    const { data, sources } = await generateJSON<{ results?: Partial<ProspectResult>[] }>({
      workspace: ws,
      search: true,
      system: DISCOVERY_SYSTEM,
      schema: PROSPECT_SCHEMA,
      temperature: 0.2,
      prompt: `Find up to ${limit} real decision makers who match this target. Search the web for companies that fit, then for the named people in the matching roles at those companies.

${target}

${sellerContext(ws)}

For each person return first_name, last_name, current title, company name, the company's website domain, a LinkedIn profile URL only if you found one, location, a one-sentence reason they match, and the source_url where you found them.`,
    });
    const seen = new Set<string>();
    const results: ProspectResult[] = [];
    for (const r of data.results || []) {
      let first = str(r.first_name) || "";
      let last = str(r.last_name) || "";
      if (first && !last && first.includes(" ")) ({ first, last } = splitName(first));
      const company = str(r.company);
      if (!first || !company) continue;
      const key = `${first} ${last} ${company}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        first_name: first,
        last_name: last,
        title: str(r.title) || "",
        company,
        domain: normalizeDomain(str(r.domain)),
        linkedin_url: cleanLinkedIn(r.linkedin_url),
        location: str(r.location),
        reason: str(r.reason) || "",
        source_url: cleanUrl(r.source_url),
      });
      if (results.length >= limit) break;
    }
    return { results, sources };
  });
}

/** Search-grounded discovery of real companies (accounts) matching a description / ICP. */
export async function discoverCompanies(
  ws: Workspace,
  input: { query: string; icp?: ICP; limit?: number },
): Promise<{ results: CompanyResult[]; sources: Source[] }> {
  const target = targetDescription(input.query || "", input.icp ? { ...input.icp, titles: undefined, seniorities: undefined } : undefined);
  if (!target) throw new HttpError(400, "Describe the companies you're looking for or set at least one filter.");
  const limit = clampLimit(input.limit, 15, 30);
  return withCredits(ws, "prospect_search", 1, async () => {
    const { data, sources } = await generateJSON<{ results?: Partial<CompanyResult>[] }>({
      workspace: ws,
      search: true,
      system: DISCOVERY_SYSTEM,
      schema: COMPANY_SCHEMA,
      temperature: 0.2,
      prompt: `Find up to ${limit} real companies that match this target account profile.

${target}

${sellerContext(ws)}

For each company return name, website domain, industry, employee size range, HQ location, a one-line description, a one-sentence reason it matches, and the source_url where you verified it.`,
    });
    const seen = new Set<string>();
    const results: CompanyResult[] = [];
    for (const r of data.results || []) {
      const name = str(r.name);
      if (!name) continue;
      const domain = normalizeDomain(str(r.domain));
      const key = domain || name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        name,
        domain,
        industry: str(r.industry),
        size: str(r.size),
        location: str(r.location),
        description: str(r.description),
        reason: str(r.reason) || "",
        source_url: cleanUrl(r.source_url),
      });
      if (results.length >= limit) break;
    }
    return { results, sources };
  });
}

/** Find people at one specific company (search-grounded), scoped to the workspace ICP titles. */
export async function findPeopleAtCompany(ws: Workspace, companyId: string, input: { query?: string; limit?: number } = {}) {
  const co = await getCompany(ws.id, companyId);
  if (!co) throw new HttpError(404, "Company not found");
  const icp = workspaceIcp(ws);
  const roles = input.query?.trim() || (icp.titles?.length ? icp.titles.join(", ") : "senior decision makers relevant to what we sell");
  const query = `People currently working at ${co.name}${co.domain ? ` (${co.domain})` : ""} in roles like: ${roles}. Only people at this exact company.`;
  const res = await discoverProspects(ws, { query, limit: input.limit ?? 8 });
  // Keep the company identity consistent with our record.
  res.results = res.results.map((r) => ({ ...r, company: co.name, domain: co.domain || r.domain }));
  return res;
}

/* ───────────────────────────── saving / importing ───────────────────────────── */

type ContactInput = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  linkedin_url?: string | null;
  location?: string | null;
  company?: string | null;
  domain?: string | null;
  seniority?: string | null;
  department?: string | null;
  notes?: string | null;
  source?: string | null;
  enrichment?: Record<string, unknown> | null;
};

/** Look for an existing contact by email, LinkedIn URL, or name + company. */
async function findDuplicate(workspaceId: string, c: { email?: string | null; linkedin_url?: string | null; first_name?: string | null; last_name?: string | null; company_id?: string | null }) {
  if (c.email) {
    const r = await one<{ id: string }>("SELECT id FROM contacts WHERE workspace_id = ? AND lower(email) = lower(?)", [workspaceId, c.email]);
    if (r) return r.id;
  }
  if (c.linkedin_url) {
    const r = await one<{ id: string }>("SELECT id FROM contacts WHERE workspace_id = ? AND lower(rtrim(linkedin_url, '/')) = lower(rtrim(?, '/'))", [workspaceId, c.linkedin_url]);
    if (r) return r.id;
  }
  if (c.first_name && c.company_id) {
    const r = await one<{ id: string }>(
      "SELECT id FROM contacts WHERE workspace_id = ? AND company_id = ? AND lower(coalesce(first_name,'')) = lower(?) AND lower(coalesce(last_name,'')) = lower(?)",
      [workspaceId, c.company_id, c.first_name, c.last_name || ""],
    );
    if (r) return r.id;
  }
  return null;
}

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/** Insert a contact (and its company) unless it already exists. */
async function insertContact(workspaceId: string, input: ContactInput): Promise<{ id: string; created: boolean }> {
  let first = str(input.first_name) || "";
  let last = str(input.last_name) || "";
  if (!first && !last && input.full_name) ({ first, last } = splitName(input.full_name));
  const emailRaw = str(input.email)?.toLowerCase() || null;
  const email = emailRaw && EMAIL_RE.test(emailRaw) ? emailRaw : null;
  const linkedin = cleanLinkedIn(input.linkedin_url);
  let domain = normalizeDomain(str(input.domain));
  if (!domain && email && !isFreeMailDomain(email.split("@")[1])) domain = email.split("@")[1];
  const companyName = str(input.company) || (domain ? domain.split(".")[0].replace(/^\w/, (m) => m.toUpperCase()) : null);
  const companyId = companyName ? await upsertCompany(workspaceId, { name: companyName, domain }) : null;
  if (!first && !last && !email && !linkedin) throw new HttpError(400, "A contact needs a name, email or LinkedIn URL");

  const dup = await findDuplicate(workspaceId, { email, linkedin_url: linkedin, first_name: first, last_name: last, company_id: companyId });
  if (dup) return { id: dup, created: false };

  const id = await insert("contacts", {
    workspace_id: workspaceId,
    company_id: companyId,
    first_name: first || null,
    last_name: last || null,
    title: str(input.title),
    email,
    phone: str(input.phone),
    linkedin_url: linkedin,
    location: str(input.location),
    seniority: str(input.seniority),
    department: str(input.department),
    notes: str(input.notes),
    source: str(input.source) || "manual",
    enrichment_json: input.enrichment ? JSON.stringify(input.enrichment) : null,
  });
  return { id, created: true };
}

/** Save AI-discovered prospects as contacts (deduped), optionally into a list. */
export async function saveProspects(
  ws: Workspace,
  results: ProspectResult[],
  opts: { listId?: string; source?: string } = {},
): Promise<{ contactIds: string[]; created: number; skipped: number }> {
  if (opts.listId) await requireList(ws.id, opts.listId);
  const contactIds: string[] = [];
  let created = 0;
  let skipped = 0;
  for (const r of results.slice(0, 200)) {
    if (!r?.first_name || !r?.company) {
      skipped++;
      continue;
    }
    const res = await insertContact(ws.id, {
      first_name: r.first_name,
      last_name: r.last_name,
      title: r.title,
      company: r.company,
      domain: r.domain,
      linkedin_url: r.linkedin_url,
      location: r.location,
      source: opts.source || "ai_prospect",
      enrichment: { discovery: { reason: r.reason, source_url: r.source_url, found_at: new Date().toISOString() } },
    });
    contactIds.push(res.id);
    if (res.created) {
      created++;
      await logActivity(ws.id, {
        type: "prospect",
        title: "Added from AI lead discovery",
        body: [r.reason, r.source_url && `Source: ${r.source_url}`].filter(Boolean).join("\n"),
        contact_id: res.id,
      });
    } else skipped++;
  }
  if (opts.listId && contactIds.length) await addToList(ws.id, opts.listId, contactIds);
  return { contactIds, created, skipped };
}

/** Save AI-discovered companies (deduped by domain / name). */
export async function saveCompanies(ws: Workspace, results: CompanyResult[]): Promise<{ companyIds: string[]; created: number; skipped: number }> {
  const companyIds: string[] = [];
  let created = 0;
  for (const r of results.slice(0, 200)) {
    if (!r?.name) continue;
    const domain = normalizeDomain(r.domain);
    const existing = domain
      ? await one<{ id: string }>("SELECT id FROM companies WHERE workspace_id = ? AND domain = ?", [ws.id, domain])
      : await one<{ id: string }>("SELECT id FROM companies WHERE workspace_id = ? AND lower(name) = lower(?)", [ws.id, r.name]);
    if (existing) {
      companyIds.push(existing.id);
      continue;
    }
    const id = await upsertCompany(ws.id, {
      name: r.name,
      domain,
      industry: r.industry,
      size: r.size,
      location: r.location,
      description: r.description,
    });
    await update("companies", id, { enrichment_json: JSON.stringify({ discovery: { reason: r.reason, source_url: r.source_url } }) }, ws.id);
    await logActivity(ws.id, { type: "prospect", title: "Added from AI account discovery", body: r.reason, company_id: id });
    companyIds.push(id);
    created++;
  }
  return { companyIds, created, skipped: results.length - created };
}

/** Bulk import contacts (e.g. from CSV). Dedupes by email / LinkedIn / name+company. */
export async function importContacts(
  workspaceId: string,
  rows: ContactInput[],
  opts: { listId?: string } = {},
): Promise<{ created: number; duplicates: number; invalid: number; contactIds: string[] }> {
  if (rows.length > 5000) throw new HttpError(400, "Import up to 5,000 rows at a time");
  if (opts.listId) await requireList(workspaceId, opts.listId);
  let created = 0;
  let duplicates = 0;
  let invalid = 0;
  const contactIds: string[] = [];
  for (const row of rows) {
    try {
      const r = await insertContact(workspaceId, { ...row, source: row.source || "csv_import" });
      contactIds.push(r.id);
      if (r.created) created++;
      else duplicates++;
    } catch (e) {
      if (e instanceof HttpError && e.status === 400) invalid++;
      else throw e;
    }
  }
  if (opts.listId && contactIds.length) await addToList(workspaceId, opts.listId, contactIds);
  return { created, duplicates, invalid, contactIds };
}

/** Create a single contact manually. Returns the id (existing id when it's a duplicate). */
export async function createContact(workspaceId: string, input: ContactInput) {
  const r = await insertContact(workspaceId, input);
  if (r.created) await logActivity(workspaceId, { type: "created", title: "Contact created", contact_id: r.id });
  return r;
}

export async function createCompany(workspaceId: string, input: { name: string; domain?: string | null; industry?: string | null; size?: string | null; location?: string | null }) {
  const name = str(input.name);
  if (!name) throw new HttpError(400, "Company name is required");
  return upsertCompany(workspaceId, { ...input, name, domain: normalizeDomain(input.domain) });
}

/* ───────────────────────────── querying ───────────────────────────── */

export type ContactFilters = {
  q?: string;
  status?: string;
  listId?: string;
  companyId?: string;
  emailStatus?: string;
  minScore?: number;
  maxScore?: number;
  ids?: string[];
  sort?: "created" | "score" | "name" | "updated";
  limit?: number;
  offset?: number;
};

function contactWhere(workspaceId: string, f: ContactFilters) {
  const where = ["c.workspace_id = ?"];
  const args: InValue[] = [workspaceId];
  if (f.q?.trim()) {
    const q = `%${f.q.trim().toLowerCase()}%`;
    where.push(
      "(lower(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')) LIKE ? OR lower(coalesce(c.email,'')) LIKE ? OR lower(coalesce(c.title,'')) LIKE ? OR lower(coalesce(co.name,'')) LIKE ?)",
    );
    args.push(q, q, q, q);
  }
  if (f.status && CONTACT_STATUSES.includes(f.status as ContactStatus)) {
    where.push("c.status = ?");
    args.push(f.status);
  }
  if (f.emailStatus) {
    if (f.emailStatus === "missing") where.push("(c.email IS NULL OR c.email = '')");
    else if (EMAIL_STATUSES.includes(f.emailStatus as EmailStatus)) {
      where.push("c.email_status = ? AND c.email IS NOT NULL AND c.email != ''");
      args.push(f.emailStatus);
    }
  }
  if (f.companyId) {
    where.push("c.company_id = ?");
    args.push(f.companyId);
  }
  if (f.listId) {
    where.push("c.id IN (SELECT contact_id FROM list_members WHERE list_id = ?)");
    args.push(f.listId);
  }
  if (f.minScore != null && !Number.isNaN(f.minScore)) {
    where.push("c.score >= ?");
    args.push(f.minScore);
  }
  if (f.maxScore != null && !Number.isNaN(f.maxScore)) {
    where.push("c.score <= ?");
    args.push(f.maxScore);
  }
  if (f.ids?.length) {
    where.push(`c.id IN (${placeholders(f.ids.length)})`);
    args.push(...f.ids);
  }
  return { sql: where.join(" AND "), args };
}

/** Parse contact filters from a request URL's query string. */
export function contactFiltersFromUrl(url: string): ContactFilters {
  const s = new URL(url).searchParams;
  const num = (k: string) => (s.get(k) != null && s.get(k) !== "" ? Number(s.get(k)) : undefined);
  return {
    q: s.get("q") || undefined,
    status: s.get("status") || undefined,
    listId: s.get("listId") || undefined,
    companyId: s.get("companyId") || undefined,
    emailStatus: s.get("emailStatus") || undefined,
    minScore: num("minScore"),
    maxScore: num("maxScore"),
    ids: s.get("ids") ? s.get("ids")!.split(",").filter(Boolean) : undefined,
    sort: (s.get("sort") as ContactFilters["sort"]) || undefined,
    limit: num("limit"),
    offset: num("offset"),
  };
}

const CONTACT_SORTS: Record<NonNullable<ContactFilters["sort"]>, string> = {
  created: "c.created_at DESC",
  updated: "c.updated_at DESC",
  score: "c.score IS NULL, c.score DESC, c.created_at DESC",
  name: "lower(coalesce(c.first_name,'')), lower(coalesce(c.last_name,''))",
};

export async function searchContacts(
  workspaceId: string,
  f: ContactFilters,
): Promise<{ contacts: Contact[]; total: number }> {
  const { sql, args } = contactWhere(workspaceId, f);
  const limit = clampLimit(f.limit, 50, 1000);
  const offset = Math.max(0, Math.floor(Number(f.offset) || 0));
  const from = "FROM contacts c LEFT JOIN companies co ON co.id = c.company_id";
  const total = (await one<{ n: number }>(`SELECT count(*) AS n ${from} WHERE ${sql}`, args))?.n ?? 0;
  const contacts = await all<Contact>(
    `SELECT c.*, co.name AS company_name, co.domain AS company_domain ${from} WHERE ${sql} ORDER BY ${CONTACT_SORTS[f.sort || "created"] || CONTACT_SORTS.created} LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
  return { contacts, total: Number(total) };
}

export type CompanyRow = Company & { people_count: number };

export async function searchCompanies(
  workspaceId: string,
  f: { q?: string; minScore?: number; industry?: string; sort?: "created" | "score" | "name" | "people"; limit?: number; offset?: number },
): Promise<{ companies: CompanyRow[]; total: number }> {
  const where = ["co.workspace_id = ?"];
  const args: InValue[] = [workspaceId];
  if (f.q?.trim()) {
    const q = `%${f.q.trim().toLowerCase()}%`;
    where.push("(lower(co.name) LIKE ? OR lower(coalesce(co.domain,'')) LIKE ? OR lower(coalesce(co.industry,'')) LIKE ? OR lower(coalesce(co.location,'')) LIKE ?)");
    args.push(q, q, q, q);
  }
  if (f.industry?.trim()) {
    where.push("lower(coalesce(co.industry,'')) LIKE ?");
    args.push(`%${f.industry.trim().toLowerCase()}%`);
  }
  if (f.minScore != null && !Number.isNaN(f.minScore)) {
    where.push("co.score >= ?");
    args.push(f.minScore);
  }
  const sorts = {
    created: "co.created_at DESC",
    score: "co.score IS NULL, co.score DESC",
    name: "lower(co.name)",
    people: "people_count DESC, co.created_at DESC",
  };
  const sql = where.join(" AND ");
  const limit = clampLimit(f.limit, 50, 1000);
  const offset = Math.max(0, Math.floor(Number(f.offset) || 0));
  const total = (await one<{ n: number }>(`SELECT count(*) AS n FROM companies co WHERE ${sql}`, args))?.n ?? 0;
  const companies = await all<CompanyRow>(
    `SELECT co.*, (SELECT count(*) FROM contacts c WHERE c.company_id = co.id AND c.workspace_id = co.workspace_id) AS people_count
     FROM companies co WHERE ${sql} ORDER BY ${sorts[f.sort || "created"] || sorts.created} LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
  return { companies: companies.map((c) => ({ ...c, people_count: Number(c.people_count) })), total: Number(total) };
}

export async function getContactDetail(workspaceId: string, id: string) {
  const contact = await getContact(workspaceId, id);
  if (!contact) throw new HttpError(404, "Contact not found");
  const [activities, lists, enrollments] = await Promise.all([
    all<Activity>("SELECT * FROM activities WHERE workspace_id = ? AND contact_id = ? ORDER BY created_at DESC LIMIT 50", [workspaceId, id]),
    all<{ id: string; name: string }>(
      "SELECT l.id, l.name FROM lists l JOIN list_members m ON m.list_id = l.id WHERE l.workspace_id = ? AND m.contact_id = ? ORDER BY l.name",
      [workspaceId, id],
    ),
    all<{ id: string; sequence_id: string; sequence_name: string; status: string; current_step: number }>(
      `SELECT e.id, e.sequence_id, s.name AS sequence_name, e.status, e.current_step
       FROM enrollments e JOIN sequences s ON s.id = e.sequence_id WHERE e.workspace_id = ? AND e.contact_id = ? ORDER BY e.created_at DESC`,
      [workspaceId, id],
    ),
  ]);
  return { contact, activities, lists, enrollments };
}

export async function getCompanyDetail(workspaceId: string, id: string) {
  const company = await getCompany(workspaceId, id);
  if (!company) throw new HttpError(404, "Company not found");
  const [people, activities] = await Promise.all([
    all<Contact>(
      "SELECT * FROM contacts WHERE workspace_id = ? AND company_id = ? ORDER BY score IS NULL, score DESC, created_at DESC LIMIT 200",
      [workspaceId, id],
    ),
    all<Activity>("SELECT * FROM activities WHERE workspace_id = ? AND (company_id = ? OR contact_id IN (SELECT id FROM contacts WHERE company_id = ? AND workspace_id = ?)) ORDER BY created_at DESC LIMIT 40", [workspaceId, id, id, workspaceId]),
  ]);
  return { company, people, activities };
}

const CONTACT_EDITABLE = ["first_name", "last_name", "title", "email", "phone", "linkedin_url", "location", "seniority", "department", "status", "notes", "tags", "email_status"] as const;

export async function updateContact(workspaceId: string, id: string, patch: Record<string, unknown> & { company?: string | null; domain?: string | null }) {
  const existing = await getContact(workspaceId, id);
  if (!existing) throw new HttpError(404, "Contact not found");
  const data: Record<string, InValue | undefined> = {};
  for (const k of CONTACT_EDITABLE) {
    if (!(k in patch)) continue;
    const v = patch[k];
    data[k] = v == null ? null : String(v).trim() || null;
  }
  if (data.status !== undefined && !CONTACT_STATUSES.includes(data.status as ContactStatus)) throw new HttpError(400, "Invalid status");
  if (data.email_status !== undefined && !EMAIL_STATUSES.includes(data.email_status as EmailStatus)) throw new HttpError(400, "Invalid email status");
  if (data.email_status === null) data.email_status = "unknown";
  if (data.email !== undefined && data.email !== null) {
    const e = String(data.email).toLowerCase();
    if (!EMAIL_RE.test(e)) throw new HttpError(400, "That email address doesn't look valid");
    data.email = e;
    if (e !== existing.email && data.email_status === undefined) data.email_status = "unknown";
  }
  if (data.linkedin_url) data.linkedin_url = cleanLinkedIn(data.linkedin_url) ?? data.linkedin_url;
  if ("company" in patch) {
    const name = str(patch.company);
    data.company_id = name ? await upsertCompany(workspaceId, { name, domain: normalizeDomain(str(patch.domain)) }) : null;
  }
  await update("contacts", id, data, workspaceId);
  if (data.status && data.status !== existing.status) {
    await logActivity(workspaceId, { type: "status", title: `Status changed to ${String(data.status).replace("_", " ")}`, contact_id: id });
  }
  return (await getContact(workspaceId, id))!;
}

const COMPANY_EDITABLE = ["name", "domain", "website", "linkedin_url", "industry", "size", "location", "description", "funding"] as const;

export async function updateCompany(workspaceId: string, id: string, patch: Record<string, unknown>) {
  const existing = await getCompany(workspaceId, id);
  if (!existing) throw new HttpError(404, "Company not found");
  const data: Record<string, InValue | undefined> = {};
  for (const k of COMPANY_EDITABLE) {
    if (!(k in patch)) continue;
    const v = patch[k];
    data[k] = v == null ? null : String(v).trim() || null;
  }
  if ("name" in data && !data.name) throw new HttpError(400, "Company name is required");
  if (data.domain) data.domain = normalizeDomain(String(data.domain));
  await update("companies", id, data, workspaceId);
  return (await getCompany(workspaceId, id))!;
}

export async function deleteContacts(workspaceId: string, ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  let n = 0;
  for (const part of chunk(ids, 200)) {
    const ph = placeholders(part.length);
    const owned = await all<{ id: string }>(`SELECT id FROM contacts WHERE workspace_id = ? AND id IN (${ph})`, [workspaceId, ...part]);
    if (!owned.length) continue;
    const ownedIds = owned.map((o) => o.id);
    const oph = placeholders(ownedIds.length);
    await run(`DELETE FROM list_members WHERE contact_id IN (${oph})`, ownedIds);
    await run(`DELETE FROM enrollments WHERE workspace_id = ? AND contact_id IN (${oph})`, [workspaceId, ...ownedIds]);
    n += await run(`DELETE FROM contacts WHERE workspace_id = ? AND id IN (${oph})`, [workspaceId, ...ownedIds]);
  }
  return n;
}

export async function deleteCompanies(workspaceId: string, ids: string[], opts: { withPeople?: boolean } = {}): Promise<number> {
  if (!ids.length) return 0;
  let n = 0;
  for (const part of chunk(ids, 200)) {
    const ph = placeholders(part.length);
    if (opts.withPeople) {
      const people = await all<{ id: string }>(`SELECT id FROM contacts WHERE workspace_id = ? AND company_id IN (${ph})`, [workspaceId, ...part]);
      await deleteContacts(workspaceId, people.map((p) => p.id));
    } else {
      await run(`UPDATE contacts SET company_id = NULL WHERE workspace_id = ? AND company_id IN (${ph})`, [workspaceId, ...part]);
    }
    n += await run(`DELETE FROM companies WHERE workspace_id = ? AND id IN (${ph})`, [workspaceId, ...part]);
  }
  return n;
}

export async function setContactStatus(workspaceId: string, ids: string[], status: string) {
  if (!CONTACT_STATUSES.includes(status as ContactStatus)) throw new HttpError(400, "Invalid status");
  let n = 0;
  for (const part of chunk(ids, 200)) {
    n += await run(`UPDATE contacts SET status = ?, updated_at = datetime('now') WHERE workspace_id = ? AND id IN (${placeholders(part.length)})`, [status, workspaceId, ...part]);
  }
  return n;
}

/* ───────────────────────────── CSV export ───────────────────────────── */

const EXPORT_COLUMNS: { key: string; label: string; get: (c: Contact) => unknown }[] = [
  { key: "first_name", label: "First name", get: (c) => c.first_name },
  { key: "last_name", label: "Last name", get: (c) => c.last_name },
  { key: "title", label: "Title", get: (c) => c.title },
  { key: "company", label: "Company", get: (c) => c.company_name },
  { key: "domain", label: "Company domain", get: (c) => c.company_domain },
  { key: "email", label: "Email", get: (c) => c.email },
  { key: "email_status", label: "Email status", get: (c) => c.email_status },
  { key: "phone", label: "Phone", get: (c) => c.phone },
  { key: "linkedin_url", label: "LinkedIn", get: (c) => c.linkedin_url },
  { key: "location", label: "Location", get: (c) => c.location },
  { key: "seniority", label: "Seniority", get: (c) => c.seniority },
  { key: "status", label: "Status", get: (c) => c.status },
  { key: "score", label: "Score", get: (c) => c.score },
  { key: "score_reason", label: "Score reason", get: (c) => c.score_reason },
  { key: "source", label: "Source", get: (c) => c.source },
  { key: "created_at", label: "Created", get: (c) => c.created_at },
];

function csvCell(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportContactsCsv(workspaceId: string, f: ContactFilters): Promise<string> {
  const { contacts } = await searchContacts(workspaceId, { ...f, limit: 1000, offset: 0 });
  const lines = [EXPORT_COLUMNS.map((c) => csvCell(c.label)).join(",")];
  for (const c of contacts) lines.push(EXPORT_COLUMNS.map((col) => csvCell(col.get(c))).join(","));
  return lines.join("\r\n") + "\r\n";
}

/* ───────────────────────────── enrichment ───────────────────────────── */

type CompanyEnrichment = {
  domain?: string;
  website?: string;
  linkedin_url?: string;
  industry?: string;
  size?: string;
  employees?: string;
  location?: string;
  founded?: string;
  description?: string;
  funding?: string;
  tech_stack?: string[];
  recent_news?: { title: string; date?: string; url?: string }[];
  competitors?: string[];
  products?: string[];
};

const COMPANY_ENRICH_SCHEMA = {
  type: "object",
  properties: {
    domain: { type: "string" },
    website: { type: "string" },
    linkedin_url: { type: "string" },
    industry: { type: "string" },
    size: { type: "string", description: "Employee range, e.g. 201-500" },
    employees: { type: "string", description: "Approximate headcount if published" },
    location: { type: "string", description: "HQ city, country" },
    founded: { type: "string" },
    description: { type: "string", description: "2-3 sentence description of what the company does" },
    funding: { type: "string", description: "Latest funding stage, total raised, key investors" },
    tech_stack: { type: "array", items: { type: "string" } },
    recent_news: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, date: { type: "string" }, url: { type: "string" } }, required: ["title"] },
    },
    competitors: { type: "array", items: { type: "string" } },
    products: { type: "array", items: { type: "string" } },
  },
};

function strArr(v: unknown, max = 15): string[] {
  return Array.isArray(v) ? v.map(str).filter((s): s is string => !!s).slice(0, max) : [];
}

/** Search-grounded company research ("waterfall": keep existing values, fill and refresh from public sources). */
export async function enrichCompany(ws: Workspace, companyId: string): Promise<Company> {
  const co = await getCompany(ws.id, companyId);
  if (!co) throw new HttpError(404, "Company not found");
  return withCredits(ws, "enrich_company", 1, async () => {
    const { data, sources } = await generateJSON<CompanyEnrichment>({
      workspace: ws,
      search: true,
      temperature: 0.1,
      system: "You are a B2B data researcher. Use Google Search to find accurate, current public facts about the company. Leave fields empty when not found; never guess.",
      schema: COMPANY_ENRICH_SCHEMA,
      prompt: `Research this company and return firmographics:
Name: ${co.name}
${co.domain ? `Domain: ${co.domain}` : ""}
${co.location ? `Known location: ${co.location}` : ""}

Include: official website domain, LinkedIn company page URL, industry, employee range, HQ location, year founded, a short description, funding (stage, total raised, notable investors), technologies they use (from job posts, BuiltWith-style sources, engineering blogs), up to 5 recent news items from the past 12 months with dates and URLs, main competitors and key products.`,
    });
    const prev = parseJson<Record<string, unknown>>(co.enrichment_json, {});
    const news = Array.isArray(data.recent_news)
      ? data.recent_news
          .filter((n) => n && str(n.title))
          .slice(0, 6)
          .map((n) => ({ title: str(n.title)!, date: str(n.date), url: cleanUrl(n.url) }))
      : [];
    const tech = strArr(data.tech_stack, 30);
    const enrichment = {
      ...prev,
      founded: str(data.founded),
      employees: str(data.employees),
      tech_stack: tech,
      recent_news: news,
      competitors: strArr(data.competitors, 10),
      products: strArr(data.products, 10),
      sources,
      enriched_at: new Date().toISOString(),
    };
    const domain = co.domain || normalizeDomain(str(data.domain) || str(data.website));
    await update(
      "companies",
      co.id,
      {
        domain,
        website: co.website || cleanUrl(data.website) || (domain ? `https://${domain}` : null),
        linkedin_url: cleanLinkedIn(data.linkedin_url) || co.linkedin_url,
        industry: str(data.industry) || co.industry,
        size: str(data.size) || co.size,
        location: str(data.location) || co.location,
        description: str(data.description) || co.description,
        funding: str(data.funding) || co.funding,
        tech_json: tech.length ? JSON.stringify(tech) : co.tech_json,
        enrichment_json: JSON.stringify(enrichment),
      },
      ws.id,
    );
    await logActivity(ws.id, {
      type: "enrichment",
      title: "Company enriched",
      body: [str(data.industry), str(data.size), str(data.funding)].filter(Boolean).join(" · ") || null,
      company_id: co.id,
    });
    return (await getCompany(ws.id, co.id))!;
  });
}

type ContactEnrichment = {
  current_title?: string;
  current_company?: string;
  still_at_company?: boolean;
  linkedin_url?: string;
  location?: string;
  seniority?: string;
  department?: string;
  summary?: string;
  past_roles?: { title: string; company: string; years?: string }[];
  education?: string[];
  talking_points?: string[];
};

const CONTACT_ENRICH_SCHEMA = {
  type: "object",
  properties: {
    current_title: { type: "string" },
    current_company: { type: "string" },
    still_at_company: { type: "boolean", description: "True if public sources confirm they still work at the given company" },
    linkedin_url: { type: "string" },
    location: { type: "string" },
    seniority: { type: "string", enum: ["C-level", "VP", "Director", "Manager", "Senior IC", "IC", "Founder", "Other", ""] },
    department: { type: "string" },
    summary: { type: "string", description: "2-sentence professional summary" },
    past_roles: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, company: { type: "string" }, years: { type: "string" } }, required: ["title", "company"] },
    },
    education: { type: "array", items: { type: "string" } },
    talking_points: { type: "array", items: { type: "string" }, description: "Personalization hooks from talks, posts, interviews, news" },
  },
};

/** Search-grounded public professional research about a contact. */
export async function enrichContact(ws: Workspace, contactId: string): Promise<Contact> {
  const c = await getContact(ws.id, contactId);
  if (!c) throw new HttpError(404, "Contact not found");
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
  if (!name && !c.linkedin_url) throw new HttpError(400, "This contact needs a name or LinkedIn URL to enrich");
  return withCredits(ws, "enrich_contact", 1, async () => {
    const { data, sources } = await generateJSON<ContactEnrichment>({
      workspace: ws,
      search: true,
      temperature: 0.1,
      system:
        "You are a B2B sales researcher. Use Google Search to find PUBLIC professional information only (no personal contact details, no private life). Leave fields empty when not verifiable; never guess.",
      schema: CONTACT_ENRICH_SCHEMA,
      prompt: `Research this professional:
Name: ${name || "(unknown)"}
${c.title ? `Last known title: ${c.title}` : ""}
${c.company_name ? `Last known company: ${c.company_name}${c.company_domain ? ` (${c.company_domain})` : ""}` : ""}
${c.linkedin_url ? `LinkedIn: ${c.linkedin_url}` : ""}
${c.location ? `Location: ${c.location}` : ""}

Verify their current title and company, find their LinkedIn URL, location, seniority, department, notable past roles, education, and 2-4 talking points a seller could reference (recent posts, talks, interviews, company news they were part of).

${sellerContext(ws)}`,
    });
    const prev = parseJson<Record<string, unknown>>(c.enrichment_json, {});
    const pastRoles = Array.isArray(data.past_roles)
      ? data.past_roles.filter((r) => r && str(r.title) && str(r.company)).slice(0, 8).map((r) => ({ title: str(r.title)!, company: str(r.company)!, years: str(r.years) }))
      : [];
    const enrichment = {
      ...prev,
      current_title: str(data.current_title),
      current_company: str(data.current_company),
      still_at_company: typeof data.still_at_company === "boolean" ? data.still_at_company : null,
      summary: str(data.summary),
      past_roles: pastRoles,
      education: strArr(data.education, 5),
      talking_points: strArr(data.talking_points, 6),
      sources,
      enriched_at: new Date().toISOString(),
    };
    const confirmedAtCompany = data.still_at_company !== false;
    await update(
      "contacts",
      c.id,
      {
        title: confirmedAtCompany && str(data.current_title) ? str(data.current_title) : c.title,
        linkedin_url: c.linkedin_url || cleanLinkedIn(data.linkedin_url),
        location: c.location || str(data.location),
        seniority: str(data.seniority) || c.seniority,
        department: str(data.department) || c.department,
        enrichment_json: JSON.stringify(enrichment),
      },
      ws.id,
    );
    const moved = data.still_at_company === false && str(data.current_company);
    await logActivity(ws.id, {
      type: "enrichment",
      title: "Enriched",
      body: moved ? `Possible job change: now ${str(data.current_title) || ""} at ${str(data.current_company)}` : str(data.summary),
      contact_id: c.id,
      company_id: c.company_id,
    });
    return (await getContact(ws.id, c.id))!;
  });
}

/* ───────────────────────────── email finder / verifier ───────────────────────────── */

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "10minutemail.com", "tempmail.com", "temp-mail.org", "trashmail.com",
  "yopmail.com", "getnada.com", "dispostable.com", "sharklasers.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com",
  "mintemail.com", "mohmal.com", "emailondeck.com", "tempail.com", "spamgourmet.com", "mailnesia.com", "mytemp.email",
  "burnermail.io", "tempr.email", "discard.email", "moakt.com", "inboxkitten.com", "spam4.me", "33mail.com", "jetable.org",
]);

const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com", "live.com", "msn.com", "aol.com",
  "icloud.com", "me.com", "mac.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "web.de", "yandex.com", "yandex.ru",
  "mail.com", "zoho.com", "qq.com", "163.com", "hey.com", "fastmail.com",
]);

const ROLE_ACCOUNTS = new Set([
  "info", "sales", "support", "admin", "contact", "hello", "hi", "team", "office", "help", "billing", "accounts", "marketing",
  "hr", "jobs", "careers", "press", "media", "noreply", "no-reply", "postmaster", "webmaster", "abuse", "security", "privacy",
  "legal", "enquiries", "inquiries", "service", "partners", "feedback", "newsletter", "mail", "general",
]);

function isFreeMailDomain(d: string) {
  return FREE_MAIL_DOMAINS.has(d.toLowerCase());
}

type MxResult = { status: "ok" | "none" | "error"; hosts: string[] };
const mxCache = new Map<string, { at: number; res: MxResult }>();

/** Look up a domain's MX records (cached 1h). "none" = domain has no mail servers / doesn't exist. */
export async function checkMx(domain: string): Promise<MxResult> {
  const d = domain.toLowerCase();
  const cached = mxCache.get(d);
  if (cached && Date.now() - cached.at < 3600_000) return cached.res;
  let res: MxResult;
  try {
    const records = await Promise.race([
      resolveMx(d),
      new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), 5000)),
    ]);
    const hosts = records.filter((r) => r.exchange && r.exchange !== ".").sort((a, b) => a.priority - b.priority).map((r) => r.exchange);
    res = { status: hosts.length ? "ok" : "none", hosts };
  } catch (e) {
    const code = (e as { code?: string }).code;
    res = { status: code === "ENOTFOUND" || code === "ENODATA" || code === "NXDOMAIN" ? "none" : "error", hosts: [] };
  }
  mxCache.set(d, { at: Date.now(), res });
  return res;
}

/** Verify an email address: syntax, disposable domain, role account, and live MX lookup. Free, no AI. */
export async function verifyEmail(email: string): Promise<{ status: EmailStatus; reason: string }> {
  const e = (email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(e) || e.length > 254) return { status: "invalid", reason: "Invalid email syntax" };
  const [local, domain] = e.split("@");
  if (local.length > 64) return { status: "invalid", reason: "Local part is too long" };
  if (DISPOSABLE_DOMAINS.has(domain)) return { status: "invalid", reason: "Disposable email domain" };
  const mx = await checkMx(domain);
  if (mx.status === "none") return { status: "invalid", reason: `${domain} has no mail servers (no MX records)` };
  if (mx.status === "error") return { status: "risky", reason: `Couldn't reach DNS for ${domain}; try again later` };
  if (ROLE_ACCOUNTS.has(local.split("+")[0])) return { status: "risky", reason: "Role-based address (shared inbox), not a person" };
  if (isFreeMailDomain(domain)) return { status: "risky", reason: "Personal webmail address; deliverable but not a work email" };
  return { status: "valid", reason: `Valid syntax and ${domain} accepts mail (MX: ${mx.hosts[0]})` };
}

/** Verify a contact's existing email and store the result. */
export async function verifyContactEmail(ws: Workspace, contactId: string) {
  const c = await getContact(ws.id, contactId);
  if (!c) throw new HttpError(404, "Contact not found");
  if (!c.email) throw new HttpError(400, "This contact has no email to verify");
  return withCredits(ws, "verify_email", 1, async () => {
    const r: { status: EmailStatus; reason: string } = await verifyEmail(c.email!);
    // An address produced by the pattern finder stays "risky" unless its format was confirmed:
    // without an SMTP handshake we can only prove the domain accepts mail, not the mailbox.
    const finder = parseJson<{ email_finder?: { email?: string; status?: EmailStatus } }>(c.enrichment_json, {}).email_finder;
    if (r.status === "valid" && finder?.email === c.email && finder.status === "risky") {
      r.status = "risky";
      r.reason = `${c.email.split("@")[1]} accepts mail, but this address is a guessed pattern (mailbox not confirmed)`;
    }
    await update("contacts", c.id, { email_status: r.status }, ws.id);
    await logActivity(ws.id, { type: "email_verify", title: `Email verified: ${r.status}`, body: `${c.email} — ${r.reason}`, contact_id: c.id });
    return { email: c.email, ...r };
  });
}

const PATTERNS = ["first.last", "first", "flast", "firstlast", "f.last", "last", "first_last", "firstl", "first-last", "last.first", "lastf"] as const;
type Pattern = (typeof PATTERNS)[number];

function slug(s: string | null | undefined) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function applyPattern(p: Pattern, first: string, last: string): string | null {
  const f = first[0] || "";
  const l = last[0] || "";
  const needsLast = p !== "first";
  if (!first || (needsLast && !last)) return null;
  switch (p) {
    case "first.last": return `${first}.${last}`;
    case "first": return first;
    case "flast": return `${f}${last}`;
    case "firstlast": return `${first}${last}`;
    case "f.last": return `${f}.${last}`;
    case "last": return last;
    case "first_last": return `${first}_${last}`;
    case "firstl": return `${first}${l}`;
    case "first-last": return `${first}-${last}`;
    case "last.first": return `${last}.${first}`;
    case "lastf": return `${last}${f}`;
  }
}

type FormatLookup = { domain?: string; pattern?: string; confidence?: "high" | "medium" | "low" | ""; example?: string };

/**
 * Find a contact's work email: derive the domain, generate pattern candidates, check MX,
 * and rank using the company's publicly documented email format (search-grounded Gemini).
 * Works without Gemini (MX-only, status "risky") when AI isn't configured.
 */
export async function findEmail(ws: Workspace, contactId: string): Promise<{ email: string | null; status: EmailStatus; candidates: string[] }> {
  const c = await getContact(ws.id, contactId);
  if (!c) throw new HttpError(404, "Contact not found");
  const first = slug(c.first_name);
  const lastParts = (c.last_name || "").trim().split(/\s+/);
  const last = slug(lastParts[lastParts.length - 1]);
  if (!first) throw new HttpError(400, "This contact needs a first name to find an email");

  return withCredits(ws, "find_email", 1, async () => {
    let domain = normalizeDomain(c.company_domain) || (c.email && !isFreeMailDomain(c.email.split("@")[1]) ? c.email.split("@")[1] : null);
    let format: FormatLookup | null = null;
    let aiError: HttpError | null = null;
    try {
      if (c.company_name || domain) {
        const { data } = await generateJSON<FormatLookup>({
          workspace: ws,
          search: true,
          temperature: 0,
          system: "You look up publicly documented corporate email address formats (e.g. from sites that publish company email patterns, press pages, or public staff emails). Never guess; return low confidence if unsure.",
          schema: {
            type: "object",
            properties: {
              domain: { type: "string", description: "The company's primary email domain" },
              pattern: { type: "string", enum: [...PATTERNS, "unknown"] },
              confidence: { type: "string", enum: ["high", "medium", "low"] },
              example: { type: "string", description: "A publicly listed example address, if any" },
            },
            required: ["pattern", "confidence"],
          },
          prompt: `What email address format does ${c.company_name || domain}${domain ? ` (domain ${domain})` : ""} use for employees? Patterns: first.last = jane.doe@, flast = jdoe@, firstlast = janedoe@, f.last = j.doe@, first = jane@, last = doe@, first_last = jane_doe@, firstl = janed@, first-last = jane-doe@, last.first = doe.jane@, lastf = doej@.`,
        });
        format = data;
      }
    } catch (e) {
      if (e instanceof HttpError && (e.status === 402 || e.status === 404)) throw e;
      aiError = e instanceof HttpError ? e : new HttpError(502, "AI lookup failed");
    }
    if (!domain && format?.domain) domain = normalizeDomain(format.domain);
    if (!domain) {
      if (aiError) throw aiError;
      throw new HttpError(400, "Couldn't determine the company's domain. Add a company domain to this contact first.");
    }
    if (domain !== normalizeDomain(c.company_domain) && c.company_id) {
      await run("UPDATE companies SET domain = ? WHERE id = ? AND workspace_id = ? AND (domain IS NULL OR domain = '')", [domain, c.company_id, ws.id]);
    }

    const known = PATTERNS.includes(format?.pattern as Pattern) ? (format!.pattern as Pattern) : null;
    const ordered: Pattern[] = known ? [known, ...PATTERNS.filter((p) => p !== known)] : [...PATTERNS];
    const candidates = [...new Set(ordered.map((p) => applyPattern(p, first, last)).filter((s): s is string => !!s).map((l) => `${l}@${domain}`))];

    const mx = await checkMx(domain);
    let status: EmailStatus;
    let email: string | null;
    let reason: string;
    if (mx.status === "none") {
      status = "invalid";
      email = null;
      reason = `${domain} has no MX records — it can't receive email.`;
    } else {
      email = candidates[0] || null;
      if (known && format?.confidence === "high" && mx.status === "ok") {
        status = "valid";
        reason = `MX present and ${domain} publicly uses the ${known} format.`;
      } else {
        status = "risky";
        reason = known
          ? `MX present; ${known} format reported with ${format?.confidence || "low"} confidence.`
          : mx.status === "ok"
            ? "MX present; format not publicly documented, so this is the most common pattern."
            : "DNS lookup failed; pattern guessed.";
      }
    }

    const shouldWrite = email && (!c.email || c.email_status === "invalid");
    if (shouldWrite) {
      const prev = parseJson<Record<string, unknown>>(c.enrichment_json, {});
      const email_finder = { email, status, pattern: known, confidence: format?.confidence || null, candidates, reason, at: new Date().toISOString() };
      await update("contacts", c.id, { email, email_status: status, enrichment_json: JSON.stringify({ ...prev, email_finder }) }, ws.id);
    }
    else if (!email && !c.email) await update("contacts", c.id, { email_status: "invalid" }, ws.id);
    await logActivity(ws.id, {
      type: "email_found",
      title: email ? `Email found: ${email}` : "No deliverable email found",
      body: `${reason}${aiError ? " (AI format lookup unavailable)" : ""}`,
      contact_id: c.id,
    });
    return { email, status, candidates };
  });
}

/* ───────────────────────────── ICP scoring ───────────────────────────── */

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, score: { type: "integer", minimum: 0, maximum: 100 }, reason: { type: "string" } },
        required: ["id", "score", "reason"],
      },
    },
  },
  required: ["scores"],
};

const SCORE_SYSTEM = `You score B2B prospects for fit against the seller's ideal customer profile (ICP).
Score 0-100: 80+ = strong fit (right role, seniority, industry, size, location), 50-79 = partial fit, <50 = weak fit.
Missing data lowers confidence; don't reward it. The reason must be one short sentence naming the deciding factors.`;

function scoreIcpBlock(ws: Workspace) {
  const icp = icpText(workspaceIcp(ws));
  return `${sellerContext(ws)}\n\n${icp ? `ICP details:\n${icp}` : "No explicit ICP has been set; infer the ideal customer from what the seller sells."}`;
}

export async function scoreContacts(ws: Workspace, contactIds: string[]): Promise<{ id: string; score: number; reason: string }[]> {
  const ids = [...new Set(contactIds)].slice(0, 500);
  if (!ids.length) return [];
  const out: { id: string; score: number; reason: string }[] = [];
  for (const part of chunk(ids, 20)) {
    const rows = await all<Contact & { industry: string | null; size: string | null; company_location: string | null; description: string | null }>(
      `SELECT c.*, co.name AS company_name, co.industry, co.size, co.location AS company_location, co.description
       FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
       WHERE c.workspace_id = ? AND c.id IN (${placeholders(part.length)})`,
      [ws.id, ...part],
    );
    if (!rows.length) continue;
    const scored = await withCredits(ws, "ai_score", rows.length, async () => {
      const { data } = await generateJSON<{ scores?: { id: string; score: number; reason: string }[] }>({
        workspace: ws,
        temperature: 0,
        system: SCORE_SYSTEM,
        schema: SCORE_SCHEMA,
        prompt: `${scoreIcpBlock(ws)}

Score each prospect (return every id exactly as given):
${JSON.stringify(
  rows.map((r) => ({
    id: r.id,
    name: [r.first_name, r.last_name].filter(Boolean).join(" "),
    title: r.title,
    seniority: r.seniority,
    location: r.location,
    company: r.company_name,
    industry: r.industry,
    company_size: r.size,
    company_location: r.company_location,
    company_description: r.description?.slice(0, 200),
  })),
)}`,
      });
      return data.scores || [];
    });
    const valid = new Set(rows.map((r) => r.id));
    for (const s of scored) {
      if (!valid.has(s.id)) continue;
      const score = Math.max(0, Math.min(100, Math.round(Number(s.score) || 0)));
      const reason = String(s.reason || "").slice(0, 300);
      await update("contacts", s.id, { score, score_reason: reason }, ws.id);
      out.push({ id: s.id, score, reason });
    }
  }
  return out;
}

export async function scoreCompanies(ws: Workspace, companyIds: string[]): Promise<{ id: string; score: number; reason: string }[]> {
  const ids = [...new Set(companyIds)].slice(0, 500);
  if (!ids.length) return [];
  const out: { id: string; score: number; reason: string }[] = [];
  for (const part of chunk(ids, 20)) {
    const rows = await all<Company>(`SELECT * FROM companies WHERE workspace_id = ? AND id IN (${placeholders(part.length)})`, [ws.id, ...part]);
    if (!rows.length) continue;
    const scored = await withCredits(ws, "ai_score", rows.length, async () => {
      const { data } = await generateJSON<{ scores?: { id: string; score: number; reason: string }[] }>({
        workspace: ws,
        temperature: 0,
        system: SCORE_SYSTEM.replace("prospects", "companies (accounts)").replace("right role, seniority, ", ""),
        schema: SCORE_SCHEMA,
        prompt: `${scoreIcpBlock(ws)}

Score each account (return every id exactly as given):
${JSON.stringify(
  rows.map((r) => ({
    id: r.id,
    name: r.name,
    domain: r.domain,
    industry: r.industry,
    size: r.size,
    location: r.location,
    funding: r.funding,
    description: r.description?.slice(0, 300),
  })),
)}`,
      });
      return data.scores || [];
    });
    const valid = new Set(rows.map((r) => r.id));
    for (const s of scored) {
      if (!valid.has(s.id)) continue;
      const score = Math.max(0, Math.min(100, Math.round(Number(s.score) || 0)));
      const reason = String(s.reason || "").slice(0, 300);
      await update("companies", s.id, { score, score_reason: reason }, ws.id);
      out.push({ id: s.id, score, reason });
    }
  }
  return out;
}

/* ───────────────────────────── account research ───────────────────────────── */

export async function researchAccount(ws: Workspace, companyId: string): Promise<{ text: string; sources: Source[] }> {
  const co = await getCompany(ws.id, companyId);
  if (!co) throw new HttpError(404, "Company not found");
  return withCredits(ws, "research", 1, async () => {
    const { text, sources } = await generateText({
      workspace: ws,
      search: true,
      temperature: 0.3,
      system:
        "You are a senior account executive preparing an account briefing. Use Google Search for current, factual information and cite specifics (numbers, dates, names). Write concise GitHub-flavored markdown.",
      prompt: `Prepare an account research briefing on ${co.name}${co.domain ? ` (${co.domain})` : ""}.
${co.industry ? `Industry: ${co.industry}. ` : ""}${co.description ? `About: ${co.description}` : ""}

${sellerContext(ws)}

Use these sections:
## Snapshot
## Strategic priorities
## Recent news & triggers (last 12 months, with dates)
## Likely pain points (relevant to what we sell)
## Who to target (roles; named people only if publicly listed)
## Outreach angle (2-3 specific hooks and a suggested first-line)`,
    });
    if (!text) throw new HttpError(502, "The AI returned an empty briefing. Please try again.");
    const prev = parseJson<Record<string, unknown>>(co.enrichment_json, {});
    await update("companies", co.id, { enrichment_json: JSON.stringify({ ...prev, research: { text, sources, at: new Date().toISOString() } }) }, ws.id);
    await logActivity(ws.id, { type: "research", title: "Account research briefing generated", company_id: co.id });
    return { text, sources };
  });
}

/* ───────────────────────────── lists ───────────────────────────── */

export type ListRow = { id: string; name: string; created_at: string; member_count: number };

async function requireList(workspaceId: string, listId: string) {
  const l = await one<{ id: string; name: string }>("SELECT id, name FROM lists WHERE id = ? AND workspace_id = ?", [listId, workspaceId]);
  if (!l) throw new HttpError(404, "List not found");
  return l;
}

export async function getLists(workspaceId: string): Promise<ListRow[]> {
  const rows = await all<ListRow>(
    `SELECT l.id, l.name, l.created_at,
       (SELECT count(*) FROM list_members m JOIN contacts c ON c.id = m.contact_id WHERE m.list_id = l.id AND c.workspace_id = l.workspace_id) AS member_count
     FROM lists l WHERE l.workspace_id = ? ORDER BY l.created_at DESC`,
    [workspaceId],
  );
  return rows.map((r) => ({ ...r, member_count: Number(r.member_count) }));
}

export async function getList(workspaceId: string, listId: string) {
  const l = await one<{ id: string; name: string; created_at: string }>("SELECT id, name, created_at FROM lists WHERE id = ? AND workspace_id = ?", [listId, workspaceId]);
  if (!l) throw new HttpError(404, "List not found");
  return l;
}

export async function createList(workspaceId: string, name: string): Promise<string> {
  const n = name?.trim();
  if (!n) throw new HttpError(400, "List name is required");
  if (n.length > 120) throw new HttpError(400, "List name is too long");
  return insert("lists", { workspace_id: workspaceId, name: n });
}

export async function renameList(workspaceId: string, listId: string, name: string) {
  const n = name?.trim();
  if (!n) throw new HttpError(400, "List name is required");
  await requireList(workspaceId, listId);
  await run("UPDATE lists SET name = ? WHERE id = ? AND workspace_id = ?", [n.slice(0, 120), listId, workspaceId]);
}

export async function deleteList(workspaceId: string, listId: string) {
  await requireList(workspaceId, listId);
  await run("DELETE FROM list_members WHERE list_id = ?", [listId]);
  await run("DELETE FROM lists WHERE id = ? AND workspace_id = ?", [listId, workspaceId]);
}

/** Add contacts to a list. Returns how many were newly added. */
export async function addToList(workspaceId: string, listId: string, contactIds: string[]): Promise<number> {
  await requireList(workspaceId, listId);
  let added = 0;
  for (const part of chunk([...new Set(contactIds)], 200)) {
    const owned = await all<{ id: string }>(`SELECT id FROM contacts WHERE workspace_id = ? AND id IN (${placeholders(part.length)})`, [workspaceId, ...part]);
    for (const o of owned) added += await run("INSERT OR IGNORE INTO list_members (list_id, contact_id) VALUES (?, ?)", [listId, o.id]);
  }
  return added;
}

export async function removeFromList(workspaceId: string, listId: string, contactIds: string[]): Promise<number> {
  await requireList(workspaceId, listId);
  let removed = 0;
  for (const part of chunk([...new Set(contactIds)], 200)) {
    removed += await run(`DELETE FROM list_members WHERE list_id = ? AND contact_id IN (${placeholders(part.length)})`, [listId, ...part]);
  }
  return removed;
}

/* ───────────────────────────── bulk runner ───────────────────────────── */

/** Run a per-record paid action over many ids sequentially; stops early on credit/config errors. */
export async function runBulk<T>(ids: string[], max: number, fn: (id: string) => Promise<T>) {
  const results: { id: string; ok: boolean; result?: T; error?: string }[] = [];
  let fatal: string | null = null;
  for (const id of ids.slice(0, max)) {
    try {
      results.push({ id, ok: true, result: await fn(id) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      results.push({ id, ok: false, error: msg });
      if (e instanceof HttpError && (e.status === 402 || e.status === 503)) {
        fatal = msg;
        break;
      }
    }
  }
  return { results, ok: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, error: fatal, truncated: ids.length > max };
}

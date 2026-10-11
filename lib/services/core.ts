import "server-only";
import { all, insert, one, parseJson } from "../db";
import type { Activity, Company, Contact } from "../types";

/** Record an event on the timeline of a contact / company / deal. */
export async function logActivity(
  workspaceId: string,
  a: { type: string; title: string; body?: string | null; contact_id?: string | null; company_id?: string | null; deal_id?: string | null },
) {
  return insert("activities", {
    workspace_id: workspaceId,
    type: a.type,
    title: a.title,
    body: a.body ?? null,
    contact_id: a.contact_id ?? null,
    company_id: a.company_id ?? null,
    deal_id: a.deal_id ?? null,
  });
}

export async function getContact(workspaceId: string, id: string) {
  return one<Contact>(
    `SELECT c.*, co.name AS company_name, co.domain AS company_domain
     FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
     WHERE c.id = ? AND c.workspace_id = ?`,
    [id, workspaceId],
  );
}

export async function getCompany(workspaceId: string, id: string) {
  return one<Company>("SELECT * FROM companies WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
}

/** Find a company by domain or name, creating it if it doesn't exist. Returns its id. */
export async function upsertCompany(
  workspaceId: string,
  c: { name: string; domain?: string | null } & Partial<Omit<Company, "id" | "workspace_id" | "name" | "domain">>,
): Promise<string> {
  const domain = normalizeDomain(c.domain);
  const existing = domain
    ? await one<{ id: string }>("SELECT id FROM companies WHERE workspace_id = ? AND domain = ?", [workspaceId, domain])
    : await one<{ id: string }>("SELECT id FROM companies WHERE workspace_id = ? AND lower(name) = lower(?)", [workspaceId, c.name]);
  if (existing) return existing.id;
  return insert("companies", {
    workspace_id: workspaceId,
    name: c.name,
    domain,
    website: c.website ?? (domain ? `https://${domain}` : null),
    linkedin_url: c.linkedin_url ?? null,
    industry: c.industry ?? null,
    size: c.size ?? null,
    location: c.location ?? null,
    description: c.description ?? null,
    funding: c.funding ?? null,
  });
}

export function normalizeDomain(d?: string | null): string | null {
  if (!d) return null;
  const s = d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
  return s && s.includes(".") ? s : null;
}

/**
 * A compact, prompt-ready description of a contact, their company and recent history.
 * Used to personalize AI-written messages, call scripts and insights.
 */
export async function contactBrief(workspaceId: string, contactId: string): Promise<string> {
  const c = await getContact(workspaceId, contactId);
  if (!c) return "";
  const co = c.company_id ? await getCompany(workspaceId, c.company_id) : null;
  const acts = await all<Activity>(
    "SELECT type, title, body, created_at FROM activities WHERE workspace_id = ? AND contact_id = ? ORDER BY created_at DESC LIMIT 8",
    [workspaceId, contactId],
  );
  const signals = c.company_id
    ? await all<{ type: string; title: string }>(
        "SELECT type, title FROM signals WHERE workspace_id = ? AND company_id = ? ORDER BY created_at DESC LIMIT 5",
        [workspaceId, c.company_id],
      )
    : [];
  const enrich = parseJson<Record<string, unknown>>(c.enrichment_json, {});
  const coEnrich = parseJson<Record<string, unknown>>(co?.enrichment_json, {});
  return [
    `Prospect: ${[c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown"}${c.title ? `, ${c.title}` : ""}`,
    c.location && `Location: ${c.location}`,
    c.seniority && `Seniority: ${c.seniority}`,
    Object.keys(enrich).length ? `Prospect research: ${JSON.stringify(enrich).slice(0, 1200)}` : null,
    co && `Company: ${co.name}${co.domain ? ` (${co.domain})` : ""}`,
    co?.industry && `Industry: ${co.industry}`,
    co?.size && `Company size: ${co.size}`,
    co?.description && `About the company: ${co.description}`,
    co?.funding && `Funding: ${co.funding}`,
    Object.keys(coEnrich).length ? `Company research: ${JSON.stringify(coEnrich).slice(0, 1500)}` : null,
    signals.length ? `Recent buying signals: ${signals.map((s) => `[${s.type}] ${s.title}`).join("; ")}` : null,
    acts.length ? `Recent history (newest first):\n${acts.map((a) => `- ${a.created_at} ${a.type}: ${a.title}${a.body ? ` — ${a.body.slice(0, 200)}` : ""}`).join("\n")}` : null,
    c.notes && `Notes: ${c.notes}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Fill {{first_name}}-style merge fields in a template. */
export function renderTemplate(tpl: string, c: Partial<Contact> & { company_name?: string | null }, sender?: { sender_name?: string | null }) {
  const vars: Record<string, string> = {
    first_name: c.first_name || "there",
    last_name: c.last_name || "",
    full_name: [c.first_name, c.last_name].filter(Boolean).join(" "),
    title: c.title || "",
    company: c.company_name || "your company",
    company_name: c.company_name || "your company",
    sender_name: sender?.sender_name || "",
  };
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

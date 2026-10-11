import "server-only";
import { createClient, type Client, type InValue } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";

/**
 * Database layer. Uses libSQL: a local SQLite file by default, or a hosted
 * Turso database when DATABASE_URL is a libsql:// URL (needed on serverless hosts).
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT, company_website TEXT,
  product_description TEXT, value_prop TEXT,
  icp_json TEXT,
  sender_name TEXT, sender_email TEXT, signature TEXT,
  smtp_json TEXT,
  gemini_api_key TEXT,
  credits INTEGER NOT NULL DEFAULT 2000,
  plan TEXT NOT NULL DEFAULT 'free',
  tracking_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT, website TEXT, linkedin_url TEXT,
  industry TEXT, size TEXT, location TEXT, description TEXT,
  funding TEXT, tech_json TEXT, enrichment_json TEXT,
  score INTEGER, score_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_companies_ws ON companies(workspace_id);
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT,
  first_name TEXT, last_name TEXT, title TEXT,
  email TEXT, email_status TEXT NOT NULL DEFAULT 'unknown',
  phone TEXT, linkedin_url TEXT, location TEXT,
  seniority TEXT, department TEXT,
  source TEXT, score INTEGER, score_reason TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  tags TEXT, notes TEXT, enrichment_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_ws ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS list_members (
  list_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  PRIMARY KEY (list_id, contact_id)
);
CREATE TABLE IF NOT EXISTS sequences (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sequence_steps (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject TEXT, body TEXT,
  ai_personalize INTEGER NOT NULL DEFAULT 1,
  instructions TEXT
);
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  contact_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_step INTEGER NOT NULL DEFAULT 0,
  next_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (sequence_id, contact_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  contact_id TEXT,
  enrollment_id TEXT, step_id TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  direction TEXT NOT NULL DEFAULT 'out',
  subject TEXT, body TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sentiment TEXT,
  thread_id TEXT,
  opened_at TEXT, sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_ws ON messages(workspace_id);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  contact_id TEXT, enrollment_id TEXT, step_id TEXT,
  type TEXT NOT NULL DEFAULT 'todo',
  title TEXT NOT NULL, body TEXT,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  contact_id TEXT,
  outcome TEXT, duration_sec INTEGER,
  notes TEXT, summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT, contact_id TEXT,
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'lead',
  value REAL NOT NULL DEFAULT 0,
  probability INTEGER,
  close_date TEXT,
  notes TEXT, ai_insight TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  contact_id TEXT, company_id TEXT, deal_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activities_ws ON activities(workspace_id);
CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT, contact_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT, url TEXT,
  score INTEGER,
  seen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  visitor_id TEXT,
  contact_id TEXT, company_id TEXT,
  url TEXT, title TEXT, referrer TEXT,
  ip TEXT, org TEXT, city TEXT, country TEXT, user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS agent_threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

const globalForDb = globalThis as unknown as { __db?: Client; __dbReady?: Promise<void> };

function client(): Client {
  if (!globalForDb.__db) {
    const url = process.env.DATABASE_URL || "file:./data/comuno.db";
    if (url.startsWith("file:")) mkdirSync("./data", { recursive: true });
    globalForDb.__db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  }
  return globalForDb.__db;
}

async function ready(): Promise<Client> {
  const c = client();
  if (!globalForDb.__dbReady) {
    globalForDb.__dbReady = c.executeMultiple(SCHEMA).catch((e) => {
      globalForDb.__dbReady = undefined;
      throw e;
    });
  }
  await globalForDb.__dbReady;
  return c;
}

export type Row = Record<string, unknown>;
type Args = InValue[] | Record<string, InValue>;

function clean(args?: Args): Args {
  if (!args) return [];
  if (Array.isArray(args)) return args.map((v) => (v === undefined ? null : v));
  return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, v === undefined ? null : v]));
}

/** Run a query and return all rows as plain objects. */
export async function all<T = Row>(sql: string, args?: Args): Promise<T[]> {
  const c = await ready();
  const res = await c.execute({ sql, args: clean(args) });
  return res.rows.map((r) => ({ ...r })) as T[];
}

/** Run a query and return the first row, or null. */
export async function one<T = Row>(sql: string, args?: Args): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

/** Run a write statement. Returns the number of affected rows. */
export async function run(sql: string, args?: Args): Promise<number> {
  const c = await ready();
  const res = await c.execute({ sql, args: clean(args) });
  return res.rowsAffected;
}

/** Insert a row from an object. Generates an id when absent. Returns the id. */
export async function insert(table: string, data: Record<string, InValue | undefined>): Promise<string> {
  const row = { id: newId(), ...data } as Record<string, InValue | undefined>;
  const keys = Object.keys(row).filter((k) => row[k] !== undefined);
  await run(
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    keys.map((k) => row[k] as InValue),
  );
  return row.id as string;
}

/** Update a row by id, scoped to a workspace when the table has workspace_id. */
export async function update(
  table: string,
  id: string,
  data: Record<string, InValue | undefined>,
  workspaceId?: string,
): Promise<number> {
  const keys = Object.keys(data).filter((k) => data[k] !== undefined && k !== "id" && k !== "workspace_id");
  if (!keys.length) return 0;
  const sets = keys.map((k) => `${k} = ?`);
  const hasUpdatedAt = ["companies", "contacts", "deals"].includes(table);
  if (hasUpdatedAt && !keys.includes("updated_at")) sets.push("updated_at = datetime('now')");
  const args = keys.map((k) => data[k] as InValue);
  let sql = `UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`;
  args.push(id);
  if (workspaceId) {
    sql += " AND workspace_id = ?";
    args.push(workspaceId);
  }
  return run(sql, args);
}

export function newId(): string {
  return randomUUID().replace(/-/g, "").slice(0, 20);
}

/** Parse a JSON column safely. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

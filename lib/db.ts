import "server-only";
import { Pool, types, type PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import { SCHEMA } from "./schema";

/**
 * Database layer: Postgres (Supabase) via node-postgres, connected server-side
 * with DATABASE_URL. Queries are written with `?` (or `:name`) placeholders;
 * `toPg()` converts them, plus a few portable idioms, to Postgres SQL:
 *
 *   ?, :name             → $1, $2 …            (`? IS [NOT] NULL` gets an explicit ::text type)
 *   datetime(v[, mod])   → sqlite_datetime(…)  (UTC 'YYYY-MM-DD HH:MM:SS' text; see schema.ts)
 *   date(v[, mod])       → sqlite_date(…)
 *   LIKE                 → ILIKE               (case-insensitive search)
 *   GROUP_CONCAT(x, sep) → string_agg(x, sep)
 *   INSERT OR IGNORE     → INSERT … ON CONFLICT DO NOTHING
 *   rowid                → seq                 (BIGSERIAL insertion order)
 */

export type InValue = string | number | bigint | boolean | null | Uint8Array;
export type Row = Record<string, unknown>;
type Args = InValue[] | Record<string, InValue>;

// Return COUNT/SUM (int8) and numeric aggregates as JS numbers, not strings.
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1700, (v) => parseFloat(v));

const globalForDb = globalThis as unknown as { __pg?: Pool; __pgReady?: Promise<void> };

function pool(): Pool {
  if (!globalForDb.__pg) {
    const url = process.env.DATABASE_URL;
    if (!url || !/^postgres(ql)?:\/\//.test(url)) {
      throw new Error(
        "DATABASE_URL is not set. Use your Supabase connection string (Project → Connect → Transaction pooler).",
      );
    }
    const parsed = new URL(url);
    const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
    // Supabase requires TLS. Its certificate chain isn't in Node's default store, so verify
    // only when DATABASE_SSL=verify (and provide the CA via NODE_EXTRA_CA_CERTS).
    parsed.searchParams.delete("sslmode");
    const ssl =
      local || process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: process.env.DATABASE_SSL === "verify" };
    globalForDb.__pg = new Pool({
      connectionString: parsed.toString(),
      ssl,
      max: Number(process.env.DATABASE_POOL_MAX) || 5,
      idleTimeoutMillis: 10_000,
    });
  }
  return globalForDb.__pg;
}

async function ready(): Promise<Pool> {
  const p = pool();
  if (!globalForDb.__pgReady) {
    globalForDb.__pgReady = migrate(p).catch((e) => {
      globalForDb.__pgReady = undefined;
      throw e;
    });
  }
  await globalForDb.__pgReady;
  return p;
}

/** Apply the schema once per process, serialized across instances with an advisory lock. */
async function migrate(p: Pool) {
  let c: PoolClient | undefined;
  try {
    c = await p.connect();
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(724113)");
    await c.query(SCHEMA);
    await c.query("COMMIT");
  } catch (e) {
    await c?.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c?.release();
  }
}

const cache = new Map<string, { text: string; names: string[] | null }>();

/** Convert portable SQL (see header) to Postgres. Exported for tests. */
export function toPg(sql: string, named: boolean): { text: string; names: string[] | null } {
  const key = `${named ? "n" : "p"}:${sql}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let s = sql;
  const ignore = /^\s*INSERT\s+OR\s+IGNORE\s+/i.test(s);
  if (ignore) s = s.replace(/^\s*INSERT\s+OR\s+IGNORE\s+/i, "INSERT ").replace(/;?\s*$/, " ON CONFLICT DO NOTHING");
  s = s
    .replace(/\bdatetime\s*\(/gi, "sqlite_datetime(")
    .replace(/\bdate\s*\(/gi, "sqlite_date(")
    .replace(/\bGROUP_CONCAT\s*\(/gi, "string_agg(")
    .replace(/\browid\b/gi, "seq")
    .replace(/(?<!\bI)\bLIKE\b/g, "ILIKE")
    .replace(/(?<!\bI)\blike\b/g, "ILIKE");

  // Placeholders, skipping quoted literals/identifiers and :: casts.
  let out = "";
  let n = 0;
  const names: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "'" || ch === '"') {
      const end = s.indexOf(ch, i + 1);
      const j = end < 0 ? s.length : end;
      out += s.slice(i, j + 1);
      i = j;
      continue;
    }
    let ph: string | null = null;
    if (!named && ch === "?") ph = `$${++n}`;
    else if (named && ch === ":" && s[i - 1] !== ":" && s[i + 1] !== ":" && /[A-Za-z_]/.test(s[i + 1] || "")) {
      const m = /^[A-Za-z_]\w*/.exec(s.slice(i + 1))!;
      let idx = names.indexOf(m[0]);
      if (idx < 0) idx = names.push(m[0]) - 1;
      ph = `$${idx + 1}`;
      i += m[0].length;
    }
    if (ph) {
      // A bare parameter tested for NULL has no inferable type in Postgres.
      if (/^\s+IS\s+(NOT\s+)?NULL\b/i.test(s.slice(i + 1))) ph += "::text";
      out += ph;
    } else out += ch;
  }
  const res = { text: out, names: named ? names : null };
  if (cache.size > 2000) cache.clear();
  cache.set(key, res);
  return res;
}

function normalize(v: InValue | undefined): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0; // columns are INTEGER flags
  if (typeof v === "bigint") return v.toString();
  return v;
}

async function exec(sql: string, args?: Args) {
  const p = await ready();
  const named = !!args && !Array.isArray(args);
  const { text, names } = toPg(sql, named);
  const values = named
    ? names!.map((k) => normalize((args as Record<string, InValue>)[k]))
    : ((args as InValue[] | undefined) || []).map(normalize);
  try {
    return await p.query(text, values);
  } catch (e) {
    const err = e as Error & { position?: string };
    err.message = `${err.message} [SQL: ${text.replace(/\s+/g, " ").slice(0, 300)}]`;
    throw err;
  }
}

/** Run a query and return all rows as plain objects. */
export async function all<T = Row>(sql: string, args?: Args): Promise<T[]> {
  return (await exec(sql, args)).rows as T[];
}

/** Run a query and return the first row, or null. */
export async function one<T = Row>(sql: string, args?: Args): Promise<T | null> {
  const rows = await all<T>(sql, args);
  return rows[0] ?? null;
}

/** Run a write statement. Returns the number of affected rows. */
export async function run(sql: string, args?: Args): Promise<number> {
  return (await exec(sql, args)).rowCount ?? 0;
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

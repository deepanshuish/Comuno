import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { insert, one, run, newId } from "./db";
import type { User, Workspace } from "./types";

const scrypt = promisify(_scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "comuno_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const hash = await scrypt(password, salt, 64);
  const expected = Buffer.from(hex, "hex");
  return expected.length === hash.length && timingSafeEqual(expected, hash);
}

export async function createUser(input: { email: string; password: string; name?: string; company?: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await one("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) throw new HttpError(409, "An account with this email already exists");
  const workspaceId = await insert("workspaces", {
    name: input.company || `${input.name || email.split("@")[0]}'s workspace`,
    company_name: input.company || null,
    sender_name: input.name || null,
    sender_email: email,
    tracking_key: randomBytes(9).toString("base64url"),
  });
  await insert("credit_ledger", { workspace_id: workspaceId, amount: 2000, reason: "Free plan credits" });
  const userId = await insert("users", {
    workspace_id: workspaceId,
    email,
    name: input.name || null,
    password_hash: await hashPassword(input.password),
  });
  return userId;
}

export async function startSession(userId: string) {
  const id = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await insert("sessions", { id: sha256(id), user_id: userId, expires_at: expires.toISOString() });
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await run("DELETE FROM sessions WHERE id = ?", [sha256(token)]);
  store.delete(SESSION_COOKIE);
}

export type Ctx = { user: User; workspace: Workspace };

/** Resolve the signed-in user from the session cookie or an API key (Authorization: Bearer). */
export async function getCtx(): Promise<Ctx | null> {
  const h = await headers();
  const auth = h.get("authorization");
  if (auth?.startsWith("Bearer ")) return ctxFromApiKey(auth.slice(7).trim());

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<{ user_id: string; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE id = ?",
    [sha256(token)],
  );
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return loadCtx(row.user_id);
}

async function loadCtx(userId: string): Promise<Ctx | null> {
  const user = await one<User>("SELECT id, workspace_id, email, name, role, created_at FROM users WHERE id = ?", [userId]);
  if (!user) return null;
  const workspace = await one<Workspace>("SELECT * FROM workspaces WHERE id = ?", [user.workspace_id]);
  if (!workspace) return null;
  return { user, workspace };
}

async function ctxFromApiKey(key: string): Promise<Ctx | null> {
  const row = await one<{ id: string; workspace_id: string }>(
    "SELECT id, workspace_id FROM api_keys WHERE key_hash = ?",
    [sha256(key)],
  );
  if (!row) return null;
  await run("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?", [row.id]);
  const owner = await one<{ id: string }>(
    "SELECT id FROM users WHERE workspace_id = ? ORDER BY created_at LIMIT 1",
    [row.workspace_id],
  );
  return owner ? loadCtx(owner.id) : null;
}

/** For server components/pages: redirect to /login when signed out. */
export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

/** For route handlers: throw a 401 HttpError when signed out. */
export async function requireApiCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) throw new HttpError(401, "Not signed in");
  return ctx;
}

export async function createApiKey(workspaceId: string, name: string) {
  const key = `cmn_${randomBytes(24).toString("base64url")}`;
  const id = newId();
  await insert("api_keys", { id, workspace_id: workspaceId, name, prefix: key.slice(0, 10), key_hash: sha256(key) });
  return { id, key };
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

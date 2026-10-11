import "server-only";
import { HttpError } from "./auth";
import { insert, run } from "./db";
import type { Workspace } from "./types";

/** Credit cost of each billable action. */
export const CREDIT_COSTS = {
  ai_generate: 1, // email draft, reply, summary, classification
  ai_score: 1, // ICP fit scoring, per record
  enrich_company: 5,
  enrich_contact: 5,
  find_email: 2,
  verify_email: 1,
  prospect_search: 10, // AI prospect discovery (search-grounded)
  research: 10, // market/account research (search-grounded)
  signals_refresh: 5, // per company
  agent_turn: 2,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

/**
 * Deduct credits for an action, throwing 402 if the workspace can't afford it.
 * Call before doing the paid work.
 */
export async function charge(ws: Workspace, action: CreditAction, units = 1, note?: string) {
  const cost = CREDIT_COSTS[action] * units;
  const changed = await run("UPDATE workspaces SET credits = credits - ? WHERE id = ? AND credits >= ?", [
    cost,
    ws.id,
    cost,
  ]);
  if (!changed) throw new HttpError(402, `Not enough credits (needs ${cost}). Upgrade your plan in Settings → Billing.`);
  ws.credits -= cost;
  await insert("credit_ledger", { workspace_id: ws.id, amount: -cost, reason: note || action });
}

/** Refund credits, e.g. when an AI call fails after charging. */
export async function refund(ws: Workspace, action: CreditAction, units = 1) {
  const cost = CREDIT_COSTS[action] * units;
  await run("UPDATE workspaces SET credits = credits + ? WHERE id = ?", [cost, ws.id]);
  ws.credits += cost;
  await insert("credit_ledger", { workspace_id: ws.id, amount: cost, reason: `refund: ${action}` });
}

/** Charge, run `fn`, and refund if it throws. */
export async function withCredits<T>(ws: Workspace, action: CreditAction, units: number, fn: () => Promise<T>) {
  await charge(ws, action, units);
  try {
    return await fn();
  } catch (e) {
    await refund(ws, action, units);
    throw e;
  }
}

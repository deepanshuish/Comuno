import "server-only";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import { HttpError, type Ctx } from "../auth";
import { charge, refund } from "../credits";
import { all, insert, one, parseJson, run, update } from "../db";
import { DEFAULT_MODEL, generateWithTools, sellerContext } from "../gemini";
import { AGENT_TOOLS, TOOLS_BY_NAME, runTool } from "./agent-tools";

/**
 * Comuno Agent runtime: a Gemini function-calling loop over the platform's tools.
 *
 * Thread history is stored as raw Gemini `Content` objects (role "user" / "model"),
 * which preserves thought signatures required by newer Gemini models.
 * Outward-facing tools (send email, enroll in sequence) are not executed by the
 * model: they're stored as "approval" rows that the user approves in the UI.
 */

const AGENT_MODEL = process.env.GEMINI_AGENT_MODEL || DEFAULT_MODEL;
const MAX_STEPS = 10;

export type AgentEvent =
  | { kind: "thread"; threadId: string; title: string }
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { kind: "tool_result"; id: string; name: string; ok: boolean; result?: unknown; error?: string }
  | { kind: "approval"; id: string; tool: string; args: Record<string, unknown>; status: "pending" | "approved" | "rejected"; result?: unknown; error?: string }
  | { kind: "error"; id: string; text: string }
  | { kind: "done"; threadId: string };

type ApprovalRow = { tool: string; args: Record<string, unknown>; status: "pending" | "approved" | "rejected"; result?: unknown; error?: string };

const declarations: FunctionDeclaration[] = AGENT_TOOLS.map((t) => ({
  name: t.name,
  description: t.approval ? `${t.description} (Queued for the user's approval in the UI.)` : t.description,
  parametersJsonSchema: t.parameters,
}));

function systemPrompt(ctx: Ctx) {
  return `You are the Comuno Agent, an AI sales teammate inside Comuno, an outbound sales platform.
You help the user prospect, research, engage and manage pipeline by calling tools. Today is ${new Date().toISOString().slice(0, 10)}.

${sellerContext(ctx.workspace)}

How to work:
- Take action with tools rather than describing what you would do. Chain tools when needed (e.g. find prospects → save → find emails → draft emails).
- Never invent people, companies, emails or facts. Only report what tools return. If a tool fails, explain briefly and suggest a fix.
- Use record ids returned by tools when calling other tools. Look things up with search tools when you need an id.
- send_email and enroll_in_sequence are queued for the user to approve; tell the user they're waiting for approval in the chat.
- Credits are consumed by AI and data tools; for large batches (more than 25 records) confirm with the user first.
- Write concise answers in Markdown. Use tables for lists of people or companies (name, title, company, and anything relevant). Include source links for web research.
- If the seller profile is missing, suggest filling in Settings → Company profile for better personalization.`;
}

export async function listThreads(ctx: Ctx) {
  return all<{ id: string; title: string | null; created_at: string }>(
    "SELECT id, title, created_at FROM agent_threads WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 50",
    [ctx.workspace.id, ctx.user.id],
  );
}

async function getThread(ctx: Ctx, threadId: string) {
  const t = await one<{ id: string; title: string }>(
    "SELECT id, title FROM agent_threads WHERE id = ? AND workspace_id = ? AND user_id = ?",
    [threadId, ctx.workspace.id, ctx.user.id],
  );
  if (!t) throw new HttpError(404, "Conversation not found");
  return t;
}

export async function deleteThread(ctx: Ctx, threadId: string) {
  await getThread(ctx, threadId);
  await run("DELETE FROM agent_messages WHERE thread_id = ?", [threadId]);
  await run("DELETE FROM agent_threads WHERE id = ?", [threadId]);
}

/** Thread history converted to display events for the UI. */
export async function threadEvents(ctx: Ctx, threadId: string): Promise<AgentEvent[]> {
  await getThread(ctx, threadId);
  const rows = await all<{ id: string; role: string; content_json: string }>(
    "SELECT id, role, content_json FROM agent_messages WHERE thread_id = ? ORDER BY created_at, rowid",
    [threadId],
  );
  return rows.flatMap((r) => rowToEvents(r.id, r.role, r.content_json));
}

function rowToEvents(id: string, role: string, json: string): AgentEvent[] {
  if (role === "approval") {
    const a = parseJson<ApprovalRow | null>(json, null);
    return a ? [{ kind: "approval", id, ...a }] : [];
  }
  if (role === "error") return [{ kind: "error", id, text: parseJson<{ text: string }>(json, { text: "" }).text }];
  const content = parseJson<Content | null>(json, null);
  if (!content?.parts) return [];
  const events: AgentEvent[] = [];
  content.parts.forEach((p, i) => {
    const pid = `${id}:${i}`;
    if (p.functionCall) events.push({ kind: "tool_call", id: pid, name: p.functionCall.name || "", args: (p.functionCall.args as Record<string, unknown>) || {} });
    else if (p.functionResponse) {
      const r = (p.functionResponse.response || {}) as { ok?: boolean; result?: unknown; error?: string; status?: string };
      if (r.status === "pending_user_approval") return;
      events.push({ kind: "tool_result", id: pid, name: p.functionResponse.name || "", ok: r.ok !== false, result: r.result, error: r.error });
    } else if (p.text && !p.thought) {
      if (role === "note") return;
      events.push({ kind: content.role === "model" ? "assistant" : "user", id: pid, text: p.text });
    }
  });
  return events;
}

async function save(threadId: string, role: string, content: unknown) {
  return insert("agent_messages", { thread_id: threadId, role, content_json: JSON.stringify(content) });
}

/**
 * Run one user turn. Streams display events through `emit` as they happen.
 */
export async function runAgentTurn(ctx: Ctx, input: { threadId?: string; message: string }, emit: (e: AgentEvent) => void): Promise<string> {
  const message = input.message.trim();
  if (!message) throw new HttpError(400, "Message is empty");

  let threadId = input.threadId;
  if (threadId) await getThread(ctx, threadId);
  else {
    const title = message.length > 60 ? `${message.slice(0, 57)}…` : message;
    threadId = await insert("agent_threads", { workspace_id: ctx.workspace.id, user_id: ctx.user.id, title });
    emit({ kind: "thread", threadId, title });
  }

  const userContent: Content = { role: "user", parts: [{ text: message }] };
  const uid = await save(threadId, "user", userContent);
  emit({ kind: "user", id: `${uid}:0`, text: message });

  for (let step = 0; step < MAX_STEPS; step++) {
    const history = await modelHistory(threadId);
    await charge(ctx.workspace, "agent_turn", 1, "agent");
    let res;
    try {
      res = await generateWithTools({ workspace: ctx.workspace, model: AGENT_MODEL, system: systemPrompt(ctx), contents: history, functions: declarations });
    } catch (e) {
      await refund(ctx.workspace, "agent_turn", 1);
      throw e;
    }

    const content = res.candidates?.[0]?.content;
    if (!content?.parts?.length) {
      const id = await save(threadId, "error", { text: "The model returned an empty response. Try rephrasing." });
      emit({ kind: "error", id, text: "The model returned an empty response. Try rephrasing." });
      break;
    }
    const modelContent: Content = { role: "model", parts: content.parts };
    const mid = await save(threadId, "model", modelContent);
    for (const e of rowToEvents(mid, "model", JSON.stringify(modelContent))) emit(e);

    const calls = content.parts.filter((p) => p.functionCall);
    if (!calls.length) break;

    const responses: Part[] = [];
    for (const p of calls) {
      const call = p.functionCall!;
      const name = call.name || "";
      const args = (call.args as Record<string, unknown>) || {};
      const tool = TOOLS_BY_NAME.get(name);
      if (tool?.approval) {
        const approval: ApprovalRow = { tool: name, args, status: "pending" };
        const aid = await save(threadId, "approval", approval);
        emit({ kind: "approval", id: aid, ...approval });
        responses.push({ functionResponse: { id: call.id, name, response: { status: "pending_user_approval", approval_id: aid } } });
      } else {
        const out = await runTool(ctx, name, args);
        responses.push({ functionResponse: { id: call.id, name, response: out } });
      }
    }
    const toolContent: Content = { role: "user", parts: responses };
    const tid = await save(threadId, "tool", toolContent);
    for (const e of rowToEvents(tid, "tool", JSON.stringify(toolContent))) emit(e);

    if (step === MAX_STEPS - 1) {
      const id = await save(threadId, "error", { text: "Stopped after the maximum number of steps. Ask me to continue if needed." });
      emit({ kind: "error", id, text: "Stopped after the maximum number of steps. Ask me to continue if needed." });
    }
  }
  return threadId;
}

/** Content sent to Gemini: user/model/tool rows and approval notes, in order. */
async function modelHistory(threadId: string): Promise<Content[]> {
  const rows = await all<{ role: string; content_json: string }>(
    "SELECT role, content_json FROM agent_messages WHERE thread_id = ? AND role IN ('user','model','tool','note') ORDER BY created_at, rowid",
    [threadId],
  );
  const contents = rows.map((r) => parseJson<Content>(r.content_json, { role: "user", parts: [] }));
  // Gemini requires alternating turns; merge consecutive same-role contents.
  const merged: Content[] = [];
  for (const c of contents) {
    const last = merged[merged.length - 1];
    if (last && last.role === c.role) last.parts = [...(last.parts || []), ...(c.parts || [])];
    else merged.push({ role: c.role, parts: [...(c.parts || [])] });
  }
  return merged;
}

/** Approve or reject a queued outward-facing action. */
export async function resolveApproval(ctx: Ctx, approvalId: string, decision: "approve" | "reject") {
  const row = await one<{ id: string; thread_id: string; content_json: string }>(
    `SELECT m.id, m.thread_id, m.content_json FROM agent_messages m JOIN agent_threads t ON t.id = m.thread_id
     WHERE m.id = ? AND m.role = 'approval' AND t.workspace_id = ? AND t.user_id = ?`,
    [approvalId, ctx.workspace.id, ctx.user.id],
  );
  if (!row) throw new HttpError(404, "Approval not found");
  const a = parseJson<ApprovalRow>(row.content_json, { tool: "", args: {}, status: "pending" });
  if (a.status !== "pending") throw new HttpError(409, `Already ${a.status}`);

  let resolved: ApprovalRow;
  if (decision === "approve") {
    const out = await runTool(ctx, a.tool, a.args);
    resolved = { ...a, status: "approved", result: out.result, error: out.error };
  } else {
    resolved = { ...a, status: "rejected" };
  }
  await update("agent_messages", row.id, { content_json: JSON.stringify(resolved) });
  // Tell the model what happened on its next turn.
  const note =
    resolved.status === "approved"
      ? `[The user approved ${a.tool}. Result: ${JSON.stringify(resolved.error ? { error: resolved.error } : resolved.result).slice(0, 800)}]`
      : `[The user rejected ${a.tool}; do not retry it unless asked.]`;
  await save(row.thread_id, "note", { role: "user", parts: [{ text: note }] });
  return { id: row.id, ...resolved };
}

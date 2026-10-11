import "server-only";
import { HttpError } from "../auth";
import { withCredits } from "../credits";
import { all, insert, newId, one, run, update } from "../db";
import { generateJSON, generateText, geminiClient, sellerContext } from "../gemini";
import { deliver, MailError, mailerStatus, plainWithSignature, renderEmailHtml } from "../mailer";
import type { Contact, Enrollment, Message, Sequence, SequenceStep, StepType, Task, Workspace } from "../types";
import type {
  CallOutcome, CallRow, EngageMessage, EngageStats, EnrollmentRow, InboxCounts, InboxThread, PickerContact,
  QueueContact, Sentiment, SequenceDetail, SequenceSummary, TaskRow, ThreadDetail,
} from "@/components/engage/types";
import { contactBrief, getContact, logActivity, renderTemplate } from "./core";

/**
 * Engage: multi-channel sequences, the execution engine, email sending, unified inbox,
 * power dialer and tasks. Route handlers under app/api/{sequences,messages,inbox,tasks,calls,dialer,cron,t}
 * are thin wrappers around these functions; the Agent calls them directly.
 *
 * Scheduling: `processDue()` executes every enrollment whose `next_run_at` has passed.
 * Point an external scheduler (cron-job.org, GitHub Actions, Vercel/Render cron, crontab + curl)
 * at `POST /api/cron/process` with `Authorization: Bearer $CRON_SECRET` every 5–10 minutes.
 * Users can also hit "Run now" in the UI, which processes their own workspace.
 */

/* ------------------------------------------------------------------ */
/* Schema additions (guarded, idempotent)                              */
/* ------------------------------------------------------------------ */

const g = globalThis as unknown as { __engageSchema?: Promise<void> };

/** Adds Engage's delivery columns to `messages` on existing databases. Safe to call repeatedly. */
export async function ensureEngageSchema() {
  if (!g.__engageSchema) {
    g.__engageSchema = (async () => {
      const stmts = [
        "ALTER TABLE messages ADD COLUMN delivery TEXT",
        "ALTER TABLE messages ADD COLUMN error TEXT",
        "ALTER TABLE messages ADD COLUMN clicked_at TEXT",
        "ALTER TABLE messages ADD COLUMN provider_id TEXT",
        "ALTER TABLE messages ADD COLUMN to_email TEXT",
        "ALTER TABLE messages ADD COLUMN from_email TEXT",
        "CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id)",
        "CREATE INDEX IF NOT EXISTS idx_enrollments_due ON enrollments(status, next_run_at)",
        "CREATE INDEX IF NOT EXISTS idx_tasks_ws_status ON tasks(workspace_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id)",
      ];
      for (const sql of stmts) {
        try {
          await run(sql);
        } catch (e) {
          if (!/duplicate column/i.test((e as Error).message)) throw e;
        }
      }
    })().catch((e) => {
      g.__engageSchema = undefined;
      throw e;
    });
  }
  await g.__engageSchema;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** SQLite-style UTC timestamp ("YYYY-MM-DD HH:MM:SS"), comparable with datetime('now'). */
export function sqlTime(d: Date = new Date()) {
  return d.toISOString().slice(0, 19).replace("T", " ");
}
const inDays = (days: number, from = Date.now()) => sqlTime(new Date(from + days * 864e5));
const inMinutes = (min: number) => sqlTime(new Date(Date.now() + min * 6e4));

const name = (c: { first_name?: string | null; last_name?: string | null; email?: string | null }) =>
  [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "this prospect";

const STEP_TYPES: StepType[] = ["email", "linkedin_connect", "linkedin_message", "call", "task"];
const SENTIMENTS: Sentiment[] = ["interested", "not_interested", "objection", "ooo", "referral", "neutral"];
const STOP_STATUSES = ["replied", "interested", "not_interested", "bounced", "customer"];

/** Throws the clean 503 "Gemini is not configured" error before any credits are charged. */
function requireAI(ws: Workspace) {
  geminiClient(ws);
}

async function aiCall<T>(ws: Workspace, fn: () => Promise<T>): Promise<T> {
  requireAI(ws);
  return withCredits(ws, "ai_generate", 1, fn);
}

async function loadWorkspace(id: string) {
  return one<Workspace>("SELECT * FROM workspaces WHERE id = ?", [id]);
}

async function requireContact(workspaceId: string, contactId: string) {
  const c = await getContact(workspaceId, contactId);
  if (!c) throw new HttpError(404, "Contact not found");
  return c;
}

function cleanStep(s: Partial<SequenceStep>, position: number): Omit<SequenceStep, "id" | "sequence_id"> {
  const type = STEP_TYPES.includes(s.type as StepType) ? (s.type as StepType) : "email";
  return {
    position,
    type,
    delay_days: Math.max(0, Math.min(90, Math.round(Number(s.delay_days) || 0))),
    subject: type === "email" || type === "task" ? (s.subject ?? "").toString().slice(0, 300) || null : null,
    body: (s.body ?? "").toString().slice(0, 10_000) || null,
    ai_personalize: s.ai_personalize ? 1 : 0,
    instructions: (s.instructions ?? "").toString().slice(0, 2000) || null,
  };
}

const EMAIL_RULES = `Writing rules:
- Plain text only. No markdown, no bullet symbols unless natural, no placeholders like [Name] or {{...}}.
- Short: 60–130 words for a first touch, 30–80 for follow-ups. One clear, low-friction call to action.
- Specific to the prospect: reference their role, company, or a real signal from the context. Never invent facts that aren't in the context.
- Sound like a thoughtful human, not marketing copy. No "I hope this email finds you well".
- End with a short sign-off using only the sender's first name (a full signature is appended automatically).`;

/* ------------------------------------------------------------------ */
/* AI writing                                                          */
/* ------------------------------------------------------------------ */

const EMAIL_SCHEMA = {
  type: "object",
  properties: { subject: { type: "string" }, body: { type: "string" } },
  required: ["subject", "body"],
};

export async function draftEmail(
  ws: Workspace,
  input: { contactId: string; goal?: string; instructions?: string },
): Promise<{ subject: string; body: string }> {
  requireAI(ws);
  const c = await requireContact(ws.id, input.contactId);
  const brief = await contactBrief(ws.id, c.id);
  const history = await threadHistory(ws.id, c.id, 6);
  return aiCall(ws, async () => {
    const { data } = await generateJSON<{ subject: string; body: string }>({
      workspace: ws,
      schema: EMAIL_SCHEMA,
      temperature: 0.7,
      system: `You are an elite B2B sales development rep writing a cold or follow-up email.\n${EMAIL_RULES}\nSubject: 2–6 words, lowercase-ish, no clickbait.`,
      prompt: [
        sellerContext(ws),
        `\nProspect context:\n${brief}`,
        history ? `\nPrevious conversation (oldest first):\n${history}` : "",
        `\nGoal of this email: ${input.goal?.trim() || "Start a conversation and book a short intro call."}`,
        input.instructions?.trim() ? `Extra instructions: ${input.instructions.trim()}` : "",
      ].join("\n"),
    });
    return { subject: (data.subject || "").trim(), body: (data.body || "").trim() };
  });
}

export async function generateSequence(
  ws: Workspace,
  input: { goal: string; steps?: number; channels?: StepType[]; tone?: string },
): Promise<{ name: string; steps: Omit<SequenceStep, "id" | "sequence_id">[] }> {
  if (!input.goal?.trim()) throw new HttpError(400, "Describe the goal of the sequence");
  requireAI(ws);
  const count = Math.max(2, Math.min(12, Math.round(input.steps || 6)));
  const channels = (input.channels?.length ? input.channels : (["email", "linkedin_connect", "call"] as StepType[])).filter((c) =>
    STEP_TYPES.includes(c),
  );
  return aiCall(ws, async () => {
    const { data } = await generateJSON<{ name: string; steps: (Partial<Omit<SequenceStep, "ai_personalize">> & { ai_personalize?: boolean })[] }>({
      workspace: ws,
      temperature: 0.7,
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: channels },
                delay_days: { type: "integer" },
                subject: { type: "string" },
                body: { type: "string" },
                ai_personalize: { type: "boolean" },
                instructions: { type: "string" },
              },
              required: ["type", "delay_days", "body", "ai_personalize"],
            },
          },
        },
        required: ["name", "steps"],
      },
      system: `You design high-performing multi-channel B2B outbound sequences (cadences).
Return exactly ${count} steps using only these channels: ${channels.join(", ")}.
- delay_days is the wait AFTER the previous step (the first step is 0). Spread the cadence over ~2–3 weeks.
- Templates use merge fields {{first_name}}, {{company}}, {{title}}, {{sender_name}} — never other placeholders.
- email: give a subject for the first email; leave subject EMPTY ("") for follow-ups so they reply in the same thread. Each email adds a new angle (insight, social proof, a question, breakup). ${EMAIL_RULES.replace("Writing rules:\n", "")}
- linkedin_connect: body is a connection note under 280 characters.
- linkedin_message: body under 500 characters, conversational.
- call: body is a short talk track (opener, reason for call, one question).
- task: subject is a short task title, body explains what to do.
- ai_personalize: true for steps where per-prospect research adds value (usually the first email and LinkedIn notes); "instructions" tells the AI how to personalize that step.
Tone: ${input.tone?.trim() || "friendly, concise, credible"}.`,
      prompt: `${sellerContext(ws)}\n\nSequence goal: ${input.goal.trim()}\n\nName the sequence briefly (max 6 words).`,
    });
    const steps = (data.steps || []).slice(0, 12).map((s, i) => cleanStep({ ...s, ai_personalize: s.ai_personalize ? 1 : 0, delay_days: i === 0 ? 0 : s.delay_days }, i));
    if (!steps.length) throw new HttpError(502, "The AI didn't return any steps. Please try again.");
    return { name: (data.name || "AI sequence").trim().slice(0, 120), steps };
  });
}

async function personalizeEmail(
  ws: Workspace,
  c: Contact,
  step: SequenceStep,
  draft: { subject: string; body: string },
  stepIndex: number,
): Promise<{ subject: string; body: string }> {
  const brief = await contactBrief(ws.id, c.id);
  const history = await threadHistory(ws.id, c.id, 6);
  return aiCall(ws, async () => {
    const { data } = await generateJSON<{ subject: string; body: string }>({
      workspace: ws,
      schema: EMAIL_SCHEMA,
      temperature: 0.6,
      system: `You personalize outbound sales emails for one specific prospect. Keep the template's intent, offer and call to action, but rewrite it so it clearly speaks to this prospect using the context.\n${EMAIL_RULES}`,
      prompt: [
        sellerContext(ws),
        `\nProspect context:\n${brief}`,
        history ? `\nEarlier messages with this prospect (oldest first):\n${history}` : "",
        `\nThis is step ${stepIndex + 1} of the sequence.${draft.subject ? "" : " It is a follow-up in the same thread: return an empty subject."}`,
        step.instructions ? `Personalization instructions: ${step.instructions}` : "",
        draft.body ? `\nTemplate to personalize:\nSubject: ${draft.subject || "(same thread)"}\n${draft.body}` : "\nThere is no template: write the email from scratch.",
      ].join("\n"),
    });
    return { subject: draft.subject ? (data.subject || draft.subject).trim() : "", body: (data.body || draft.body).trim() };
  });
}

async function writeTaskContent(ws: Workspace, c: Contact, type: StepType | "linkedin" | "call", draft: string, instructions?: string | null) {
  const brief = await contactBrief(ws.id, c.id);
  const kind =
    type === "linkedin_connect"
      ? "a LinkedIn connection request note. HARD LIMIT: 280 characters. No pitch, just a genuine reason to connect."
      : type === "linkedin_message" || type === "linkedin"
        ? "a LinkedIn direct message (under 500 characters), conversational, one soft question at the end."
        : type === "call" || type === "task"
          ? "a concise cold-call talk track: opener (permission-based), reason for calling tied to their context, 2 discovery questions, and a one-line ask for a meeting. Use short lines."
          : "a short task description.";
  return aiCall(ws, async () => {
    const { text } = await generateText({
      workspace: ws,
      temperature: 0.7,
      system: `You write ${kind} Plain text, no markdown headings, no placeholders. Never invent facts not present in the context.`,
      prompt: [
        sellerContext(ws),
        `\nProspect context:\n${brief}`,
        instructions ? `Instructions: ${instructions}` : "",
        draft ? `\nStarting template (keep its intent):\n${draft}` : "",
      ].join("\n"),
    });
    const out = text.trim();
    return type === "linkedin_connect" && out.length > 300 ? out.slice(0, 297).trimEnd() + "…" : out;
  });
}

export async function callScript(ws: Workspace, contactId: string): Promise<string> {
  requireAI(ws);
  const c = await requireContact(ws.id, contactId);
  const brief = await contactBrief(ws.id, c.id);
  return aiCall(ws, async () => {
    const { text } = await generateText({
      workspace: ws,
      temperature: 0.6,
      system: `You are a top-performing SDR coach. Write a cold-call script the rep can glance at mid-call.
Format in light markdown with these sections (## headings): Opener, Reason for calling, Discovery questions, Value pitch, Objection handling, Close.
- Opener: permission-based, under 25 words, uses their first name.
- Reason for calling: tie to a specific detail from the context (role, company, signal). Never invent facts.
- Discovery questions: 3 sharp, open questions.
- Value pitch: 2–3 sentences in plain language.
- Objection handling: 4 likely objections for this persona as "**"Objection"** → response" lines.
- Close: a specific ask for a 20-minute meeting with two time options.
Keep it tight — the whole thing should be readable in 60 seconds.`,
      prompt: `${sellerContext(ws)}\n\nProspect context:\n${brief}`,
    });
    return text;
  });
}

export async function summarizeCall(
  ws: Workspace,
  input: { contactId: string; notes: string; outcome?: string | null },
): Promise<{ summary: string; next_steps: string[] }> {
  if (!input.notes?.trim()) throw new HttpError(400, "Add some call notes first");
  requireAI(ws);
  const c = await requireContact(ws.id, input.contactId);
  return aiCall(ws, async () => {
    const { data } = await generateJSON<{ summary: string; next_steps: string[] }>({
      workspace: ws,
      temperature: 0.3,
      schema: {
        type: "object",
        properties: { summary: { type: "string" }, next_steps: { type: "array", items: { type: "string" } } },
        required: ["summary", "next_steps"],
      },
      system:
        "You summarize sales calls for a CRM. summary: 2–4 crisp sentences (pain, interest level, timeline, stakeholders if mentioned). next_steps: 1–4 concrete actions for the rep. Only use information in the notes.",
      prompt: `Prospect: ${name(c)}${c.title ? `, ${c.title}` : ""}${c.company_name ? ` at ${c.company_name}` : ""}\nOutcome: ${input.outcome || "unknown"}\n\nRep's raw notes:\n${input.notes.trim()}`,
    });
    return { summary: (data.summary || "").trim(), next_steps: (data.next_steps || []).map((s) => s.trim()).filter(Boolean) };
  });
}

async function threadHistory(workspaceId: string, contactId: string, limit: number) {
  const rows = await all<Pick<Message, "direction" | "subject" | "body" | "created_at" | "channel">>(
    `SELECT direction, subject, body, created_at, channel FROM messages
     WHERE workspace_id = ? AND contact_id = ? AND status IN ('sent','received')
     ORDER BY created_at DESC LIMIT ?`,
    [workspaceId, contactId, limit],
  );
  return rows
    .reverse()
    .map((m) => `[${m.created_at}] ${m.direction === "in" ? "PROSPECT" : "US"} (${m.channel})${m.subject ? ` — ${m.subject}` : ""}:\n${(m.body || "").slice(0, 1200)}`)
    .join("\n\n");
}

/* ------------------------------------------------------------------ */
/* Sequences                                                           */
/* ------------------------------------------------------------------ */

export async function createSequence(
  workspaceId: string,
  input: { name: string; goal?: string; steps: Omit<SequenceStep, "id" | "sequence_id">[] },
): Promise<string> {
  const nm = input.name?.trim();
  if (!nm) throw new HttpError(400, "Sequence name is required");
  const id = await insert("sequences", { workspace_id: workspaceId, name: nm.slice(0, 120), goal: input.goal?.trim() || null, status: "draft" });
  let i = 0;
  for (const s of input.steps || []) {
    await insert("sequence_steps", { sequence_id: id, ...cleanStep(s, i++) });
  }
  return id;
}

export async function listSequences(workspaceId: string): Promise<SequenceSummary[]> {
  await ensureEngageSchema();
  return all<SequenceSummary>(
    `SELECT s.*,
       (SELECT COUNT(*) FROM sequence_steps st WHERE st.sequence_id = s.id) AS steps,
       (SELECT GROUP_CONCAT(type) FROM (SELECT DISTINCT type FROM sequence_steps st WHERE st.sequence_id = s.id)) AS channels,
       (SELECT COUNT(*) FROM enrollments e WHERE e.sequence_id = s.id) AS enrolled,
       (SELECT COUNT(*) FROM enrollments e WHERE e.sequence_id = s.id AND e.status = 'active') AS active,
       (SELECT COUNT(*) FROM enrollments e WHERE e.sequence_id = s.id AND (e.current_step > 0 OR e.status = 'replied')) AS contacted,
       (SELECT COUNT(*) FROM enrollments e WHERE e.sequence_id = s.id AND e.status = 'replied') AS replied,
       (SELECT COUNT(*) FROM messages m JOIN enrollments e ON e.id = m.enrollment_id
          WHERE e.sequence_id = s.id AND m.direction = 'out' AND m.status = 'sent') AS sent,
       (SELECT COUNT(*) FROM messages m JOIN enrollments e ON e.id = m.enrollment_id
          WHERE e.sequence_id = s.id AND m.direction = 'out' AND m.opened_at IS NOT NULL) AS opened
     FROM sequences s WHERE s.workspace_id = ? ORDER BY s.created_at DESC`,
    [workspaceId],
  );
}

async function requireSequence(workspaceId: string, id: string) {
  const s = await one<Sequence>("SELECT * FROM sequences WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
  if (!s) throw new HttpError(404, "Sequence not found");
  return s;
}

async function sequenceSteps(sequenceId: string) {
  return all<SequenceStep>("SELECT * FROM sequence_steps WHERE sequence_id = ? ORDER BY position", [sequenceId]);
}

export async function getSequence(ws: Workspace, id: string): Promise<SequenceDetail> {
  await ensureEngageSchema();
  const sequence = await requireSequence(ws.id, id);
  const steps = await sequenceSteps(id);
  const enrollments = await all<EnrollmentRow>(
    `SELECT e.*, c.first_name, c.last_name, c.email, c.title, c.status AS contact_status, co.name AS company_name
     FROM enrollments e JOIN contacts c ON c.id = e.contact_id LEFT JOIN companies co ON co.id = c.company_id
     WHERE e.sequence_id = ? AND e.workspace_id = ? ORDER BY e.created_at DESC LIMIT 1000`,
    [id, ws.id],
  );
  const msgStats = await all<{ step_id: string; sent: number; opened: number }>(
    `SELECT m.step_id, SUM(CASE WHEN m.status = 'sent' THEN 1 ELSE 0 END) AS sent,
            SUM(CASE WHEN m.opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opened
     FROM messages m JOIN enrollments e ON e.id = m.enrollment_id
     WHERE e.sequence_id = ? AND m.workspace_id = ? AND m.direction = 'out' GROUP BY m.step_id`,
    [id, ws.id],
  );
  const taskStats = await all<{ step_id: string; tasks: number }>(
    `SELECT t.step_id, COUNT(*) AS tasks FROM tasks t JOIN enrollments e ON e.id = t.enrollment_id
     WHERE e.sequence_id = ? AND t.workspace_id = ? GROUP BY t.step_id`,
    [id, ws.id],
  );
  const stepStats: SequenceDetail["stepStats"] = {};
  for (const s of steps) stepStats[s.id] = { sent: 0, opened: 0, tasks: 0 };
  for (const m of msgStats) if (stepStats[m.step_id]) Object.assign(stepStats[m.step_id], { sent: Number(m.sent), opened: Number(m.opened) });
  for (const t of taskStats) if (stepStats[t.step_id]) stepStats[t.step_id].tasks = Number(t.tasks);
  const count = (f: (e: EnrollmentRow) => boolean) => enrollments.filter(f).length;
  return {
    sequence,
    steps,
    enrollments,
    stats: {
      enrolled: enrollments.length,
      active: count((e) => e.status === "active"),
      completed: count((e) => e.status === "completed"),
      replied: count((e) => e.status === "replied"),
      contacted: count((e) => e.current_step > 0 || e.status === "replied"),
      sent: msgStats.reduce((a, m) => a + Number(m.sent), 0),
      opened: msgStats.reduce((a, m) => a + Number(m.opened), 0),
    },
    stepStats,
    mailer: mailerStatus(ws),
  };
}

/** Update name/goal/status and (optionally) the full ordered step list, keeping ids of existing steps. */
export async function updateSequence(
  workspaceId: string,
  id: string,
  input: { name?: string; goal?: string | null; status?: string; steps?: (Partial<SequenceStep> & { id?: string })[] },
) {
  const seq = await requireSequence(workspaceId, id);
  const patch: Record<string, string | null | undefined> = {};
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new HttpError(400, "Sequence name is required");
    patch.name = input.name.trim().slice(0, 120);
  }
  if (input.goal !== undefined) patch.goal = input.goal?.trim() || null;
  if (input.status !== undefined) {
    if (!["draft", "active", "paused"].includes(input.status)) throw new HttpError(400, "Invalid status");
    patch.status = input.status;
  }

  if (input.steps) {
    const existing = await sequenceSteps(id);
    const keep = new Set<string>();
    let pos = 0;
    for (const s of input.steps) {
      const clean = cleanStep(s, pos++);
      if (s.id && existing.some((e) => e.id === s.id)) {
        keep.add(s.id);
        await run(
          `UPDATE sequence_steps SET position = ?, type = ?, delay_days = ?, subject = ?, body = ?, ai_personalize = ?, instructions = ?
           WHERE id = ? AND sequence_id = ?`,
          [clean.position, clean.type, clean.delay_days, clean.subject, clean.body, clean.ai_personalize, clean.instructions, s.id, id],
        );
      } else {
        keep.add(await insert("sequence_steps", { sequence_id: id, ...clean }));
      }
    }
    for (const e of existing) if (!keep.has(e.id)) await run("DELETE FROM sequence_steps WHERE id = ? AND sequence_id = ?", [e.id, id]);
    // Enrollments pointing past the end of a shortened sequence are complete.
    await run(
      "UPDATE enrollments SET status = 'completed', next_run_at = NULL WHERE sequence_id = ? AND status IN ('active','paused') AND current_step >= ?",
      [id, input.steps.length],
    );
  }

  if (patch.status === "active") {
    const n = await one<{ n: number }>("SELECT COUNT(*) AS n FROM sequence_steps WHERE sequence_id = ?", [id]);
    if (!Number(n?.n)) throw new HttpError(400, "Add at least one step before activating the sequence");
  }
  if (Object.keys(patch).length) await update("sequences", id, patch, workspaceId);
  if (patch.status && patch.status !== seq.status) {
    await logActivity(workspaceId, { type: "sequence", title: `Sequence "${patch.name || seq.name}" ${patch.status === "active" ? "activated" : patch.status}` });
  }
}

export async function deleteSequence(workspaceId: string, id: string) {
  await requireSequence(workspaceId, id);
  await run("DELETE FROM enrollments WHERE sequence_id = ? AND workspace_id = ?", [id, workspaceId]);
  await run("DELETE FROM sequence_steps WHERE sequence_id = ?", [id]);
  await run("UPDATE tasks SET status = 'skipped' WHERE workspace_id = ? AND status = 'open' AND step_id IN (SELECT id FROM sequence_steps WHERE sequence_id = ?)", [workspaceId, id]);
  await run("DELETE FROM sequences WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
}

export async function enrollContacts(
  workspaceId: string,
  sequenceId: string,
  contactIds: string[],
): Promise<{ enrolled: number; skipped: number }> {
  await requireSequence(workspaceId, sequenceId);
  const steps = await sequenceSteps(sequenceId);
  const firstDelay = steps[0]?.delay_days ?? 0;
  const ids = [...new Set((contactIds || []).filter((x) => typeof x === "string"))].slice(0, 5000);
  let enrolled = 0;
  let skipped = 0;
  for (const cid of ids) {
    const c = await one<{ id: string; status: string }>("SELECT id, status FROM contacts WHERE id = ? AND workspace_id = ?", [cid, workspaceId]);
    if (!c || ["bounced", "not_interested", "customer"].includes(c.status)) {
      skipped++;
      continue;
    }
    const n = await run(
      `INSERT OR IGNORE INTO enrollments (id, workspace_id, sequence_id, contact_id, status, current_step, next_run_at)
       VALUES (?, ?, ?, ?, 'active', 0, ?)`,
      [newId(), workspaceId, sequenceId, cid, inDays(firstDelay)],
    );
    if (n) enrolled++;
    else skipped++;
  }
  if (enrolled) {
    const seq = await one<{ name: string }>("SELECT name FROM sequences WHERE id = ?", [sequenceId]);
    for (const cid of ids.slice(0, 200)) {
      await logActivity(workspaceId, { type: "sequence", contact_id: cid, title: `Enrolled in sequence "${seq?.name}"` }).catch(() => {});
    }
  }
  return { enrolled, skipped };
}

export async function enrollmentAction(workspaceId: string, sequenceId: string, enrollmentId: string, action: "pause" | "resume" | "unenroll") {
  const e = await one<Enrollment>("SELECT * FROM enrollments WHERE id = ? AND sequence_id = ? AND workspace_id = ?", [enrollmentId, sequenceId, workspaceId]);
  if (!e) throw new HttpError(404, "Enrollment not found");
  if (action === "unenroll") {
    await run("DELETE FROM enrollments WHERE id = ?", [e.id]);
    await run("UPDATE tasks SET status = 'skipped' WHERE enrollment_id = ? AND status = 'open'", [e.id]);
  } else if (action === "pause") {
    if (e.status !== "active") throw new HttpError(400, "Only active enrollments can be paused");
    await run("UPDATE enrollments SET status = 'paused' WHERE id = ?", [e.id]);
  } else if (action === "resume") {
    if (!["paused", "completed", "replied", "bounced"].includes(e.status)) throw new HttpError(400, "Enrollment is already active");
    const steps = await sequenceSteps(sequenceId);
    if (e.current_step >= steps.length) throw new HttpError(400, "This contact has finished every step of the sequence");
    await run("UPDATE enrollments SET status = 'active', next_run_at = ? WHERE id = ?", [sqlTime(), e.id]);
  } else {
    throw new HttpError(400, "Unknown action");
  }
}

/** Contacts for pickers (enroll, compose, tasks), with an `enrolled` flag for a sequence. */
export async function pickContacts(
  workspaceId: string,
  opts: { q?: string; listId?: string; sequenceId?: string; withPhone?: boolean; limit?: number },
): Promise<{ contacts: PickerContact[]; lists: { id: string; name: string; count: number }[] }> {
  const where = ["c.workspace_id = ?"];
  const args: (string | number)[] = [opts.sequenceId || "", workspaceId];
  if (opts.q?.trim()) {
    const q = `%${opts.q.trim().toLowerCase()}%`;
    where.push("(lower(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) LIKE ? OR lower(COALESCE(c.email,'')) LIKE ? OR lower(COALESCE(co.name,'')) LIKE ? OR lower(COALESCE(c.title,'')) LIKE ?)");
    args.push(q, q, q, q);
  }
  if (opts.listId) {
    where.push("c.id IN (SELECT contact_id FROM list_members lm JOIN lists l ON l.id = lm.list_id WHERE lm.list_id = ? AND l.workspace_id = ?)");
    args.push(opts.listId, workspaceId);
  }
  if (opts.withPhone) where.push("c.phone IS NOT NULL AND trim(c.phone) <> ''");
  const limit = Math.min(opts.limit || 100, 1000);
  const contacts = await all<PickerContact>(
    `SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.title, c.status, co.name AS company_name,
       EXISTS(SELECT 1 FROM enrollments e WHERE e.contact_id = c.id AND e.sequence_id = ?) AS enrolled
     FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
     WHERE ${where.join(" AND ")}
     ORDER BY COALESCE(c.score, -1) DESC, c.created_at DESC LIMIT ${limit}`,
    args,
  );
  const lists = await all<{ id: string; name: string; count: number }>(
    `SELECT l.id, l.name, (SELECT COUNT(*) FROM list_members lm WHERE lm.list_id = l.id) AS count
     FROM lists l WHERE l.workspace_id = ? ORDER BY l.created_at DESC LIMIT 200`,
    [workspaceId],
  );
  return { contacts, lists };
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export async function sendEmail(
  ws: Workspace,
  input: { contactId: string; subject: string; body: string; enrollmentId?: string; stepId?: string },
): Promise<Message> {
  await ensureEngageSchema();
  const c = await requireContact(ws.id, input.contactId);
  if (!c.email) throw new HttpError(400, `${name(c)} has no email address`);
  if (c.email_status === "invalid" || c.status === "bounced") throw new HttpError(400, `${c.email} is marked as undeliverable`);
  const body = (input.body || "").trim();
  let subject = (input.subject || "").trim();
  if (!body) throw new HttpError(400, "Email body is empty");

  const prev = await one<{ provider_id: string | null; thread_id: string | null; subject: string | null }>(
    `SELECT provider_id, thread_id, subject FROM messages
     WHERE workspace_id = ? AND contact_id = ? AND channel = 'email' AND status IN ('sent','received')
     ORDER BY created_at DESC LIMIT 1`,
    [ws.id, c.id],
  );
  if (!subject) {
    const base = (prev?.subject || "").replace(/^(re:\s*)+/i, "").trim();
    subject = base ? `Re: ${base}` : `Quick question, ${c.first_name || "there"}`;
  }
  const isReply = !!prev && /^re:/i.test(subject);
  const id = newId();
  await insert("messages", {
    id,
    workspace_id: ws.id,
    contact_id: c.id,
    enrollment_id: input.enrollmentId ?? null,
    step_id: input.stepId ?? null,
    channel: "email",
    direction: "out",
    subject,
    body,
    status: "scheduled",
    thread_id: prev?.thread_id || id,
    to_email: c.email,
  });

  try {
    const res = await deliver(ws, {
      to: c.email,
      subject,
      text: plainWithSignature(body, ws.signature),
      html: renderEmailHtml(body, { messageId: id, signature: ws.signature, track: true }),
      inReplyTo: isReply ? prev?.provider_id : null,
      messageId: id,
    });
    await run(
      "UPDATE messages SET status = 'sent', sent_at = ?, delivery = ?, provider_id = ?, from_email = ?, error = NULL WHERE id = ?",
      [sqlTime(), res.delivery, res.providerId, res.from, id],
    );
    if (c.status === "new") await update("contacts", c.id, { status: "contacted" }, ws.id);
    await logActivity(ws.id, {
      type: "email_sent",
      contact_id: c.id,
      company_id: c.company_id,
      title: `Email sent: ${subject}${res.delivery === "sandbox" ? " (sandbox)" : ""}`,
      body: body.slice(0, 500),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    await run("UPDATE messages SET status = 'failed', error = ? WHERE id = ?", [msg.slice(0, 500), id]);
    if (e instanceof MailError && e.permanent) {
      await update("contacts", c.id, { status: "bounced", email_status: "invalid" }, ws.id);
      await run("UPDATE enrollments SET status = 'bounced', next_run_at = NULL WHERE contact_id = ? AND workspace_id = ? AND status IN ('active','paused')", [c.id, ws.id]);
      await logActivity(ws.id, { type: "email_bounced", contact_id: c.id, company_id: c.company_id, title: `Email bounced: ${c.email}`, body: msg });
    }
    throw new HttpError(502, msg);
  }
  return (await one<Message>("SELECT * FROM messages WHERE id = ?", [id]))!;
}

/* ------------------------------------------------------------------ */
/* Execution engine                                                    */
/* ------------------------------------------------------------------ */

type RunResult = { sent: number; tasks: number; error?: string };

export async function processDue(workspaceId?: string): Promise<{ processed: number; sent: number; tasks: number; errors: number }> {
  await ensureEngageSchema();
  const now = sqlTime();
  const due = await all<Enrollment>(
    `SELECT e.* FROM enrollments e JOIN sequences s ON s.id = e.sequence_id AND s.workspace_id = e.workspace_id
     WHERE e.status = 'active' AND s.status = 'active' AND e.next_run_at IS NOT NULL AND e.next_run_at <= ?
     ${workspaceId ? "AND e.workspace_id = ?" : ""}
     ORDER BY e.next_run_at LIMIT 200`,
    workspaceId ? [now, workspaceId] : [now],
  );
  const out = { processed: 0, sent: 0, tasks: 0, errors: 0 };
  const workspaces = new Map<string, Workspace | null>();
  const stepsBySeq = new Map<string, SequenceStep[]>();

  for (const e of due) {
    // Claim the enrollment so concurrent runs don't double-send.
    const claimed = await run("UPDATE enrollments SET next_run_at = ? WHERE id = ? AND status = 'active' AND next_run_at = ?", [inMinutes(15), e.id, e.next_run_at]);
    if (!claimed) continue;
    if (!workspaces.has(e.workspace_id)) workspaces.set(e.workspace_id, await loadWorkspace(e.workspace_id));
    const ws = workspaces.get(e.workspace_id);
    if (!ws) continue;
    if (!stepsBySeq.has(e.sequence_id)) stepsBySeq.set(e.sequence_id, await sequenceSteps(e.sequence_id));
    const steps = stepsBySeq.get(e.sequence_id)!;
    out.processed++;
    try {
      const r = await runEnrollment(ws, e, steps);
      out.sent += r.sent;
      out.tasks += r.tasks;
      if (r.error) out.errors++;
    } catch (err) {
      out.errors++;
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[engage] enrollment failed", e.id, err);
      await run("UPDATE enrollments SET status = 'paused', next_run_at = ? WHERE id = ?", [sqlTime(), e.id]);
      await logActivity(e.workspace_id, { type: "sequence_error", contact_id: e.contact_id, title: "Sequence paused: step failed", body: msg }).catch(() => {});
    }
  }
  return out;
}

async function runEnrollment(ws: Workspace, e: Enrollment, steps: SequenceStep[]): Promise<RunResult> {
  const c = await getContact(ws.id, e.contact_id);
  if (!c) {
    await run("DELETE FROM enrollments WHERE id = ?", [e.id]);
    return { sent: 0, tasks: 0 };
  }
  // Stop when the prospect replied / bounced / was otherwise resolved.
  const replied = await one<{ id: string }>(
    "SELECT id FROM messages WHERE workspace_id = ? AND contact_id = ? AND direction = 'in' AND created_at >= ? LIMIT 1",
    [ws.id, c.id, e.created_at],
  );
  if (STOP_STATUSES.includes(c.status) || replied) {
    const status = c.status === "bounced" ? "bounced" : c.status === "customer" ? "completed" : "replied";
    await run("UPDATE enrollments SET status = ?, next_run_at = NULL WHERE id = ?", [status, e.id]);
    return { sent: 0, tasks: 0 };
  }

  const step = steps[e.current_step];
  if (!step) {
    await run("UPDATE enrollments SET status = 'completed', next_run_at = NULL WHERE id = ?", [e.id]);
    return { sent: 0, tasks: 0 };
  }

  const pause = async (reason: string): Promise<RunResult> => {
    await run("UPDATE enrollments SET status = 'paused', next_run_at = ? WHERE id = ?", [sqlTime(), e.id]);
    await logActivity(ws.id, { type: "sequence_error", contact_id: c.id, company_id: c.company_id, title: `Sequence paused at step ${e.current_step + 1}`, body: reason });
    return { sent: 0, tasks: 0, error: reason };
  };

  const render = (t: string | null) => (t ? renderTemplate(t, c, ws) : "");
  const result: RunResult = { sent: 0, tasks: 0 };

  if (step.type === "email") {
    if (!c.email) return pause(`${name(c)} has no email address. Add one, then resume.`);
    let draft = { subject: render(step.subject), body: render(step.body) };
    if (e.current_step > 0 && !step.subject) draft.subject = "";
    if (step.ai_personalize) {
      try {
        draft = await personalizeEmail(ws, c, step, draft, e.current_step);
      } catch (err) {
        if (!draft.body) return pause(`AI personalization failed (${(err as Error).message}) and the step has no template to fall back to.`);
        await logActivity(ws.id, { type: "sequence", contact_id: c.id, title: "AI personalization skipped — sent the template", body: (err as Error).message });
      }
    }
    if (!draft.body.trim()) return pause("This email step has no body. Add a template or enable AI personalization.");
    try {
      await sendEmail(ws, { contactId: c.id, subject: draft.subject, body: draft.body, enrollmentId: e.id, stepId: step.id });
      result.sent = 1;
    } catch (err) {
      const fresh = await one<{ status: string }>("SELECT status FROM enrollments WHERE id = ?", [e.id]);
      if (fresh?.status === "bounced") return { sent: 0, tasks: 0, error: (err as Error).message };
      return pause((err as Error).message);
    }
  } else {
    const taskType: Task["type"] = step.type === "call" ? "call" : step.type === "task" ? "todo" : "linkedin";
    let body = render(step.body);
    if (step.ai_personalize) {
      try {
        body = await writeTaskContent(ws, c, step.type, body, step.instructions);
      } catch (err) {
        if (!body) body = step.instructions || "";
        await logActivity(ws.id, { type: "sequence", contact_id: c.id, title: "AI personalization skipped — used the template", body: (err as Error).message });
      }
    }
    const who = name(c);
    const title =
      step.type === "linkedin_connect"
        ? `Send LinkedIn connection request to ${who}`
        : step.type === "linkedin_message"
          ? `Send LinkedIn message to ${who}`
          : step.type === "call"
            ? `Call ${who}`
            : render(step.subject) || `Follow up with ${who}`;
    await insert("tasks", {
      workspace_id: ws.id,
      contact_id: c.id,
      enrollment_id: e.id,
      step_id: step.id,
      type: taskType,
      title: title.slice(0, 200),
      body: body || null,
      due_at: sqlTime(),
      status: "open",
    });
    result.tasks = 1;
  }

  const next = e.current_step + 1;
  if (next >= steps.length) {
    await run("UPDATE enrollments SET current_step = ?, status = 'completed', next_run_at = NULL WHERE id = ?", [next, e.id]);
    const seq = await one<{ name: string }>("SELECT name FROM sequences WHERE id = ?", [e.sequence_id]);
    await logActivity(ws.id, { type: "sequence", contact_id: c.id, title: `Completed sequence "${seq?.name}"` });
  } else {
    await run("UPDATE enrollments SET current_step = ?, next_run_at = ? WHERE id = ?", [next, inDays(steps[next].delay_days), e.id]);
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Inbox                                                               */
/* ------------------------------------------------------------------ */

export type InboxFilter = keyof InboxCounts;

export async function inboxThreads(workspaceId: string, filter: InboxFilter = "all", q?: string): Promise<{ threads: InboxThread[]; counts: InboxCounts }> {
  await ensureEngageSchema();
  const rows = await all<EngageMessage & { c_first: string | null; c_last: string | null; c_email: string | null; c_title: string | null; c_status: string; company_name: string | null }>(
    `SELECT m.*, c.first_name AS c_first, c.last_name AS c_last, c.email AS c_email, c.title AS c_title, c.status AS c_status, co.name AS company_name
     FROM messages m JOIN contacts c ON c.id = m.contact_id AND c.workspace_id = m.workspace_id
     LEFT JOIN companies co ON co.id = c.company_id
     WHERE m.workspace_id = ? AND m.status IN ('sent','received','failed')
     ORDER BY m.created_at DESC LIMIT 5000`,
    [workspaceId],
  );
  const map = new Map<string, InboxThread>();
  for (const r of rows) {
    const cid = r.contact_id!;
    let t = map.get(cid);
    if (!t) {
      const { c_first, c_last, c_email, c_title, c_status, company_name, ...msg } = r;
      t = {
        contact: { id: cid, first_name: c_first, last_name: c_last, email: c_email, title: c_title, status: c_status as Contact["status"], company_name },
        last: msg as EngageMessage,
        count: 0,
        inbound: 0,
        sentiment: null,
        needsReply: false,
      };
      map.set(cid, t);
    }
    t.count++;
    if (r.direction === "in") {
      t.inbound++;
      if (!t.sentiment && r.sentiment) t.sentiment = r.sentiment as Sentiment;
    }
  }
  const threads = [...map.values()];
  for (const t of threads) {
    t.needsReply = t.last.direction === "in" && !["not_interested", "ooo"].includes(t.last.sentiment || "");
    if (t.last.direction === "in" && t.last.sentiment) t.sentiment = t.last.sentiment as Sentiment;
  }
  const test: Record<InboxFilter, (t: InboxThread) => boolean> = {
    all: () => true,
    needs_reply: (t) => t.needsReply,
    interested: (t) => t.sentiment === "interested",
    not_interested: (t) => t.sentiment === "not_interested",
    ooo: (t) => t.sentiment === "ooo",
    sent: (t) => t.inbound === 0,
  };
  const counts = Object.fromEntries((Object.keys(test) as InboxFilter[]).map((k) => [k, threads.filter(test[k]).length])) as InboxCounts;
  let list = threads.filter(test[filter] || test.all);
  if (q?.trim()) {
    const s = q.trim().toLowerCase();
    list = list.filter((t) =>
      [t.contact.first_name, t.contact.last_name, t.contact.email, t.contact.company_name, t.last.subject].some((v) => v?.toLowerCase().includes(s)),
    );
  }
  return { threads: list.slice(0, 300), counts };
}

export async function threadDetail(workspaceId: string, contactId: string): Promise<ThreadDetail> {
  await ensureEngageSchema();
  const contact = await requireContact(workspaceId, contactId);
  const messages = await all<EngageMessage>(
    "SELECT * FROM messages WHERE workspace_id = ? AND contact_id = ? AND status <> 'draft' ORDER BY created_at ASC LIMIT 500",
    [workspaceId, contactId],
  );
  const enrollments = await all<Enrollment & { sequence_name: string }>(
    `SELECT e.*, s.name AS sequence_name FROM enrollments e JOIN sequences s ON s.id = e.sequence_id
     WHERE e.workspace_id = ? AND e.contact_id = ? ORDER BY e.created_at DESC`,
    [workspaceId, contactId],
  );
  return { contact, messages, enrollments };
}

/** Save a prospect's reply (pasted or from the inbound webhook), stop their sequences, and try to classify it. */
export async function logReply(
  ws: Workspace,
  contactId: string,
  input: { subject?: string; body: string; channel?: "email" | "linkedin" },
): Promise<{ message: EngageMessage; classification: { sentiment: string; summary: string } | null; aiError: string | null }> {
  await ensureEngageSchema();
  const c = await requireContact(ws.id, contactId);
  const body = (input.body || "").trim();
  if (!body) throw new HttpError(400, "Paste the reply text");
  const prev = await one<{ thread_id: string | null; subject: string | null }>(
    "SELECT thread_id, subject FROM messages WHERE workspace_id = ? AND contact_id = ? ORDER BY created_at DESC LIMIT 1",
    [ws.id, c.id],
  );
  const subject = input.subject?.trim() || (prev?.subject ? `Re: ${prev.subject.replace(/^(re:\s*)+/i, "")}` : "Reply");
  const id = await insert("messages", {
    workspace_id: ws.id,
    contact_id: c.id,
    channel: input.channel || "email",
    direction: "in",
    subject,
    body: body.slice(0, 20_000),
    status: "received",
    thread_id: prev?.thread_id || null,
    sent_at: sqlTime(),
    from_email: c.email,
  });
  await run("UPDATE enrollments SET status = 'replied', next_run_at = NULL WHERE workspace_id = ? AND contact_id = ? AND status IN ('active','paused')", [ws.id, c.id]);
  if (!["interested", "customer", "not_interested"].includes(c.status)) await update("contacts", c.id, { status: "replied" }, ws.id);
  await logActivity(ws.id, { type: "email_reply", contact_id: c.id, company_id: c.company_id, title: `Reply from ${name(c)}: ${subject}`, body: body.slice(0, 500) });

  let classification: { sentiment: string; summary: string } | null = null;
  let aiError: string | null = null;
  try {
    classification = await classifyReply(ws, id);
  } catch (e) {
    aiError = e instanceof Error ? e.message : "Classification failed";
  }
  const message = (await one<EngageMessage>("SELECT * FROM messages WHERE id = ?", [id]))!;
  return { message, classification, aiError };
}

export async function classifyReply(ws: Workspace, messageId: string): Promise<{ sentiment: string; summary: string }> {
  requireAI(ws);
  const m = await one<Message>("SELECT * FROM messages WHERE id = ? AND workspace_id = ?", [messageId, ws.id]);
  if (!m) throw new HttpError(404, "Message not found");
  if (m.direction !== "in") throw new HttpError(400, "Only replies from prospects can be classified");
  const history = m.contact_id ? await threadHistory(ws.id, m.contact_id, 4) : "";
  const res = await aiCall(ws, async () => {
    const { data } = await generateJSON<{ sentiment: Sentiment; summary: string }>({
      workspace: ws,
      temperature: 0.1,
      schema: {
        type: "object",
        properties: { sentiment: { type: "string", enum: SENTIMENTS }, summary: { type: "string" } },
        required: ["sentiment", "summary"],
      },
      system: `Classify a prospect's reply to a sales email.
- interested: wants to talk, asks for time/pricing/details, positive.
- not_interested: declines, unsubscribe, "not a fit", "stop emailing".
- objection: pushes back (budget, timing, already have a vendor) but door not closed.
- ooo: automatic out-of-office / vacation / parental leave reply.
- referral: points to someone else who is the right person.
- neutral: anything else (questions without clear intent, acknowledgements).
summary: one sentence describing what the prospect said and what they want next.`,
      prompt: `${history ? `Conversation so far:\n${history}\n\n` : ""}Reply to classify:\nSubject: ${m.subject || ""}\n${m.body || ""}`,
    });
    return data;
  });
  const sentiment = SENTIMENTS.includes(res.sentiment) ? res.sentiment : "neutral";
  await setSentiment(ws.id, m.id, sentiment, res.summary);
  return { sentiment, summary: (res.summary || "").trim() };
}

/** Apply a sentiment label (AI or manual) to an inbound message and its contact. */
export async function setSentiment(workspaceId: string, messageId: string, sentiment: Sentiment, summary?: string) {
  if (!SENTIMENTS.includes(sentiment)) throw new HttpError(400, "Invalid sentiment");
  const m = await one<Message>("SELECT * FROM messages WHERE id = ? AND workspace_id = ?", [messageId, workspaceId]);
  if (!m || !m.contact_id) throw new HttpError(404, "Message not found");
  await run("UPDATE messages SET sentiment = ? WHERE id = ?", [sentiment, m.id]);
  const c = await getContact(workspaceId, m.contact_id);
  if (!c) return;
  if (sentiment === "interested" && c.status !== "customer") await update("contacts", c.id, { status: "interested" }, workspaceId);
  else if (sentiment === "not_interested") await update("contacts", c.id, { status: "not_interested" }, workspaceId);
  else if (sentiment === "ooo") {
    // Auto-replies shouldn't end the sequence: resume it after the prospect is back.
    await update("contacts", c.id, { status: "contacted" }, workspaceId);
    await run("UPDATE enrollments SET status = 'active', next_run_at = ? WHERE workspace_id = ? AND contact_id = ? AND status = 'replied'", [inDays(5), workspaceId, c.id]);
  } else if (!["interested", "customer"].includes(c.status)) await update("contacts", c.id, { status: "replied" }, workspaceId);
  if (sentiment !== "ooo") {
    await run("UPDATE enrollments SET status = 'replied', next_run_at = NULL WHERE workspace_id = ? AND contact_id = ? AND status IN ('active','paused')", [workspaceId, c.id]);
  }
  await logActivity(workspaceId, {
    type: "reply_classified",
    contact_id: c.id,
    company_id: c.company_id,
    title: `Reply marked ${sentiment.replace("_", " ")}`,
    body: summary || null,
  });
}

export async function draftReply(ws: Workspace, contactId: string): Promise<{ subject: string; body: string }> {
  requireAI(ws);
  const c = await requireContact(ws.id, contactId);
  const brief = await contactBrief(ws.id, c.id);
  const history = await threadHistory(ws.id, c.id, 10);
  if (!history) throw new HttpError(400, "There's no conversation to reply to yet");
  const last = await one<{ subject: string | null; sentiment: string | null }>(
    "SELECT subject, sentiment FROM messages WHERE workspace_id = ? AND contact_id = ? AND direction = 'in' ORDER BY created_at DESC LIMIT 1",
    [ws.id, c.id],
  );
  return aiCall(ws, async () => {
    const { data } = await generateJSON<{ subject: string; body: string }>({
      workspace: ws,
      schema: EMAIL_SCHEMA,
      temperature: 0.5,
      system: `You are a sales rep replying to a prospect. Read the whole conversation and answer what they actually said.
- interested → propose 2 concrete time slots or share a booking link if one is in the seller context, confirm the next step.
- objection → acknowledge, reframe briefly with value, low-pressure ask.
- referral → thank them, ask for an intro or permission to reach out to the referred person.
- not interested → gracious one-line close, leave the door open.
- out of office → don't reply substantively; a 1-line note is fine.
${EMAIL_RULES}`,
      prompt: [
        sellerContext(ws),
        `\nProspect context:\n${brief}`,
        `\nConversation (oldest first):\n${history}`,
        last?.sentiment ? `\nLatest reply was classified as: ${last.sentiment}` : "",
        `\nReturn subject as "Re: <original subject>".`,
      ].join("\n"),
    });
    const fallback = last?.subject ? `Re: ${last.subject.replace(/^(re:\s*)+/i, "")}` : "Re:";
    return { subject: (data.subject || fallback).trim(), body: (data.body || "").trim() };
  });
}

/** Inbound webhook: match the sender to a contact and log the reply. */
export async function ingestInbound(ws: Workspace, input: { from: string; subject?: string; text: string }) {
  const email = (input.from || "").match(/[^\s<>"]+@[^\s<>"]+/)?.[0]?.toLowerCase();
  if (!email) throw new HttpError(400, "`from` must contain an email address");
  if (!input.text?.trim()) throw new HttpError(400, "`text` is required");
  const c = await one<{ id: string }>("SELECT id FROM contacts WHERE workspace_id = ? AND lower(email) = ? LIMIT 1", [ws.id, email]);
  if (!c) return { matched: false as const, email };
  // Strip quoted history ("On ... wrote:" and "> " lines) so classification sees only the new text.
  const cleaned = input.text
    .split(/\r?\n/)
    .filter((l) => !l.startsWith(">"))
    .join("\n")
    .split(/\n[ \t]*On [^\n]{5,200}wrote:/)[0]
    .trim();
  const r = await logReply(ws, c.id, { subject: input.subject, body: cleaned || input.text });
  return { matched: true as const, contactId: c.id, messageId: r.message.id, classification: r.classification, aiError: r.aiError };
}

/* ------------------------------------------------------------------ */
/* Tracking                                                            */
/* ------------------------------------------------------------------ */

export async function trackOpen(messageId: string) {
  await ensureEngageSchema();
  const m = await one<Message>("SELECT * FROM messages WHERE id = ? AND direction = 'out'", [messageId]);
  if (!m || m.opened_at) return;
  const n = await run("UPDATE messages SET opened_at = ? WHERE id = ? AND opened_at IS NULL", [sqlTime(), m.id]);
  if (n && m.contact_id) await logActivity(m.workspace_id, { type: "email_opened", contact_id: m.contact_id, title: `Opened: ${m.subject || "email"}` });
}

/** Records a click and returns the destination, only if that URL actually appears in the message. */
export async function trackClick(messageId: string, url: string): Promise<string | null> {
  await ensureEngageSchema();
  const m = await one<EngageMessage>("SELECT * FROM messages WHERE id = ? AND direction = 'out'", [messageId]);
  if (!m || !url || !/^https?:\/\//i.test(url)) return null;
  const ws = await loadWorkspace(m.workspace_id);
  if (!`${m.body || ""}\n${ws?.signature || ""}`.includes(url)) return null;
  if (!m.clicked_at) {
    await run("UPDATE messages SET clicked_at = ?, opened_at = COALESCE(opened_at, ?) WHERE id = ?", [sqlTime(), sqlTime(), m.id]);
    if (m.contact_id) await logActivity(m.workspace_id, { type: "email_clicked", contact_id: m.contact_id, title: `Clicked a link in: ${m.subject || "email"}`, body: url });
  }
  return withContactId(url, m.contact_id, ws?.company_website);
}

/**
 * Tag links to the seller's own website with ?cid=<contactId> so the website tracking
 * script can identify the visitor. Third-party links are left untouched.
 */
function withContactId(url: string, contactId: string | null, website: string | null | undefined): string {
  if (!contactId || !website) return url;
  try {
    const dest = new URL(url);
    const own = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`);
    const bare = (h: string) => h.replace(/^www\./, "");
    if (bare(dest.hostname) !== bare(own.hostname)) return url;
    dest.searchParams.set("cid", contactId);
    return dest.toString();
  } catch {
    return url;
  }
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export async function listTasks(workspaceId: string, opts: { status?: string; type?: string; contactId?: string }): Promise<TaskRow[]> {
  const where = ["t.workspace_id = ?"];
  const args: string[] = [workspaceId];
  const status = opts.status || "open";
  if (status !== "all") {
    where.push("t.status = ?");
    args.push(status);
  }
  if (opts.type && opts.type !== "all") {
    where.push("t.type = ?");
    args.push(opts.type);
  }
  if (opts.contactId) {
    where.push("t.contact_id = ?");
    args.push(opts.contactId);
  }
  return all<TaskRow>(
    `SELECT t.*, c.first_name, c.last_name, c.email, c.phone, c.linkedin_url, c.title AS title_text, co.name AS company_name,
       s.name AS sequence_name, st.type AS step_type
     FROM tasks t
     LEFT JOIN contacts c ON c.id = t.contact_id
     LEFT JOIN companies co ON co.id = c.company_id
     LEFT JOIN enrollments e ON e.id = t.enrollment_id
     LEFT JOIN sequences s ON s.id = e.sequence_id
     LEFT JOIN sequence_steps st ON st.id = t.step_id
     WHERE ${where.join(" AND ")}
     ORDER BY ${status === "open" ? "COALESCE(t.due_at, t.created_at) ASC" : "t.created_at DESC"} LIMIT 500`,
    args,
  );
}

export async function createTask(
  workspaceId: string,
  input: { type?: string; title: string; body?: string; due_at?: string | null; contactId?: string | null },
) {
  const title = input.title?.trim();
  if (!title) throw new HttpError(400, "Task title is required");
  const type = ["call", "linkedin", "todo", "email"].includes(input.type || "") ? input.type! : "todo";
  if (input.contactId) await requireContact(workspaceId, input.contactId);
  let due: string | null = null;
  if (input.due_at) {
    const d = new Date(input.due_at);
    if (Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid due date");
    due = sqlTime(d);
  }
  return insert("tasks", {
    workspace_id: workspaceId,
    contact_id: input.contactId || null,
    type,
    title: title.slice(0, 200),
    body: input.body?.trim() || null,
    due_at: due ?? sqlTime(),
    status: "open",
  });
}

export async function updateTask(workspaceId: string, id: string, input: { status?: string; title?: string; body?: string | null; due_at?: string | null }) {
  const t = await one<Task>("SELECT * FROM tasks WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
  if (!t) throw new HttpError(404, "Task not found");
  const patch: Record<string, string | null | undefined> = {};
  if (input.status !== undefined) {
    if (!["open", "done", "skipped"].includes(input.status)) throw new HttpError(400, "Invalid status");
    patch.status = input.status;
  }
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new HttpError(400, "Task title is required");
    patch.title = input.title.trim().slice(0, 200);
  }
  if (input.body !== undefined) patch.body = input.body?.trim() || null;
  if (input.due_at !== undefined) {
    const d = input.due_at ? new Date(input.due_at) : null;
    if (d && Number.isNaN(d.getTime())) throw new HttpError(400, "Invalid due date");
    patch.due_at = d ? sqlTime(d) : null;
  }
  await update("tasks", id, patch, workspaceId);
  if (patch.status && patch.status !== t.status && patch.status !== "open") {
    const c = t.contact_id ? await getContact(workspaceId, t.contact_id) : null;
    await logActivity(workspaceId, {
      type: patch.status === "done" ? (t.type === "linkedin" ? "linkedin" : "task_done") : "task_skipped",
      contact_id: t.contact_id,
      company_id: c?.company_id ?? null,
      title: `${patch.status === "done" ? "Done" : "Skipped"}: ${t.title}`,
      body: t.type === "linkedin" && patch.status === "done" ? t.body : null,
    });
    if (patch.status === "done" && c?.status === "new") await update("contacts", c.id, { status: "contacted" }, workspaceId);
  }
  return one<Task>("SELECT * FROM tasks WHERE id = ?", [id]);
}

export async function deleteTask(workspaceId: string, id: string) {
  const n = await run("DELETE FROM tasks WHERE id = ? AND workspace_id = ?", [id, workspaceId]);
  if (!n) throw new HttpError(404, "Task not found");
}

/** (Re)write a task's LinkedIn note / call talk-track with AI and save it. */
export async function aiTaskContent(ws: Workspace, taskId: string): Promise<Task> {
  requireAI(ws);
  const t = await one<Task>("SELECT * FROM tasks WHERE id = ? AND workspace_id = ?", [taskId, ws.id]);
  if (!t) throw new HttpError(404, "Task not found");
  if (!t.contact_id) throw new HttpError(400, "This task isn't linked to a contact");
  const c = await requireContact(ws.id, t.contact_id);
  const step = t.step_id ? await one<SequenceStep>("SELECT * FROM sequence_steps WHERE id = ?", [t.step_id]) : null;
  const kind: StepType | "linkedin" | "call" = step?.type ?? (t.type === "linkedin" ? "linkedin" : t.type === "call" ? "call" : "task");
  const body = await writeTaskContent(ws, c, kind, step?.body ? renderTemplate(step.body, c, ws) : t.body || "", step?.instructions || (t.type === "todo" ? t.title : null));
  await update("tasks", t.id, { body }, ws.id);
  return (await one<Task>("SELECT * FROM tasks WHERE id = ?", [t.id]))!;
}

/* ------------------------------------------------------------------ */
/* Power dialer & calls                                                */
/* ------------------------------------------------------------------ */

export async function dialerQueue(workspaceId: string, opts: { listId?: string; includeRecent?: boolean } = {}): Promise<QueueContact[]> {
  await ensureEngageSchema();
  const where = [
    "c.workspace_id = ?",
    "c.phone IS NOT NULL AND trim(c.phone) <> ''",
    "c.status NOT IN ('not_interested','customer','bounced')",
  ];
  const args: string[] = [workspaceId];
  if (opts.listId) {
    where.push("c.id IN (SELECT lm.contact_id FROM list_members lm JOIN lists l ON l.id = lm.list_id WHERE lm.list_id = ? AND l.workspace_id = ?)");
    args.push(opts.listId, workspaceId);
  }
  const rows = await all<QueueContact>(
    `SELECT * FROM (
       SELECT c.*, co.name AS company_name, co.domain AS company_domain, co.industry AS company_industry, co.size AS company_size,
         co.description AS company_description, co.website AS company_website,
         (SELECT t.id FROM tasks t WHERE t.contact_id = c.id AND t.workspace_id = c.workspace_id AND t.type = 'call' AND t.status = 'open' ORDER BY t.due_at LIMIT 1) AS call_task_id,
         (SELECT t.title FROM tasks t WHERE t.contact_id = c.id AND t.workspace_id = c.workspace_id AND t.type = 'call' AND t.status = 'open' ORDER BY t.due_at LIMIT 1) AS call_task_title,
         (SELECT t.body FROM tasks t WHERE t.contact_id = c.id AND t.workspace_id = c.workspace_id AND t.type = 'call' AND t.status = 'open' ORDER BY t.due_at LIMIT 1) AS call_task_body,
         (SELECT MAX(k.created_at) FROM calls k WHERE k.contact_id = c.id AND k.workspace_id = c.workspace_id) AS last_call_at,
         (SELECT k.outcome FROM calls k WHERE k.contact_id = c.id AND k.workspace_id = c.workspace_id ORDER BY k.created_at DESC LIMIT 1) AS last_outcome,
         (SELECT COUNT(*) FROM calls k WHERE k.contact_id = c.id AND k.workspace_id = c.workspace_id) AS call_count
       FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
       WHERE ${where.join(" AND ")}
     ) q
     ${opts.includeRecent ? "" : "WHERE q.call_task_id IS NOT NULL OR q.last_call_at IS NULL OR q.last_call_at < datetime('now', '-20 hours')"}
     ORDER BY (q.call_task_id IS NULL), COALESCE(q.score, -1) DESC, (q.last_call_at IS NOT NULL), q.last_call_at ASC
     LIMIT 200`,
    args,
  );
  return rows.map((r) => ({ ...r, call_count: Number(r.call_count) }));
}

export async function logCall(
  ws: Workspace,
  input: { contactId: string; outcome: CallOutcome; duration_sec?: number; notes?: string; summary?: string; taskId?: string; followUp?: { title: string; due_at?: string } | null },
) {
  const valid: CallOutcome[] = ["connected", "voicemail", "no_answer", "wrong_number", "meeting_booked", "not_interested"];
  if (!valid.includes(input.outcome)) throw new HttpError(400, "Choose a call outcome");
  const c = await requireContact(ws.id, input.contactId);
  const id = await insert("calls", {
    workspace_id: ws.id,
    contact_id: c.id,
    outcome: input.outcome,
    duration_sec: Math.max(0, Math.round(Number(input.duration_sec) || 0)),
    notes: input.notes?.trim() || null,
    summary: input.summary?.trim() || null,
  });
  const label = input.outcome.replace(/_/g, " ");
  await logActivity(ws.id, {
    type: "call",
    contact_id: c.id,
    company_id: c.company_id,
    title: `Call with ${name(c)}: ${label}`,
    body: input.summary?.trim() || input.notes?.trim() || null,
  });
  // Complete the call task(s) this call satisfies.
  if (input.taskId) await run("UPDATE tasks SET status = 'done' WHERE id = ? AND workspace_id = ?", [input.taskId, ws.id]);
  await run("UPDATE tasks SET status = 'done' WHERE workspace_id = ? AND contact_id = ? AND type = 'call' AND status = 'open' AND COALESCE(due_at, created_at) <= datetime('now', '+1 day')", [ws.id, c.id]);

  if (input.outcome === "meeting_booked") {
    if (c.status !== "customer") await update("contacts", c.id, { status: "interested" }, ws.id);
    await run("UPDATE enrollments SET status = 'replied', next_run_at = NULL WHERE workspace_id = ? AND contact_id = ? AND status IN ('active','paused')", [ws.id, c.id]);
    await logActivity(ws.id, { type: "meeting", contact_id: c.id, company_id: c.company_id, title: `Meeting booked with ${name(c)}` });
  } else if (input.outcome === "not_interested") {
    await update("contacts", c.id, { status: "not_interested" }, ws.id);
    await run("UPDATE enrollments SET status = 'replied', next_run_at = NULL WHERE workspace_id = ? AND contact_id = ? AND status IN ('active','paused')", [ws.id, c.id]);
  } else if (c.status === "new") {
    await update("contacts", c.id, { status: "contacted" }, ws.id);
  }
  if (input.followUp?.title?.trim()) {
    await createTask(ws.id, { type: "todo", title: input.followUp.title, due_at: input.followUp.due_at || inDays(2).replace(" ", "T") + "Z", contactId: c.id });
  }
  return id;
}

export async function listCalls(workspaceId: string, limit = 50): Promise<CallRow[]> {
  return all<CallRow>(
    `SELECT k.id, k.contact_id, k.outcome, k.duration_sec, k.notes, k.summary, k.created_at, c.first_name, c.last_name, co.name AS company_name
     FROM calls k LEFT JOIN contacts c ON c.id = k.contact_id LEFT JOIN companies co ON co.id = c.company_id
     WHERE k.workspace_id = ? ORDER BY k.created_at DESC LIMIT ?`,
    [workspaceId, limit],
  );
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export async function engageStats(workspaceId: string): Promise<EngageStats> {
  await ensureEngageSchema();
  const m = await one<{ sent: number; opened: number; replied: number; interested: number }>(
    `SELECT
       SUM(CASE WHEN direction = 'out' AND status = 'sent' THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN direction = 'out' AND opened_at IS NOT NULL THEN 1 ELSE 0 END) AS opened,
       COUNT(DISTINCT CASE WHEN direction = 'in' THEN contact_id END) AS replied,
       COUNT(DISTINCT CASE WHEN direction = 'in' AND sentiment = 'interested' THEN contact_id END) AS interested
     FROM messages WHERE workspace_id = ?`,
    [workspaceId],
  );
  const e = await one<{ n: number }>("SELECT COUNT(*) AS n FROM enrollments WHERE workspace_id = ? AND status = 'active'", [workspaceId]);
  const t = await one<{ n: number }>("SELECT COUNT(*) AS n FROM tasks WHERE workspace_id = ? AND status = 'open'", [workspaceId]);
  const k = await one<{ n: number }>("SELECT COUNT(*) AS n FROM calls WHERE workspace_id = ?", [workspaceId]);
  return {
    sent: Number(m?.sent || 0),
    opened: Number(m?.opened || 0),
    replied: Number(m?.replied || 0),
    interested: Number(m?.interested || 0),
    activeEnrollments: Number(e?.n || 0),
    openTasks: Number(t?.n || 0),
    calls: Number(k?.n || 0),
  };
}

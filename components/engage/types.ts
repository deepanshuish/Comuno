// Client-safe types and constants for the Engage module (sequences, inbox, dialer, tasks).
import type { Contact, Enrollment, Message, Sequence, SequenceStep, StepType, Task } from "@/lib/types";

export type MailerMode = { mode: "smtp" | "sandbox"; source: "workspace" | "env" | null; from: string | null; host: string | null };

/** Message row plus the delivery columns Engage adds (see ensureEngageSchema). */
export type EngageMessage = Message & {
  delivery?: "smtp" | "sandbox" | null;
  error?: string | null;
  clicked_at?: string | null;
  provider_id?: string | null;
  to_email?: string | null;
  from_email?: string | null;
};

export type Sentiment = "interested" | "not_interested" | "objection" | "ooo" | "referral" | "neutral";

export const SENTIMENTS: { id: Sentiment; label: string; tone: "green" | "red" | "amber" | "blue" | "violet" | "zinc" }[] = [
  { id: "interested", label: "Interested", tone: "green" },
  { id: "not_interested", label: "Not interested", tone: "red" },
  { id: "objection", label: "Objection", tone: "amber" },
  { id: "ooo", label: "Out of office", tone: "blue" },
  { id: "referral", label: "Referral", tone: "violet" },
  { id: "neutral", label: "Neutral", tone: "zinc" },
];

export const STEP_TYPES: { id: StepType; label: string; short: string }[] = [
  { id: "email", label: "Email", short: "Email" },
  { id: "linkedin_connect", label: "LinkedIn connection request", short: "LinkedIn connect" },
  { id: "linkedin_message", label: "LinkedIn message", short: "LinkedIn message" },
  { id: "call", label: "Phone call", short: "Call" },
  { id: "task", label: "Manual task", short: "Task" },
];

export const MERGE_FIELDS = ["first_name", "last_name", "full_name", "title", "company", "sender_name"] as const;

export const CALL_OUTCOMES = [
  { id: "connected", label: "Connected", tone: "green" },
  { id: "meeting_booked", label: "Meeting booked", tone: "violet" },
  { id: "voicemail", label: "Left voicemail", tone: "blue" },
  { id: "no_answer", label: "No answer", tone: "zinc" },
  { id: "not_interested", label: "Not interested", tone: "red" },
  { id: "wrong_number", label: "Wrong number", tone: "amber" },
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number]["id"];

export type SequenceSummary = Sequence & {
  steps: number;
  enrolled: number;
  active: number;
  contacted: number;
  replied: number;
  sent: number;
  opened: number;
  channels: string | null;
};

export type EnrollmentRow = Enrollment & {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
  company_name: string | null;
  contact_status: string;
};

export type SequenceDetail = {
  sequence: Sequence;
  steps: SequenceStep[];
  enrollments: EnrollmentRow[];
  stats: { enrolled: number; active: number; completed: number; replied: number; sent: number; opened: number; contacted: number };
  stepStats: Record<string, { sent: number; opened: number; tasks: number }>;
  mailer: MailerMode;
};

export type EngageStats = {
  sent: number;
  opened: number;
  replied: number;
  interested: number;
  activeEnrollments: number;
  openTasks: number;
  calls: number;
};

export type PickerContact = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  status: string;
  company_name: string | null;
  enrolled?: number;
};

export type InboxThread = {
  contact: Pick<Contact, "id" | "first_name" | "last_name" | "email" | "title" | "status"> & { company_name: string | null };
  last: EngageMessage;
  count: number;
  inbound: number;
  sentiment: Sentiment | null;
  needsReply: boolean;
};

export type InboxCounts = Record<"all" | "needs_reply" | "interested" | "not_interested" | "ooo" | "sent", number>;

export type ThreadDetail = {
  contact: Contact;
  messages: EngageMessage[];
  enrollments: (Enrollment & { sequence_name: string })[];
};

export type TaskRow = Task & {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  title_text: string | null;
  company_name: string | null;
  sequence_name: string | null;
  step_type: StepType | null;
};

export type QueueContact = Contact & {
  company_industry: string | null;
  company_size: string | null;
  company_description: string | null;
  company_website: string | null;
  call_task_id: string | null;
  call_task_title: string | null;
  call_task_body: string | null;
  last_call_at: string | null;
  last_outcome: string | null;
  call_count: number;
};

export type CallRow = {
  id: string;
  contact_id: string | null;
  outcome: string | null;
  duration_sec: number | null;
  notes: string | null;
  summary: string | null;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) or ISO → Date. */
export function parseDbDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatWhen(s: string | null | undefined): string {
  const d = parseDbDate(s);
  if (!d) return "—";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

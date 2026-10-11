// Shared row types. Safe to import from client components.

export type User = {
  id: string;
  workspace_id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  company_name: string | null;
  company_website: string | null;
  product_description: string | null;
  value_prop: string | null;
  icp_json: string | null;
  sender_name: string | null;
  sender_email: string | null;
  signature: string | null;
  smtp_json: string | null;
  gemini_api_key: string | null;
  credits: number;
  plan: string;
  tracking_key: string;
  created_at: string;
};

export type ICP = {
  industries?: string[];
  company_sizes?: string[];
  locations?: string[];
  titles?: string[];
  seniorities?: string[];
  keywords?: string[];
  notes?: string;
};

export type Company = {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  size: string | null;
  location: string | null;
  description: string | null;
  funding: string | null;
  tech_json: string | null;
  enrichment_json: string | null;
  score: number | null;
  score_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactStatus = "new" | "contacted" | "replied" | "interested" | "not_interested" | "customer" | "bounced";
export type EmailStatus = "unknown" | "valid" | "risky" | "invalid";

export type Contact = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  email_status: EmailStatus;
  phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  seniority: string | null;
  department: string | null;
  source: string | null;
  score: number | null;
  score_reason: string | null;
  status: ContactStatus;
  tags: string | null;
  notes: string | null;
  enrichment_json: string | null;
  created_at: string;
  updated_at: string;
  // joined
  company_name?: string | null;
  company_domain?: string | null;
};

export type StepType = "email" | "linkedin_connect" | "linkedin_message" | "call" | "task";

export type Sequence = {
  id: string;
  workspace_id: string;
  name: string;
  goal: string | null;
  status: "draft" | "active" | "paused";
  created_at: string;
};

export type SequenceStep = {
  id: string;
  sequence_id: string;
  position: number;
  type: StepType;
  delay_days: number;
  subject: string | null;
  body: string | null;
  ai_personalize: number;
  instructions: string | null;
};

export type Enrollment = {
  id: string;
  workspace_id: string;
  sequence_id: string;
  contact_id: string;
  status: "active" | "paused" | "completed" | "replied" | "bounced";
  current_step: number;
  next_run_at: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  enrollment_id: string | null;
  step_id: string | null;
  channel: "email" | "linkedin";
  direction: "out" | "in";
  subject: string | null;
  body: string | null;
  status: "draft" | "scheduled" | "sent" | "failed" | "received";
  sentiment: string | null;
  thread_id: string | null;
  opened_at: string | null;
  sent_at: string | null;
  created_at: string;
};

export type Task = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  enrollment_id: string | null;
  step_id: string | null;
  type: "call" | "linkedin" | "todo" | "email";
  title: string;
  body: string | null;
  due_at: string | null;
  status: "open" | "done" | "skipped";
  created_at: string;
};

export type DealStage = "lead" | "qualified" | "meeting" | "proposal" | "negotiation" | "won" | "lost";

export const DEAL_STAGES: { id: DealStage; label: string; probability: number }[] = [
  { id: "lead", label: "Lead", probability: 10 },
  { id: "qualified", label: "Qualified", probability: 25 },
  { id: "meeting", label: "Meeting booked", probability: 40 },
  { id: "proposal", label: "Proposal", probability: 60 },
  { id: "negotiation", label: "Negotiation", probability: 80 },
  { id: "won", label: "Closed won", probability: 100 },
  { id: "lost", label: "Closed lost", probability: 0 },
];

export type Deal = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  name: string;
  stage: DealStage;
  value: number;
  probability: number | null;
  close_date: string | null;
  notes: string | null;
  ai_insight: string | null;
  created_at: string;
  updated_at: string;
};

export type Activity = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  company_id: string | null;
  deal_id: string | null;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
};

export type SignalType = "visit" | "funding" | "hiring" | "job_change" | "news" | "intent" | "leadership" | "product" | "expansion";

export type Signal = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  type: SignalType;
  title: string;
  body: string | null;
  url: string | null;
  score: number | null;
  seen: number;
  created_at: string;
};

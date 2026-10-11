/**
 * Postgres schema (Supabase). Applied automatically and idempotently on first
 * database use; you can also paste it into Supabase → SQL Editor.
 */
export const SCHEMA = `CREATE TABLE IF NOT EXISTS workspaces (
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
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
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
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
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
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_ws ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);
CREATE TABLE IF NOT EXISTS lists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
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
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
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
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
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
  opened_at TEXT, sent_at TEXT, clicked_at TEXT,
  delivery TEXT, error TEXT, provider_id TEXT, to_email TEXT, from_email TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
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
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  contact_id TEXT,
  outcome TEXT, duration_sec INTEGER,
  notes TEXT, summary TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  company_id TEXT, contact_id TEXT,
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'lead',
  value DOUBLE PRECISION NOT NULL DEFAULT 0,
  probability INTEGER,
  close_date TEXT,
  notes TEXT, ai_insight TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')),
  updated_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  seq BIGSERIAL,
  workspace_id TEXT NOT NULL,
  contact_id TEXT, company_id TEXT, deal_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
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
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  seq BIGSERIAL,
  workspace_id TEXT NOT NULL,
  visitor_id TEXT,
  contact_id TEXT, company_id TEXT,
  url TEXT, title TEXT, referrer TEXT,
  ip TEXT, org TEXT, city TEXT, country TEXT, user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS agent_threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS agent_messages (
  id TEXT PRIMARY KEY,
  seq BIGSERIAL,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'))
);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_due ON enrollments(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_tasks_ws_status ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_visits_ws ON visits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_signals_ws ON signals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_thread ON agent_messages(thread_id, seq);

-- Timestamps are stored as UTC text 'YYYY-MM-DD HH:MM:SS'. These helpers give
-- queries the familiar datetime(value[, modifier]) / date(value[, modifier]) semantics.
CREATE OR REPLACE FUNCTION sqlite_datetime(v text, modifier text DEFAULT NULL) RETURNS text
LANGUAGE sql STABLE AS $fn$
  SELECT CASE WHEN v IS NULL THEN NULL ELSE to_char(
    (CASE
      WHEN lower(v) = 'now' THEN now() AT TIME ZONE 'utc'
      WHEN v ~ '(Z|[+-][0-9][0-9](:?[0-9][0-9])?)$' THEN v::timestamptz AT TIME ZONE 'utc'
      ELSE v::timestamp
    END) + COALESCE(modifier::interval, interval '0'),
    'YYYY-MM-DD HH24:MI:SS') END
$fn$;
CREATE OR REPLACE FUNCTION sqlite_date(v text, modifier text DEFAULT NULL) RETURNS text
LANGUAGE sql STABLE AS $fn$ SELECT substr(sqlite_datetime(v, modifier), 1, 10) $fn$;

-- Comuno talks to Postgres directly from the server. Enabling RLS with no policies
-- keeps these tables private from Supabase's public Data API (publishable/anon key).
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
`;

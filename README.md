# Comuno

**Comuno is an AI-native outbound sales platform.** Reps work alongside AI agents to find, qualify and engage high-intent buyers, all in one place instead of a fragmented sales stack.
**Google Gemini** is the AI engine throughout.

| Module | What it does |
| --- | --- |
| **Agent** | Natural-language AI teammate (Gemini function calling) that prospects, researches, enriches, writes, builds sequences and manages deals. Outward-facing actions wait for your approval. Also available inside Claude and other assistants through the built-in **MCP server**. |
| **Prospect** | AI lead and account discovery grounded in live Google Search, People and Companies databases, lists, CSV import and export, waterfall enrichment, an email finder and verifier (pattern + MX checks), and ICP fit scoring. |
| **Engage** | Multi-channel sequences (email, LinkedIn, calls, tasks) with AI personalization per prospect, a scheduler, SMTP sending with open tracking, a unified inbox with AI reply classification and drafting, a power dialer with AI call scripts and summaries, and a task queue. |
| **Manage** | Deals Kanban CRM, activity timelines, AI deal insights (next best action and risks), and analytics: funnel, outreach performance, pipeline, win rate, credit usage. |
| **Signals** | Website visitor identification (person- and company-level) via a tracking script, plus AI-sourced buying signals (funding, hiring, leadership changes, launches) and job-change alerts. |
| **Platform** | Workspaces, auth, a credits system, a company profile and ICP (autofilled from your website by Gemini), API keys, a REST API and an MCP server. |

## Quick start

```bash
cp .env.example .env.local   # add your GEMINI_API_KEY
npm install
npm run dev
```

Open http://localhost:3000, click **Start for free**, then go to **Settings → Company profile** and use **Autofill with AI**.

Get a Gemini key at https://aistudio.google.com/apikey. You can also set a key per workspace in **Settings → AI engine**.

## Configuration

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API key (required for AI features). |
| `GEMINI_MODEL` | Default model. Defaults to `gemini-flash-latest`. |
| `GEMINI_PRO_MODEL` | Model for heavier research. Defaults to `gemini-pro-latest`. |
| `GEMINI_AGENT_MODEL` | Model that drives the Agent. Defaults to `GEMINI_MODEL`. |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | libSQL database. Defaults to a local SQLite file at `data/comuno.db`. Use a [Turso](https://turso.tech) URL on serverless hosts. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Default sending mailbox. Can be set per workspace in Settings. Without one, sending runs in **sandbox mode**: messages are recorded but not delivered. |
| `CRON_SECRET` | Bearer token for `POST /api/cron/process`, the sequence scheduler. |

### Scheduler

Sequences advance when `POST /api/cron/process` runs. Call it every 5–10 minutes from any cron (Vercel Cron, GitHub Actions, cron-job.org):

```bash
curl -X POST https://your-host/api/cron/process -H "Authorization: Bearer $CRON_SECRET"
```

You can also click **Run now** on the Sequences page.

### Website visitor tracking

Copy the snippet from **Website visitors** and add it to your site:

```html
<script async src="https://your-host/t.js" data-key="YOUR_TRACKING_KEY"></script>
```

## API

Create an API key in **Settings → API & integrations**, then send it as `Authorization: Bearer <key>`.

- `GET /api/v1/contacts?q=&status=&limit=&offset=` lists and searches people.
- `POST /api/v1/contacts` creates people (one object or an array), deduplicated.
- `GET /api/v1/companies` and `GET /api/v1/deals` list records.
- `POST /api/v1/agent` with `{ "message": "...", "threadId": "optional" }` runs the agent.
- `POST /api/inbox/inbound` is a webhook that logs an inbound email reply.

### MCP server (use Comuno inside Claude)

Comuno exposes its agent tools at `/api/mcp` (Streamable HTTP):

```json
{
  "mcpServers": {
    "comuno": {
      "type": "http",
      "url": "https://your-host/api/mcp",
      "headers": { "Authorization": "Bearer <YOUR_API_KEY>" }
    }
  }
}
```

## Architecture

- **Next.js 16** App Router, React 19, Tailwind CSS v4, TypeScript.
- `lib/gemini.ts` is the Gemini engine: text, structured JSON (JSON Schema), Google Search grounding with sources, and function calling.
- `lib/db.ts` is the libSQL/SQLite data layer; the schema is created automatically on first run.
- `lib/services/*` holds the domain logic for each module (prospect, engage, crm, signals, agent). Route handlers in `app/api/*` stay thin.
- `lib/services/agent-tools.ts` is the single tool registry shared by the in-app Agent and the MCP server.
- `app/(platform)/*` holds the authenticated app; `app/page.tsx` is the marketing site.
- Credits: each AI or data action costs credits (`lib/credits.ts`). New workspaces get 2,000.

See `docs/CONVENTIONS.md` for engineering conventions.

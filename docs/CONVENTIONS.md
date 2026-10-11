# Comuno platform — engineering conventions

Comuno is an AI-native outbound sales platform (FuseAI-style): Prospect → Engage → Manage → Signals,
plus a natural-language Agent. **Google Gemini is the only AI engine.**

## Stack
- Next.js 16 App Router (read `node_modules/next/dist/docs/` when unsure — APIs differ from older versions):
  - Middleware is now `proxy.ts`. Route/page `params` are **Promises** (`await params`).
  - `cookies()` / `headers()` are async.
- TypeScript strict, Tailwind v4 (utility classes), lucide-react icons, React 19.
- DB: Postgres (Supabase) via `lib/db.ts` helpers `all`, `one`, `run`, `insert`, `update`, `newId`, `parseJson`.
  Write SQL with `?` placeholders; `toPg()` converts them and maps `datetime()/date()`, `LIKE`, `GROUP_CONCAT`,
  `INSERT OR IGNORE` and `rowid` (see the header of `lib/db.ts`). Timestamps are UTC text 'YYYY-MM-DD HH:MM:SS'.
  Schema lives in `lib/schema.ts`; add tables with `CREATE TABLE IF NOT EXISTS` and columns with
  `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, and enable RLS on new tables. Postgres is strict about `GROUP BY`:
  group by the primary key of every joined table whose columns you select.
- Every row has `workspace_id`; **every query must be scoped by workspace_id**.

## Server
- `lib/auth.ts`: `requireCtx()` (pages), `getCtx()`, `HttpError`. `Ctx = { user, workspace }`.
- `lib/api.ts`: wrap route handlers with `route(async ({ req, ctx, params }) => ...)` — returns JSON, maps errors.
  Use `body<T>(req)`, `bad(msg)`, `notFound()`.
- `lib/gemini.ts`: `generateText`, `generateJSON<T>({ schema, search? })`, `generateWithTools`, `sellerContext(ws)`,
  `DEFAULT_MODEL`, `PRO_MODEL`. `search: true` grounds in live Google Search and returns `sources`.
- `lib/credits.ts`: `withCredits(ws, action, units, fn)` around every paid AI/data call. Costs in `CREDIT_COSTS`.
- `lib/services/core.ts`: `logActivity`, `getContact`, `getCompany`, `upsertCompany`, `normalizeDomain`,
  `contactBrief(wsId, contactId)` (prompt-ready prospect context), `renderTemplate`.
- Put domain logic in `lib/services/<module>.ts` (exported functions taking `ws: Workspace` / `workspaceId`),
  and keep route handlers thin. The Agent calls these service functions directly as tools.
- API routes live under `app/api/<module>/...`.

## Client
- Pages live in `app/(platform)/<route>/page.tsx` (layout provides the sidebar & auth).
  Make the page a `"use client"` component (or a server component that renders client components).
- `lib/client.ts`: `api`, `post`, `patch`, `del`, `useApi<T>(url)`, `useAction(fn)`, `fullName`, `timeAgo`, `money`.
- `components/app/ui.tsx`: Button (variants primary/secondary/ghost/danger/ai), Card, CardHeader, PageHeader,
  Input, Textarea, Select, Field, Badge, Score, Spinner, Loading, Empty, ErrorNote, Modal, Drawer, Tabs, Stat,
  Table/Th/Td, Avatar, Sources, cx.
- Visual style: light, quiet, zinc neutrals; `font-serif` for page titles (PageHeader does this); violet for AI actions
  (`variant="ai"`). Text sizes 13px for UI. Must work at phone width (no horizontal page scroll; tables scroll inside their card).
- Every AI action shows a loading state and surfaces errors (e.g. "Gemini is not configured") with `ErrorNote`.
- `lib/types.ts` has the row types (`Contact`, `Company`, `Deal`, `DEAL_STAGES`, `Signal`, …).

## Don'ts
- Don't add new npm dependencies without need (available: @google/genai, @libsql/client, nodemailer, papaparse, framer-motion, lucide-react).
- Don't edit files owned by another module (see ownership in your brief). Shared files (`lib/db.ts` schema,
  `lib/types.ts`) may be appended to, carefully.
- Don't fabricate data presented as real. AI-discovered prospects must come from search-grounded Gemini calls with sources.

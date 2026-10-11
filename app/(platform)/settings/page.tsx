"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { del, patch, post, timeAgo, useApi } from "@/lib/client";
import type { ICP, Workspace } from "@/lib/types";
import { Badge, Button, Card, CardHeader, ErrorNote, Field, Input, Loading, PageHeader, Sources, Table, Tabs, Td, Textarea, Th } from "@/components/app/ui";

type SettingsData = {
  workspace: Workspace;
  env: { gemini: boolean; smtp: boolean; model: string };
  user: { email: string; name: string | null };
  ledger: { amount: number; reason: string; created_at: string }[];
};
type TabId = "company" | "icp" | "email" | "ai" | "api" | "billing";

export default function SettingsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as TabId) || "company";
  const { data, error, reload } = useApi<SettingsData>("/api/settings");

  return (
    <>
      <PageHeader title="Settings" subtitle="Your company profile powers every AI-written message, score and insight." />
      {params.get("welcome") && (
        <Card className="mb-6 border-violet-200 bg-violet-50/60 px-5 py-4">
          <div className="text-sm font-semibold text-violet-900">Welcome to Comuno 👋</div>
          <p className="mt-1 text-[13px] text-violet-800">
            Start by entering your website below and clicking <b>Autofill with AI</b>. Gemini will research your company and draft your profile and ideal customer profile.
          </p>
        </Card>
      )}
      <Tabs<TabId>
        value={tab}
        onChange={(t) => router.replace(`/settings?tab=${t}`)}
        tabs={[
          { id: "company", label: "Company profile" },
          { id: "icp", label: "Ideal customer" },
          { id: "email", label: "Email & sending" },
          { id: "ai", label: "AI engine" },
          { id: "api", label: "API & integrations" },
          { id: "billing", label: "Plan & credits" },
        ]}
      />
      <div className="mt-6">
        <ErrorNote error={error} />
        {!data ? (
          !error && <Loading />
        ) : tab === "company" ? (
          <CompanyTab ws={data.workspace} onSaved={reload} />
        ) : tab === "icp" ? (
          <IcpTab ws={data.workspace} onSaved={reload} />
        ) : tab === "email" ? (
          <EmailTab ws={data.workspace} envSmtp={data.env.smtp} onSaved={reload} />
        ) : tab === "ai" ? (
          <AiTab ws={data.workspace} env={data.env} onSaved={reload} />
        ) : tab === "api" ? (
          <ApiTab />
        ) : (
          <BillingTab ws={data.workspace} ledger={data.ledger} />
        )}
      </div>
    </>
  );
}

function useSave(onSaved: () => void) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      await patch("/api/settings", body);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return { save, saving, saved, error };
}

function SaveBar({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-5 py-3">
      {saved && (
        <span className="flex items-center gap-1 text-xs text-emerald-600">
          <Check className="size-3.5" /> Saved
        </span>
      )}
      <Button variant="primary" loading={saving} onClick={onClick}>
        Save changes
      </Button>
    </div>
  );
}

function CompanyTab({ ws, onSaved }: { ws: Workspace; onSaved: () => void }) {
  const [f, setF] = useState({
    name: ws.name || "",
    company_name: ws.company_name || "",
    company_website: ws.company_website || "",
    product_description: ws.product_description || "",
    value_prop: ws.value_prop || "",
  });
  const { save, saving, saved, error } = useSave(onSaved);
  const [auto, setAuto] = useState<{ loading: boolean; error: string | null; sources?: { title: string; url: string }[] }>({ loading: false, error: null });

  async function autofill() {
    setAuto({ loading: true, error: null });
    try {
      const r = await post<{ profile: { company_name: string; product_description: string; value_prop: string; icp: ICP }; sources: { title: string; url: string }[] }>(
        "/api/settings/autofill",
        { website: f.company_website },
      );
      const next = {
        ...f,
        company_name: r.profile.company_name || f.company_name,
        product_description: r.profile.product_description,
        value_prop: r.profile.value_prop,
      };
      setF(next);
      await save({ ...next, icp_json: JSON.stringify(r.profile.icp) });
      setAuto({ loading: false, error: null, sources: r.sources });
    } catch (e) {
      setAuto({ loading: false, error: (e as Error).message });
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Card>
      <CardHeader title="Company profile" subtitle="Used as seller context in every Gemini prompt." />
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        <Field label="Workspace name">
          <Input value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Company name">
          <Input value={f.company_name} onChange={set("company_name")} />
        </Field>
        <Field label="Website" className="sm:col-span-2" hint="Autofill researches your site with Gemini and Google Search, and drafts your profile and ICP (10 credits).">
          <div className="flex gap-2">
            <Input value={f.company_website} onChange={set("company_website")} placeholder="https://yourcompany.com" />
            <Button variant="ai" loading={auto.loading} disabled={!f.company_website} onClick={autofill}>
              Autofill with AI
            </Button>
          </div>
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote error={auto.error} />
          <Sources sources={auto.sources} />
        </div>
        <Field label="What you sell" className="sm:col-span-2">
          <Textarea rows={3} value={f.product_description} onChange={set("product_description")} placeholder="We help B2B SaaS teams…" />
        </Field>
        <Field label="Value proposition" className="sm:col-span-2">
          <Textarea rows={2} value={f.value_prop} onChange={set("value_prop")} placeholder="Customers cut onboarding time by 40%…" />
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote error={error} />
        </div>
      </div>
      <SaveBar saving={saving} saved={saved} onClick={() => save(f)} />
    </Card>
  );
}

const ICP_FIELDS: { key: keyof ICP; label: string; placeholder: string }[] = [
  { key: "industries", label: "Industries", placeholder: "SaaS, Fintech, Healthcare IT" },
  { key: "company_sizes", label: "Company sizes", placeholder: "11-50, 51-200, 201-500" },
  { key: "locations", label: "Locations", placeholder: "United States, United Kingdom, India" },
  { key: "titles", label: "Buyer titles", placeholder: "VP Sales, Head of Revenue, CRO" },
  { key: "seniorities", label: "Seniority", placeholder: "VP, Director, C-level" },
  { key: "keywords", label: "Keywords", placeholder: "outbound, SDR team, Salesforce" },
];

function IcpTab({ ws, onSaved }: { ws: Workspace; onSaved: () => void }) {
  const initial: ICP = (() => {
    try {
      return ws.icp_json ? JSON.parse(ws.icp_json) : {};
    } catch {
      return {};
    }
  })();
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries([...ICP_FIELDS.map((x) => [x.key, ((initial[x.key] as string[]) || []).join(", ")]), ["notes", initial.notes || ""]]),
  );
  const { save, saving, saved, error } = useSave(onSaved);
  function submit() {
    const icp: ICP = { notes: f.notes };
    for (const x of ICP_FIELDS) (icp[x.key] as string[]) = f[x.key].split(",").map((s) => s.trim()).filter(Boolean);
    save({ icp_json: JSON.stringify(icp) });
  }
  return (
    <Card>
      <CardHeader title="Ideal customer profile" subtitle="Drives lead discovery defaults and the 0–100 fit score on every person and company. Separate values with commas." />
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
        {ICP_FIELDS.map((x) => (
          <Field key={x.key} label={x.label}>
            <Input value={f[x.key]} placeholder={x.placeholder} onChange={(e) => setF({ ...f, [x.key]: e.target.value })} />
          </Field>
        ))}
        <Field label="Qualification notes" className="sm:col-span-2">
          <Textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Must have an outbound team of 3+ SDRs; recently raised…" />
        </Field>
        <div className="sm:col-span-2">
          <ErrorNote error={error} />
        </div>
      </div>
      <SaveBar saving={saving} saved={saved} onClick={submit} />
    </Card>
  );
}

function EmailTab({ ws, envSmtp, onSaved }: { ws: Workspace; envSmtp: boolean; onSaved: () => void }) {
  const smtp = (() => {
    try {
      return ws.smtp_json ? JSON.parse(ws.smtp_json) : {};
    } catch {
      return {};
    }
  })();
  const [f, setF] = useState({ sender_name: ws.sender_name || "", sender_email: ws.sender_email || "", signature: ws.signature || "" });
  const [s, setS] = useState({ host: smtp.host || "", port: String(smtp.port || "587"), secure: !!smtp.secure, user: smtp.user || "", pass: smtp.pass || "", from: smtp.from || "" });
  const { save, saving, saved, error } = useSave(onSaved);
  function submit() {
    const smtp_json = s.host ? JSON.stringify({ host: s.host, port: Number(s.port) || 587, secure: s.secure, user: s.user, pass: s.pass, from: s.from || undefined }) : null;
    save({ ...f, smtp_json });
  }
  const sending = ws.smtp_json || envSmtp;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Sender identity" />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
          <Field label="Sender name">
            <Input value={f.sender_name} onChange={(e) => setF({ ...f, sender_name: e.target.value })} />
          </Field>
          <Field label="Reply-to email">
            <Input type="email" value={f.sender_email} onChange={(e) => setF({ ...f, sender_email: e.target.value })} />
          </Field>
          <Field label="Email signature" className="sm:col-span-2">
            <Textarea rows={3} value={f.signature} onChange={(e) => setF({ ...f, signature: e.target.value })} placeholder={"Ada Lovelace\nHead of Growth, Acme"} />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader
          title="Sending mailbox (SMTP)"
          subtitle="Connect Google Workspace, Microsoft 365 or any SMTP provider. Use an app password for Gmail/Outlook."
          actions={sending ? <Badge tone="green">Connected{!ws.smtp_json && envSmtp ? " (env)" : ""}</Badge> : <Badge tone="amber">Sandbox mode</Badge>}
        />
        {!sending && (
          <p className="border-b border-zinc-100 bg-amber-50/50 px-5 py-2.5 text-xs text-amber-800">
            No mailbox connected: emails are recorded as sent in sandbox mode but not delivered.
          </p>
        )}
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-3">
          <Field label="SMTP host" className="sm:col-span-2">
            <Input value={s.host} onChange={(e) => setS({ ...s, host: e.target.value })} placeholder="smtp.gmail.com" />
          </Field>
          <Field label="Port">
            <Input value={s.port} onChange={(e) => setS({ ...s, port: e.target.value })} />
          </Field>
          <Field label="Username">
            <Input value={s.user} onChange={(e) => setS({ ...s, user: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Password / app password">
            <Input type="password" value={s.pass} onChange={(e) => setS({ ...s, pass: e.target.value })} autoComplete="new-password" />
          </Field>
          <Field label="From address (optional)">
            <Input value={s.from} onChange={(e) => setS({ ...s, from: e.target.value })} placeholder="Ada <ada@acme.com>" />
          </Field>
          <label className="flex items-center gap-2 text-[13px] text-zinc-700 sm:col-span-3">
            <input type="checkbox" checked={s.secure} onChange={(e) => setS({ ...s, secure: e.target.checked })} /> Use TLS from the start (port 465)
          </label>
          <div className="sm:col-span-3">
            <ErrorNote error={error} />
          </div>
        </div>
        <SaveBar saving={saving} saved={saved} onClick={submit} />
      </Card>
    </div>
  );
}

function AiTab({ ws, env, onSaved }: { ws: Workspace; env: SettingsData["env"]; onSaved: () => void }) {
  const [key, setKey] = useState(ws.gemini_api_key || "");
  const { save, saving, saved, error } = useSave(onSaved);
  const [test, setTest] = useState<{ loading: boolean; result?: string; error?: string }>({ loading: false });
  async function runTest() {
    setTest({ loading: true });
    try {
      const r = await post<{ reply: string; model: string; ms: number }>("/api/settings/test-ai");
      setTest({ loading: false, result: `${r.model} replied in ${r.ms} ms: “${r.reply}”` });
    } catch (e) {
      setTest({ loading: false, error: (e as Error).message });
    }
  }
  return (
    <Card>
      <CardHeader
        title="AI engine: Google Gemini"
        subtitle="Comuno uses Gemini for discovery, enrichment, scoring, writing, signals and the Agent. Search-grounded features use Google Search."
        actions={ws.gemini_api_key || env.gemini ? <Badge tone="green">Configured</Badge> : <Badge tone="red">Not configured</Badge>}
      />
      <div className="space-y-4 px-5 py-5">
        <div className="text-[13px] text-zinc-600">
          Model: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">{env.model}</code>
          {env.gemini && <span className="ml-2 text-zinc-500">· A server-wide key is set via <code className="text-xs">GEMINI_API_KEY</code>.</span>}
        </div>
        <Field label="Workspace Gemini API key (optional)" hint={<>Overrides the server key for this workspace. Get one at <a className="underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>.</>}>
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="AIza…" autoComplete="off" />
        </Field>
        <ErrorNote error={error || test.error} />
        {test.result && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{test.result}</div>}
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-5 py-3">
        {saved && <span className="text-xs text-emerald-600">Saved</span>}
        <Button loading={test.loading} onClick={runTest}>
          Test connection
        </Button>
        <Button variant="primary" loading={saving} onClick={() => save({ gemini_api_key: key })}>
          Save key
        </Button>
      </div>
    </Card>
  );
}

type ApiKey = { id: string; name: string; prefix: string; last_used_at: string | null; created_at: string };

function ApiTab() {
  const { data: keys, reload } = useApi<ApiKey[]>("/api/settings/api-keys");
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // This tab only renders after client-side data loads, so window is available.
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  async function create() {
    const r = await post<{ key: string }>("/api/settings/api-keys", { name });
    setCreated(r.key);
    setName("");
    reload();
  }
  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  }
  const mcpConfig = JSON.stringify(
    { mcpServers: { comuno: { type: "http", url: `${origin}/api/mcp`, headers: { Authorization: "Bearer <YOUR_API_KEY>" } } } },
    null,
    2,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="API keys" subtitle="Authenticate the REST API, the MCP server and inbound webhooks with Authorization: Bearer <key>." />
        <div className="flex flex-wrap gap-2 px-5 py-4">
          <Input className="max-w-xs" placeholder="Key name, e.g. Zapier" value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={create}>
            Create key
          </Button>
        </div>
        {created && (
          <div className="mx-5 mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px]">
            <div className="font-medium text-emerald-900">Copy your key now. It won&apos;t be shown again.</div>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2 py-1 text-xs">{created}</code>
              <Button size="sm" icon={<Copy className="size-3" />} onClick={() => copy(created, "new")}>
                {copied === "new" ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Key</Th>
              <Th>Last used</Th>
              <Th>Created</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {keys?.map((k) => (
              <tr key={k.id}>
                <Td className="font-medium text-zinc-900">
                  <KeyRound className="mr-1.5 inline size-3.5 text-zinc-400" />
                  {k.name}
                </Td>
                <Td>
                  <code className="text-xs">{k.prefix}…</code>
                </Td>
                <Td>{k.last_used_at ? timeAgo(k.last_used_at) : "Never"}</Td>
                <Td>{timeAgo(k.created_at)}</Td>
                <Td className="text-right">
                  <button
                    className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Revoke key"
                    onClick={async () => {
                      if (confirm(`Revoke "${k.name}"? Apps using it will stop working.`)) {
                        await del(`/api/settings/api-keys/${k.id}`);
                        reload();
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </Td>
              </tr>
            ))}
            {keys?.length === 0 && (
              <tr>
                <Td className="py-6 text-center text-zinc-500">
                  No API keys yet.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
      <Card>
        <CardHeader title="Use Comuno inside Claude and other AI assistants (MCP)" subtitle="Comuno exposes its agent tools as an MCP server: prospect, enrich, write, sequence and manage deals from any MCP client." />
        <div className="px-5 py-4">
          <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs leading-relaxed text-zinc-100">{mcpConfig}</pre>
          <div className="mt-2 flex justify-end">
            <Button size="sm" icon={<Copy className="size-3" />} onClick={() => copy(mcpConfig, "mcp")}>
              {copied === "mcp" ? "Copied" : "Copy config"}
            </Button>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="REST API" />
        <div className="space-y-1.5 px-5 py-4 font-mono text-xs text-zinc-700">
          {[
            ["GET", "/api/v1/contacts?q=&limit=", "List / search people"],
            ["POST", "/api/v1/contacts", "Create or upsert people (array or object)"],
            ["GET", "/api/v1/companies", "List companies"],
            ["GET", "/api/v1/deals", "List deals"],
            ["POST", "/api/v1/agent", "Run the Comuno Agent: { message, threadId? }"],
            ["POST", "/api/inbox/inbound", "Webhook: log an inbound reply { from, subject, text }"],
          ].map(([m, p, d]) => (
            <div key={p} className="flex flex-wrap gap-x-3">
              <span className="w-10 font-semibold text-violet-700">{m}</span>
              <span className="text-zinc-900">{p}</span>
              <span className="font-sans text-zinc-500">{d}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const PLANS = [
  { id: "free", name: "Free", price: "$0", credits: "2,000 one-time credits", seats: "1 seat" },
  { id: "solo", name: "Solo", price: "$60/mo", credits: "480K credits / year", seats: "1 seat" },
  { id: "team", name: "Team", price: "$200/mo", credits: "1.2M credits / year", seats: "5 seats" },
  { id: "enterprise", name: "Enterprise", price: "Custom", credits: "Custom credits, SSO, self-hosting", seats: "5+ seats" },
];

function BillingTab({ ws, ledger }: { ws: Workspace; ledger: SettingsData["ledger"] }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <Card key={p.id} className={p.id === ws.plan ? "border-zinc-900 ring-1 ring-zinc-900" : ""}>
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{p.name}</div>
                {p.id === ws.plan && <Badge tone="violet">Current</Badge>}
              </div>
              <div className="mt-2 font-serif text-3xl">{p.price}</div>
              <div className="mt-2 text-xs text-zinc-600">{p.credits}</div>
              <div className="text-xs text-zinc-500">{p.seats}</div>
              {p.id !== ws.plan && p.id !== "free" && (
                <a href={`mailto:sales@comuno.ai?subject=${encodeURIComponent(`Upgrade ${ws.name} to ${p.name}`)}`} className="mt-3 block">
                  <Button className="w-full" size="sm">
                    {p.id === "enterprise" ? "Contact sales" : "Upgrade"}
                  </Button>
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-zinc-500">Annual billing saves 25%.</p>
      <Card>
        <CardHeader title="Credit usage" subtitle={`${ws.credits.toLocaleString()} credits remaining`} />
        <Table>
          <thead>
            <tr>
              <Th>Action</Th>
              <Th className="text-right">Credits</Th>
              <Th className="text-right">When</Th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((l, i) => (
              <tr key={i}>
                <Td>{l.reason.replace(/_/g, " ")}</Td>
                <Td className={`text-right tabular-nums ${l.amount < 0 ? "text-zinc-700" : "text-emerald-600"}`}>
                  {l.amount > 0 ? "+" : ""}
                  {l.amount}
                </Td>
                <Td className="text-right text-zinc-500">{timeAgo(l.created_at)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}


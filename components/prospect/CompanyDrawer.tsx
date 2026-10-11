"use client";
import { useCallback, useEffect, useState } from "react";
import { Building2, Newspaper, Save, Trash2, UserPlus, Users } from "lucide-react";
import { api, del, fullName, patch, post, timeAgo } from "@/lib/client";
import type { ProspectResult, Source } from "@/lib/services/prospect";
import type { Activity, Company, Contact } from "@/lib/types";
import { Avatar, Badge, Button, Card, Drawer, Empty, ErrorNote, Field, Input, Loading, Score, Sources, Tabs, Textarea } from "@/components/app/ui";
import { ProspectResultsTable } from "./ResultsTable";
import { EmailCell, ExtLink, KV, LinkedInLink, Markdown, StatusBadge } from "./shared";

type Detail = { company: Company; people: Contact[]; activities: Activity[] };

type CompanyEnrichment = {
  discovery?: { reason?: string; source_url?: string | null };
  founded?: string | null;
  employees?: string | null;
  tech_stack?: string[];
  recent_news?: { title: string; date?: string | null; url?: string | null }[];
  competitors?: string[];
  products?: string[];
  sources?: Source[];
  enriched_at?: string;
  research?: { text: string; sources: Source[]; at: string };
};

const FIELDS: { key: keyof Company; label: string; textarea?: boolean }[] = [
  { key: "name", label: "Name" },
  { key: "domain", label: "Domain" },
  { key: "industry", label: "Industry" },
  { key: "size", label: "Employees" },
  { key: "location", label: "HQ location" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "funding", label: "Funding" },
  { key: "description", label: "Description", textarea: true },
];

const toForm = (c: Company) => Object.fromEntries(FIELDS.map((f) => [f.key, (c[f.key] as string | null) || ""]));

export function CompanyDrawer({
  companyId,
  onClose,
  onChanged,
  onOpenContact,
}: {
  companyId: string;
  onClose: () => void;
  onChanged: () => void;
  onOpenContact?: (id: string) => void;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "people" | "research" | "activity">("overview");
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Find people
  const [roleQuery, setRoleQuery] = useState("");
  const [found, setFound] = useState<{ results: ProspectResult[]; sources: Source[] } | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());

  const apply = useCallback((d: Detail) => {
    setData(d);
    setForm(toForm(d.company));
    setDirty(false);
    setLoadError(null);
  }, []);

  const load = useCallback(async () => {
    try {
      apply(await api<Detail>(`/api/companies/${companyId}`));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [companyId, apply]);

  useEffect(() => {
    let alive = true;
    api<Detail>(`/api/companies/${companyId}`)
      .then((d) => alive && apply(d))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [companyId, apply]);

  const act = async (name: string, fn: () => Promise<string | void>) => {
    setBusy(name);
    setError(null);
    setInfo(null);
    try {
      const msg = await fn();
      if (msg) setInfo(msg);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const co = data?.company;
  const enr: CompanyEnrichment = (() => {
    try {
      return co?.enrichment_json ? (JSON.parse(co.enrichment_json) as CompanyEnrichment) : {};
    } catch {
      return {};
    }
  })();

  const findPeople = () =>
    act("find", async () => {
      const r = await post<{ results: ProspectResult[]; sources: Source[] }>(`/api/companies/${companyId}/find-people`, { query: roleQuery || undefined });
      setFound(r);
      setSel(new Set(r.results.map((_, i) => i)));
      setTab("people");
      return r.results.length ? `Found ${r.results.length} people — review and save` : "No publicly listed people found. Try different roles.";
    });

  const saveFound = () =>
    act("savefound", async () => {
      if (!found) return;
      const r = await post<{ created: number; skipped: number }>("/api/prospect/save", { results: found.results.filter((_, i) => sel.has(i)) });
      setFound(null);
      setSel(new Set());
      return `Saved ${r.created} new ${r.created === 1 ? "person" : "people"}${r.skipped ? ` · ${r.skipped} already existed` : ""}`;
    });

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        co ? (
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                {co.name} <LinkedInLink url={co.linkedin_url} />
              </div>
              <div className="truncate text-xs font-normal text-zinc-500">{[co.domain, co.industry].filter(Boolean).join(" · ") || "No details yet"}</div>
            </div>
          </div>
        ) : (
          "Company"
        )
      }
    >
      {!data || !co ? (
        loadError ? (
          <div className="p-5">
            <ErrorNote error={loadError} />
          </div>
        ) : (
          <Loading />
        )
      ) : (
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1">
              Fit <Score value={co.score} />
            </span>
            <span>·</span>
            <span>{data.people.length} people</span>
            {co.size && (
              <>
                <span>·</span>
                <span>{co.size} employees</span>
              </>
            )}
          </div>
          {co.score_reason && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[13px] text-zinc-600">{co.score_reason}</p>}

          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ai" loading={busy === "enrich"} disabled={!!busy} onClick={() => act("enrich", async () => (await post(`/api/companies/${companyId}/enrich`), "Company enriched from public sources"))}>
              Enrich
            </Button>
            <Button size="sm" variant="ai" loading={busy === "research"} disabled={!!busy} onClick={() => act("research", async () => {
              await post(`/api/companies/${companyId}/research`);
              setTab("research");
              return "Account briefing ready";
            })}>
              Research account
            </Button>
            <Button size="sm" variant="ai" loading={busy === "score"} disabled={!!busy} onClick={() => act("score", async () => {
              const r = await post<{ score: number }>(`/api/companies/${companyId}/score`);
              return `Scored ${r.score}/100`;
            })}>
              Score fit
            </Button>
          </div>
          <ErrorNote error={error} />
          {info && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{info}</div>}

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "people", label: `People (${data.people.length})` },
              { id: "research", label: "Research" },
              { id: "activity", label: "Activity" },
            ]}
          />

          {tab === "overview" && (
            <div className="space-y-4">
              {enr.discovery?.reason && (
                <div className="rounded-lg border border-violet-100 bg-violet-50/50 px-3 py-2 text-[13px] text-zinc-700">
                  <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-violet-700">Why it matched</div>
                  {enr.discovery.reason}
                </div>
              )}
              {enr.enriched_at ? (
                <div className="space-y-3">
                  <div>
                    <KV label="Website">{co.domain ? <ExtLink href={co.website || `https://${co.domain}`}>{co.domain}</ExtLink> : null}</KV>
                    <KV label="Founded">{enr.founded}</KV>
                    <KV label="Headcount">{enr.employees || co.size}</KV>
                    <KV label="Funding">{co.funding}</KV>
                    <KV label="Products">{enr.products?.length ? enr.products.join(", ") : null}</KV>
                    <KV label="Competitors">{enr.competitors?.length ? enr.competitors.join(", ") : null}</KV>
                  </div>
                  {!!enr.tech_stack?.length && (
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-zinc-700">Tech stack</div>
                      <div className="flex flex-wrap gap-1">
                        {enr.tech_stack.map((t) => (
                          <Badge key={t}>{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!enr.recent_news?.length && (
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-zinc-700">Recent news</div>
                      <ul className="space-y-1.5">
                        {enr.recent_news.map((n, i) => (
                          <li key={i} className="flex gap-2 text-[13px]">
                            <Newspaper className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
                            <span>
                              {n.url ? (
                                <a href={n.url} target="_blank" rel="noreferrer" className="text-zinc-800 hover:underline">
                                  {n.title}
                                </a>
                              ) : (
                                n.title
                              )}
                              {n.date && <span className="ml-1 text-xs text-zinc-400">{n.date}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Sources sources={enr.sources} />
                  <div className="text-xs text-zinc-400">Enriched {timeAgo(enr.enriched_at)}</div>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-3 text-[13px] text-zinc-500">
                  Not enriched yet. <b className="font-medium text-zinc-700">Enrich</b> pulls firmographics, funding, tech stack, news and competitors from public sources.
                </p>
              )}

              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {FIELDS.map((f) => (
                    <Field key={f.key} label={f.label} className={f.textarea ? "sm:col-span-2" : undefined}>
                      {f.textarea ? (
                        <Textarea rows={3} value={form[f.key] ?? ""} onChange={(e) => (setForm((s) => ({ ...s, [f.key]: e.target.value })), setDirty(true))} />
                      ) : (
                        <Input value={form[f.key] ?? ""} onChange={(e) => (setForm((s) => ({ ...s, [f.key]: e.target.value })), setDirty(true))} />
                      )}
                    </Field>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 className="size-3.5" />}
                    onClick={async () => {
                      if (!confirm(`Delete ${co.name}? People at this company are kept but unlinked.`)) return;
                      try {
                        await del(`/api/companies/${companyId}`);
                        onChanged();
                        onClose();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<Save className="size-3.5" />}
                    disabled={!dirty}
                    loading={busy === "save"}
                    onClick={() => act("save", async () => (await patch(`/api/companies/${companyId}`, form), "Saved"))}
                  >
                    Save changes
                  </Button>
                </div>
              </div>
            </div>
          )}

          {tab === "people" && (
            <div className="space-y-4">
              <Card className="p-3">
                <div className="mb-2 text-[13px] font-medium text-zinc-900">Find people at {co.name}</div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input placeholder="Roles, e.g. Head of RevOps, VP Sales (defaults to your ICP titles)" value={roleQuery} onChange={(e) => setRoleQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && findPeople()} />
                  <Button variant="ai" loading={busy === "find"} disabled={!!busy} onClick={findPeople} icon={<UserPlus className="size-3.5" />}>
                    Find people
                  </Button>
                </div>
              </Card>
              {found && found.results.length > 0 && (
                <Card>
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
                    <span className="text-[13px] text-zinc-600">{sel.size} of {found.results.length} selected</span>
                    <Button size="sm" variant="primary" disabled={!sel.size} loading={busy === "savefound"} onClick={saveFound}>
                      Save to People
                    </Button>
                  </div>
                  <ProspectResultsTable
                    results={found.results}
                    selected={sel}
                    onToggle={(i) => setSel((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })}
                    onToggleAll={(on) => setSel(on ? new Set(found.results.map((_, i) => i)) : new Set())}
                  />
                  <div className="px-3 pb-3">
                    <Sources sources={found.sources} />
                  </div>
                </Card>
              )}
              {data.people.length === 0 ? (
                <Empty icon={<Users className="size-5" />} title="No people saved at this company" body="Use Find people above to discover publicly listed decision makers." />
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                  {data.people.map((p) => (
                    <li key={p.id}>
                      <button className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-zinc-50" onClick={() => onOpenContact?.(p.id)}>
                        <Avatar name={fullName(p)} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-zinc-900">{fullName(p)}</div>
                          <div className="truncate text-xs text-zinc-500">{p.title || "—"}</div>
                        </div>
                        <div className="hidden text-xs sm:block">
                          <EmailCell email={p.email} status={p.email_status} />
                        </div>
                        <StatusBadge status={p.status} />
                        <Score value={p.score} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "research" && (
            <div>
              {enr.research?.text ? (
                <div>
                  <Markdown text={enr.research.text} />
                  <Sources sources={enr.research.sources} />
                  <div className="mt-2 text-xs text-zinc-400">Generated {timeAgo(enr.research.at)}</div>
                </div>
              ) : (
                <Empty
                  icon={<Newspaper className="size-5" />}
                  title="No account briefing yet"
                  body="Research account builds a sourced briefing: priorities, recent news, likely pain points and an outreach angle."
                  action={
                    <Button size="sm" variant="ai" loading={busy === "research"} onClick={() => act("research", async () => (await post(`/api/companies/${companyId}/research`), "Account briefing ready"))}>
                      Research account
                    </Button>
                  }
                />
              )}
            </div>
          )}

          {tab === "activity" &&
            (data.activities.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-zinc-500">No activity yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-zinc-200 pl-4">
                {data.activities.map((a) => (
                  <li key={a.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-white bg-zinc-300" />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-medium text-zinc-900">{a.title}</span>
                      <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(a.created_at)}</span>
                    </div>
                    {a.body && <p className="mt-0.5 whitespace-pre-line text-[13px] text-zinc-600">{a.body}</p>}
                  </li>
                ))}
              </ol>
            ))}
        </div>
      )}
    </Drawer>
  );
}

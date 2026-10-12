"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, KanbanSquare, Search, Send, UserPlus, Users } from "lucide-react";
import { timeAgo, useApi } from "@/lib/client";
import { Avatar, Badge, Button, Card, Empty, ErrorNote, Loading, PageHeader, Select, Stat, Table, Tabs, Td, Th, cx } from "@/components/app/ui";
import { DealFormModal, type DealPreset } from "@/components/crm/DealForm";
import { ButtonLink } from "@/components/crm/shared";
import { TrackingSnippet } from "@/components/signals/TrackingSnippet";

type Page = { path: string; views: number; high_intent: boolean };
type Report = {
  days: number;
  totals: { views: number; visitors: number; companies: number; people: number; anonymous_views: number };
  companies: {
    company_id: string; name: string; domain: string | null; industry: string | null; score: number | null;
    views: number; visitors: number; people: number; last_seen: string; first_seen: string; location: string | null; pages: Page[];
  }[];
  people: {
    contact_id: string; name: string | null; email: string | null; title: string | null; company_id: string | null; company_name: string | null;
    views: number; last_seen: string; pages: Page[];
  }[];
  recent: {
    id: string; url: string; path: string; title: string | null; referrer: string | null; created_at: string; org: string | null;
    city: string | null; country: string | null; company_name: string | null; contact_name: string | null; visitor_id: string;
  }[];
  topPages: { path: string; url: string; views: number }[];
  installed: boolean;
  tracking_key: string;
  snippet: string;
};

type Tab = "companies" | "people" | "live";

export default function VisitorsPage() {
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<Tab>("companies");
  const { data, error, loading } = useApi<Report>(`/api/visitors?days=${days}`);
  const [dealPreset, setDealPreset] = useState<DealPreset | null>(null);

  return (
    <div>
      <PageHeader
        title="Website visitors"
        subtitle="De-anonymized companies and people browsing your site."
        actions={
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Date range" className="w-36">
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        }
      />
      {error && !data && <ErrorNote error={error} />}
      {loading && !data ? (
        <Loading label="Loading visitors…" />
      ) : data ? (
        <div className={cx("space-y-5 transition-opacity", loading && "opacity-60")}>
          <TrackingSnippet key={String(data.installed)} snippet={data.snippet} installed={data.installed} />

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Page views" value={data.totals.views.toLocaleString()} sub={`${data.totals.anonymous_views.toLocaleString()} anonymous`} />
            <Stat label="Unique visitors" value={data.totals.visitors.toLocaleString()} />
            <Stat label="Companies identified" value={data.totals.companies.toLocaleString()} />
            <Stat label="People identified" value={data.totals.people.toLocaleString()} />
          </div>

          <Card className="overflow-hidden">
            <div className="px-3 pt-1 sm:px-4">
              <Tabs
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "companies", label: `Companies (${data.companies.length})` },
                  { id: "people", label: `People (${data.people.length})` },
                  { id: "live", label: "Live feed" },
                ]}
              />
            </div>
            {tab === "companies" &&
              (data.companies.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Company</Th>
                      <Th className="text-right">Views</Th>
                      <Th>Pages viewed</Th>
                      <Th>Last seen</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.companies.map((c) => (
                      <tr key={c.company_id} className="align-top">
                        <Td className="min-w-[180px]">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500">
                              <Building2 className="size-3.5" />
                            </span>
                            <div className="min-w-0">
                              <Link href={`/companies?open=${c.company_id}`} className="block truncate font-medium text-zinc-900 hover:underline">
                                {c.name}
                              </Link>
                              <div className="truncate text-xs text-zinc-500">{[c.domain, c.location].filter(Boolean).join(" · ") || "—"}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-right tabular-nums">
                          <div className="font-medium text-zinc-900">{c.views}</div>
                          <div className="text-[11px] text-zinc-400">
                            {c.visitors} visitor{c.visitors === 1 ? "" : "s"}
                          </div>
                          {c.people > 0 && <div className="text-[11px] text-zinc-400">{c.people} known</div>}
                        </Td>
                        <Td className="min-w-[200px]">
                          <PageChips pages={c.pages} />
                        </Td>
                        <Td className="whitespace-nowrap text-xs">{timeAgo(c.last_seen)}</Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <ButtonLink size="sm" href={`/companies?open=${c.company_id}`} icon={<UserPlus className="size-3.5" />} title="Find and add people at this company">
                              Add people
                            </ButtonLink>
                            <ButtonLink
                              size="sm"
                              variant="ghost"
                              href={`/agent?q=${encodeURIComponent(`Research ${c.name}${c.domain ? ` (${c.domain})` : ""} — they visited our website (${c.pages.map((p) => p.path).slice(0, 5).join(", ")}). Summarize the account, likely buying intent and who to contact.`)}`}
                              icon={<Search className="size-3.5" />}
                            >
                              Research
                            </ButtonLink>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<KanbanSquare className="size-3.5" />}
                              aria-label={`Create deal for ${c.name}`}
                              title="Create deal"
                              onClick={() => setDealPreset({ name: `${c.name} deal`, company: { id: c.company_id, label: c.name } })}
                            />
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty
                  icon={<Building2 className="size-5" />}
                  title="No companies identified yet"
                  body={data.installed ? "Business visitors appear here as soon as they browse your site." : "Install the tracking pixel above to start identifying visiting companies."}
                />
              ))}

            {tab === "people" &&
              (data.people.length ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Person</Th>
                      <Th className="text-right">Views</Th>
                      <Th>Pages viewed</Th>
                      <Th>Last seen</Th>
                      <Th className="text-right">Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.people.map((p) => (
                      <tr key={p.contact_id} className="align-top">
                        <Td className="min-w-[180px]">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={p.name || p.email || "?"} />
                            <div className="min-w-0">
                              <Link href={`/contacts?open=${p.contact_id}`} className="block truncate font-medium text-zinc-900 hover:underline">
                                {p.name || p.email || "Unnamed"}
                              </Link>
                              <div className="truncate text-xs text-zinc-500">{[p.title, p.company_name].filter(Boolean).join(" · ") || p.email}</div>
                            </div>
                          </div>
                        </Td>
                        <Td className="text-right font-medium tabular-nums text-zinc-900">{p.views}</Td>
                        <Td className="min-w-[200px]">
                          <PageChips pages={p.pages} />
                        </Td>
                        <Td className="whitespace-nowrap text-xs">{timeAgo(p.last_seen)}</Td>
                        <Td>
                          <div className="flex justify-end gap-1">
                            <ButtonLink size="sm" href={`/inbox?compose=${p.contact_id}`} icon={<Send className="size-3.5" />}>
                              Engage
                            </ButtonLink>
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<KanbanSquare className="size-3.5" />}
                              aria-label={`Create deal for ${p.name || p.email}`}
                              title="Create deal"
                              onClick={() =>
                                setDealPreset({
                                  name: p.company_name ? `${p.company_name} deal` : `${p.name || "New"} deal`,
                                  contact: { id: p.contact_id, label: p.name || p.email || "Contact" },
                                  company: p.company_id ? { id: p.company_id, label: p.company_name || "Company" } : null,
                                })
                              }
                            />
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <Empty
                  icon={<Users className="size-5" />}
                  title="No identified people yet"
                  body="People are identified when they open a link containing ?cid= / ?email=, or when your site calls comuno.identify(email)."
                />
              ))}

            {tab === "live" &&
              (data.recent.length ? (
                <ul className="divide-y divide-zinc-100">
                  {data.recent.map((v) => (
                    <li key={v.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                        <Eye className="size-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                          <span className="font-medium text-zinc-900">
                            {v.contact_name || v.company_name || (v.org ? `${v.org}` : "Anonymous visitor")}
                          </span>
                          {v.contact_name && v.company_name && <span className="text-xs text-zinc-500">{v.company_name}</span>}
                          {!v.company_name && !v.contact_name && v.org && <Badge>network</Badge>}
                          <span className="ml-auto text-[11px] text-zinc-400">{timeAgo(v.created_at)}</span>
                        </div>
                        <a href={v.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-zinc-600 hover:text-zinc-900 hover:underline">
                          {v.title ? `${v.title} — ` : ""}
                          {v.path}
                        </a>
                        <div className="truncate text-[11px] text-zinc-400">
                          {[v.city && v.country ? `${v.city}, ${v.country}` : v.country, v.referrer && `from ${hostOf(v.referrer)}`].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={<Eye className="size-5" />} title="No page views yet" body="Page views stream in here in real time once the pixel is installed." />
              ))}
          </Card>

          {data.topPages.length > 0 && (
            <Card>
              <div className="border-b border-zinc-100 px-5 py-3.5">
                <h3 className="text-sm font-semibold text-zinc-900">Top pages</h3>
              </div>
              <ul className="space-y-2 px-5 py-4">
                {data.topPages.map((p) => {
                  const max = data.topPages[0].views || 1;
                  return (
                    <li key={p.url} className="text-[13px]">
                      <div className="mb-1 flex justify-between gap-2">
                        <span className="truncate text-zinc-700" title={p.url}>
                          {p.path}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-900">{p.views}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100">
                        <div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${Math.max(2, (p.views / max) * 100)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      ) : null}

      {dealPreset && (
        <DealFormModal
          open
          preset={dealPreset}
          onClose={() => setDealPreset(null)}
          onSaved={(id) => {
            setDealPreset(null);
            router.push(`/deals?id=${id}`);
          }}
        />
      )}
    </div>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PageChips({ pages }: { pages: Page[] }) {
  const shown = pages.slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((p) => (
        <span
          key={p.path}
          title={p.high_intent ? "High-intent page" : undefined}
          className={cx(
            "inline-flex max-w-[180px] items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px]",
            p.high_intent ? "bg-zinc-50 font-medium text-zinc-800" : "bg-zinc-100 text-zinc-600",
          )}
        >
          <span className="truncate">{p.path}</span>
          {p.views > 1 && <span className="tabular-nums opacity-70">×{p.views}</span>}
        </span>
      ))}
      {pages.length > shown.length && <span className="text-[11px] text-zinc-400">+{pages.length - shown.length}</span>}
    </div>
  );
}

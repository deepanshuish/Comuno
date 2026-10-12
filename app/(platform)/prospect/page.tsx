"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, CheckCircle2, ChevronDown, Coins, Globe2, Save, Search, SlidersHorizontal, Sparkles, Users } from "lucide-react";
import { api, post } from "@/lib/client";
import type { CompanyResult, ProspectResult, Source } from "@/lib/services/prospect";
import type { ICP } from "@/lib/types";
import { Button, Card, cx, Empty, ErrorNote, Field, Loading, PageHeader, Select, Sources, Spinner, Textarea } from "@/components/app/ui";
import { ListPicker } from "@/components/prospect/modals";
import { CompanyResultsTable, ProspectResultsTable } from "@/components/prospect/ResultsTable";
import { ChipsInput } from "@/components/prospect/shared";

type Mode = "people" | "companies";
type Filters = Required<Pick<ICP, "industries" | "company_sizes" | "locations" | "titles" | "seniorities" | "keywords">>;
const EMPTY: Filters = { industries: [], company_sizes: [], locations: [], titles: [], seniorities: [], keywords: [] };

const EXAMPLES: Record<Mode, string[]> = {
  people: [
    "VPs of Sales at Series B fintech startups in London",
    "Heads of RevOps at B2B SaaS companies with 200–1000 employees in the US",
    "CTOs of seed-stage climate tech startups in Berlin",
  ],
  companies: [
    "Series A–C vertical SaaS companies in healthcare hiring SDRs",
    "Mid-market e-commerce brands in the Nordics using Shopify Plus",
    "Logistics companies in Texas that raised funding in the last 12 months",
  ],
};

const SIZE_SUGGESTIONS = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];
const SENIORITY_SUGGESTIONS = ["C-level", "Founder", "VP", "Head of", "Director", "Manager"];

type SearchRes =
  | { mode: "people"; results: ProspectResult[]; sources: Source[]; credits: number }
  | { mode: "companies"; results: CompanyResult[]; sources: Source[]; credits: number };

export default function ProspectPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FindLeads />
    </Suspense>
  );
}

function FindLeads() {
  const sp = useSearchParams();
  const [mode, setMode] = useState<Mode>(sp.get("mode") === "companies" ? "companies" : "people");
  const [query, setQuery] = useState(sp.get("q") || "");
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [icp, setIcp] = useState<ICP | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [limit, setLimit] = useState("10");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<SearchRes | null>(null);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<{ listId?: string; newListName?: string }>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ created: number; skipped: number; listId?: string | null; mode: Mode } | null>(null);

  useEffect(() => {
    api<{ icp: ICP }>("/api/prospect/icp")
      .then(({ icp }) => {
        setIcp(icp);
        const pre: Filters = {
          industries: icp.industries || [],
          company_sizes: icp.company_sizes || [],
          locations: icp.locations || [],
          titles: icp.titles || [],
          seniorities: icp.seniorities || [],
          keywords: icp.keywords || [],
        };
        setFilters(pre);
      })
      .catch(() => setIcp({}));
  }, []);

  const hasIcp = !!icp && Object.values(icp).some((v) => (Array.isArray(v) ? v.length > 0 : !!v));
  const filterCount = Object.entries(filters).reduce((n, [k, v]) => n + (mode === "companies" && (k === "titles" || k === "seniorities") ? 0 : v.length), 0);
  const canSearch = !!query.trim() || filterCount > 0;

  const search = async () => {
    if (!canSearch) return;
    setSearching(true);
    setError(null);
    setSaved(null);
    try {
      const icpBody: ICP = { ...filters, notes: icp?.notes };
      const r = await post<SearchRes>("/api/prospect/search", { mode, query, icp: icpBody, limit: Number(limit) });
      setRes(r);
      setSel(new Set(r.results.map((_, i) => i)));
      if (mode === "people") setTarget({ newListName: (query.trim() || "AI leads").slice(0, 60) });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const save = async () => {
    if (!res || !sel.size) return;
    setSaving(true);
    setError(null);
    try {
      const results = res.results.filter((_, i) => sel.has(i));
      const body = res.mode === "people" ? { mode: "people", results, ...(target.listId ? { listId: target.listId } : target.newListName?.trim() ? { newListName: target.newListName } : {}) } : { mode: "companies", results };
      const r = await post<{ created: number; skipped: number; listId?: string | null }>("/api/prospect/save", body);
      setSaved({ ...r, mode: res.mode });
      setSel(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (i: number) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  const setF = (k: keyof Filters) => (v: string[]) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader
        title="Find leads"
        subtitle="Describe who you sell to. Comuno searches the live web for real companies and publicly listed decision makers — every result links to its source."
      />

      <Card className="mb-5">
        <div className="flex gap-1 border-b border-zinc-100 px-3 pt-3">
          {(
            [
              { id: "people", label: "People", icon: Users },
              { id: "companies", label: "Companies", icon: Building2 },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setMode(t.id);
                setRes(null);
                setSaved(null);
                setError(null);
              }}
              className={cx(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-[13px] font-medium",
                mode === t.id ? "border-brand-600 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="space-y-3 p-4">
          <Textarea
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) search();
            }}
            placeholder={mode === "people" ? "e.g. VPs of Sales at Series B fintech startups in London" : "e.g. Series B fintech startups in London with 50–200 employees"}
            className="text-[14px]"
          />
          {!query && (
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES[mode].map((ex) => (
                <button key={ex} onClick={() => setQuery(ex)} className="rounded-full border border-zinc-200 px-2.5 py-1 text-[12px] text-zinc-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800">
                  {ex}
                </button>
              ))}
            </div>
          )}

          <div>
            <button onClick={() => setShowFilters((s) => !s)} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-700 hover:text-zinc-900">
              <SlidersHorizontal className="size-3.5" /> ICP filters
              {filterCount > 0 && <span className="rounded bg-zinc-100 px-1.5 text-[11px] text-zinc-600">{filterCount}</span>}
              {hasIcp && <span className="text-[11px] font-normal text-zinc-400">· prefilled from your ICP</span>}
              <ChevronDown className={cx("size-3.5 transition-transform", showFilters && "rotate-180")} />
            </button>
            {showFilters && (
              <div className="mt-3 grid gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 sm:grid-cols-2">
                <Field label="Industries">
                  <ChipsInput value={filters.industries} onChange={setF("industries")} placeholder="Fintech, SaaS… (Enter to add)" />
                </Field>
                <Field label="Company size (employees)">
                  <ChipsInput value={filters.company_sizes} onChange={setF("company_sizes")} placeholder="51-200" suggestions={SIZE_SUGGESTIONS} />
                </Field>
                <Field label="Locations">
                  <ChipsInput value={filters.locations} onChange={setF("locations")} placeholder="London, United States…" />
                </Field>
                <Field label="Keywords">
                  <ChipsInput value={filters.keywords} onChange={setF("keywords")} placeholder="Series B, hiring SDRs, uses Salesforce…" />
                </Field>
                {mode === "people" && (
                  <>
                    <Field label="Job titles">
                      <ChipsInput value={filters.titles} onChange={setF("titles")} placeholder="VP Sales, Head of Growth…" />
                    </Field>
                    <Field label="Seniority">
                      <ChipsInput value={filters.seniorities} onChange={setF("seniorities")} placeholder="VP, Director…" suggestions={SENIORITY_SUGGESTIONS} />
                    </Field>
                  </>
                )}
                <div className="flex items-center gap-3 text-xs text-zinc-500 sm:col-span-2">
                  <Link href="/settings" className="text-brand-700 hover:underline">
                    {hasIcp ? "Edit saved ICP" : "Save an ICP in Settings"}
                  </Link>
                  <span>·</span>
                  <button className="hover:text-zinc-800" onClick={() => setFilters(EMPTY)}>
                    Clear filters
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Select className="!h-8 !w-auto" value={limit} onChange={(e) => setLimit(e.target.value)} aria-label="Number of results">
                <option value="5">Up to 5</option>
                <option value="10">Up to 10</option>
                <option value="15">Up to 15</option>
                <option value="25">Up to 25</option>
              </Select>
              <span className="inline-flex items-center gap-1">
                <Coins className="size-3.5 text-zinc-500" /> 10 credits per search
              </span>
            </div>
            <Button variant="ai" size="lg" loading={searching} disabled={!canSearch} onClick={search} icon={<Search className="size-4" />}>
              {mode === "people" ? "Find people" : "Find companies"}
            </Button>
          </div>
          <ErrorNote error={error} />
        </div>
      </Card>

      {searching ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="relative">
            <Globe2 className="size-8 text-brand-300" />
            <Spinner className="absolute -bottom-1 -right-1 size-4 text-brand-600" />
          </div>
          <div className="text-sm font-medium text-zinc-900">Searching the web…</div>
          <p className="max-w-sm text-[13px] text-zinc-500">
            Comuno is reading company sites, press releases and public profiles to find {mode === "people" ? "real decision makers" : "matching companies"}. This usually takes 15–40 seconds.
          </p>
        </Card>
      ) : res ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">
                {res.results.length} {res.mode === "people" ? (res.results.length === 1 ? "person" : "people") : res.results.length === 1 ? "company" : "companies"} found
              </h3>
              <p className="text-xs text-zinc-500">
                {sel.size} selected · {res.sources.length} web sources · {res.credits.toLocaleString()} credits left
              </p>
            </div>
            {res.results.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {res.mode === "people" && (
                  <div className="w-full min-w-[220px] sm:w-64">
                    <ListPicker value={target} onChange={setTarget} allowNone />
                  </div>
                )}
                <Button variant="primary" loading={saving} disabled={!sel.size} onClick={save} icon={<Save className="size-3.5" />}>
                  Save {sel.size || ""} to {res.mode === "people" ? "People" : "Companies"}
                </Button>
              </div>
            )}
          </div>
          {saved && (
            <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2.5 text-[13px] text-brand-800">
              <CheckCircle2 className="size-4" />
              Saved {saved.created} new {saved.mode === "people" ? "people" : "companies"}
              {saved.skipped > 0 && ` · ${saved.skipped} already existed`}
              <span className="ml-auto flex gap-3">
                {saved.mode === "people" && saved.listId && (
                  <Link href={`/lists/${saved.listId}`} className="font-medium underline">
                    Open list
                  </Link>
                )}
                <Link href={saved.mode === "people" ? "/contacts" : "/companies"} className="font-medium underline">
                  View {saved.mode === "people" ? "People" : "Companies"}
                </Link>
              </span>
            </div>
          )}
          {res.results.length === 0 ? (
            <Empty
              icon={<Sparkles className="size-5" />}
              title="No verifiable matches"
              body="The web search didn't surface publicly listed matches. Broaden the description, loosen filters, or try a nearby location or title."
            />
          ) : res.mode === "people" ? (
            <ProspectResultsTable results={res.results} selected={sel} onToggle={toggle} onToggleAll={(on) => setSel(on ? new Set(res.results.map((_, i) => i)) : new Set())} />
          ) : (
            <CompanyResultsTable results={res.results} selected={sel} onToggle={toggle} onToggleAll={(on) => setSel(on ? new Set(res.results.map((_, i) => i)) : new Set())} />
          )}
          {res.sources.length > 0 && (
            <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Sources</div>
              <Sources sources={res.sources} />
            </div>
          )}
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Globe2, title: "Live web search", body: "Results are grounded in Google Search — real companies and people, each with a source link." },
            { icon: SlidersHorizontal, title: "Your ICP built in", body: "Filters prefill from your saved ideal customer profile; tweak them per search." },
            { icon: Save, title: "Save & act", body: "Save picks into People or a list, then find emails, enrich and enroll in sequences." },
          ].map((f) => (
            <Card key={f.title} className="p-4">
              <f.icon className="mb-2 size-4 text-brand-600" />
              <div className="text-[13px] font-medium text-zinc-900">{f.title}</div>
              <p className="mt-1 text-[13px] text-zinc-500">{f.body}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

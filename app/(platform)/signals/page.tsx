"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CheckCheck, Radar } from "lucide-react";
import { del, patch, post, useApi } from "@/lib/client";
import type { SignalType } from "@/lib/types";
import { Button, Card, CardHeader, Empty, ErrorNote, Loading, PageHeader, Select, cx } from "@/components/app/ui";
import { DealFormModal, type DealPreset } from "@/components/crm/DealForm";
import { EntityPicker, type PickerOption } from "@/components/crm/EntityPicker";
import { SIGNAL_META, SignalItem, type SignalRow } from "@/components/signals/SignalItem";

type Resp = { signals: SignalRow[]; counts: Record<string, { total: number; unseen: number }> };
type RefreshResult = { created: number; companies?: { company_name: string; created: number; error?: string }[] };
type JobResult = { changed: number; checked: number; results: { name: string; status: string; detail?: string }[] };

const FILTERS: SignalType[] = ["visit", "funding", "hiring", "job_change", "leadership", "product", "expansion", "news", "intent"];

export default function SignalsPage() {
  const router = useRouter();
  const [type, setType] = useState<SignalType | "all">("all");
  const [unseenOnly, setUnseenOnly] = useState(false);
  const url = `/api/signals?limit=200${type !== "all" ? `&type=${type}` : ""}${unseenOnly ? "&unseen=1" : ""}`;
  const { data, error, loading, reload, setData } = useApi<Resp>(url);
  const [dealPreset, setDealPreset] = useState<DealPreset | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const counts = data?.counts ?? {};
  const totalUnseen = Object.values(counts).reduce((a, c) => a + c.unseen, 0);
  const total = Object.values(counts).reduce((a, c) => a + c.total, 0);

  const setSeen = async (s: SignalRow, seen: boolean) => {
    if (!data) return;
    setData({ ...data, signals: data.signals.map((x) => (x.id === s.id ? { ...x, seen: seen ? 1 : 0 } : x)) });
    try {
      await patch(`/api/signals/${s.id}`, { seen });
      reload();
    } catch (e) {
      setActionError((e as Error).message);
      reload();
    }
  };

  const remove = async (s: SignalRow) => {
    if (!data) return;
    setData({ ...data, signals: data.signals.filter((x) => x.id !== s.id) });
    try {
      await del(`/api/signals/${s.id}`);
    } catch (e) {
      setActionError((e as Error).message);
    }
    reload();
  };

  const markAll = async () => {
    try {
      await patch("/api/signals", { all: true, seen: true });
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Buying signals"
        subtitle="Website visits, funding, hiring, leadership moves and job changes — the moments to reach out."
        actions={
          totalUnseen > 0 && (
            <Button icon={<CheckCheck className="size-3.5" />} onClick={markAll}>
              Mark all seen
            </Button>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip active={type === "all"} onClick={() => setType("all")} label="All" count={total} unseen={totalUnseen} />
            {FILTERS.filter((f) => counts[f]?.total || type === f).map((f) => (
              <FilterChip key={f} active={type === f} onClick={() => setType(f)} label={SIGNAL_META[f].label} count={counts[f]?.total ?? 0} unseen={counts[f]?.unseen ?? 0} />
            ))}
            <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-600">
              <input type="checkbox" checked={unseenOnly} onChange={(e) => setUnseenOnly(e.target.checked)} className="size-3.5 accent-violet-600" />
              New only
            </label>
          </div>
          <ErrorNote error={actionError} />
          <Card className="overflow-hidden">
            {loading && !data ? (
              <Loading label="Loading signals…" />
            ) : error && !data ? (
              <div className="p-5">
                <ErrorNote error={error} />
              </div>
            ) : !data?.signals.length ? (
              <Empty
                icon={<Radar className="size-5" />}
                title={total ? "Nothing matches this filter" : "No signals yet"}
                body={
                  total
                    ? "Try another type, or turn off “New only”."
                    : "Install the tracking pixel to catch website visits, and scan your top accounts for funding, hiring and leadership news."
                }
                action={
                  !total && (
                    <Button onClick={() => router.push("/visitors")} icon={<Radar className="size-3.5" />}>
                      Install tracking pixel
                    </Button>
                  )
                }
              />
            ) : (
              <div className="divide-y divide-zinc-100">
                {data.signals.map((s) => (
                  <SignalItem
                    key={s.id}
                    s={s}
                    onSeen={(seen) => setSeen(s, seen)}
                    onDelete={() => remove(s)}
                    onCreateDeal={() =>
                      setDealPreset({
                        name: s.company_name ? `${s.company_name} deal` : "",
                        company: s.company_id ? { id: s.company_id, label: s.company_name || "Company" } : null,
                        contact: s.contact_id ? { id: s.contact_id, label: s.contact_name || "Contact" } : null,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <ScanCompany onDone={reload} />
          <ScanTop onDone={reload} />
          <JobChanges onDone={reload} />
        </aside>
      </div>

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

function FilterChip({ active, onClick, label, count, unseen }: { active: boolean; onClick: () => void; label: string; count: number; unseen: number }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        active ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900",
      )}
    >
      {label}
      <span className={cx("tabular-nums", active ? "text-zinc-300" : "text-zinc-400")}>{count}</span>
      {unseen > 0 && <span className="size-1.5 rounded-full bg-violet-500" title={`${unseen} new`} />}
    </button>
  );
}

function ScanCompany({ onDone }: { onDone: () => void }) {
  const [company, setCompany] = useState<PickerOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    if (!company) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await post<RefreshResult>("/api/signals/refresh", { company_id: company.id });
      setMsg(r.created ? `Found ${r.created} new signal${r.created === 1 ? "" : "s"} at ${company.label}.` : `No new signals at ${company.label} in the last 90 days.`);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Scan an account" subtitle="Search the web for funding, hiring, leadership and news from the last 90 days · 5 credits" />
      <div className="space-y-3 px-5 py-4">
        <EntityPicker kind="company" value={company} onChange={setCompany} />
        <Button variant="ai" className="w-full" loading={busy} disabled={!company} onClick={run}>
          Refresh signals
        </Button>
        <ErrorNote error={error} />
        {msg && <p className="text-xs text-zinc-600">{msg}</p>}
      </div>
    </Card>
  );
}

function ScanTop({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await post<RefreshResult>("/api/signals/refresh", { top: n }));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader title="Scan top accounts" subtitle="Your highest-scoring companies, 5 credits each" />
      <div className="space-y-3 px-5 py-4">
        <div className="flex gap-2">
          <Select value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of companies" className="w-24">
            {[3, 5, 10, 20].map((x) => (
              <option key={x} value={x}>
                Top {x}
              </option>
            ))}
          </Select>
          <Button variant="ai" className="flex-1" loading={busy} onClick={run}>
            Scan {n} companies
          </Button>
        </div>
        {busy && <p className="text-xs text-zinc-500">Searching the web — this takes a few seconds per company…</p>}
        <ErrorNote error={error} />
        {result?.companies && (
          <ul className="space-y-1 text-xs">
            {result.companies.length === 0 && <li className="text-zinc-500">No companies to scan yet.</li>}
            {result.companies.map((c) => (
              <li key={c.company_name} className="flex justify-between gap-2">
                <span className="truncate text-zinc-700">{c.company_name}</span>
                <span className={cx("shrink-0", c.error ? "text-red-600" : "text-zinc-500")}>{c.error ? "failed" : `${c.created} new`}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function JobChanges({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await post<JobResult>("/api/signals/job-changes", { limit: n }));
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-1.5">
            <Briefcase className="size-4 text-zinc-400" /> Job-change alerts
          </span>
        }
        subtitle="Check whether your champions and engaged contacts still hold their role · 5 credits per person"
      />
      <div className="space-y-3 px-5 py-4">
        <div className="flex gap-2">
          <Select value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="Number of contacts" className="w-28">
            {[5, 10, 25].map((x) => (
              <option key={x} value={x}>
                {x} people
              </option>
            ))}
          </Select>
          <Button className="flex-1" loading={busy} onClick={run} icon={<Briefcase className="size-3.5" />}>
            Check job changes
          </Button>
        </div>
        <ErrorNote error={error} />
        {result && (
          <div className="space-y-1.5 text-xs">
            <p className="font-medium text-zinc-800">
              {result.changed ? `${result.changed} job change${result.changed === 1 ? "" : "s"} found` : "No job changes found"} · {result.checked} checked
            </p>
            <ul className="space-y-1">
              {result.results.map((r, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate text-zinc-700">{r.name}</span>
                  <span className={cx("shrink-0", r.status === "changed" ? "font-medium text-amber-700" : r.status === "error" ? "text-red-600" : "text-zinc-500")}>
                    {r.status === "same" ? "still there" : r.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

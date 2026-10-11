"use client";
import { useState } from "react";
import { money, useApi } from "@/lib/client";
import type { DealStage } from "@/lib/types";
import { Card, CardHeader, ErrorNote, Loading, PageHeader, Stat, Table, Td, Th, cx } from "@/components/app/ui";
import { DailyBars, Funnel, HBarList, SERIES } from "@/components/crm/charts";
import { STAGE_COLOR, stageLabel, type PipelineSummary } from "@/components/crm/shared";

type Report = {
  days: number;
  funnel: { id: string; label: string; value: number }[];
  outreach: {
    sent: number;
    opened: number;
    openRate: number;
    replies: number;
    replyRate: number;
    positive: number;
    failed: number;
    byDay: { day: string; sent: number; opened: number; replies: number }[];
  };
  pipeline: PipelineSummary;
  calls: { outcome: string; count: number; minutes: number }[];
  credits: { balance: number; used: number; byAction: { action: string; used: number }[] };
};

const RANGES = [7, 30, 90] as const;

const ACTION_LABELS: Record<string, string> = {
  ai_generate: "AI writing & summaries",
  ai_score: "ICP scoring",
  enrich_company: "Company enrichment",
  enrich_contact: "Contact enrichment",
  find_email: "Email finding",
  verify_email: "Email verification",
  prospect_search: "Prospect search",
  research: "Account research",
  signals_refresh: "Signals & job changes",
  agent_turn: "Comuno Agent",
};

const humanize = (s: string) => ACTION_LABELS[s] ?? s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export default function AnalyticsPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const { data, error, loading } = useApi<Report>(`/api/analytics?days=${days}`);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="How outreach turns into pipeline and revenue."
        actions={
          <div className="flex rounded-lg border border-zinc-200 bg-white p-0.5" role="tablist" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={r}
                role="tab"
                aria-selected={days === r}
                onClick={() => setDays(r)}
                className={cx("rounded-md px-2.5 py-1 text-xs font-medium", days === r ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}
              >
                {r} days
              </button>
            ))}
          </div>
        }
      />
      {error && <ErrorNote error={error} />}
      {loading && !data ? <Loading label="Crunching numbers…" /> : data ? <ReportView data={data} loading={loading} /> : null}
    </div>
  );
}

function ReportView({ data, loading }: { data: Report; loading: boolean }) {
  const o = data.outreach;
  const p = data.pipeline;
  const openStages = p.stages.filter((s) => s.stage !== "won" && s.stage !== "lost");
  const totalCalls = data.calls.reduce((a, c) => a + c.count, 0);
  const hasOutreach = o.byDay.some((d) => d.sent || d.replies);

  return (
    <div className={cx("space-y-5 transition-opacity", loading && "opacity-60")}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Emails sent" value={o.sent.toLocaleString()} sub={`Last ${data.days} days${o.failed ? ` · ${o.failed} failed` : ""}`} />
        <Stat label="Open rate" value={`${o.openRate}%`} sub={`${o.opened.toLocaleString()} opened`} />
        <Stat label="Reply rate" value={`${o.replyRate}%`} sub={`${o.replies.toLocaleString()} repl${o.replies === 1 ? "y" : "ies"}${o.positive ? ` · ${o.positive} positive` : ""}`} />
        <Stat label="Win rate" value={`${p.winRate}%`} sub={p.avgDealSize ? `Avg deal ${money(p.avgDealSize)}` : "No closed deals yet"} />
      </div>

      <Card>
        <CardHeader title="Outreach activity" subtitle={`Emails sent and replies received per day, last ${data.days} days`} />
        <div className="px-4 py-4 sm:px-5">
          {hasOutreach ? (
            <DailyBars
              data={o.byDay}
              series={[
                { key: "sent", label: "Emails sent", color: SERIES.a },
                { key: "replies", label: "Replies", color: SERIES.b },
              ]}
            />
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">No emails sent in this period yet. Launch a sequence to see activity here.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Funnel" subtitle="All-time · % = conversion from the previous step" />
          <div className="px-4 py-4 sm:px-5">
            <Funnel steps={data.funnel} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Pipeline by stage" subtitle={`${money(p.total)} open · ${money(p.weighted)} weighted`} />
          <div className="px-4 py-4 sm:px-5">
            <HBarList
              emptyLabel="No open deals yet"
              items={openStages.map((s) => ({
                key: s.stage,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[s.stage as DealStage] }} />
                    {stageLabel(s.stage)}
                    <span className="text-xs text-zinc-400">{s.count}</span>
                  </span>
                ),
                value: s.value,
                display: money(s.value),
                color: STAGE_COLOR[s.stage as DealStage],
              }))}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 text-[13px]">
              {(["won", "lost"] as const).map((st) => {
                const row = p.stages.find((s) => s.stage === st);
                return (
                  <div key={st} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: STAGE_COLOR[st] }} />
                    <span className="text-zinc-600">{stageLabel(st)}</span>
                    <span className="ml-auto font-medium tabular-nums text-zinc-900">{money(row?.value ?? 0)}</span>
                    <span className="text-xs tabular-nums text-zinc-400">({row?.count ?? 0})</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Calls by outcome" subtitle={`${totalCalls} call${totalCalls === 1 ? "" : "s"} in the last ${data.days} days`} />
          <div className="px-4 py-4 sm:px-5">
            <HBarList
              emptyLabel="No calls logged in this period"
              items={data.calls.map((c) => ({
                key: c.outcome,
                label: humanize(c.outcome),
                value: c.count,
                sub: c.minutes ? `${c.minutes} min` : undefined,
              }))}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Credit usage" subtitle={`${data.credits.used.toLocaleString()} used in ${data.days} days · ${data.credits.balance.toLocaleString()} remaining`} />
          {data.credits.byAction.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Action</Th>
                  <Th className="text-right">Credits</Th>
                  <Th className="w-1/3">Share</Th>
                </tr>
              </thead>
              <tbody>
                {data.credits.byAction.map((c) => (
                  <tr key={c.action}>
                    <Td>{humanize(c.action)}</Td>
                    <Td className="text-right tabular-nums font-medium text-zinc-900">{c.used.toLocaleString()}</Td>
                    <Td>
                      <div className="h-1.5 rounded-full bg-zinc-100">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (c.used / data.credits.used) * 100)}%`, background: SERIES.a }} />
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-zinc-500">No credits used in this period.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

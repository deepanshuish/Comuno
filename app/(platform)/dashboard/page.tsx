"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUp, Bot, CircleCheck, Circle, Radar } from "lucide-react";
import { money, useApi } from "@/lib/client";
import { Card, CardHeader, Empty, ErrorNote, Loading, cx } from "@/components/app/ui";
import { ActivityList, type ActivityRow } from "@/components/crm/shared";
import { SignalItem, type SignalRow } from "@/components/signals/SignalItem";

type Dashboard = {
  user: { name: string | null; email: string };
  workspace: { name: string; company_name: string | null };
  stats: Record<string, number>;
  checklist: { id: string; label: string; body: string; href: string; done: boolean }[];
  signals: SignalRow[];
  activity: ActivityRow[];
};

const SUGGESTIONS = [
  "Find 20 VPs of Sales at Series B SaaS companies in the US",
  "Which companies visited our pricing page this week?",
  "Summarize my pipeline and the deals at risk",
  "Draft a 3-step sequence for heads of RevOps",
];

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Working late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { data, error, loading } = useApi<Dashboard>("/api/dashboard");

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorNote error={error} />;
  if (!data) return null;

  const s = data.stats;
  const first = (data.user.name || data.user.email.split("@")[0]).split(" ")[0];
  const done = data.checklist.filter((c) => c.done).length;
  const allDone = done === data.checklist.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-semibold text-[28px] leading-tight tracking-tight text-zinc-900">
          {greeting()}, {first}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {s.unseen_signals
            ? `You have ${s.unseen_signals} new buying signal${s.unseen_signals === 1 ? "" : "s"}${s.overdue_tasks ? ` and ${s.overdue_tasks} overdue task${s.overdue_tasks === 1 ? "" : "s"}` : ""}.`
            : s.overdue_tasks
              ? `You have ${s.overdue_tasks} overdue task${s.overdue_tasks === 1 ? "" : "s"}.`
              : `Here's what's happening at ${data.workspace.company_name || data.workspace.name}.`}
        </p>
      </div>

      <PromptBox />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Tile href="/contacts" label="People" value={s.people.toLocaleString()} sub={s.people_added_week ? `+${s.people_added_week} this week` : `${s.companies.toLocaleString()} companies`} />
        <Tile href="/deals" label="Pipeline value" value={money(s.pipeline_value)} sub={`${money(s.weighted_pipeline)} weighted · ${s.open_deals} open`} />
        <Tile href="/analytics" label="Emails sent this week" value={s.emails_sent_week.toLocaleString()} sub={`${s.open_rate}% open rate (30d)`} />
        <Tile href="/analytics" label="Reply rate" value={`${s.reply_rate}%`} sub="Last 30 days" />
        <Tile
          href="/tasks"
          label="Open tasks"
          value={s.open_tasks.toLocaleString()}
          sub={s.overdue_tasks ? <span className="text-red-600">{s.overdue_tasks} overdue</span> : "Nothing overdue"}
          className="col-span-2 xl:col-span-1"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title="Recent buying signals"
              subtitle={s.unseen_signals ? `${s.unseen_signals} new` : "Visits, funding, hiring and job changes"}
              actions={
                <Link href="/signals" className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900">
                  View all <ArrowRight className="size-3" />
                </Link>
              }
            />
            {data.signals.length ? (
              <div className="divide-y divide-zinc-100">
                {data.signals.map((sig) => (
                  <Link key={sig.id} href="/signals" className="block hover:bg-zinc-50/70">
                    <SignalItem s={sig} compact />
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                icon={<Radar className="size-5" />}
                title="No signals yet"
                body="Install the website pixel and scan your top accounts to surface who's ready to buy."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Recent activity" subtitle="Across people, companies and deals" />
            <div className="px-5 py-4">
              {data.activity.length ? (
                <ActivityList items={data.activity} showContext compact />
              ) : (
                <p className="py-6 text-center text-sm text-zinc-500">Activity from outreach, deals and signals will show up here.</p>
              )}
            </div>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader title={allDone ? "You're all set up" : "Getting started"} subtitle={`${done} of ${data.checklist.length} complete`} />
            <div className="px-5 pt-3">
              <div className="h-1.5 rounded-full bg-zinc-100">
                <div className="h-1.5 rounded-full bg-brand-500 transition-[width]" style={{ width: `${(done / data.checklist.length) * 100}%` }} />
              </div>
            </div>
            <ul className="p-2">
              {data.checklist.map((c) => (
                <li key={c.id}>
                  <Link href={c.href} className="group flex gap-3 rounded-lg px-3 py-2.5 hover:bg-zinc-50">
                    {c.done ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand-500" /> : <Circle className="mt-0.5 size-4 shrink-0 text-zinc-300" />}
                    <div className="min-w-0 flex-1">
                      <div className={cx("text-[13px] font-medium", c.done ? "text-zinc-400 line-through" : "text-zinc-900")}>{c.label}</div>
                      {!c.done && <div className="text-xs text-zinc-500">{c.body}</div>}
                    </div>
                    {!c.done && <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-zinc-300 group-hover:text-zinc-600" />}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="px-5 py-4">
            <div className="text-xs text-zinc-500">Credits remaining</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{s.credits.toLocaleString()}</span>
              <Link href="/analytics" className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
                Usage →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-500">
              <div>
                <span className="font-medium tabular-nums text-zinc-900">{s.visitors_week}</span> site visitors this week
              </div>
              <div>
                <span className="font-medium tabular-nums text-zinc-900">{s.active_sequences}</span> active sequence{s.active_sequences === 1 ? "" : "s"}
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Tile({ href, label, value, sub, className }: { href: string; label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cx("rounded-xl border border-zinc-200 bg-white px-4 py-3.5 transition-colors hover:border-zinc-300", className)}>
      <div className="truncate text-xs text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-zinc-500">{sub}</div>}
    </Link>
  );
}

function PromptBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = (text: string) => {
    const t = text.trim();
    if (t) router.push(`/agent?q=${encodeURIComponent(t)}`);
  };
  return (
    <Card className="p-3 sm:p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex items-end gap-2"
      >
        <Bot className="mb-2 size-5 shrink-0 text-brand-600" />
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              go(q);
            }
          }}
          rows={1}
          placeholder="Ask Comuno Agent to find leads, write a sequence, research an account…"
          aria-label="Ask Comuno Agent"
          className="max-h-32 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 [field-sizing:content]"
        />
        <button
          type="submit"
          disabled={!q.trim()}
          aria-label="Send to agent"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-500 disabled:opacity-40"
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => go(s)}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-left text-xs text-zinc-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
          >
            {s}
          </button>
        ))}
      </div>
    </Card>
  );
}

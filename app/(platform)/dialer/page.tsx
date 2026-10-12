"use client";
import { useMemo, useState } from "react";
import { PhoneCall } from "lucide-react";
import { fullName, timeAgo, useApi } from "@/lib/client";
import { Avatar, Badge, Card, CardHeader, Empty, ErrorNote, Loading, PageHeader, Score, Select, cx } from "@/components/app/ui";
import DialerCard from "@/components/engage/DialerCard";
import { CALL_OUTCOMES, type CallRow, type QueueContact } from "@/components/engage/types";
import { useContactSearch } from "@/components/engage/shared";

export default function DialerPage() {
  const [listId, setListId] = useState("");
  const [recent, setRecent] = useState(false);
  const { data, error, loading, reload } = useApi<{ queue: QueueContact[] }>(`/api/dialer/queue?${new URLSearchParams({ ...(listId ? { list: listId } : {}), ...(recent ? { recent: "1" } : {}) })}`);
  const calls = useApi<{ calls: CallRow[] }>("/api/calls?limit=15");
  const lists = useContactSearch({ q: "", withPhone: true });
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [currentId, setCurrentId] = useState<string | null>(null);

  const queue = useMemo(() => (data?.queue || []).filter((c) => !skipped.has(c.id) || c.id === currentId), [data, skipped, currentId]);
  const current = queue.find((c) => c.id === currentId) || queue.find((c) => !skipped.has(c.id)) || null;
  const idx = current ? queue.indexOf(current) : -1;

  const next = (markSkipped: boolean) => {
    if (!current) return;
    const after = queue.slice(idx + 1).find((c) => !skipped.has(c.id));
    if (markSkipped) setSkipped((s) => new Set(s).add(current.id));
    setCurrentId(after?.id ?? null);
  };

  return (
    <div>
      <PageHeader
        title="Power dialer"
        subtitle="Work your call queue one prospect at a time — AI talk tracks, objection handling and call summaries."
        actions={
          <>
            <Select value={listId} onChange={(e) => setListId(e.target.value)} className="w-48!">
              <option value="">All contacts with phones</option>
              {lists.data?.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 text-[13px] text-zinc-600">
              <input type="checkbox" className="size-3.5 accent-zinc-900" checked={recent} onChange={(e) => setRecent(e.target.checked)} />
              Include called today
            </label>
          </>
        }
      />
      {loading && !data ? (
        <Loading label="Building your call queue…" />
      ) : error ? (
        <ErrorNote error={error} />
      ) : !queue.length ? (
        <Card>
          <Empty
            icon={<PhoneCall className="size-5" />}
            title={data?.queue.length ? "You’ve worked the whole queue" : "No one to call"}
            body={
              data?.queue.length
                ? "Nice work. Reload to start over with skipped contacts."
                : "The queue includes contacts with a phone number who haven’t been called in the last day. Add phone numbers in People, or add call steps to a sequence."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="order-2 overflow-hidden lg:order-1 lg:max-h-[calc(100vh-200px)] lg:overflow-y-auto">
            <CardHeader title="Queue" subtitle={`${queue.length} to call · open call tasks first`} />
            {queue.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setCurrentId(c.id)}
                className={cx(
                  "flex w-full items-center gap-2.5 border-b border-zinc-100 px-4 py-2.5 text-left last:border-0",
                  current?.id === c.id ? "bg-brand-50/60" : "hover:bg-zinc-50",
                  skipped.has(c.id) && "opacity-50",
                )}
              >
                <span className="w-4 shrink-0 text-right text-[11px] tabular-nums text-zinc-400">{i + 1}</span>
                <Avatar name={fullName(c)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-zinc-900">{fullName(c)}</span>
                  <span className="block truncate text-xs text-zinc-500">{c.company_name || c.title || c.phone}</span>
                </span>
                {c.call_task_id ? <Badge tone="green">Task</Badge> : <Score value={c.score} />}
              </button>
            ))}
          </Card>
          <div className="order-1 min-w-0 lg:order-2">
            {current && (
              <DialerCard
                key={current.id}
                contact={current}
                position={`${idx + 1} of ${queue.length}`}
                onSkip={() => next(true)}
                onSaved={async () => {
                  next(false);
                  await Promise.all([reload(), calls.reload()]);
                }}
              />
            )}
          </div>
        </div>
      )}

      {!!calls.data?.calls.length && (
        <Card className="mt-6">
          <CardHeader title="Recent calls" />
          <div className="divide-y divide-zinc-100">
            {calls.data.calls.map((k) => {
              const o = CALL_OUTCOMES.find((x) => x.id === k.outcome);
              return (
                <div key={k.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                  <Avatar name={fullName(k)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="font-medium text-zinc-900">{fullName(k)}</span>
                      {k.company_name && <span className="text-zinc-500">· {k.company_name}</span>}
                      {o && <Badge tone={o.tone}>{o.label}</Badge>}
                      {!!k.duration_sec && <span className="text-xs tabular-nums text-zinc-500">{Math.floor(k.duration_sec / 60)}:{String(k.duration_sec % 60).padStart(2, "0")}</span>}
                    </div>
                    {(k.summary || k.notes) && <p className="mt-0.5 line-clamp-2 text-xs text-zinc-600">{k.summary || k.notes}</p>}
                  </div>
                  <span className="text-[11px] text-zinc-400">{timeAgo(k.created_at)}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

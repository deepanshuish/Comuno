"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, Pause, Play, X } from "lucide-react";
import { del, fullName, patch } from "@/lib/client";
import { Avatar, Button, Card, ErrorNote, Table, Td, Th, cx } from "@/components/app/ui";
import { StatusBadge, StepIcon } from "./shared";
import { formatWhen, type SequenceDetail } from "./types";

const FILTERS = ["all", "active", "paused", "replied", "completed", "bounced"] as const;

export default function EnrollmentsTable({ detail, onChange }: { detail: SequenceDetail; onChange: () => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rows = useMemo(() => detail.enrollments.filter((e) => filter === "all" || e.status === filter), [detail.enrollments, filter]);
  const count = (f: string) => (f === "all" ? detail.enrollments.length : detail.enrollments.filter((e) => e.status === f).length);

  const act = async (eid: string, action: "pause" | "resume" | "unenroll") => {
    if (action === "unenroll" && !confirm("Remove this contact from the sequence?")) return;
    setBusy(eid + action);
    setError(null);
    try {
      if (action === "unenroll") await del(`/api/sequences/${detail.sequence.id}/enrollments/${eid}`);
      else await patch(`/api/sequences/${detail.sequence.id}/enrollments/${eid}`, { action });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-4 py-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cx(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              filter === f ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
            )}
          >
            {f} <span className="opacity-60">{count(f)}</span>
          </button>
        ))}
      </div>
      {error && (
        <div className="px-4 pt-3">
          <ErrorNote error={error} />
        </div>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Contact</Th>
            <Th>Status</Th>
            <Th>Progress</Th>
            <Th>Next step</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const next = detail.steps[e.current_step];
            return (
              <tr key={e.id}>
                <Td>
                  <div className="flex min-w-[200px] items-center gap-2.5">
                    <Avatar name={fullName(e)} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-900">{fullName(e)}</div>
                      <div className="truncate text-xs text-zinc-500">{[e.title, e.company_name].filter(Boolean).join(" · ") || e.email || "—"}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <StatusBadge status={e.status} />
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full rounded-full bg-zinc-800" style={{ width: `${detail.steps.length ? Math.min(100, (e.current_step / detail.steps.length) * 100) : 0}%` }} />
                    </div>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {Math.min(e.current_step, detail.steps.length)}/{detail.steps.length}
                    </span>
                  </div>
                </Td>
                <Td>
                  {e.status === "active" && next ? (
                    <span className="flex items-center gap-2 whitespace-nowrap text-xs text-zinc-600">
                      <StepIcon type={next.type} className="size-5 rounded-md [&_svg]:size-3" />
                      {formatWhen(e.next_run_at)}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-400">—</span>
                  )}
                </Td>
                <Td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/inbox?contact=${e.contact_id}`} className="inline-flex h-7 items-center rounded-lg px-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" title="Open conversation">
                      <Mail className="size-3.5" />
                    </Link>
                    {e.status === "active" ? (
                      <Button size="sm" variant="ghost" title="Pause" loading={busy === e.id + "pause"} onClick={() => act(e.id, "pause")} icon={<Pause className="size-3.5" />} />
                    ) : e.current_step < detail.steps.length ? (
                      <Button size="sm" variant="ghost" title="Resume" loading={busy === e.id + "resume"} onClick={() => act(e.id, "resume")} icon={<Play className="size-3.5" />} />
                    ) : null}
                    <Button size="sm" variant="ghost" title="Remove from sequence" loading={busy === e.id + "unenroll"} onClick={() => act(e.id, "unenroll")} icon={<X className="size-3.5" />} />
                  </div>
                </Td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-500">
                No {filter} enrollments.
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Card>
  );
}

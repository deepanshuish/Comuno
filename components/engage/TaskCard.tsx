"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, CheckSquare, ExternalLink, Mail, MessageSquare, Phone, RotateCcw, SkipForward, Trash2, type LucideIcon } from "lucide-react";
import { del, fullName, patch, post } from "@/lib/client";
import type { Task } from "@/lib/types";
import { Avatar, Badge, Button, Card, ErrorNote, Textarea, cx } from "@/components/app/ui";
import { CopyButton } from "./shared";
import { formatWhen, parseDbDate, type TaskRow } from "./types";

const TYPE_META: Record<Task["type"], { icon: LucideIcon; label: string; tone: string }> = {
  linkedin: { icon: MessageSquare, label: "LinkedIn", tone: "bg-brand-50 text-brand-700 ring-brand-100" },
  call: { icon: Phone, label: "Call", tone: "bg-brand-50 text-brand-700 ring-brand-100" },
  todo: { icon: CheckSquare, label: "To-do", tone: "bg-zinc-50 text-zinc-700 ring-zinc-100" },
  email: { icon: Mail, label: "Email", tone: "bg-zinc-50 text-zinc-700 ring-zinc-100" },
};

export default function TaskCard({ task: t, onRemoved, onUpdated }: { task: TaskRow; onRemoved: () => void; onUpdated: (t: TaskRow) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.body || "");
  const meta = TYPE_META[t.type] || TYPE_META.todo;
  const Icon = meta.icon;
  const who = t.contact_id ? fullName(t) : null;
  const overdue = t.status === "open" && (parseDbDate(t.due_at)?.getTime() ?? Infinity) < new Date().setHours(0, 0, 0, 0);
  const isConnect = t.step_type === "linkedin_connect";
  const linkedinHref = t.linkedin_url || (who ? `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent([who, t.company_name].filter(Boolean).join(" "))}` : null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const setStatus = (status: Task["status"]) =>
    run(status, async () => {
      await patch(`/api/tasks/${t.id}`, { status });
      onRemoved();
    });

  const ai = () =>
    run("ai", async () => {
      const r = await post<{ task: Task }>(`/api/tasks/${t.id}/ai`);
      onUpdated({ ...t, ...r.task });
      setDraft(r.task.body || "");
    });

  const saveBody = () =>
    run("save", async () => {
      const r = await patch<{ task: Task }>(`/api/tasks/${t.id}`, { body: draft });
      onUpdated({ ...t, ...r.task });
      setEditing(false);
    });

  const remove = () => {
    if (!confirm("Delete this task?")) return;
    run("delete", async () => {
      await del(`/api/tasks/${t.id}`);
      onRemoved();
    });
  };

  return (
    <Card className={cx("p-4", t.status !== "open" && "opacity-75")}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cx("inline-flex size-8 shrink-0 items-center justify-center rounded-lg ring-1", meta.tone)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-zinc-900">{t.title}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
            {who && (
              <span className="inline-flex items-center gap-1.5">
                <Avatar name={who} className="size-4 text-[8px]" />
                {who}
                {t.title_text && ` · ${t.title_text}`}
                {t.company_name && ` · ${t.company_name}`}
              </span>
            )}
            {t.sequence_name && <Badge>{t.sequence_name}</Badge>}
            <span className={cx(overdue && "font-medium text-red-600")}>Due {formatWhen(t.due_at || t.created_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {t.status === "open" ? (
            <>
              <Button size="sm" variant="primary" icon={<Check className="size-3.5" />} loading={busy === "done"} onClick={() => setStatus("done")}>
                Done
              </Button>
              <Button size="sm" variant="ghost" icon={<SkipForward className="size-3.5" />} loading={busy === "skipped"} onClick={() => setStatus("skipped")}>
                Skip
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} loading={busy === "open"} onClick={() => setStatus("open")}>
              Reopen
            </Button>
          )}
          <Button size="sm" variant="ghost" aria-label="Delete task" title="Delete" loading={busy === "delete"} onClick={remove} icon={<Trash2 className="size-3.5" />} />
        </div>
      </div>

      {(t.body || editing || t.contact_id) && (
        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 sm:ml-11">
          {editing ? (
            <>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} />
              {isConnect && <div className={cx("mt-1 text-xs", draft.length > 300 ? "text-red-600" : "text-zinc-500")}>{draft.length}/300 characters</div>}
              <div className="mt-2 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" loading={busy === "save"} onClick={saveBody}>
                  Save
                </Button>
              </div>
            </>
          ) : t.body ? (
            <>
              <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-700">{t.body}</div>
              {isConnect && <div className={cx("mt-1 text-[11px]", t.body.length > 300 ? "text-red-600" : "text-zinc-400")}>{t.body.length}/300</div>}
            </>
          ) : (
            <div className="text-[13px] text-zinc-500">
              {t.type === "linkedin" ? "No note yet — write one with AI." : t.type === "call" ? "No talk track yet — generate one with AI." : "No notes."}
            </div>
          )}
          {!editing && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {t.body && <CopyButton text={t.body} label={t.type === "linkedin" ? "Copy note" : "Copy"} />}
              {t.type === "linkedin" && linkedinHref && (
                <a href={linkedinHref} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50">
                  <ExternalLink className="size-3.5" /> {t.linkedin_url ? "Open LinkedIn profile" : "Find on LinkedIn"}
                </a>
              )}
              {t.type === "call" && t.phone && (
                <>
                  <a href={`tel:${t.phone.replace(/[^\d+]/g, "")}`} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50">
                    <Phone className="size-3.5" /> {t.phone}
                  </a>
                  <Link href="/dialer" className="inline-flex h-7 items-center rounded-lg px-2 text-[13px] text-zinc-600 hover:bg-zinc-100">
                    Open in dialer →
                  </Link>
                </>
              )}
              {t.contact_id && t.type !== "email" && (
                <Button size="sm" variant="ai" loading={busy === "ai"} onClick={ai}>
                  {t.body ? "Rewrite with AI" : "Write with AI"}
                </Button>
              )}
              {t.type === "email" && t.contact_id && (
                <Link href={`/inbox?compose=${t.contact_id}`} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50">
                  <Mail className="size-3.5" /> Compose email
                </Link>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(t.body || "");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mt-2 sm:ml-11">
          <ErrorNote error={error} />
        </div>
      )}
    </Card>
  );
}

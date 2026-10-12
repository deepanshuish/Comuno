"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ExternalLink, Mail, Phone, PhoneOff, SkipForward } from "lucide-react";
import { fullName, post, timeAgo } from "@/lib/client";
import { Avatar, Badge, Button, Card, CardHeader, ErrorNote, Field, Input, Score, Textarea, cx } from "@/components/app/ui";
import { MiniMarkdown, StatusBadge } from "./shared";
import { CALL_OUTCOMES, type CallOutcome, type QueueContact } from "./types";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function DialerCard({
  contact: c,
  position,
  onSkip,
  onSaved,
}: {
  contact: QueueContact;
  position: string;
  onSkip: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [notes, setNotes] = useState("");
  const [summary, setSummary] = useState("");
  const [nextSteps, setNextSteps] = useState<string[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [script, setScript] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  const startCall = () => {
    setStartedAt(Date.now());
    setElapsed(0);
  };
  const endCall = () => {
    if (startedAt) setElapsed(Math.round((Date.now() - startedAt) / 1000));
    setStartedAt(null);
  };

  const genScript = async () => {
    setBusy("script");
    setScriptError(null);
    try {
      const r = await post<{ script: string }>("/api/dialer/script", { contactId: c.id });
      setScript(r.script);
    } catch (e) {
      setScriptError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const summarize = async () => {
    setBusy("summary");
    setError(null);
    try {
      const r = await post<{ summary: string; next_steps: string[] }>("/api/calls/summary", { contactId: c.id, notes, outcome });
      setSummary(r.summary);
      setNextSteps(r.next_steps);
      if (r.next_steps[0] && !followUp) setFollowUp(r.next_steps[0]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!outcome) return setError("Pick a call outcome first");
    setBusy("save");
    setError(null);
    try {
      const duration = startedAt ? Math.round((Date.now() - startedAt) / 1000) : elapsed;
      const fullSummary = [summary.trim(), nextSteps.length ? `Next steps:\n${nextSteps.map((s) => `- ${s}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
      await post("/api/calls", {
        contactId: c.id,
        outcome,
        duration_sec: duration,
        notes,
        summary: fullSummary || undefined,
        taskId: c.call_task_id || undefined,
        followUp: followUp.trim() ? { title: followUp.trim() } : null,
      });
      setStartedAt(null);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const onCall = !!startedAt;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start gap-4 p-5">
          <Avatar name={fullName(c)} className="size-12 text-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">{fullName(c)}</h2>
              <Score value={c.score} />
              <StatusBadge status={c.status} />
            </div>
            <div className="text-[13px] text-zinc-600">{[c.title, c.company_name].filter(Boolean).join(" at ")}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
              {c.location && <span>{c.location}</span>}
              {c.email && (
                <Link href={`/inbox?contact=${c.id}`} className="inline-flex items-center gap-1 hover:text-zinc-900">
                  <Mail className="size-3" /> {c.email}
                </Link>
              )}
              {c.linkedin_url && (
                <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-zinc-900">
                  <ExternalLink className="size-3" /> LinkedIn
                </a>
              )}
              {c.call_count > 0 && (
                <span>
                  Called {c.call_count}× · last {timeAgo(c.last_call_at)}
                  {c.last_outcome ? ` (${c.last_outcome.replace(/_/g, " ")})` : ""}
                </span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-zinc-400">{position}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 bg-zinc-50/50 px-5 py-3">
          <span className="font-mono text-base tabular-nums text-zinc-900">{c.phone}</span>
          {!onCall ? (
            <a
              href={`tel:${(c.phone || "").replace(/[^\d+]/g, "")}`}
              onClick={startCall}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[13px] font-medium text-white hover:bg-brand-500"
            >
              <Phone className="size-3.5" /> Call
            </a>
          ) : (
            <Button variant="danger" icon={<PhoneOff className="size-3.5" />} onClick={endCall}>
              End call
            </Button>
          )}
          <span className={cx("font-mono text-sm tabular-nums", onCall ? "text-brand-700" : "text-zinc-400")}>
            {onCall && <span className="mr-1.5 inline-block size-2 animate-pulse rounded-full bg-brand-500" />}
            {fmt(elapsed)}
          </span>
          {!onCall && elapsed === 0 && (
            <button onClick={startCall} className="text-xs text-zinc-500 underline-offset-2 hover:underline">
              Start timer
            </button>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" icon={<SkipForward className="size-3.5" />} onClick={onSkip}>
            Skip
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          {(c.company_name || c.company_description) && (
            <Card>
              <CardHeader title={<span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-zinc-400" /> {c.company_name || "Company"}</span>} subtitle={[c.company_industry, c.company_size && `${c.company_size} employees`].filter(Boolean).join(" · ") || undefined} />
              <div className="space-y-1 px-5 py-3 text-[13px] text-zinc-600">
                {c.company_description ? <p>{c.company_description}</p> : <p className="text-zinc-400">No company description yet.</p>}
                {c.company_domain && (
                  <a href={c.company_website || `https://${c.company_domain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900">
                    <ExternalLink className="size-3" /> {c.company_domain}
                  </a>
                )}
              </div>
            </Card>
          )}
          {c.call_task_id && c.call_task_body && (
            <Card>
              <CardHeader title={c.call_task_title || "Call task"} subtitle="From your sequence" />
              <div className="whitespace-pre-wrap px-5 py-3 text-[13px] text-zinc-700">{c.call_task_body}</div>
            </Card>
          )}
          <Card>
            <CardHeader
              title="AI call script"
              subtitle="Talk track & objection handling tailored to this prospect"
              actions={
                <Button size="sm" variant="ai" loading={busy === "script"} onClick={genScript}>
                  {script ? "Regenerate" : "Generate"}
                </Button>
              }
            />
            <div className="px-5 py-4">
              <ErrorNote error={scriptError} />
              {script ? (
                <MiniMarkdown text={script} />
              ) : (
                !scriptError && <p className="text-[13px] text-zinc-500">Generate an opener, discovery questions, value pitch and objection handling from everything Comuno knows about {c.first_name || "this prospect"}.</p>
              )}
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader title="Log this call" />
          <div className="space-y-4 p-5">
            <div>
              <div className="mb-1.5 text-xs font-medium text-zinc-700">Outcome</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CALL_OUTCOMES.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setOutcome(o.id)}
                    className={cx(
                      "rounded-lg border px-2.5 py-2 text-[13px] font-medium transition-colors",
                      outcome === o.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Notes">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Pain points, current tools, timeline, who else is involved…" />
            </Field>
            <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-brand-900">Call summary</span>
                <Button size="sm" variant="ai" loading={busy === "summary"} disabled={!notes.trim()} onClick={summarize}>
                  Summarize with AI
                </Button>
              </div>
              <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="AI turns your notes into a CRM-ready summary — or write your own." />
              {!!nextSteps.length && (
                <ul className="mt-2 space-y-1 text-[13px] text-zinc-700">
                  {nextSteps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[7px] size-1 shrink-0 rounded-full bg-brand-500" />
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Field label="Follow-up task (optional)" hint="Created in your task queue, due in 2 days.">
              <Input value={followUp} onChange={(e) => setFollowUp(e.target.value)} placeholder="e.g. Send case study and pricing" />
            </Field>
            <ErrorNote error={error} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              {outcome === "meeting_booked" && <Badge tone="violet">Marks contact interested & stops sequences</Badge>}
              <Button variant="primary" className="ml-auto" loading={busy === "save"} disabled={!outcome} onClick={save}>
                Save & next
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

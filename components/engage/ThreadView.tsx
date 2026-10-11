"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FlaskConical, MailOpen, MessageSquareReply, MousePointerClick, Phone, Send } from "lucide-react";
import { fullName, patch, post, timeAgo, useApi } from "@/lib/client";
import { Avatar, Badge, Button, Card, ErrorNote, Input, Loading, Select, Tabs, Textarea, cx } from "@/components/app/ui";
import { SentimentBadge, StatusBadge } from "./shared";
import { SENTIMENTS, formatWhen, type EngageMessage, type Sentiment, type ThreadDetail } from "./types";

export default function ThreadView({ contactId, onChanged }: { contactId: string; onChanged: () => void }) {
  const { data, error, loading, reload } = useApi<ThreadDetail>(`/api/inbox/${contactId}`);
  const [mode, setMode] = useState<"reply" | "log">("reply");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [data?.messages.length]);

  if (loading && !data) return <Card><Loading /></Card>;
  if (error && !data) return <ErrorNote error={error} />;
  if (!data) return null;
  const { contact: c, messages, enrollments } = data;
  const refresh = async () => {
    await reload();
    onChanged();
  };
  const lastIn = [...messages].reverse().find((m) => m.direction === "in");

  return (
    <Card className="flex min-h-[420px] flex-col overflow-hidden lg:h-[max(560px,calc(100vh-210px))]">
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
        <Avatar name={fullName(c)} className="size-9 text-xs" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-zinc-900">{fullName(c)}</span>
            <StatusBadge status={c.status} />
          </div>
          <div className="truncate text-xs text-zinc-500">{[c.title, c.company_name, c.email].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {enrollments.map((e) => (
            <Link key={e.id} href={`/sequences/${e.sequence_id}`} className="inline-flex">
              <Badge tone={e.status === "active" ? "green" : "zinc"}>
                {e.sequence_name} · {e.status}
              </Badge>
            </Link>
          ))}
          {c.phone && (
            <a href={`tel:${c.phone}`} className="inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-200 px-2 text-xs text-zinc-700 hover:bg-zinc-50">
              <Phone className="size-3" /> Call
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-zinc-50/40 px-4 py-4">
        {!messages.length && <div className="py-10 text-center text-sm text-zinc-500">No messages with {c.first_name || "this contact"} yet.</div>}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} onChanged={refresh} />
        ))}
        <div ref={bottom} />
      </div>

      <div className="border-t border-zinc-100 bg-white">
        <div className="px-4 pt-1">
          <Tabs
            value={mode}
            onChange={setMode}
            tabs={[
              { id: "reply", label: "Reply" },
              { id: "log", label: "Log their reply" },
            ]}
          />
        </div>
        {mode === "reply" ? (
          <ReplyBox key={`r-${contactId}`} contactId={contactId} hasEmail={!!c.email} defaultSubject={replySubject(lastIn || messages[messages.length - 1])} canDraft={messages.length > 0} onSent={refresh} />
        ) : (
          <LogReplyBox key={`l-${contactId}`} contactId={contactId} onSaved={refresh} />
        )}
      </div>
    </Card>
  );
}

function replySubject(m?: EngageMessage) {
  if (!m?.subject) return "";
  return `Re: ${m.subject.replace(/^(re:\s*)+/i, "")}`;
}

function MessageBubble({ m, onChanged }: { m: EngageMessage; onChanged: () => void }) {
  const out = m.direction === "out";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const classify = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await post<{ sentiment: string; summary: string }>(`/api/messages/${m.id}/classify`);
      setAiSummary(r.summary);
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const label = async (s: Sentiment) => {
    setErr(null);
    try {
      await patch(`/api/messages/${m.id}`, { sentiment: s });
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className={cx("flex", out ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "w-full max-w-[640px] rounded-xl border px-4 py-3",
          out ? "border-zinc-200 bg-white" : "border-violet-200 bg-violet-50/40",
          m.status === "failed" && "border-red-200 bg-red-50/40",
        )}
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
          <span className="font-medium text-zinc-700">{out ? "You" : "Prospect"}</span>
          {m.channel === "linkedin" && <Badge tone="blue">LinkedIn</Badge>}
          <span title={m.sent_at || m.created_at}>{formatWhen(m.sent_at || m.created_at)}</span>
          {out && m.delivery === "sandbox" && (
            <Badge tone="amber">
              <FlaskConical className="size-3" /> Sandbox — not delivered
            </Badge>
          )}
          {out && m.status === "failed" && (
            <Badge tone="red">
              <AlertTriangle className="size-3" /> Failed
            </Badge>
          )}
          {out && m.opened_at && (
            <Badge tone="green">
              <MailOpen className="size-3" /> Opened {timeAgo(m.opened_at)}
            </Badge>
          )}
          {out && m.clicked_at && (
            <Badge tone="violet">
              <MousePointerClick className="size-3" /> Clicked
            </Badge>
          )}
          {!out && <SentimentBadge value={m.sentiment} />}
        </div>
        {m.subject && <div className="mb-1 text-[13px] font-semibold text-zinc-900">{m.subject}</div>}
        <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-zinc-700">{m.body}</div>
        {m.error && <div className="mt-2 text-xs text-red-600">{m.error}</div>}
        {!out && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-violet-100 pt-2.5">
            <Button size="sm" variant="ai" loading={busy} onClick={classify}>
              {m.sentiment ? "Re-classify" : "Classify with AI"}
            </Button>
            <Select value={m.sentiment || ""} onChange={(e) => e.target.value && label(e.target.value as Sentiment)} className="h-7! w-auto! py-0! text-xs" aria-label="Set sentiment">
              <option value="">Label manually…</option>
              {SENTIMENTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            {aiSummary && <span className="text-xs text-violet-700">{aiSummary}</span>}
          </div>
        )}
        {err && (
          <div className="mt-2">
            <ErrorNote error={err} />
          </div>
        )}
      </div>
    </div>
  );
}

function ReplyBox({ contactId, hasEmail, defaultSubject, canDraft, onSent }: { contactId: string; hasEmail: boolean; defaultSubject: string; canDraft: boolean; onSent: () => void }) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draft = async () => {
    setDrafting(true);
    setError(null);
    try {
      const d = await post<{ subject: string; body: string }>(`/api/inbox/${contactId}/draft`);
      if (d.subject) setSubject(d.subject);
      setBody(d.body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  };
  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await post("/api/messages", { contactId, subject, body });
      setBody("");
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!hasEmail) return <div className="px-4 py-4 text-[13px] text-zinc-500">This contact has no email address, so you can’t email them from here.</div>;
  return (
    <div className="space-y-2 p-4">
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write a reply… or let AI draft one from the whole conversation." />
      <ErrorNote error={error} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ai" size="sm" loading={drafting} disabled={!canDraft} onClick={draft}>
          AI draft reply
        </Button>
        <Button variant="primary" size="sm" icon={<Send className="size-3.5" />} loading={sending} disabled={!body.trim()} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}

function LogReplyBox({ contactId, onSaved }: { contactId: string; onSaved: () => void }) {
  const [body, setBody] = useState("");
  const [channel, setChannel] = useState<"email" | "linkedin">("email");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const r = await post<{ classification: { sentiment: string; summary: string } | null; aiError: string | null }>(`/api/inbox/${contactId}/reply`, { body, channel });
      setBody("");
      if (r.classification) {
        const s = SENTIMENTS.find((x) => x.id === r.classification!.sentiment);
        setResult({ tone: "ok", text: `Saved and classified as ${s?.label || r.classification.sentiment}: ${r.classification.summary}` });
      } else {
        setResult({ tone: "warn", text: `Reply saved and sequences stopped. AI classification unavailable (${r.aiError}) — label it manually above.` });
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 p-4">
      <p className="text-xs text-zinc-500">
        Paste the prospect’s reply. It’s saved to the thread, stops their sequences and is classified by AI (interested, objection, OOO…).
      </p>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Paste their reply here…" />
      <ErrorNote error={error} />
      {result && (
        <div className={cx("rounded-lg border px-3 py-2 text-[13px]", result.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
          {result.text}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={channel} onChange={(e) => setChannel(e.target.value as "email" | "linkedin")} className="h-8! w-auto!">
          <option value="email">Email reply</option>
          <option value="linkedin">LinkedIn reply</option>
        </Select>
        <Button variant="primary" size="sm" icon={<MessageSquareReply className="size-3.5" />} loading={saving} disabled={!body.trim()} onClick={save}>
          Save reply
        </Button>
      </div>
    </div>
  );
}

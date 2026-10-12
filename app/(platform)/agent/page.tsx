"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Bot, Check, ChevronRight, Loader2, Mail, MessageSquarePlus, Trash2, Users, Wrench, X } from "lucide-react";
import Markdown from "@/components/agent/Markdown";
import { Button, cx, ErrorNote, Loading } from "@/components/app/ui";
import { del, post, timeAgo, useApi } from "@/lib/client";

type Event =
  | { kind: "thread"; threadId: string; title: string }
  | { kind: "user"; id: string; text: string }
  | { kind: "assistant"; id: string; text: string }
  | { kind: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { kind: "tool_result"; id: string; name: string; ok: boolean; result?: unknown; error?: string }
  | { kind: "approval"; id: string; tool: string; args: Record<string, unknown>; status: "pending" | "approved" | "rejected"; result?: unknown; error?: string }
  | { kind: "error"; id: string; text: string }
  | { kind: "done"; threadId: string }
  | { kind: "fatal"; error: string };

type Thread = { id: string; title: string | null; created_at: string };

const SUGGESTIONS = [
  { icon: Users, text: "Find 10 Heads of Sales at Series A–B SaaS companies in the US and save them to a list called 'Q4 outbound'" },
  { icon: Bot, text: "Research our top 3 scored companies and tell me the best angle for outreach" },
  { icon: Mail, text: "Create a 5-step email + LinkedIn sequence to book demos with RevOps leaders" },
  { icon: Wrench, text: "Summarize my pipeline and tell me which deals need attention this week" },
];

const TOOL_LABELS: Record<string, string> = {
  find_prospects: "Finding prospects",
  find_companies: "Finding companies",
  search_people: "Searching people",
  search_companies: "Searching companies",
  enrich_company: "Enriching company",
  enrich_person: "Enriching person",
  find_email: "Finding email",
  score_people: "Scoring fit",
  research_account: "Researching account",
  market_research: "Researching the market",
  add_to_list: "Updating list",
  update_person: "Updating person",
  draft_email: "Drafting email",
  send_email: "Send email",
  list_sequences: "Listing sequences",
  create_sequence: "Building sequence",
  enroll_in_sequence: "Enroll in sequence",
  call_script: "Writing call script",
  outreach_stats: "Checking outreach stats",
  list_deals: "Listing deals",
  create_deal: "Creating deal",
  update_deal: "Updating deal",
  pipeline_summary: "Summarizing pipeline",
  deal_insight: "Analyzing deal",
  list_signals: "Checking signals",
  refresh_signals: "Scanning for signals",
};

export default function AgentPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Agent />
    </Suspense>
  );
}

function Agent() {
  const params = useSearchParams();
  const router = useRouter();
  const threadParam = params.get("t");
  const { data: threads, reload: reloadThreads } = useApi<Thread[]>("/api/agent/threads");
  const [threadId, setThreadId] = useState<string | null>(threadParam);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingThread, setLoadingThread] = useState(!!threadParam);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  // When the ?t= param changes (thread picked in the sidebar), reset view state.
  // While a turn is streaming, the param changes because we created the thread; keep events then.
  const [prevParam, setPrevParam] = useState(threadParam);
  if (prevParam !== threadParam) {
    setPrevParam(threadParam);
    setThreadId(threadParam);
    if (!busy) {
      setEvents([]);
      setLoadingThread(!!threadParam);
    }
  }

  // Load a thread's history when navigating to it.
  const shouldLoad = !!threadParam && loadingThread;
  useEffect(() => {
    if (!shouldLoad || !threadParam) return;
    let cancelled = false;
    fetch(`/api/agent/threads/${threadParam}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setEvents(Array.isArray(d) ? d : []))
      .finally(() => !cancelled && setLoadingThread(false));
    return () => {
      cancelled = true;
    };
  }, [shouldLoad, threadParam]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [events, busy]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setBusy(true);
      setError(null);
      setInput("");
      try {
        const res = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, threadId }),
        });
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const e = JSON.parse(line) as Event;
            if (e.kind === "thread") {
              setThreadId(e.threadId);
              window.history.replaceState(null, "", `/agent?t=${e.threadId}`);
              reloadThreads();
            } else if (e.kind === "fatal") setError(e.error);
            else if (e.kind !== "done") setEvents((prev) => [...prev, e]);
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [busy, threadId, reloadThreads],
  );

  // Support /agent?q=... from the dashboard quick prompt.
  useEffect(() => {
    const q = params.get("q");
    if (q && !autoSent.current) {
      autoSent.current = true;
      window.history.replaceState(null, "", "/agent");
      send(q);
    }
  }, [params, send]);

  async function resolve(id: string, decision: "approve" | "reject") {
    try {
      const r = await post<Extract<Event, { kind: "approval" }>>(`/api/agent/approvals/${id}`, { decision });
      setEvents((prev) => prev.map((e) => (e.kind === "approval" && e.id === id ? { ...e, ...r, kind: "approval" } : e)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const newChat = () => {
    setEvents([]);
    setError(null);
    router.push("/agent");
  };

  // Pair tool calls with their results for compact display.
  const results = new Map<string, Extract<Event, { kind: "tool_result" }>[]>();
  for (const e of events) if (e.kind === "tool_result") results.set(e.name, [...(results.get(e.name) || []), e]);
  const used = new Map<string, number>();

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-48px)] sm:-mx-8 sm:-my-8 lg:h-dvh">
      {/* Threads */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex">
        <div className="p-3">
          <Button className="w-full" icon={<MessageSquarePlus className="size-3.5" />} onClick={newChat}>
            New chat
          </Button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {threads?.map((t) => (
            <div
              key={t.id}
              className={cx(
                "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px]",
                t.id === threadId ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50",
              )}
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => router.push(`/agent?t=${t.id}`)}>
                <div className="truncate">{t.title || "Untitled"}</div>
                <div className="text-[11px] text-zinc-400">{timeAgo(t.created_at)}</div>
              </button>
              <button
                className="hidden rounded p-1 text-zinc-400 hover:text-red-600 group-hover:block"
                aria-label="Delete conversation"
                onClick={async () => {
                  await del(`/api/agent/threads/${t.id}`);
                  reloadThreads();
                  if (t.id === threadId) newChat();
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div ref={scroller} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
            {loadingThread ? (
              <Loading />
            ) : events.length === 0 && !busy ? (
              <div className="pt-[8vh]">
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-medium text-brand-700">
                  <Bot className="size-3.5" /> Comuno Agent · Gemini
                </div>
                <h1 className="font-display font-semibold text-[38px] leading-[1.1] tracking-tight text-zinc-900">What should we work on?</h1>
                <p className="mt-2 max-w-xl text-sm text-zinc-500">
                  Ask in plain English. The agent prospects with live web search, enriches and scores leads, writes outreach, builds sequences, and manages your pipeline.
                </p>
                <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => send(s.text)}
                      className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 text-left text-[13px] text-zinc-700 transition hover:border-zinc-300 hover:shadow-sm"
                    >
                      <s.icon className="mt-0.5 size-4 shrink-0 text-brand-600" />
                      {s.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {events.map((e) => {
                  if (e.kind === "user")
                    return (
                      <div key={e.id} className="flex justify-end">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-[13.5px] text-white">{e.text}</div>
                      </div>
                    );
                  if (e.kind === "assistant")
                    return (
                      <div key={e.id} className="flex gap-3">
                        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                          <Bot className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Markdown text={e.text} />
                        </div>
                      </div>
                    );
                  if (e.kind === "tool_call") {
                    const n = used.get(e.name) || 0;
                    used.set(e.name, n + 1);
                    const r = results.get(e.name)?.[n];
                    return <ToolChip key={e.id} name={e.name} args={e.args} result={r} running={!r && busy} />;
                  }
                  if (e.kind === "approval") return <ApprovalCard key={e.id} e={e} onResolve={resolve} />;
                  if (e.kind === "error")
                    return (
                      <div key={e.id} className="text-[13px] text-zinc-700">
                        {e.text}
                      </div>
                    );
                  return null;
                })}
                {busy && (
                  <div className="flex items-center gap-2 pl-10 text-[13px] text-zinc-500">
                    <Loader2 className="size-3.5 animate-spin" /> Working…
                  </div>
                )}
              </div>
            )}
            <div className="mt-4">
              <ErrorNote error={error} />
            </div>
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-zinc-200 bg-[#fbfbfa] px-4 py-3 sm:px-6">
          <form
            className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:border-brand-300 focus-within:ring-2 focus-within:ring-brand-100"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask the agent to prospect, research, write or manage deals…"
              className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[13.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:opacity-30"
              aria-label="Send"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </form>
          <p className="mx-auto mt-1.5 max-w-3xl text-center text-[11px] text-zinc-400">Each agent step uses 2 credits, plus the credits of the tools it runs.</p>
        </div>
      </section>
    </div>
  );
}

function ToolChip({ name, args, result, running }: { name: string; args: Record<string, unknown>; result?: { ok: boolean; result?: unknown; error?: string }; running: boolean }) {
  const [open, setOpen] = useState(false);
  const summary = typeof args.query === "string" ? args.query : typeof args.q === "string" ? args.q : typeof args.goal === "string" ? args.goal : typeof args.question === "string" ? args.question : "";
  return (
    <div className="ml-10">
      <button
        onClick={() => setOpen(!open)}
        className={cx(
          "inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px]",
          result && !result.ok ? "border-red-200 bg-red-50 text-red-700" : "border-zinc-200 bg-white text-zinc-600",
        )}
      >
        {running ? <Loader2 className="size-3 animate-spin" /> : result?.ok ? <Check className="size-3 text-brand-600" /> : result ? <X className="size-3" /> : <Wrench className="size-3" />}
        <span className="font-medium">{TOOL_LABELS[name] || name}</span>
        {summary && <span className="truncate text-zinc-400">· {summary}</span>}
        <ChevronRight className={cx("size-3 shrink-0 transition", open && "rotate-90")} />
      </button>
      {open && (
        <pre className="mt-1.5 max-h-72 overflow-auto rounded-lg bg-zinc-50 p-2.5 text-[11px] leading-relaxed text-zinc-600 ring-1 ring-zinc-200">
          {JSON.stringify({ args, ...(result ? (result.ok ? { result: result.result } : { error: result.error }) : {}) }, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ApprovalCard({ e, onResolve }: { e: Extract<Event, { kind: "approval" }>; onResolve: (id: string, d: "approve" | "reject") => Promise<void> }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const act = async (d: "approve" | "reject") => {
    setLoading(d);
    await onResolve(e.id, d);
    setLoading(null);
  };
  const a = e.args as { subject?: string; body?: string; contact_id?: string; contact_ids?: string[]; sequence_id?: string };
  return (
    <div className="ml-10 rounded-xl border border-zinc-200 bg-zinc-50/50">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
        <div className="text-[13px] font-semibold text-zinc-900">
          {e.tool === "send_email" ? "Approve email send" : e.tool === "enroll_in_sequence" ? `Approve enrolling ${a.contact_ids?.length || 0} people` : `Approve ${e.tool}`}
        </div>
        <span className={cx("text-[11px] font-medium", e.status === "approved" ? "text-brand-700" : e.status === "rejected" ? "text-zinc-500" : "text-zinc-700")}>
          {e.status === "pending" ? "Waiting for you" : e.status === "approved" ? (e.error ? "Failed" : "Approved") : "Rejected"}
        </span>
      </div>
      <div className="px-4 py-3 text-[13px] text-zinc-700">
        {e.tool === "send_email" ? (
          <>
            <div className="text-xs text-zinc-500">Subject</div>
            <div className="font-medium text-zinc-900">{a.subject}</div>
            <div className="mt-2 whitespace-pre-wrap rounded-lg bg-white p-3 ring-1 ring-zinc-200">{a.body}</div>
          </>
        ) : (
          <pre className="overflow-x-auto text-xs">{JSON.stringify(e.args, null, 2)}</pre>
        )}
        {e.error && <div className="mt-2 text-xs text-red-600">{e.error}</div>}
      </div>
      {e.status === "pending" && (
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-4 py-2.5">
          <Button size="sm" variant="ghost" loading={loading === "reject"} onClick={() => act("reject")}>
            Reject
          </Button>
          <Button size="sm" variant="primary" loading={loading === "approve"} onClick={() => act("approve")}>
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}

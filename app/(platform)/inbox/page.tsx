"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Inbox as InboxIcon, PenSquare, Search } from "lucide-react";
import { fullName, timeAgo, useApi } from "@/lib/client";
import { Avatar, Button, Card, Empty, ErrorNote, Input, Loading, PageHeader, cx } from "@/components/app/ui";
import { SandboxBanner, SentimentBadge, StatusBadge } from "@/components/engage/shared";
import ComposeModal from "@/components/engage/ComposeModal";
import ThreadView from "@/components/engage/ThreadView";
import type { InboxCounts, InboxThread, MailerMode } from "@/components/engage/types";

type Filter = keyof InboxCounts;
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_reply", label: "Needs reply" },
  { id: "interested", label: "Interested" },
  { id: "not_interested", label: "Not interested" },
  { id: "ooo", label: "OOO" },
  { id: "sent", label: "Sent" },
];

export default function InboxPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inbox />
    </Suspense>
  );
}

function Inbox() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("contact");
  const composeFor = params.get("compose");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error, loading, reload } = useApi<{ threads: InboxThread[]; counts: InboxCounts; mailer: MailerMode }>(
    `/api/inbox?filter=${filter}${debounced ? `&q=${encodeURIComponent(debounced)}` : ""}`,
  );

  const setParam = useCallback(
    (key: string, value: string | null, extra?: Record<string, string | null>) => {
      const p = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries({ [key]: value, ...extra })) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      router.replace(`/inbox${p.toString() ? `?${p}` : ""}`, { scroll: false });
    },
    [params, router],
  );

  const select = (id: string | null) => setParam("contact", id);

  return (
    <div>
      <PageHeader
        title="Inbox"
        subtitle="Every conversation across your sequences, with AI reply classification and drafting."
        actions={
          <Button variant="primary" icon={<PenSquare className="size-3.5" />} onClick={() => setComposeOpen(true)}>
            Compose
          </Button>
        }
      />
      <SandboxBanner mailer={data?.mailer} />
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className={cx("flex min-h-[420px] flex-col overflow-hidden lg:h-[max(560px,calc(100vh-210px))]", selected ? "hidden lg:flex" : "flex")}>
          <div className="space-y-2.5 border-b border-zinc-100 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations" className="pl-8" />
            </div>
            <div className="flex flex-wrap gap-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cx(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === f.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
                  )}
                >
                  {f.label}
                  {data && data.counts[f.id] > 0 && <span className={cx("ml-1", filter === f.id ? "opacity-70" : "text-zinc-400")}>{data.counts[f.id]}</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && !data ? (
              <Loading />
            ) : error ? (
              <div className="p-3">
                <ErrorNote error={error} />
              </div>
            ) : !data?.threads.length ? (
              <Empty
                icon={<InboxIcon className="size-5" />}
                title={filter === "all" && !debounced ? "No conversations yet" : "Nothing here"}
                body={filter === "all" && !debounced ? "Emails you send from sequences or Compose will show up here." : "No conversations match this filter."}
              />
            ) : (
              data.threads.map((t) => (
                <button
                  key={t.contact.id}
                  onClick={() => select(t.contact.id)}
                  className={cx(
                    "flex w-full gap-3 border-b border-zinc-100 px-3 py-3 text-left transition-colors",
                    selected === t.contact.id ? "bg-brand-50/60" : "hover:bg-zinc-50",
                  )}
                >
                  <Avatar name={fullName(t.contact)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cx("min-w-0 flex-1 truncate text-[13px] text-zinc-900", t.needsReply ? "font-semibold" : "font-medium")}>{fullName(t.contact)}</span>
                      <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(t.last.created_at)}</span>
                    </div>
                    <div className="truncate text-xs text-zinc-500">{t.contact.company_name || t.contact.email}</div>
                    <div className="mt-1 truncate text-xs text-zinc-600">
                      <span className="text-zinc-400">{t.last.direction === "out" ? "You: " : ""}</span>
                      {t.last.subject || t.last.body?.slice(0, 80)}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {t.needsReply && <span className="size-1.5 rounded-full bg-brand-600" title="Needs reply" />}
                      <SentimentBadge value={t.sentiment} />
                      {t.last.status === "failed" && <StatusBadge status="bounced" />}
                      <span className="text-[11px] text-zinc-400">{t.count} message{t.count === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <div className={cx("min-w-0", selected ? "block" : "hidden lg:block")}>
          {selected ? (
            <>
              <button onClick={() => select(null)} className="mb-3 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-900 lg:hidden">
                <ArrowLeft className="size-3.5" /> All conversations
              </button>
              <ThreadView key={selected} contactId={selected} onChanged={reload} />
            </>
          ) : (
            <Card className="flex h-full min-h-[420px] items-center justify-center lg:h-[max(560px,calc(100vh-210px))]">
              <Empty icon={<InboxIcon className="size-5" />} title="Select a conversation" body="Pick a thread to read it, log a reply, or draft a response with AI." />
            </Card>
          )}
        </div>
      </div>

      <ComposeModal
        open={composeOpen || !!composeFor}
        contactId={composeFor}
        onClose={() => {
          setComposeOpen(false);
          if (composeFor) setParam("compose", null);
        }}
        onSent={(id) => {
          setComposeOpen(false);
          setParam("contact", id, { compose: null });
          reload();
        }}
      />
    </div>
  );
}

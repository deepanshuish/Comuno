"use client";
import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Check, CheckSquare, Copy, FlaskConical, Mail, MessageSquare, Phone, Play, Search, UserPlus, type LucideIcon,
} from "lucide-react";
import { api, fullName, post, useAction } from "@/lib/client";
import type { StepType } from "@/lib/types";
import { Avatar, Badge, Button, cx, ErrorNote, Input, Modal, Select, Spinner } from "@/components/app/ui";
import { SENTIMENTS, type MailerMode, type PickerContact } from "./types";

export const STEP_ICON: Record<StepType, LucideIcon> = {
  email: Mail,
  linkedin_connect: UserPlus,
  linkedin_message: MessageSquare,
  call: Phone,
  task: CheckSquare,
};

const STEP_TONE: Record<StepType, string> = {
  email: "bg-sky-50 text-sky-700 ring-sky-100",
  linkedin_connect: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  linkedin_message: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  call: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  task: "bg-amber-50 text-amber-700 ring-amber-100",
};

export function StepIcon({ type, className }: { type: StepType; className?: string }) {
  const Icon = STEP_ICON[type] || CheckSquare;
  return (
    <span className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-lg ring-1", STEP_TONE[type], className)}>
      <Icon className="size-3.5" />
    </span>
  );
}

export function SentimentBadge({ value }: { value: string | null | undefined }) {
  const s = SENTIMENTS.find((x) => x.id === value);
  if (!s) return null;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const STATUS_TONE: Record<string, "zinc" | "green" | "amber" | "red" | "blue" | "violet"> = {
  active: "green",
  draft: "zinc",
  paused: "amber",
  completed: "blue",
  replied: "violet",
  bounced: "red",
  open: "zinc",
  done: "green",
  skipped: "zinc",
  new: "zinc",
  contacted: "blue",
  interested: "green",
  not_interested: "red",
  customer: "violet",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] || "zinc"}>{status.replace(/_/g, " ")}</Badge>;
}

/** Explains sandbox mode when no SMTP server is configured. */
export function SandboxBanner({ mailer }: { mailer?: MailerMode | null }) {
  if (!mailer || mailer.mode !== "sandbox") return null;
  return (
    <div className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[13px] text-amber-900">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <span className="font-medium">Sandbox mode — emails are not delivered.</span>{" "}
        No SMTP server is configured, so sends are recorded in Comuno (marked “sandbox”) but never leave the server. Add SMTP
        credentials in{" "}
        <Link href="/settings" className="font-medium underline underline-offset-2">
          Settings
        </Link>{" "}
        (or set SMTP_HOST / SMTP_USER / SMTP_PASS) to send for real.
      </div>
    </div>
  );
}

export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      variant="secondary"
      icon={done ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}

/** "Run now" — executes due sequence steps for this workspace. */
export function RunNowButton({ onDone, size = "md" }: { onDone?: () => void; size?: "sm" | "md" }) {
  const [note, setNote] = useState<string | null>(null);
  const action = useAction(useCallback(() => post<{ processed: number; sent: number; tasks: number; errors: number }>("/api/cron/process"), []));
  return (
    <span className="inline-flex items-center gap-2">
      {note && <span className="hidden text-xs text-zinc-500 sm:inline">{note}</span>}
      {action.error && <span className="text-xs text-red-600">{action.error}</span>}
      <Button
        size={size}
        icon={<Play className="size-3.5" />}
        loading={action.loading}
        title="Execute every sequence step that is due now"
        onClick={async () => {
          const r = await action.run();
          if (r) {
            setNote(
              r.processed
                ? `Processed ${r.processed}: ${r.sent} sent, ${r.tasks} task${r.tasks === 1 ? "" : "s"}${r.errors ? `, ${r.errors} paused` : ""}`
                : "Nothing due right now",
            );
            setTimeout(() => setNote(null), 6000);
            onDone?.();
          }
        }}
      >
        Run now
      </Button>
    </span>
  );
}

/** Tiny markdown renderer for AI call scripts (## headings, **bold**, bullets). */
export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const bold = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i} className="font-semibold text-zinc-900">
          {part.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  lines.forEach((raw, i) => {
    const l = raw.trimEnd();
    if (!l.trim()) return;
    const h = l.match(/^#{1,4}\s+(.*)/);
    if (h) {
      out.push(
        <div key={i} className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 first:mt-0">
          {h[1].replace(/\*\*/g, "")}
        </div>,
      );
      return;
    }
    const b = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (b) {
      out.push(
        <div key={i} className="flex gap-2 pl-1">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-zinc-400" />
          <span>{bold(b[1])}</span>
        </div>,
      );
      return;
    }
    out.push(<p key={i}>{bold(l)}</p>);
  });
  return <div className={cx("space-y-1 text-[13px] leading-relaxed text-zinc-700", className)}>{out}</div>;
}

/* ---------------- Contact picker ---------------- */

type PickerResult = { contacts: PickerContact[]; lists: { id: string; name: string; count: number }[] };

export function useContactSearch(opts: { q: string; listId?: string; sequenceId?: string; withPhone?: boolean; enabled?: boolean }) {
  const [data, setData] = useState<PickerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { q, listId, sequenceId, withPhone, enabled = true } = opts;
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const p = new URLSearchParams();
        if (q) p.set("q", q);
        if (listId) p.set("list", listId);
        if (sequenceId) p.set("sequence", sequenceId);
        if (withPhone) p.set("phone", "1");
        p.set("limit", "300");
        const d = await api<PickerResult>(`/api/sequences/contacts?${p}`);
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, listId, sequenceId, withPhone, enabled]);
  return { data, loading, error };
}

/** Multi-select contact picker with search and list filter. */
export function ContactPickerModal({
  open,
  onClose,
  title,
  sequenceId,
  confirmLabel = "Add",
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  sequenceId?: string;
  confirmLabel?: string;
  onConfirm: (sel: { contactIds: string[]; listId?: string }) => Promise<string | void>;
}) {
  const [q, setQ] = useState("");
  const [listId, setListId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data, loading, error } = useContactSearch({ q, listId, sequenceId, enabled: open });

  const selectable = useMemo(() => (data?.contacts || []).filter((c) => !c.enrolled), [data]);
  const allSelected = selectable.length > 0 && selectable.every((c) => selected.has(c.id));

  const close = () => {
    setSelected(new Set());
    setErr(null);
    onClose();
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async (wholeList: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(wholeList ? { contactIds: [], listId } : { contactIds: [...selected] });
      setSelected(new Set());
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const currentList = data?.lists.find((l) => l.id === listId);

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      wide
      footer={
        <>
          {listId && currentList && (
            <Button variant="secondary" onClick={() => submit(true)} loading={busy} className="mr-auto">
              {confirmLabel} entire list ({currentList.count})
            </Button>
          )}
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!selected.size} loading={busy} onClick={() => submit(false)}>
            {confirmLabel} {selected.size || ""} {selected.size === 1 ? "contact" : "contacts"}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
          <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, company, title…" className="pl-8" />
        </div>
        <Select value={listId} onChange={(e) => setListId(e.target.value)} className="sm:w-56!">
          <option value="">All contacts</option>
          {data?.lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.count})
            </option>
          ))}
        </Select>
      </div>
      <ErrorNote error={err || error} />
      <div className="mt-2 overflow-hidden rounded-lg border border-zinc-200">
        <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/60 px-3 py-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            className="size-3.5 accent-zinc-900"
            checked={allSelected}
            disabled={!selectable.length}
            onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((c) => c.id)))}
            aria-label="Select all"
          />
          <span>{loading ? "Searching…" : `${data?.contacts.length ?? 0} contacts${selected.size ? ` · ${selected.size} selected` : ""}`}</span>
          {loading && <Spinner className="ml-auto size-3.5" />}
        </div>
        <div className="max-h-[46vh] overflow-y-auto">
          {data && !data.contacts.length && (
            <div className="px-4 py-10 text-center text-sm text-zinc-500">
              No contacts found.{" "}
              <Link href="/contacts" className="font-medium text-zinc-900 underline underline-offset-2">
                Add people
              </Link>{" "}
              first.
            </div>
          )}
          {data?.contacts.map((c) => (
            <label
              key={c.id}
              className={cx(
                "flex cursor-pointer items-center gap-3 border-b border-zinc-100 px-3 py-2 last:border-0 hover:bg-zinc-50",
                c.enrolled ? "cursor-default opacity-60" : "",
              )}
            >
              <input
                type="checkbox"
                className="size-3.5 accent-zinc-900"
                checked={selected.has(c.id)}
                disabled={!!c.enrolled}
                onChange={() => toggle(c.id)}
              />
              <Avatar name={fullName(c)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-zinc-900">{fullName(c)}</div>
                <div className="truncate text-xs text-zinc-500">
                  {[c.title, c.company_name].filter(Boolean).join(" · ") || "—"}
                  {c.email ? ` · ${c.email}` : " · no email"}
                </div>
              </div>
              {c.enrolled ? <Badge>Enrolled</Badge> : ["bounced", "not_interested", "customer"].includes(c.status) ? <StatusBadge status={c.status} /> : null}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

/** Single-contact search box with dropdown results. */
export function ContactSearchSelect({
  value,
  onChange,
  withPhone,
  placeholder = "Search contacts…",
}: {
  value: PickerContact | null;
  onChange: (c: PickerContact | null) => void;
  withPhone?: boolean;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const { data, loading } = useContactSearch({ q, withPhone, enabled: open });
  if (value) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2">
        <Avatar name={fullName(value)} className="size-6 text-[10px]" />
        <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-900">
          {fullName(value)}
          {value.email && <span className="text-zinc-500"> · {value.email}</span>}
        </span>
        <button className="rounded px-1.5 text-xs text-zinc-500 hover:bg-zinc-100" onClick={() => onChange(null)}>
          Change
        </button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-zinc-400" />
      <Input
        value={q}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
      {open && (
        <div className="absolute inset-x-0 top-10 z-10 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
          {loading && !data && <div className="px-3 py-3 text-xs text-zinc-500">Searching…</div>}
          {data && !data.contacts.length && <div className="px-3 py-3 text-xs text-zinc-500">No matches</div>}
          {data?.contacts.slice(0, 30).map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(c);
                setOpen(false);
                setQ("");
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-50"
            >
              <Avatar name={fullName(c)} className="size-6 text-[10px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-zinc-900">{fullName(c)}</span>
                <span className="block truncate text-xs text-zinc-500">{[c.title, c.company_name, c.email].filter(Boolean).join(" · ")}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

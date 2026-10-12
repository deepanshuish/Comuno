"use client";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { ContactStatus, EmailStatus } from "@/lib/types";
import { Badge, Button, cx, type Tone } from "@/components/app/ui";

/* Shared bits for the Prospect module pages. */

export const CONTACT_STATUSES: { id: ContactStatus; label: string; tone: Tone }[] = [
  { id: "new", label: "New", tone: "zinc" },
  { id: "contacted", label: "Contacted", tone: "blue" },
  { id: "replied", label: "Replied", tone: "violet" },
  { id: "interested", label: "Interested", tone: "green" },
  { id: "not_interested", label: "Not interested", tone: "amber" },
  { id: "customer", label: "Customer", tone: "green" },
  { id: "bounced", label: "Bounced", tone: "red" },
];

export function StatusBadge({ status }: { status: ContactStatus }) {
  const s = CONTACT_STATUSES.find((x) => x.id === status) || CONTACT_STATUSES[0];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const EMAIL_TONES: Record<EmailStatus, Tone> = { valid: "green", risky: "amber", invalid: "red", unknown: "zinc" };

export function EmailStatusBadge({ status }: { status: EmailStatus }) {
  return <Badge tone={EMAIL_TONES[status] || "zinc"}>{status}</Badge>;
}

/** Email cell: address with a small verification dot. */
export function EmailCell({ email, status }: { email: string | null; status: EmailStatus }) {
  if (!email) return <span className="text-xs text-zinc-400">—</span>;
  const dot = { valid: "bg-brand-500", risky: "bg-zinc-400", invalid: "bg-red-500", unknown: "bg-zinc-300" }[status] || "bg-zinc-300";
  return (
    <span className="inline-flex max-w-[220px] items-center gap-1.5" title={`Email ${status}`}>
      <span className={cx("size-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate">{email}</span>
    </span>
  );
}

export function LinkedInLink({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] bg-zinc-700 text-[9px] font-bold leading-none text-white hover:bg-zinc-800"
      title="LinkedIn profile"
      aria-label="LinkedIn profile"
      onClick={(e) => e.stopPropagation()}
    >
      in
    </a>
  );
}

export function ExtLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
      {children ?? hostOf(href)} <ExternalLink className="size-3" />
    </a>
  );
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function Checkbox({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="size-3.5 cursor-pointer rounded border-zinc-300 accent-zinc-900"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked;
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function Pagination({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return total ? <div className="px-4 py-2.5 text-xs text-zinc-500">{total.toLocaleString()} total</div> : null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs text-zinc-500">
      <span className="tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))} icon={<ChevronLeft className="size-3.5" />}>
          Prev
        </Button>
        <Button size="sm" variant="ghost" disabled={to >= total} onClick={() => onChange(offset + limit)}>
          Next <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Floating action bar shown when rows are selected. */
export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-brand-100 bg-brand-50/60 px-4 py-2">
      <span className="text-[13px] font-medium text-zinc-900">{count} selected</span>
      <button className="text-xs text-zinc-500 hover:text-zinc-800" onClick={onClear}>
        Clear
      </button>
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Small toast-ish success note that fades after a few seconds. */
export function Notice({ text, onDone }: { text: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(onDone, 4500);
    return () => clearTimeout(t);
  }, [text, onDone]);
  if (!text) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-zinc-900 px-3.5 py-2 text-[13px] text-white shadow-lg" role="status">
      {text}
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Tags/chips input for ICP filters. */
export function ChipsInput({ value, onChange, placeholder, suggestions }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [text, setText] = useState("");
  const add = (s: string) => {
    const t = s.trim().replace(/,$/, "");
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText("");
  };
  return (
    <div>
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-white px-1.5 py-1 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[12px] text-zinc-700">
            {v}
            <button type="button" className="text-zinc-400 hover:text-zinc-700" aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((x) => x !== v))}>
              ×
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? "" : placeholder}
          className="h-6 min-w-[80px] flex-1 bg-transparent px-1 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
      </div>
      {suggestions && suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <button key={s} type="button" onClick={() => onChange([...value, s])} className="rounded-md border border-dashed border-zinc-300 px-1.5 py-0.5 text-[11px] text-zinc-500 hover:border-zinc-400 hover:text-zinc-800">
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

/* ── Minimal, safe markdown renderer (headings, lists, bold/italic, links, paragraphs) ── */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold text-zinc-900">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k} className="rounded bg-zinc-100 px-1 text-[12px]">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("[")) {
      const lm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (lm) out.push(<a key={k} href={lm[2]} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">{lm[1]}</a>);
    } else out.push(<em key={k}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) blocks.push(<p key={`p${blocks.length}`}>{inline(para.join(" "), `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    const k = `l${blocks.length}`;
    blocks.push(
      <Tag key={k} className={cx("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `${k}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    const li = line.match(/^\s*[-*•]\s+(.*)$/);
    const oli = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (h) {
      flushPara();
      flushList();
      const k = `h${blocks.length}`;
      blocks.push(
        <h4 key={k} className={cx("font-semibold text-zinc-900", h[1].length <= 2 ? "mt-4 text-[14px]" : "mt-3 text-[13px]")}>
          {inline(h[2], k)}
        </h4>,
      );
    } else if (li || oli) {
      flushPara();
      const ordered = !!oli && !li;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((li || oli)![1]);
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return <div className={cx("space-y-2 text-[13px] leading-relaxed text-zinc-700 [&>*:first-child]:mt-0", className)}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}

/** Trigger a browser download of text content. */
export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Small label/value row used in drawers. */
export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-[13px]">
      <div className="w-28 shrink-0 text-zinc-500">{label}</div>
      <div className="min-w-0 flex-1 break-words text-zinc-800">{children ?? <span className="text-zinc-400">—</span>}</div>
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Search, User, X } from "lucide-react";
import { api } from "@/lib/client";
import { Spinner, cx } from "@/components/app/ui";

export type PickerOption = { id: string; label: string; sub?: string | null; company_id?: string | null; company_name?: string | null };

/** Searchable combobox over the workspace's companies or contacts. */
export function EntityPicker({
  kind,
  value,
  onChange,
  companyId,
  placeholder,
}: {
  kind: "company" | "contact";
  value: PickerOption | null;
  onChange: (v: PickerOption | null) => void;
  /** For contacts: rank people at this company first. */
  companyId?: string | null;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const Icon = kind === "company" ? Building2 : User;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ type: kind, q });
        if (companyId) params.set("company_id", companyId);
        const r = await api<{ results: PickerOption[] }>(`/api/deals/lookup?${params}`);
        if (!cancelled) {
          setResults(r.results);
          setActive(0);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, q, kind, companyId]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const pick = (o: PickerOption) => {
    onChange(o);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={root} className="relative">
      <div
        className={cx(
          "flex h-9 w-full items-center gap-2 rounded-lg border bg-white pl-3 pr-1.5 text-[13px]",
          open ? "border-violet-400 ring-2 ring-violet-100" : "border-zinc-200",
        )}
      >
        <Icon className="size-3.5 shrink-0 text-zinc-400" />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cx("min-w-0 flex-1 truncate text-left", value ? "text-zinc-900" : "text-zinc-400")}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {value ? value.label : placeholder || (kind === "company" ? "Search companies…" : "Search people…")}
        </button>
        {value ? (
          <button type="button" onClick={() => onChange(null)} className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Clear">
            <X className="size-3.5" />
          </button>
        ) : (
          <ChevronDown className="mr-1 size-3.5 text-zinc-400" />
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-[60] mt-1 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3">
            <Search className="size-3.5 text-zinc-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                if (e.key === "Enter" && results[active]) { e.preventDefault(); pick(results[active]); }
                if (e.key === "Escape") { e.stopPropagation(); setOpen(false); }
              }}
              placeholder={kind === "company" ? "Company name or domain" : "Name or email"}
              className="h-9 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400"
            />
            {loading && <Spinner className="size-3.5" />}
          </div>
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
            {error && <li className="px-3 py-2 text-xs text-red-600">{error}</li>}
            {!error && !loading && results.length === 0 && (
              <li className="px-3 py-3 text-center text-xs text-zinc-500">
                {q ? "No matches." : kind === "company" ? "No companies yet — add some in Prospect." : "No people yet — add some in Prospect."}
              </li>
            )}
            {results.map((r, i) => (
              <li key={r.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(r)}
                  className={cx("flex w-full flex-col px-3 py-1.5 text-left", i === active && "bg-zinc-50")}
                >
                  <span className="truncate text-[13px] text-zinc-900">{r.label}</span>
                  {r.sub && <span className="truncate text-[11px] text-zinc-500">{r.sub}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

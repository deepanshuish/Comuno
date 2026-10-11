"use client";
import { useState, type ReactNode } from "react";
import { cx } from "@/components/app/ui";

/* Lightweight, dependency-free charts. Marks carry color; all text stays in neutral ink. */

export const SERIES = { a: "#8b5cf6", b: "#f59e0b" };

function niceMax(v: number) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Grouped daily columns for two series (e.g. emails sent vs replies) with a hover tooltip. */
export function DailyBars({
  data,
  series,
  height = 168,
}: {
  data: { day: string; [k: string]: number | string }[];
  series: { key: string; label: string; color: string }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0))));
  const ticks = [max, max / 2, 0];
  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const labelEvery = data.length > 14 ? 7 : data.length > 7 ? 2 : 1;
  const h = hover != null ? data[hover] : null;

  return (
    <div>
      <div className="relative flex" style={{ height }}>
        {/* y axis */}
        <div className="flex w-8 shrink-0 flex-col justify-between pr-2 text-right text-[10px] tabular-nums text-zinc-400">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 first:translate-y-0 last:translate-y-0">
              {Number.isInteger(t) ? t.toLocaleString() : t.toFixed(1)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          {ticks.map((t, i) => (
            <div key={t} className="absolute inset-x-0 border-t border-zinc-100" style={{ top: `${(i / (ticks.length - 1)) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {data.map((d, i) => (
              <div
                key={d.day}
                className={cx("relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm", hover === i && "bg-zinc-100/70")}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${fmtDay(d.day)}: ${series.map((s) => `${s.label} ${d[s.key]}`).join(", ")}`}
              >
                {series.map((s) => {
                  const v = Number(d[s.key]) || 0;
                  return (
                    <div
                      key={s.key}
                      className="w-full max-w-[10px] rounded-t-[3px]"
                      style={{ height: v ? `max(2px, ${(v / max) * 100}%)` : 0, background: s.color }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {h && hover != null && (
            <div
              className="pointer-events-none absolute top-0 z-10 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
              style={{
                left: `${((hover + 0.5) / data.length) * 100}%`,
                transform: `translate(${hover > data.length / 2 ? "-100%" : "0"}, -8px)`,
              }}
            >
              <div className="font-medium text-zinc-900">{fmtDay(h.day)}</div>
              {series.map((s) => (
                <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap text-zinc-600">
                  <span className="size-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}: <span className="font-medium tabular-nums text-zinc-900">{h[s.key]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* x axis */}
      <div className="ml-8 mt-1.5 flex gap-[2px] text-[10px] text-zinc-400">
        {data.map((d, i) => (
          <div key={d.day} className="relative flex-1">
            {(i % labelEvery === 0 || i === data.length - 1) && (data.length - 1 - i >= labelEvery / 2 || i === data.length - 1) && (
              <span className={cx("absolute whitespace-nowrap", i === data.length - 1 ? "right-0" : "left-0")}>{fmtDay(d.day)}</span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6">
        <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      </div>
    </div>
  );
}

/** Horizontal bars with labels and values at the tip. */
export function HBarList({
  items,
  emptyLabel = "No data yet",
}: {
  items: { key: string; label: ReactNode; value: number; display?: ReactNode; color?: string; sub?: ReactNode }[];
  emptyLabel?: string;
}) {
  const max = Math.max(0, ...items.map((i) => i.value));
  if (!items.length || max === 0) return <p className="py-6 text-center text-xs text-zinc-400">{emptyLabel}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((i) => (
        <li key={i.key} className="group" title={typeof i.display === "string" ? i.display : String(i.value)}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate text-zinc-700">{i.label}</span>
            <span className="shrink-0 tabular-nums text-zinc-900">
              {i.display ?? i.value.toLocaleString()}
              {i.sub && <span className="ml-1.5 text-xs text-zinc-400">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <div
              className="h-2 rounded-full transition-[width] group-hover:opacity-80"
              style={{ width: `${i.value ? Math.max(2, (i.value / max) * 100) : 0}%`, background: i.color ?? SERIES.a }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Conversion funnel: bar width relative to the first step, with step-to-step conversion. */
export function Funnel({ steps }: { steps: { id: string; label: string; value: number }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 0);
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev ? Math.round((s.value / prev) * 100) : null;
        const pct = Math.min(100, (s.value / top) * 100);
        return (
          <li key={s.id} className="grid grid-cols-[84px_1fr] items-center gap-3 sm:grid-cols-[110px_1fr]">
            <div className="text-[13px] text-zinc-600">{s.label}</div>
            <div className="flex min-w-0 items-center gap-2">
              <div className="h-7 min-w-0 flex-1 rounded-md bg-zinc-50">
                <div
                  className="flex h-7 items-center rounded-md"
                  style={{ width: `${s.value ? Math.max(1.5, pct) : 0}%`, background: SERIES.a, opacity: 1 - i * 0.1 }}
                />
              </div>
              <div className="w-[88px] shrink-0 text-right">
                <span className="text-[13px] font-semibold tabular-nums text-zinc-900">{s.value.toLocaleString()}</span>
                {conv != null && <span className="ml-1.5 text-[11px] tabular-nums text-zinc-400">{prev ? `${conv}%` : "—"}</span>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

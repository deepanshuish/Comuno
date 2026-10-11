"use client";
import { useState } from "react";
import { Building2, CalendarDays, Plus, User } from "lucide-react";
import { money } from "@/lib/client";
import { DEAL_STAGES, type DealStage } from "@/lib/types";
import { Badge, Table, Td, Th, cx } from "@/components/app/ui";
import { StageDot, compactMoney, isOverdue, shortDate, stageLabel, type DealRow } from "./shared";

/** Kanban pipeline with native HTML5 drag-and-drop, plus a stage select fallback on touch devices. */
export function DealBoard({
  deals,
  onMove,
  onOpen,
  onCreate,
}: {
  deals: DealRow[];
  onMove: (id: string, stage: DealStage) => void;
  onOpen: (id: string) => void;
  onCreate: (stage: DealStage) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<DealStage | null>(null);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-8 sm:px-8">
      <div className="flex min-w-max gap-3">
        {DEAL_STAGES.map((s) => {
          const items = deals.filter((d) => d.stage === s.id);
          const total = items.reduce((a, d) => a + d.value, 0);
          const isOver = over === s.id && dragId && deals.find((d) => d.id === dragId)?.stage !== s.id;
          return (
            <section
              key={s.id}
              aria-label={`${s.label} column`}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (over !== s.id) setOver(s.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((o) => (o === s.id ? null : o));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setOver(null);
                setDragId(null);
                if (id && deals.find((d) => d.id === id)?.stage !== s.id) onMove(id, s.id);
              }}
              className={cx(
                "flex w-[264px] shrink-0 flex-col rounded-xl border bg-zinc-50/70 transition-colors",
                isOver ? "border-violet-300 bg-violet-50/60" : "border-zinc-200/80",
              )}
            >
              <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                <StageDot stage={s.id} />
                <h3 className="truncate text-[13px] font-semibold text-zinc-800">{s.label}</h3>
                <span className="rounded bg-zinc-200/70 px-1.5 text-[11px] font-medium tabular-nums text-zinc-600">{items.length}</span>
                <span className="ml-auto text-xs tabular-nums text-zinc-500" title={money(total)}>
                  {compactMoney(total)}
                </span>
              </header>
              <div className="flex min-h-[120px] flex-1 flex-col gap-2 px-2 pb-2">
                {items.map((d) => (
                  <DealCard
                    key={d.id}
                    deal={d}
                    dragging={dragId === d.id}
                    onOpen={() => onOpen(d.id)}
                    onMove={(st) => onMove(d.id, st)}
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                  />
                ))}
                <button
                  onClick={() => onCreate(s.id)}
                  className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-200 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white hover:text-zinc-700"
                >
                  <Plus className="size-3.5" /> Add deal
                </button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({
  deal,
  dragging,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  deal: DealRow;
  dragging: boolean;
  onOpen: () => void;
  onMove: (s: DealStage) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const overdue = isOverdue(deal);
  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", deal.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
      tabIndex={0}
      role="button"
      aria-label={`Open deal ${deal.name}`}
      className={cx(
        "group cursor-grab rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)] transition hover:border-zinc-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-violet-500 active:cursor-grabbing",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="line-clamp-2 text-[13px] font-medium leading-snug text-zinc-900">{deal.name}</h4>
        {deal.ai_insight && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-violet-500" title="Has AI insight" />}
      </div>
      <div className="mt-1 text-[15px] font-semibold tabular-nums tracking-tight text-zinc-900">{money(deal.value)}</div>
      <div className="mt-2 space-y-1 text-xs text-zinc-500">
        {deal.company_name && (
          <div className="flex items-center gap-1.5 truncate">
            <Building2 className="size-3 shrink-0 text-zinc-400" />
            <span className="truncate">{deal.company_name}</span>
          </div>
        )}
        {deal.contact_name && (
          <div className="flex items-center gap-1.5 truncate">
            <User className="size-3 shrink-0 text-zinc-400" />
            <span className="truncate">{deal.contact_name}</span>
          </div>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2 text-[11px] text-zinc-500">
        {deal.close_date && (
          <span className={cx("inline-flex items-center gap-1", overdue && "font-medium text-red-600")} title={overdue ? "Close date has passed" : "Expected close"}>
            <CalendarDays className="size-3" />
            {shortDate(deal.close_date)}
          </span>
        )}
        {deal.probability != null && deal.stage !== "won" && deal.stage !== "lost" && (
          <span className="ml-auto tabular-nums">{deal.probability}%</span>
        )}
      </div>
      {/* Touch fallback: drag-and-drop doesn't work on touch screens. */}
      <label className="mt-2 hidden pointer-coarse:block" onClick={(e) => e.stopPropagation()}>
        <span className="sr-only">Move to stage</span>
        <select
          value={deal.stage}
          onChange={(e) => onMove(e.target.value as DealStage)}
          className="h-8 w-full rounded-md border border-zinc-200 bg-zinc-50 px-2 text-xs text-zinc-700"
        >
          {DEAL_STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              Move to: {s.label}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

export function DealTable({ deals, onOpen, onMove }: { deals: DealRow[]; onOpen: (id: string) => void; onMove: (id: string, s: DealStage) => void }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Deal</Th>
          <Th>Stage</Th>
          <Th className="text-right">Value</Th>
          <Th className="text-right">Prob.</Th>
          <Th>Company</Th>
          <Th>Contact</Th>
          <Th>Close</Th>
        </tr>
      </thead>
      <tbody>
        {deals.map((d) => (
          <tr key={d.id} className="cursor-pointer hover:bg-zinc-50/80" onClick={() => onOpen(d.id)}>
            <Td className="max-w-[260px]">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-zinc-900">{d.name}</span>
                {d.ai_insight && <Badge tone="violet">AI</Badge>}
              </div>
            </Td>
            <Td>
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <StageDot stage={d.stage} />
                <select
                  aria-label={`Stage for ${d.name}`}
                  value={d.stage}
                  onChange={(e) => onMove(d.id, e.target.value as DealStage)}
                  className="cursor-pointer rounded bg-transparent py-0.5 text-[13px] text-zinc-700 hover:bg-zinc-100"
                >
                  {DEAL_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {stageLabel(s.id)}
                    </option>
                  ))}
                </select>
              </div>
            </Td>
            <Td className="text-right font-medium tabular-nums text-zinc-900">{money(d.value)}</Td>
            <Td className="text-right tabular-nums">{d.probability != null ? `${d.probability}%` : "—"}</Td>
            <Td className="max-w-[180px] truncate">{d.company_name || <span className="text-zinc-400">—</span>}</Td>
            <Td className="max-w-[180px] truncate">{d.contact_name || <span className="text-zinc-400">—</span>}</Td>
            <Td className={cx("whitespace-nowrap", isOverdue(d) && "font-medium text-red-600")}>{d.close_date ? shortDate(d.close_date) : <span className="text-zinc-400">—</span>}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

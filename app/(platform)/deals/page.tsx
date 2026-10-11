"use client";
import { Suspense, useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KanbanSquare, LayoutGrid, Plus, Rows3, Search } from "lucide-react";
import { money, patch, useApi } from "@/lib/client";
import { DEAL_STAGES, type DealStage } from "@/lib/types";
import { Button, Card, Empty, ErrorNote, Input, Loading, PageHeader, Stat, cx } from "@/components/app/ui";
import { DealBoard, DealTable } from "@/components/crm/DealBoard";
import { DealDrawer } from "@/components/crm/DealDrawer";
import { DealFormModal } from "@/components/crm/DealForm";
import type { DealRow, PipelineSummary } from "@/components/crm/shared";

type Resp = { deals: DealRow[]; summary: PipelineSummary };

export default function DealsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Deals />
    </Suspense>
  );
}

function Deals() {
  const { data, error, loading, reload, setData } = useApi<Resp>("/api/deals");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openId = params.get("id");
  const [view, setView] = useState<"board" | "table">("board");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState<{ stage: DealStage } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const setOpen = useCallback(
    (id: string | null) => router.replace(id ? `${pathname}?id=${id}` : pathname, { scroll: false }),
    [router, pathname],
  );

  const deals = useMemo(() => {
    const all = data?.deals ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((d) => [d.name, d.company_name, d.contact_name].some((x) => x?.toLowerCase().includes(s)));
  }, [data, q]);

  /** Optimistic stage move; reverts and surfaces the error on failure. */
  const move = async (id: string, stage: DealStage) => {
    if (!data) return;
    const prev = data;
    const prob = DEAL_STAGES.find((s) => s.id === stage)?.probability ?? null;
    setData({ ...data, deals: data.deals.map((d) => (d.id === id ? { ...d, stage, probability: prob } : d)) });
    setMoveError(null);
    try {
      await patch(`/api/deals/${id}`, { stage });
      reload();
    } catch (e) {
      setData(prev);
      setMoveError((e as Error).message);
    }
  };

  const s = data?.summary;

  return (
    <div>
      <PageHeader
        title="Deals"
        subtitle="Your pipeline — drag deals between stages, open one for its timeline and AI coaching."
        actions={
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating({ stage: "lead" })}>
            New deal
          </Button>
        }
      />

      {s && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Open pipeline" value={money(s.total)} sub={`${s.openCount} open deal${s.openCount === 1 ? "" : "s"}`} />
          <Stat label="Weighted pipeline" value={money(s.weighted)} sub="Value × stage probability" />
          <Stat label="Won" value={money(s.wonValue)} sub={s.avgDealSize ? `Avg ${money(s.avgDealSize)}` : "No wins yet"} />
          <Stat label="Win rate" value={`${s.winRate}%`} sub={`${s.stages.find((x) => x.stage === "won")?.count ?? 0} won · ${s.stages.find((x) => x.stage === "lost")?.count ?? 0} lost`} />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter deals, companies, contacts" className="pl-8" />
        </div>
        <div className="ml-auto flex rounded-lg border border-zinc-200 bg-white p-0.5" role="tablist" aria-label="View">
          {[
            { id: "board" as const, label: "Board", icon: LayoutGrid },
            { id: "table" as const, label: "Table", icon: Rows3 },
          ].map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cx(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
                view === v.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
              )}
            >
              <v.icon className="size-3.5" /> {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3 space-y-2">
        <ErrorNote error={moveError} />
        {error && data && <ErrorNote error={error} />}
      </div>

      {loading && !data ? (
        <Loading label="Loading pipeline…" />
      ) : error && !data ? (
        <ErrorNote error={error} />
      ) : !data?.deals.length ? (
        <Card>
          <Empty
            icon={<KanbanSquare className="size-5" />}
            title="No deals yet"
            body="Create a deal when a prospect shows real interest — then track it through to close."
            action={
              <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreating({ stage: "lead" })}>
                Create your first deal
              </Button>
            }
          />
        </Card>
      ) : view === "board" ? (
        <DealBoard deals={deals} onMove={move} onOpen={setOpen} onCreate={(stage) => setCreating({ stage })} />
      ) : (
        <Card className="overflow-hidden">
          {deals.length ? <DealTable deals={deals} onOpen={setOpen} onMove={move} /> : <Empty title="No deals match your filter" />}
        </Card>
      )}

      {creating && (
        <DealFormModal
          open
          preset={{ stage: creating.stage }}
          onClose={() => setCreating(null)}
          onSaved={(id) => {
            setCreating(null);
            reload();
            setOpen(id);
          }}
        />
      )}
      <DealDrawer dealId={openId} onClose={() => setOpen(null)} onChanged={reload} />
    </div>
  );
}

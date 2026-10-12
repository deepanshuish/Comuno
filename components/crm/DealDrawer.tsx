"use client";
import { useState } from "react";
import { AlertTriangle, Building2, CalendarDays, Check, Copy, Lightbulb, Pencil, Send, Target, Trash2, User } from "lucide-react";
import { del, money, patch, post, timeAgo, useApi } from "@/lib/client";
import { DEAL_STAGES, type DealStage } from "@/lib/types";
import { Badge, Button, Card, Drawer, Empty, ErrorNote, Loading, Select, Textarea, cx } from "@/components/app/ui";
import { DealFormModal } from "./DealForm";
import { ActivityList, ButtonLink, StageDot, isOverdue, shortDate, type ActivityRow, type DealRow } from "./shared";

type Insight = {
  summary: string;
  next_best_action: string;
  risks: string[];
  meddicc_gaps: { element: string; gap: string }[];
  follow_up_email: { subject: string; body: string };
  generated_at?: string;
};

type DealDetail = { deal: DealRow; insight: Insight | null; timeline: ActivityRow[] };

export function DealDrawer({ dealId, onClose, onChanged }: { dealId: string | null; onClose: () => void; onChanged: () => void }) {
  return (
    <Drawer open={!!dealId} onClose={onClose} title="Deal">
      {dealId && <DealDrawerBody key={dealId} dealId={dealId} onClose={onClose} onChanged={onChanged} />}
    </Drawer>
  );
}

function DealDrawerBody({ dealId, onClose, onChanged }: { dealId: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload, setData } = useApi<DealDetail>(`/api/deals/${dealId}`);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error && !data) return <div className="p-5"><ErrorNote error={error} /></div>;
  if (!data) return null;
  const { deal, insight, timeline } = data;

  const changeStage = async (stage: DealStage) => {
    setBusy("stage");
    setActionError(null);
    try {
      await patch(`/api/deals/${deal.id}`, { stage });
      await reload();
      onChanged();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete “${deal.name}”? This can't be undone.`)) return;
    setBusy("delete");
    try {
      await del(`/api/deals/${deal.id}`);
      onChanged();
      onClose();
    } catch (e) {
      setActionError((e as Error).message);
      setBusy(null);
    }
  };

  const generate = async () => {
    setBusy("ai");
    setAiError(null);
    try {
      const r = await post<{ insight: Insight }>(`/api/deals/${deal.id}/insight`);
      setData({ ...data, insight: r.insight, deal: { ...deal, ai_insight: JSON.stringify(r.insight) } });
      reload();
      onChanged();
    } catch (e) {
      setAiError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const overdue = isOverdue(deal);

  return (
    <div className="divide-y divide-zinc-100">
      {/* Header */}
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-[22px] leading-tight text-zinc-900">{deal.name}</h2>
            <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{money(deal.value)}</div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} loading={busy === "delete"} onClick={remove} aria-label="Delete deal" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <StageDot stage={deal.stage} />
            <Select
              aria-label="Stage"
              value={deal.stage}
              disabled={busy === "stage"}
              onChange={(e) => changeStage(e.target.value as DealStage)}
              className="h-8 w-auto"
            >
              {DEAL_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          {deal.probability != null && <Badge>{deal.probability}% probability</Badge>}
          <Badge tone="zinc">Weighted {money((deal.value * (deal.probability ?? 0)) / 100)}</Badge>
        </div>
        <ErrorNote error={actionError} />
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-2">
          <Detail icon={<Building2 className="size-3.5" />} label="Company">
            {deal.company_name ? (
              <span className="truncate">
                {deal.company_name}
                {deal.company_domain && <span className="text-zinc-400"> · {deal.company_domain}</span>}
              </span>
            ) : (
              <span className="text-zinc-400">Not set</span>
            )}
          </Detail>
          <Detail icon={<User className="size-3.5" />} label="Primary contact">
            {deal.contact_name || deal.contact_email ? (
              <span className="truncate">
                {deal.contact_name || deal.contact_email}
                {deal.contact_title && <span className="text-zinc-400"> · {deal.contact_title}</span>}
              </span>
            ) : (
              <span className="text-zinc-400">Not set</span>
            )}
          </Detail>
          <Detail icon={<CalendarDays className="size-3.5" />} label="Expected close">
            {deal.close_date ? (
              <span className={cx(overdue && "font-medium text-red-600")}>
                {shortDate(deal.close_date)}
                {overdue && " · overdue"}
              </span>
            ) : (
              <span className="text-zinc-400">Not set</span>
            )}
          </Detail>
          <Detail icon={<Target className="size-3.5" />} label="Created">
            {timeAgo(deal.created_at)}
          </Detail>
        </dl>
        {deal.notes && <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 px-3 py-2 text-[13px] leading-relaxed text-zinc-700">{deal.notes}</p>}
        {deal.contact_id && (
          <div className="flex flex-wrap gap-2">
            <ButtonLink size="sm" href={`/inbox?compose=${deal.contact_id}`} icon={<Send className="size-3.5" />}>
              Email contact
            </ButtonLink>
          </div>
        )}
      </div>

      {/* AI insight */}
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">AI deal insight</h3>
            <p className="text-xs text-zinc-500">
              {insight?.generated_at ? `Updated ${timeAgo(insight.generated_at)}` : "Next best action, risks, MEDDICC gaps and a follow-up email"}
            </p>
          </div>
          <Button size="sm" variant="ai" loading={busy === "ai"} onClick={generate}>
            {insight ? "Refresh" : "Analyze deal"}
          </Button>
        </div>
        <ErrorNote error={aiError} />
        {busy === "ai" && !insight && <p className="text-xs text-zinc-500">Reviewing the deal, contact and timeline…</p>}
        {insight && <InsightView insight={insight} contactId={deal.contact_id} />}
      </div>

      {/* Log activity */}
      <div className="px-5 py-4">
        <LogActivity dealId={deal.id} onLogged={() => (reload(), onChanged())} />
      </div>

      {/* Timeline */}
      <div className="px-5 py-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">Timeline</h3>
        {timeline.length ? (
          <ActivityList items={timeline} />
        ) : (
          <Empty title="No activity yet" body="Notes, calls, stage changes and emails with this contact show up here." />
        )}
      </div>

      {editing && (
        <DealFormModal
          open
          deal={deal}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            reload();
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function Detail({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 text-zinc-400">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-zinc-400">{label}</dt>
        <dd className="flex min-w-0 text-zinc-800">{children}</dd>
      </div>
    </div>
  );
}

function InsightView({ insight, contactId }: { insight: Insight; contactId: string | null }) {
  const [copied, setCopied] = useState(false);
  const email = insight.follow_up_email;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="space-y-3">
      {insight.summary && <p className="text-[13px] leading-relaxed text-zinc-700">{insight.summary}</p>}
      {insight.next_best_action && (
        <Card className="border-brand-200 bg-brand-50/50 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            <Lightbulb className="size-3.5" /> Next best action
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-zinc-900">{insight.next_best_action}</p>
        </Card>
      )}
      {insight.risks.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-700">
            <AlertTriangle className="size-3.5 text-zinc-500" /> Risks
          </div>
          <ul className="space-y-1 text-[13px] text-zinc-700">
            {insight.risks.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-zinc-400" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {insight.meddicc_gaps.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-700">MEDDICC gaps</div>
          <div className="space-y-1.5">
            {insight.meddicc_gaps.map((g, i) => (
              <div key={i} className="flex flex-col gap-0.5 rounded-lg border border-zinc-200 px-3 py-2 sm:flex-row sm:gap-3">
                <span className="w-32 shrink-0 text-xs font-semibold text-zinc-800">{g.element}</span>
                <span className="text-[13px] text-zinc-600">{g.gap}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {email?.body && (
        <div className="rounded-lg border border-zinc-200">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-3 py-2">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-zinc-400">Suggested follow-up</div>
              <div className="truncate text-[13px] font-medium text-zinc-900">{email.subject}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="ghost" icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
              {contactId && (
                <ButtonLink size="sm" href={`/inbox?compose=${contactId}`} icon={<Send className="size-3.5" />}>
                  Send
                </ButtonLink>
              )}
            </div>
          </div>
          <p className="whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-relaxed text-zinc-700">{email.body}</p>
        </div>
      )}
    </div>
  );
}

const LOG_TYPES = [
  { id: "note", label: "Note" },
  { id: "call", label: "Call" },
  { id: "email", label: "Email" },
  { id: "meeting", label: "Meeting" },
];

function LogActivity({ dealId, onLogged }: { dealId: string; onLogged: () => void }) {
  const [type, setType] = useState("note");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const firstLine = body.trim().split("\n")[0];
      const title = type === "note" ? "Note added" : `${LOG_TYPES.find((t) => t.id === type)?.label} logged: ${firstLine.slice(0, 80)}`;
      await post(`/api/deals/${dealId}/activities`, { type, title, body: body.trim() });
      setBody("");
      onLogged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">Log activity</h3>
        <div className="flex rounded-lg bg-zinc-100 p-0.5">
          {LOG_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cx("rounded-md px-2 py-1 text-xs font-medium", type === t.id ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <Textarea
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()}
        placeholder={type === "note" ? "Add a note…" : `What happened on the ${type}?`}
      />
      <ErrorNote error={error} />
      <div className="flex justify-end">
        <Button size="sm" variant="primary" loading={saving} disabled={!body.trim()} onClick={submit}>
          Log {LOG_TYPES.find((t) => t.id === type)?.label.toLowerCase()}
        </Button>
      </div>
    </div>
  );
}

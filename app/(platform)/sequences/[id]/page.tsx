"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pause, Play, Trash2, UserPlus, Users } from "lucide-react";
import { del, patch, post, useApi } from "@/lib/client";
import { Button, Card, Empty, ErrorNote, Loading, PageHeader, Stat, Tabs } from "@/components/app/ui";
import { ContactPickerModal, RunNowButton, SandboxBanner, StatusBadge } from "@/components/engage/shared";
import SequenceBuilder from "@/components/engage/SequenceBuilder";
import EnrollmentsTable from "@/components/engage/EnrollmentsTable";
import type { SequenceDetail } from "@/components/engage/types";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function SequencePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, loading, reload, setData } = useApi<SequenceDetail>(`/api/sequences/${id}`);
  const [tab, setTab] = useState<"steps" | "people">("steps");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading && !data) return <Loading />;
  if (error && !data)
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorNote error={error} />
      </div>
    );
  if (!data) return null;
  const { sequence: seq, stats } = data;

  const setStatus = async (status: "active" | "paused") => {
    setBusy(status);
    setActionError(null);
    try {
      setData(await patch<SequenceDetail>(`/api/sequences/${id}`, { status }));
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete "${seq.name}"? Enrollments will be removed; sent messages stay in the inbox.`)) return;
    setBusy("delete");
    try {
      await del(`/api/sequences/${id}`);
      router.push("/sequences");
    } catch (e) {
      setActionError((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <div>
      <BackLink />
      <PageHeader
        title={seq.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={seq.status} />
            {seq.goal && <span className="line-clamp-1 max-w-xl">{seq.goal}</span>}
          </span>
        }
        actions={
          <>
            <RunNowButton onDone={reload} />
            {seq.status === "active" ? (
              <Button icon={<Pause className="size-3.5" />} loading={busy === "paused"} onClick={() => setStatus("paused")}>
                Pause
              </Button>
            ) : (
              <Button variant="primary" icon={<Play className="size-3.5" />} loading={busy === "active"} onClick={() => setStatus("active")}>
                {seq.status === "paused" ? "Resume" : "Activate"}
              </Button>
            )}
            <Button variant="ghost" icon={<Trash2 className="size-3.5" />} loading={busy === "delete"} onClick={remove} aria-label="Delete sequence" title="Delete sequence" />
          </>
        }
      />
      <SandboxBanner mailer={data.mailer} />
      {seq.status !== "active" && stats.active > 0 && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-[13px] text-zinc-600">
          This sequence is <strong className="font-medium text-zinc-900">{seq.status}</strong> — {stats.active} enrolled contact{stats.active === 1 ? " is" : "s are"} waiting.
          Activate it to start sending.
        </div>
      )}
      <ErrorNote error={actionError} />
      {notice && <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">{notice}</div>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Enrolled" value={stats.enrolled} />
        <Stat label="Active" value={stats.active} />
        <Stat label="Emails sent" value={stats.sent} />
        <Stat label="Open rate" value={pct(stats.opened, stats.sent)} />
        <Stat label="Replied" value={stats.replied} />
        <Stat label="Reply rate" value={pct(stats.replied, stats.contacted)} />
      </div>

      <div className="mb-5 flex items-end justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "steps", label: `Steps (${data.steps.length})` },
            { id: "people", label: `People (${stats.enrolled})` },
          ]}
        />
        <Button variant="primary" size="sm" icon={<UserPlus className="size-3.5" />} onClick={() => setEnrollOpen(true)}>
          Enroll contacts
        </Button>
      </div>

      {tab === "steps" ? (
        <SequenceBuilder key={data.steps.map((s) => s.id).join(",")} detail={data} onSaved={setData} />
      ) : data.enrollments.length ? (
        <EnrollmentsTable detail={data} onChange={reload} />
      ) : (
        <Card>
          <Empty
            icon={<Users className="size-5" />}
            title="Nobody enrolled yet"
            body="Enroll people or a whole list. Each contact moves through the steps on their own schedule."
            action={
              <Button variant="primary" icon={<UserPlus className="size-3.5" />} onClick={() => setEnrollOpen(true)}>
                Enroll contacts
              </Button>
            }
          />
        </Card>
      )}

      <ContactPickerModal
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title={`Enroll in “${seq.name}”`}
        sequenceId={seq.id}
        confirmLabel="Enroll"
        onConfirm={async (sel) => {
          const r = await post<{ enrolled: number; skipped: number }>(`/api/sequences/${id}/enroll`, sel);
          setNotice(`Enrolled ${r.enrolled} contact${r.enrolled === 1 ? "" : "s"}${r.skipped ? ` · skipped ${r.skipped} (already enrolled or opted out)` : ""}.`);
          setTimeout(() => setNotice(null), 6000);
          setTab("people");
          await reload();
        }}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/sequences" className="mb-3 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-900">
      <ArrowLeft className="size-3.5" /> Sequences
    </Link>
  );
}

"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { post, timeAgo, useApi } from "@/lib/client";
import type { StepType } from "@/lib/types";
import {
  Button, Card, CardHeader, Empty, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Stat, Table, Td, Textarea, Th, cx,
} from "@/components/app/ui";
import { RunNowButton, SandboxBanner, StatusBadge, StepIcon } from "@/components/engage/shared";
import { STEP_TYPES, type EngageStats, type MailerMode, type SequenceSummary } from "@/components/engage/types";

type Data = { sequences: SequenceSummary[]; stats: EngageStats; mailer: MailerMode };

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function SequencesPage() {
  const router = useRouter();
  const { data, error, loading, reload } = useApi<Data>("/api/sequences");
  const [createOpen, setCreateOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Sequences"
        subtitle="Multi-channel cadences across email, LinkedIn and calls — personalized per prospect by AI."
        actions={
          <>
            <RunNowButton onDone={reload} />
            <Button variant="ai" onClick={() => setAiOpen(true)}>
              Generate with AI
            </Button>
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setCreateOpen(true)}>
              New sequence
            </Button>
          </>
        }
      />
      <SandboxBanner mailer={data?.mailer} />
      {data && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Emails sent" value={data.stats.sent.toLocaleString()} sub={`${pct(data.stats.opened, data.stats.sent)} opened`} />
          <Stat label="Replies" value={data.stats.replied.toLocaleString()} sub={`${data.stats.interested} interested`} />
          <Stat label="Active enrollments" value={data.stats.activeEnrollments.toLocaleString()} />
          <Stat label="Open tasks" value={data.stats.openTasks.toLocaleString()} sub={<Link href="/tasks" className="hover:text-zinc-800">View tasks →</Link>} />
        </div>
      )}
      <Card>
        <CardHeader title="All sequences" subtitle={data ? `${data.sequences.length} sequence${data.sequences.length === 1 ? "" : "s"}` : undefined} />
        {loading && !data ? (
          <Loading />
        ) : error ? (
          <div className="p-5">
            <ErrorNote error={error} />
          </div>
        ) : !data?.sequences.length ? (
          <Empty
            icon={<Send className="size-5" />}
            title="No sequences yet"
            body="Describe your goal and let AI write a complete multi-channel sequence, or build one step by step."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="ai" onClick={() => setAiOpen(true)}>
                  Generate with AI
                </Button>
                <Button onClick={() => setCreateOpen(true)}>Start from scratch</Button>
              </div>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sequence</Th>
                <Th>Status</Th>
                <Th className="text-right">Enrolled</Th>
                <Th className="text-right">Active</Th>
                <Th className="text-right">Sent</Th>
                <Th className="text-right">Opened</Th>
                <Th className="text-right">Replied</Th>
                <Th className="text-right">Reply rate</Th>
              </tr>
            </thead>
            <tbody>
              {data.sequences.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-zinc-50/70" onClick={() => router.push(`/sequences/${s.id}`)}>
                  <Td>
                    <Link href={`/sequences/${s.id}`} className="block min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                      <div className="font-medium text-zinc-900">{s.name}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="flex -space-x-1">
                          {(s.channels?.split(",") || []).map((c) => (
                            <StepIcon key={c} type={c as StepType} className="size-5 rounded-md ring-2 ring-white [&_svg]:size-3" />
                          ))}
                        </span>
                        {s.steps} step{s.steps === 1 ? "" : "s"} · created {timeAgo(s.created_at)}
                      </div>
                    </Link>
                  </Td>
                  <Td>
                    <StatusBadge status={s.status} />
                  </Td>
                  <Td className="text-right tabular-nums">{s.enrolled}</Td>
                  <Td className="text-right tabular-nums">{s.active}</Td>
                  <Td className="text-right tabular-nums">{s.sent}</Td>
                  <Td className="text-right tabular-nums">{pct(s.opened, s.sent)}</Td>
                  <Td className="text-right tabular-nums">{s.replied}</Td>
                  <Td className={cx("text-right font-medium tabular-nums", s.replied ? "text-brand-700" : "")}>{pct(s.replied, s.contacted)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={(id) => router.push(`/sequences/${id}`)} />
      <GenerateModal open={aiOpen} onClose={() => setAiOpen(false)} onCreated={(id) => router.push(`/sequences/${id}`)} />
    </div>
  );
}

function CreateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await post<{ id: string }>("/api/sequences", {
        name,
        goal,
        steps: [{ type: "email", delay_days: 0, subject: "Quick question, {{first_name}}", body: "Hi {{first_name}},\n\n", ai_personalize: 1 }],
      });
      onCreated(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New sequence"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VP Sales — Series B SaaS" onKeyDown={(e) => e.key === "Enter" && name.trim() && submit()} />
        </Field>
        <Field label="Goal (optional)" hint="Used by AI when personalizing each step.">
          <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={3} placeholder="Book intro calls with sales leaders who just raised funding" />
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

function GenerateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [goal, setGoal] = useState("");
  const [steps, setSteps] = useState(6);
  const [tone, setTone] = useState("friendly, concise, credible");
  const [channels, setChannels] = useState<StepType[]>(["email", "linkedin_connect", "call"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (c: StepType) => setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const { id } = await post<{ id: string }>("/api/sequences/generate", { goal, steps, tone, channels });
      onCreated(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate a sequence with AI"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ai" loading={busy} disabled={!goal.trim() || !channels.length} onClick={submit}>
            {busy ? "Writing sequence…" : "Generate"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="What should this sequence achieve?" hint="Gemini uses your company profile from Settings to write every step.">
          <Textarea
            autoFocus
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={4}
            placeholder="Book demos with Heads of RevOps at 50–500 person B2B SaaS companies that are hiring SDRs. Lead with how we cut ramp time in half."
          />
        </Field>
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-700">Channels</div>
          <div className="flex flex-wrap gap-2">
            {STEP_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={cx(
                  "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] transition-colors",
                  channels.includes(t.id) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300",
                )}
              >
                {t.short}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Number of steps">
            <Select value={steps} onChange={(e) => setSteps(Number(e.target.value))}>
              {[3, 4, 5, 6, 7, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n} steps
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tone">
            <Input value={tone} onChange={(e) => setTone(e.target.value)} />
          </Field>
        </div>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

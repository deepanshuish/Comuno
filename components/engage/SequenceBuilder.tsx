"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Clock, Plus, Sparkles, Trash2 } from "lucide-react";
import { patch } from "@/lib/client";
import type { SequenceStep, StepType } from "@/lib/types";
import { Button, Card, CardHeader, ErrorNote, Field, Input, Select, Textarea, cx } from "@/components/app/ui";
import { StepIcon } from "./shared";
import { MERGE_FIELDS, STEP_TYPES, type SequenceDetail } from "./types";

type DraftStep = Omit<SequenceStep, "sequence_id" | "position"> & { key: string };

const BODY_LABEL: Record<StepType, string> = {
  email: "Email body",
  linkedin_connect: "Connection note (max 300 characters)",
  linkedin_message: "LinkedIn message",
  call: "Talk track",
  task: "Task description",
};

const BODY_PLACEHOLDER: Record<StepType, string> = {
  email: "Hi {{first_name}},\n\n…",
  linkedin_connect: "Hi {{first_name}}, I work with sales leaders at companies like {{company}}…",
  linkedin_message: "Thanks for connecting, {{first_name}}!…",
  call: "Opener, reason for calling, discovery questions…",
  task: "What should the rep do?",
};

let tmp = 0;
const newKey = () => `new_${Date.now()}_${tmp++}`;

function toDraft(s: SequenceStep): DraftStep {
  return { id: s.id, key: s.id, type: s.type, delay_days: s.delay_days, subject: s.subject, body: s.body, ai_personalize: s.ai_personalize, instructions: s.instructions };
}

export default function SequenceBuilder({ detail, onSaved }: { detail: SequenceDetail; onSaved: (d: SequenceDetail) => void }) {
  const [steps, setSteps] = useState<DraftStep[]>(() => detail.steps.map(toDraft));
  const [name, setName] = useState(detail.sequence.name);
  const [goal, setGoal] = useState(detail.sequence.goal || "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const focused = useRef<{ key: string; field: "subject" | "body"; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const edit = (key: string, p: Partial<DraftStep>) => {
    setSteps((ss) => ss.map((s) => (s.key === key ? { ...s, ...p } : s)));
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    setSteps((ss) => {
      const j = i + dir;
      if (j < 0 || j >= ss.length) return ss;
      const n = [...ss];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    setDirty(true);
  };
  const remove = (key: string) => {
    setSteps((ss) => ss.filter((s) => s.key !== key));
    setDirty(true);
  };
  const add = (type: StepType) => {
    setSteps((ss) => [
      ...ss,
      {
        id: "",
        key: newKey(),
        type,
        delay_days: ss.length ? (type === "email" ? 3 : 1) : 0,
        subject: type === "email" && !ss.some((s) => s.type === "email") ? "Quick question, {{first_name}}" : null,
        body: "",
        ai_personalize: type === "email" || type.startsWith("linkedin") ? 1 : 0,
        instructions: null,
      },
    ]);
    setDirty(true);
  };

  const insertField = (field: string) => {
    const f = focused.current;
    const token = `{{${field}}}`;
    if (!f) {
      const last = steps[steps.length - 1];
      if (last) edit(last.key, { body: `${last.body || ""}${token}` });
      return;
    }
    const el = f.el;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const value = el.value.slice(0, start) + token + el.value.slice(end);
    edit(f.key, { [f.field]: value });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const d = await patch<SequenceDetail>(`/api/sequences/${detail.sequence.id}`, {
        name,
        goal,
        steps: steps.map((s) => ({
          id: s.id || undefined,
          type: s.type,
          delay_days: s.delay_days,
          subject: s.subject,
          body: s.body,
          ai_personalize: s.ai_personalize,
          instructions: s.instructions,
        })),
      });
      setDirty(false);
      setSavedAt(Date.now());
      onSaved(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const totalDays = steps.reduce((a, s) => a + (Number(s.delay_days) || 0), 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-3">
        {steps.map((s, i) => {
          const st = s.id ? detail.stepStats[s.id] : undefined;
          return (
            <div key={s.key}>
              <div className="mb-2 flex items-center gap-2 pl-1 text-xs text-zinc-500">
                <Clock className="size-3.5" />
                {i === 0 ? "Start" : "Wait"}
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={s.delay_days}
                  onChange={(e) => edit(s.key, { delay_days: Math.max(0, Math.min(90, Number(e.target.value) || 0)) })}
                  className="h-7! w-16! px-2! text-center"
                  aria-label="Delay in days"
                />
                {i === 0 ? "days after enrollment" : `day${s.delay_days === 1 ? "" : "s"} after step ${i}`}
              </div>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50/50 px-4 py-2.5">
                  <StepIcon type={s.type} />
                  <span className="text-[13px] font-semibold text-zinc-900">Step {i + 1}</span>
                  <Select value={s.type} onChange={(e) => edit(s.key, { type: e.target.value as StepType })} className="h-7! w-auto! py-0! text-xs">
                    {STEP_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                  {st && (st.sent > 0 || st.tasks > 0) && (
                    <span className="text-xs text-zinc-500">
                      {s.type === "email" ? `${st.sent} sent · ${st.opened} opened` : `${st.tasks} task${st.tasks === 1 ? "" : "s"} created`}
                    </span>
                  )}
                  <div className="ml-auto flex items-center">
                    <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" icon={<ArrowUp className="size-3.5" />} />
                    <Button size="sm" variant="ghost" disabled={i === steps.length - 1} onClick={() => move(i, 1)} aria-label="Move down" icon={<ArrowDown className="size-3.5" />} />
                    <Button size="sm" variant="ghost" onClick={() => remove(s.key)} aria-label="Delete step" icon={<Trash2 className="size-3.5" />} />
                  </div>
                </div>
                <div className="space-y-3 p-4">
                  {(s.type === "email" || s.type === "task") && (
                    <Field label={s.type === "email" ? "Subject" : "Task title"}>
                      <Input
                        value={s.subject || ""}
                        onChange={(e) => edit(s.key, { subject: e.target.value })}
                        onFocus={(e) => (focused.current = { key: s.key, field: "subject", el: e.currentTarget })}
                        placeholder={s.type === "email" ? (i === 0 ? "Quick question, {{first_name}}" : "Leave empty to reply in the same thread") : "Follow up with {{first_name}}"}
                      />
                    </Field>
                  )}
                  <Field
                    label={BODY_LABEL[s.type]}
                    hint={
                      s.ai_personalize
                        ? "AI rewrites this template for each prospect. Leave it empty to let AI write from scratch."
                        : s.type === "linkedin_connect" && (s.body?.length || 0) > 300
                          ? <span className="text-red-600">{s.body?.length}/300 characters — LinkedIn will reject this.</span>
                          : undefined
                    }
                  >
                    <Textarea
                      value={s.body || ""}
                      onChange={(e) => edit(s.key, { body: e.target.value })}
                      onFocus={(e) => (focused.current = { key: s.key, field: "body", el: e.currentTarget })}
                      rows={s.type === "email" ? 7 : 4}
                      placeholder={BODY_PLACEHOLDER[s.type]}
                    />
                  </Field>
                  <div className={cx("rounded-lg border px-3 py-2.5 transition-colors", s.ai_personalize ? "border-violet-200 bg-violet-50/50" : "border-zinc-200")}>
                    <label className="flex cursor-pointer items-center gap-2.5">
                      <Toggle checked={!!s.ai_personalize} onChange={(v) => edit(s.key, { ai_personalize: v ? 1 : 0 })} />
                      <Sparkles className={cx("size-3.5", s.ai_personalize ? "text-violet-600" : "text-zinc-400")} />
                      <span className="whitespace-nowrap text-[13px] font-medium text-zinc-800">AI personalize</span>
                      <span className="hidden text-xs text-zinc-500 sm:inline">
                        — {s.type === "email" ? "rewrite per prospect using their profile, company & signals" : s.type === "call" ? "write a tailored talk track" : "write a tailored note"} (1 credit)
                      </span>
                    </label>
                    {!!s.ai_personalize && (
                      <Input
                        className="mt-2"
                        value={s.instructions || ""}
                        onChange={(e) => edit(s.key, { instructions: e.target.value })}
                        placeholder="Instructions, e.g. “Reference a recent signal; keep it under 90 words; ask about their SDR hiring”"
                      />
                    )}
                  </div>
                </div>
              </Card>
            </div>
          );
        })}

        <Card className="border-dashed p-4">
          <div className="mb-2 text-xs font-medium text-zinc-500">Add a step</div>
          <div className="flex flex-wrap gap-2">
            {STEP_TYPES.map((t) => (
              <Button key={t.id} size="sm" onClick={() => add(t.id)} icon={<Plus className="size-3.5" />}>
                {t.short}
              </Button>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title="Settings" />
          <div className="space-y-3 p-4">
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <Field label="Goal" hint="Guides AI personalization for every step.">
              <Textarea
                rows={3}
                value={goal}
                onChange={(e) => {
                  setGoal(e.target.value);
                  setDirty(true);
                }}
              />
            </Field>
            <div className="text-xs text-zinc-500">
              {steps.length} step{steps.length === 1 ? "" : "s"} over {totalDays} day{totalDays === 1 ? "" : "s"}
            </div>
            <ErrorNote error={error} />
            <Button variant="primary" className="w-full" disabled={!dirty} loading={saving} onClick={save}>
              {dirty ? "Save changes" : savedAt ? "Saved" : "No changes"}
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Merge fields" subtitle="Click to insert at the cursor" />
          <div className="flex flex-wrap gap-1.5 p-4">
            {MERGE_FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertField(f)}
                className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-[11px] text-zinc-700 hover:bg-zinc-200"
              >
                {`{{${f}}}`}
              </button>
            ))}
          </div>
        </Card>
        <p className="px-1 text-xs leading-relaxed text-zinc-500">
          Emails send automatically. LinkedIn, call and task steps land in your{" "}
          <Link href="/tasks" className="underline underline-offset-2">
            task queue
          </Link>
          . A reply stops the sequence for that contact.
        </p>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4 lg:pl-[232px]">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2 shadow-lg">
            <span className="text-[13px] text-zinc-600">Unsaved changes</span>
            <Button size="sm" variant="primary" loading={saving} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={cx("relative h-[18px] w-8 shrink-0 rounded-full transition-colors", checked ? "bg-violet-600" : "bg-zinc-300")}
    >
      <span className={cx("absolute top-0.5 size-3.5 rounded-full bg-white shadow transition-all", checked ? "left-[16px]" : "left-0.5")} />
    </button>
  );
}

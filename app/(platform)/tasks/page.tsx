"use client";
import { useMemo, useState } from "react";
import { Plus, Zap } from "lucide-react";
import { post, useApi } from "@/lib/client";
import { Button, Card, Empty, ErrorNote, Field, Input, Loading, Modal, PageHeader, Select, Tabs, Textarea, cx } from "@/components/app/ui";
import { ContactSearchSelect, RunNowButton } from "@/components/engage/shared";
import TaskCard from "@/components/engage/TaskCard";
import { parseDbDate, type PickerContact, type TaskRow } from "@/components/engage/types";

type Status = "open" | "done" | "skipped";
const TYPES = [
  { id: "all", label: "All" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "call", label: "Calls" },
  { id: "todo", label: "To-dos" },
  { id: "email", label: "Email" },
] as const;

export default function TasksPage() {
  const [status, setStatus] = useState<Status>("open");
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("all");
  const [newOpen, setNewOpen] = useState(false);
  const { data, error, loading, reload, setData } = useApi<{ tasks: TaskRow[] }>(`/api/tasks?status=${status}`);

  const tasks = useMemo(() => (data?.tasks || []).filter((t) => type === "all" || t.type === type), [data, type]);
  const groups = useMemo(() => {
    if (status !== "open") return [{ id: "all", label: "", items: tasks }];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday.getTime() + 864e5);
    const g = { overdue: [] as TaskRow[], today: [] as TaskRow[], upcoming: [] as TaskRow[] };
    for (const t of tasks) {
      const d = parseDbDate(t.due_at) || parseDbDate(t.created_at)!;
      if (d < startOfToday) g.overdue.push(t);
      else if (d < endOfToday) g.today.push(t);
      else g.upcoming.push(t);
    }
    return [
      { id: "overdue", label: "Overdue", items: g.overdue },
      { id: "today", label: "Due today", items: g.today },
      { id: "upcoming", label: "Upcoming", items: g.upcoming },
    ].filter((x) => x.items.length);
  }, [tasks, status]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.tasks.length || 0 };
    for (const t of data?.tasks || []) c[t.type] = (c[t.type] || 0) + 1;
    return c;
  }, [data]);

  const removeLocal = (id: string) => setData((d) => (d ? { tasks: d.tasks.filter((t) => t.id !== id) } : d));
  const replaceLocal = (t: TaskRow) => setData((d) => (d ? { tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, ...t } : x)) } : d));

  return (
    <div>
      <PageHeader
        title="Tasks"
        subtitle="LinkedIn touches, calls and to-dos from your sequences — with AI-written notes ready to copy."
        actions={
          <>
            <RunNowButton onDone={reload} />
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setNewOpen(true)}>
              New task
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { id: "open", label: "Open" },
            { id: "done", label: "Done" },
            { id: "skipped", label: "Skipped" },
          ]}
        />
        <div className="flex flex-wrap gap-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={cx(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                type === t.id ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              )}
            >
              {t.label}
              {!!counts[t.id] && <span className="ml-1 opacity-60">{counts[t.id]}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <Loading />
      ) : error ? (
        <ErrorNote error={error} />
      ) : !tasks.length ? (
        <Card>
          <Empty
            icon={<Zap className="size-5" />}
            title={status === "open" ? "You’re all caught up" : `No ${status} tasks`}
            body={status === "open" ? "LinkedIn, call and manual steps from active sequences appear here when they’re due." : undefined}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.id}>
              {g.label && (
                <h2 className={cx("mb-2 text-xs font-semibold uppercase tracking-wide", g.id === "overdue" ? "text-red-600" : "text-zinc-500")}>
                  {g.label} <span className="font-normal text-zinc-400">{g.items.length}</span>
                </h2>
              )}
              <div className="space-y-3">
                {g.items.map((t) => (
                  <TaskCard key={t.id} task={t} onRemoved={() => removeLocal(t.id)} onUpdated={replaceLocal} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <NewTaskModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={() => (status === "open" ? reload() : setStatus("open"))} />
    </div>
  );
}

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function NewTaskModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("todo");
  const [due, setDue] = useState(() => toLocalInput(new Date()));
  const [body, setBody] = useState("");
  const [contact, setContact] = useState<PickerContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await post("/api/tasks", { title, type, body, due_at: due ? new Date(due).toISOString() : null, contactId: contact?.id || null });
      setTitle("");
      setBody("");
      setContact(null);
      onCreated();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!title.trim()} onClick={submit}>
            Create task
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Title">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send Jane the ROI calculator" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="todo">To-do</option>
              <option value="call">Call</option>
              <option value="linkedin">LinkedIn</option>
              <option value="email">Email</option>
            </Select>
          </Field>
          <Field label="Due">
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </div>
        <Field label="Contact (optional)">
          <ContactSearchSelect value={contact} onChange={setContact} />
        </Field>
        <Field label="Notes">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

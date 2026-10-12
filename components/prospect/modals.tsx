"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ListPlus, Send } from "lucide-react";
import { api, post } from "@/lib/client";
import type { Sequence } from "@/lib/types";
import { Button, Empty, ErrorNote, Field, Input, Modal, Select, Spinner } from "@/components/app/ui";

export type ListRow = { id: string; name: string; created_at: string; member_count: number };

/* Modals are mounted only while open (parents render them conditionally), so state starts fresh. */

/** Pick an existing list or create a new one. Calls onPick with { listId } or { newListName }. */
export function ListPicker({
  value,
  onChange,
  allowNone,
}: {
  value: { listId?: string; newListName?: string };
  onChange: (v: { listId?: string; newListName?: string }) => void;
  allowNone?: boolean;
}) {
  const [lists, setLists] = useState<ListRow[] | null>(null);
  useEffect(() => {
    api<{ lists: ListRow[] }>("/api/lists")
      .then((r) => setLists(r.lists))
      .catch(() => setLists([]));
  }, []);
  const mode = value.newListName !== undefined ? "__new" : value.listId || (allowNone ? "" : lists?.[0]?.id || "__new");
  return (
    <div className="space-y-2">
      <Select
        value={mode}
        disabled={!lists}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__new") onChange({ newListName: "" });
          else if (!v) onChange({});
          else onChange({ listId: v });
        }}
      >
        {allowNone && <option value="">Don&apos;t add to a list</option>}
        {lists?.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name} ({l.member_count})
          </option>
        ))}
        <option value="__new">+ New list…</option>
      </Select>
      {mode === "__new" && (
        <Input autoFocus placeholder="List name, e.g. London fintech VPs" value={value.newListName ?? ""} onChange={(e) => onChange({ newListName: e.target.value })} />
      )}
    </div>
  );
}

export function AddToListModal({ open, onClose, contactIds, onDone }: { open: boolean; onClose: () => void; contactIds: string[]; onDone: (msg: string) => void }) {
  const [target, setTarget] = useState<{ listId?: string; newListName?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lists, setLists] = useState<ListRow[] | null>(null);

  useEffect(() => {
    if (!open) return;
    api<{ lists: ListRow[] }>("/api/lists")
      .then((r) => {
        setLists(r.lists);
        setTarget(r.lists[0] ? { listId: r.lists[0].id } : { newListName: "" });
      })
      .catch((e: Error) => setError(e.message));
  }, [open]);

  const submit = async () => {
    if (!target.listId && !target.newListName?.trim()) return setError("Choose a list or name a new one");
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ added: number }>("/api/contacts/bulk", { action: "add_to_list", ids: contactIds, ...target });
      onDone(`Added ${r.added} ${r.added === 1 ? "person" : "people"} to the list${r.added < contactIds.length ? ` (${contactIds.length - r.added} already there)` : ""}`);
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
      title={`Add ${contactIds.length} to list`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit} icon={<ListPlus className="size-3.5" />}>
            Add to list
          </Button>
        </>
      }
    >
      {!lists && !error ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="List">
            <ListPicker value={target} onChange={setTarget} />
          </Field>
          <ErrorNote error={error} />
        </div>
      )}
    </Modal>
  );
}

export function AddToSequenceModal({ open, onClose, contactIds, onDone }: { open: boolean; onClose: () => void; contactIds: string[]; onDone: (msg: string) => void }) {
  const [seqs, setSeqs] = useState<Sequence[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [seqId, setSeqId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/sequences")
      .then(async (res) => {
        if (res.status === 404) {
          setUnavailable(true);
          setSeqs([]);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { sequences?: Sequence[]; error?: string } | Sequence[];
        if (!res.ok) throw new Error((!Array.isArray(data) && data.error) || "Couldn't load sequences");
        const list = Array.isArray(data) ? data : data.sequences || [];
        setSeqs(list);
        setSeqId(list.find((s) => s.status === "active")?.id || list[0]?.id || "");
      })
      .catch((e: Error) => {
        setError(e.message);
        setSeqs([]);
      });
  }, [open]);

  const submit = async () => {
    if (!seqId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sequences/${seqId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
      });
      const data = (await res.json().catch(() => ({}))) as { enrolled?: number; added?: number; skipped?: number; error?: string };
      if (res.status === 404) throw new Error("Sequence enrollment isn't available yet.");
      if (!res.ok) throw new Error(data.error || `Enrollment failed (${res.status})`);
      const n = data.enrolled ?? data.added ?? contactIds.length;
      const name = seqs?.find((s) => s.id === seqId)?.name || "sequence";
      onDone(`Enrolled ${n} in “${name}”${data.skipped ? ` · ${data.skipped} skipped` : ""}`);
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
      title={`Add ${contactIds.length} to sequence`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!seqId} onClick={submit} icon={<Send className="size-3.5" />}>
            Enroll
          </Button>
        </>
      }
    >
      {seqs === null ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : unavailable || seqs.length === 0 ? (
        <Empty
          icon={<Send className="size-5" />}
          title={unavailable ? "Sequences aren't available yet" : "No sequences yet"}
          body="Create a multichannel sequence first, then enroll people into it."
          action={
            <Link href="/sequences" className="text-[13px] font-medium text-brand-700 hover:underline">
              Go to Sequences →
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          <Field label="Sequence" hint="People without a valid email will be skipped for email steps.">
            <Select value={seqId} onChange={(e) => setSeqId(e.target.value)}>
              {seqs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status !== "active" ? `(${s.status})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

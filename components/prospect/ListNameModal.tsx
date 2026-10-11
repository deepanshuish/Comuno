"use client";
import { useState } from "react";
import { patch, post } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Modal } from "@/components/app/ui";

/** Create or rename a list. */
export function ListNameModal({ initial, onClose, onSaved }: { initial: { id?: string; name: string }; onClose: () => void; onSaved: (id: string) => void }) {
  const [name, setName] = useState(initial.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (initial.id) {
        await patch(`/api/lists/${initial.id}`, { name });
        onSaved(initial.id);
      } else {
        const r = await post<{ id: string }>("/api/lists", { name });
        onSaved(r.id);
      }
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={initial.id ? "Rename list" : "New list"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!name.trim()} onClick={submit}>
            {initial.id ? "Save" : "Create list"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) submit();
        }}
        className="space-y-3"
      >
        <Field label="List name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 fintech VPs" />
        </Field>
        <ErrorNote error={error} />
      </form>
    </Modal>
  );
}

"use client";
import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { api, post } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Modal, Textarea } from "@/components/app/ui";
import { ContactSearchSelect } from "./shared";
import type { PickerContact, ThreadDetail } from "./types";

/** Compose a one-off email to any contact, with an AI draft. */
export default function ComposeModal({
  open,
  onClose,
  contactId,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  contactId?: string | null;
  onSent?: (contactId: string) => void;
}) {
  const [contact, setContact] = useState<PickerContact | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [goal, setGoal] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !contactId) return;
    let cancelled = false;
    api<ThreadDetail>(`/api/inbox/${contactId}`)
      .then((d) => {
        if (cancelled) return;
        setLoadedFor(d.contact.id);
        const c = d.contact;
        setContact({ id: c.id, first_name: c.first_name, last_name: c.last_name, email: c.email, phone: c.phone, title: c.title, status: c.status, company_name: c.company_name ?? null });
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [open, contactId]);

  const loadingContact = open && !!contactId && loadedFor !== contactId && !error;

  const reset = () => {
    setSubject("");
    setBody("");
    setGoal("");
    setError(null);
    setContact(null);
    setLoadedFor(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  const draft = async () => {
    if (!contact) return setError("Pick a contact first");
    setDrafting(true);
    setError(null);
    try {
      const d = await post<{ subject: string; body: string }>("/api/messages/draft", { contactId: contact.id, goal: goal || undefined });
      setSubject(d.subject);
      setBody(d.body);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  const send = async () => {
    if (!contact) return setError("Pick a contact first");
    setSending(true);
    setError(null);
    try {
      await post("/api/messages", { contactId: contact.id, subject, body });
      const id = contact.id;
      reset();
      onSent?.(id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New email"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Send className="size-3.5" />} loading={sending} disabled={!contact || !body.trim()} onClick={send}>
            Send
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="To">
          {loadingContact ? (
            <div className="flex h-9 items-center px-1 text-xs text-zinc-500">Loading contact…</div>
          ) : (
            <ContactSearchSelect value={contact} onChange={setContact} />
          )}
        </Field>
        {contact && !contact.email && <ErrorNote error="This contact has no email address — add one in People first." />}
        <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Goal for the AI draft, e.g. “book a 20-min demo about their hiring push”"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && draft()}
            />
            <Button variant="ai" loading={drafting} onClick={draft} disabled={!contact}>
              {body ? "Redraft with AI" : "Draft with AI"}
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-violet-700/80">Uses the prospect’s profile, company research, signals and past conversation.</p>
        </div>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
        </Field>
        <Field label="Message" hint="Your signature from Settings is appended automatically. Links are click-tracked.">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Write your email…" />
        </Field>
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

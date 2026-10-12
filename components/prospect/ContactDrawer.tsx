"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AtSign, Building2, MailCheck, MailSearch, PenLine, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { api, del, fullName, patch, post, timeAgo } from "@/lib/client";
import type { Activity, Contact, ContactStatus, EmailStatus } from "@/lib/types";
import { Avatar, Badge, Button, Drawer, ErrorNote, Field, Input, Loading, Score, Select, Sources, Tabs, Textarea } from "@/components/app/ui";
import { AddToSequenceModal } from "./modals";
import { CONTACT_STATUSES, EmailStatusBadge, ExtLink, KV, LinkedInLink } from "./shared";

type Detail = {
  contact: Contact;
  activities: Activity[];
  lists: { id: string; name: string }[];
  enrollments: { id: string; sequence_id: string; sequence_name: string; status: string; current_step: number }[];
};

type Enrichment = {
  discovery?: { reason?: string; source_url?: string | null };
  current_title?: string | null;
  current_company?: string | null;
  still_at_company?: boolean | null;
  summary?: string | null;
  past_roles?: { title: string; company: string; years?: string | null }[];
  education?: string[];
  talking_points?: string[];
  sources?: { title: string; url: string }[];
  enriched_at?: string;
  email_finder?: { email?: string; status?: EmailStatus; pattern?: string | null; confidence?: string | null; candidates?: string[]; reason?: string };
};

const EDIT_FIELDS: { key: keyof Contact | "company" | "domain"; label: string; type?: string }[] = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "domain", label: "Company domain" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "linkedin_url", label: "LinkedIn URL", type: "url" },
  { key: "location", label: "Location" },
  { key: "seniority", label: "Seniority" },
  { key: "department", label: "Department" },
];

function toForm(c: Contact): Record<string, string> {
  return {
    first_name: c.first_name || "",
    last_name: c.last_name || "",
    title: c.title || "",
    company: c.company_name || "",
    domain: c.company_domain || "",
    email: c.email || "",
    phone: c.phone || "",
    linkedin_url: c.linkedin_url || "",
    location: c.location || "",
    seniority: c.seniority || "",
    department: c.department || "",
    notes: c.notes || "",
    tags: c.tags || "",
  };
}

export function ContactDrawer({ contactId, onClose, onChanged }: { contactId: string | null; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "research" | "activity">("details");
  const [form, setForm] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [seqOpen, setSeqOpen] = useState(false);

  const apply = useCallback((d: Detail) => {
    setData(d);
    setForm(toForm(d.contact));
    setDirty(false);
    setLoadError(null);
  }, []);

  const load = useCallback(async () => {
    if (!contactId) return;
    try {
      apply(await api<Detail>(`/api/contacts/${contactId}`));
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, [contactId, apply]);

  // The parent remounts this drawer per contact (key={id}), so state starts fresh.
  useEffect(() => {
    if (!contactId) return;
    let alive = true;
    api<Detail>(`/api/contacts/${contactId}`)
      .then((d) => alive && apply(d))
      .catch((e: Error) => alive && setLoadError(e.message));
    return () => {
      alive = false;
    };
  }, [contactId, apply]);

  const act = async (name: string, fn: () => Promise<string | void>) => {
    setBusy(name);
    setError(null);
    setInfo(null);
    try {
      const msg = await fn();
      if (msg) setInfo(msg);
      await load();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    act("save", async () => {
      const body: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(form)) body[k] = v.trim() || null;
      await patch(`/api/contacts/${contactId}`, body);
      return "Saved";
    });

  const setStatus = (status: ContactStatus) => act("status", async () => void (await patch(`/api/contacts/${contactId}`, { status })));

  const c = data?.contact;
  const enr: Enrichment = (() => {
    try {
      return c?.enrichment_json ? (JSON.parse(c.enrichment_json) as Enrichment) : {};
    } catch {
      return {};
    }
  })();

  return (
    <Drawer
      open={!!contactId}
      onClose={onClose}
      title={
        c ? (
          <div className="flex items-center gap-2.5">
            <Avatar name={fullName(c)} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                {fullName(c)} <LinkedInLink url={c.linkedin_url} />
              </div>
              <div className="truncate text-xs font-normal text-zinc-500">
                {[c.title, c.company_name].filter(Boolean).join(" · ") || "No title"}
              </div>
            </div>
          </div>
        ) : (
          "Contact"
        )
      }
    >
      {!data ? (
        loadError ? (
          <div className="p-5">
            <ErrorNote error={loadError} />
          </div>
        ) : (
          <Loading />
        )
      ) : (
        <div className="space-y-4 p-5">
          {/* Summary row */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={c!.status} onChange={(e) => setStatus(e.target.value as ContactStatus)} className="!h-8 !w-auto" aria-label="Status">
              {CONTACT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
            <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
              Fit <Score value={c!.score} />
            </span>
            {c!.email && (
              <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                Email <EmailStatusBadge status={c!.email_status} />
              </span>
            )}
            {data.lists.map((l) => (
              <Link key={l.id} href={`/lists/${l.id}`}>
                <Badge tone="blue">{l.name}</Badge>
              </Link>
            ))}
          </div>
          {c!.score_reason && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[13px] text-zinc-600">{c!.score_reason}</p>}

          {/* Actions */}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ai" loading={busy === "enrich"} disabled={!!busy} onClick={() => act("enrich", async () => (await post(`/api/contacts/${contactId}/enrich`), "Enriched from public sources"))}>
              Enrich
            </Button>
            <Button size="sm" variant="ai" loading={busy === "score"} disabled={!!busy} onClick={() => act("score", async () => {
              const r = await post<{ score: number }>(`/api/contacts/${contactId}/score`);
              return `Scored ${r.score}/100`;
            })}>
              Score fit
            </Button>
            <Button size="sm" loading={busy === "find"} disabled={!!busy} icon={<MailSearch className="size-3.5" />} onClick={() => act("find", async () => {
              const r = await post<{ email: string | null; status: EmailStatus; candidates: string[] }>(`/api/contacts/${contactId}/find-email`);
              return r.email ? `Found ${r.email} (${r.status})` : `No deliverable email (${r.status})`;
            })}>
              Find email
            </Button>
            <Button size="sm" loading={busy === "verify"} disabled={!!busy || !c!.email} icon={<ShieldCheck className="size-3.5" />} onClick={() => act("verify", async () => {
              const r = await post<{ status: EmailStatus; reason: string }>(`/api/contacts/${contactId}/verify-email`);
              return `${r.status.toUpperCase()}: ${r.reason}`;
            })}>
              Verify
            </Button>
            <Button size="sm" disabled={!!busy} icon={<Send className="size-3.5" />} onClick={() => setSeqOpen(true)}>
              Add to sequence
            </Button>
            <Link
              href={`/inbox?compose=${contactId}`}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50"
            >
              <PenLine className="size-3.5" /> Draft email
            </Link>
          </div>
          <ErrorNote error={error} />
          {info && <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-[13px] text-brand-800">{info}</div>}

          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "details", label: "Details" },
              { id: "research", label: "Research" },
              { id: "activity", label: `Activity${data.activities.length ? ` (${data.activities.length})` : ""}` },
            ]}
          />

          {tab === "details" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {EDIT_FIELDS.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Input
                      type={f.type || "text"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => {
                        setForm((s) => ({ ...s, [f.key]: e.target.value }));
                        setDirty(true);
                      }}
                    />
                  </Field>
                ))}
                <Field label="Email status">
                  <Select
                    value={c!.email_status}
                    onChange={(e) => act("estatus", async () => void (await patch(`/api/contacts/${contactId}`, { email_status: e.target.value })))}
                  >
                    {(["unknown", "valid", "risky", "invalid"] as EmailStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Tags" hint="Comma-separated">
                <Input value={form.tags ?? ""} onChange={(e) => (setForm((s) => ({ ...s, tags: e.target.value })), setDirty(true))} />
              </Field>
              <Field label="Notes">
                <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => (setForm((s) => ({ ...s, notes: e.target.value })), setDirty(true))} />
              </Field>
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 className="size-3.5" />}
                  disabled={!!busy}
                  onClick={async () => {
                    if (!confirm(`Delete ${fullName(c!)}? This also removes them from lists and sequences.`)) return;
                    try {
                      await del(`/api/contacts/${contactId}`);
                      onChanged();
                      onClose();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Delete
                </Button>
                <div className="flex gap-2">
                  {dirty && (
                    <Button size="sm" variant="ghost" onClick={() => (setForm(toForm(c!)), setDirty(false))} icon={<X className="size-3.5" />}>
                      Discard
                    </Button>
                  )}
                  <Button size="sm" variant="primary" disabled={!dirty} loading={busy === "save"} onClick={save}>
                    Save changes
                  </Button>
                </div>
              </div>
              <div className="border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                Source: {c!.source || "—"} · Added {timeAgo(c!.created_at)} · Updated {timeAgo(c!.updated_at)}
              </div>
              {data.enrollments.length > 0 && (
                <div>
                  <div className="mb-1.5 text-xs font-medium text-zinc-700">Sequences</div>
                  <div className="space-y-1">
                    {data.enrollments.map((e) => (
                      <div key={e.id} className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-1.5 text-[13px]">
                        <Link href={`/sequences/${e.sequence_id}`} className="truncate text-zinc-800 hover:underline">
                          {e.sequence_name}
                        </Link>
                        <Badge tone={e.status === "active" ? "green" : "zinc"}>
                          {e.status} · step {e.current_step + 1}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "research" && <ResearchTab enr={enr} contact={c!} onEnrich={() => act("enrich", async () => (await post(`/api/contacts/${contactId}/enrich`), "Enriched from public sources"))} busy={busy === "enrich"} />}

          {tab === "activity" && (
            <div>
              {data.activities.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-zinc-500">No activity yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-zinc-200 pl-4">
                  {data.activities.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-white bg-zinc-300" />
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[13px] font-medium text-zinc-900">{a.title}</span>
                        <span className="shrink-0 text-[11px] text-zinc-400">{timeAgo(a.created_at)}</span>
                      </div>
                      <div className="text-[11px] uppercase tracking-wide text-zinc-400">{a.type.replace(/_/g, " ")}</div>
                      {a.body && <p className="mt-0.5 whitespace-pre-line text-[13px] text-zinc-600">{a.body}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}
      {seqOpen && <AddToSequenceModal open={seqOpen} onClose={() => setSeqOpen(false)} contactIds={contactId ? [contactId] : []} onDone={(m) => (setInfo(m), load())} />}
    </Drawer>
  );
}

function ResearchTab({ enr, contact, onEnrich, busy }: { enr: Enrichment; contact: Contact; onEnrich: () => void; busy: boolean }) {
  const has = !!enr.enriched_at;
  return (
    <div className="space-y-4">
      {enr.discovery?.reason && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 text-[13px] text-zinc-700">
          <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-brand-700">Why they matched</div>
          {enr.discovery.reason}
          {enr.discovery.source_url && (
            <div className="mt-1 text-xs">
              <ExtLink href={enr.discovery.source_url} />
            </div>
          )}
        </div>
      )}
      {enr.email_finder && (
        <div className="rounded-lg border border-zinc-100 px-3 py-2 text-[13px]">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            <AtSign className="size-3" /> Email finder
          </div>
          <div className="text-zinc-700">{enr.email_finder.reason}</div>
          {enr.email_finder.candidates && enr.email_finder.candidates.length > 1 && (
            <div className="mt-1.5 text-xs text-zinc-500">Other candidates: {enr.email_finder.candidates.slice(1, 6).join(", ")}</div>
          )}
        </div>
      )}
      {!has ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-8 text-center">
          <MailCheck className="mx-auto mb-2 size-5 text-zinc-400" />
          <p className="text-[13px] text-zinc-600">No research yet. Enrich to verify their current role, find past roles and personalization talking points from public sources.</p>
          <Button className="mt-3" size="sm" variant="ai" loading={busy} onClick={onEnrich}>
            Enrich {contact.first_name || "contact"}
          </Button>
        </div>
      ) : (
        <>
          {enr.still_at_company === false && (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-[13px] text-zinc-800">
              Possible job change: now {enr.current_title || "—"} at {enr.current_company || "another company"}.
            </div>
          )}
          {enr.summary && <p className="text-[13px] leading-relaxed text-zinc-700">{enr.summary}</p>}
          <div>
            <KV label="Current role">{[enr.current_title, enr.current_company].filter(Boolean).join(" at ") || null}</KV>
            <KV label="Seniority">{contact.seniority}</KV>
            <KV label="Department">{contact.department}</KV>
            <KV label="Education">{enr.education?.length ? enr.education.join("; ") : null}</KV>
          </div>
          {!!enr.talking_points?.length && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Talking points</div>
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-zinc-700">
                {enr.talking_points.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {!!enr.past_roles?.length && (
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-700">Past roles</div>
              <ul className="space-y-1 text-[13px] text-zinc-700">
                {enr.past_roles.map((r, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <Building2 className="size-3 text-zinc-400" /> {r.title} · {r.company} {r.years && <span className="text-zinc-400">({r.years})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Sources sources={enr.sources} />
          <div className="text-xs text-zinc-400">Enriched {timeAgo(enr.enriched_at)}</div>
        </>
      )}
    </div>
  );
}

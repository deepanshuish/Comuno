"use client";
import { Suspense, useCallback, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Upload } from "lucide-react";
import { post } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Loading, Modal, PageHeader } from "@/components/app/ui";
import { ImportModal } from "@/components/prospect/ImportModal";
import { PeopleTable } from "@/components/prospect/PeopleTable";
import { Notice } from "@/components/prospect/shared";

export default function PeoplePage() {
  return (
    <Suspense fallback={<Loading />}>
      <People />
    </Suspense>
  );
}

function People() {
  const sp = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [mountKey, setMountKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(sp.get("open"));
  const clearNotice = useCallback(() => setNotice(null), []);

  return (
    <div>
      <PageHeader
        title="People"
        subtitle="Every prospect in your workspace — search, enrich, verify, score and send to sequences."
        actions={
          <>
            <Link href="/prospect" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[13px] font-medium text-white hover:bg-brand-500">
              <Search className="size-3.5" /> Find leads
            </Link>
            <Button icon={<Upload className="size-3.5" />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAddOpen(true)}>
              Add person
            </Button>
          </>
        }
      />
      <PeopleTable
        key={mountKey}
        reloadKey={reloadKey}
        initial={{ listId: sp.get("listId") || "", companyId: sp.get("companyId") || "", status: sp.get("status") || "" }}
        initialOpenId={openId}
        emptyAction={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/prospect" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 text-[13px] font-medium text-white hover:bg-brand-500">
              <Search className="size-3.5" /> Find leads with AI
            </Link>
            <Button icon={<Upload className="size-3.5" />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
          </div>
        }
      />
      {importOpen && (
        <ImportModal
          open
          onClose={() => setImportOpen(false)}
          onImported={(r) => {
            setNotice(`Imported ${r.created} new ${r.created === 1 ? "person" : "people"}${r.duplicates ? ` · ${r.duplicates} duplicates skipped` : ""}${r.invalid ? ` · ${r.invalid} rows without a name/email` : ""}`);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
      {addOpen && (
        <AddPersonModal
          onClose={() => setAddOpen(false)}
          onCreated={(id, created) => {
            setNotice(created ? "Person added" : "That person already exists — opened their record");
            setOpenId(id);
            setMountKey((k) => k + 1); // remount so the new record's drawer opens
          }}
        />
      )}
      <Notice text={notice} onDone={clearNotice} />
    </div>
  );
}

const ADD_FIELDS = [
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email", type: "email" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "domain", label: "Company domain" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "phone", label: "Phone" },
  { key: "location", label: "Location" },
] as const;

function AddPersonModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string, created: boolean) => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ id: string; created: boolean }>("/api/contacts", form);
      onCreated(r.id, r.created);
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
      title="Add person"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Add person
          </Button>
        </>
      }
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {ADD_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <Input type={"type" in f ? f.type : "text"} value={form[f.key] || ""} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
          </Field>
        ))}
        <button type="submit" className="hidden" />
      </form>
      <div className="mt-3">
        <ErrorNote error={error} />
      </div>
    </Modal>
  );
}

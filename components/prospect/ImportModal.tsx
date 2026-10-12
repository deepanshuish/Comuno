"use client";
import { useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, Upload } from "lucide-react";
import { post } from "@/lib/client";
import { Button, cx, ErrorNote, Field, Modal, Select } from "@/components/app/ui";
import { ListPicker } from "./modals";

const FIELDS = [
  { id: "first_name", label: "First name", aliases: ["first name", "firstname", "first", "given name"] },
  { id: "last_name", label: "Last name", aliases: ["last name", "lastname", "last", "surname", "family name"] },
  { id: "full_name", label: "Full name", aliases: ["name", "full name", "fullname", "contact name", "person"] },
  { id: "email", label: "Email", aliases: ["email", "email address", "e-mail", "work email", "mail"] },
  { id: "title", label: "Job title", aliases: ["title", "job title", "position", "role", "jobtitle"] },
  { id: "company", label: "Company", aliases: ["company", "company name", "organization", "organisation", "account", "employer"] },
  { id: "domain", label: "Company domain", aliases: ["domain", "website", "company domain", "company website", "url"] },
  { id: "phone", label: "Phone", aliases: ["phone", "phone number", "mobile", "telephone", "work phone"] },
  { id: "linkedin_url", label: "LinkedIn URL", aliases: ["linkedin", "linkedin url", "linkedin profile", "person linkedin url", "profile url"] },
  { id: "location", label: "Location", aliases: ["location", "city", "country", "region", "address"] },
] as const;

type FieldId = (typeof FIELDS)[number]["id"];
type Mapping = Partial<Record<FieldId, string>>;

const norm = (s: string) => s.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();

function autoMap(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<string>();
  for (const f of FIELDS) {
    const h = headers.find((h) => !used.has(h) && (f.aliases as readonly string[]).includes(norm(h)));
    if (h) {
      m[f.id] = h;
      used.add(h);
    }
  }
  return m;
}

type Result = { created: number; duplicates: number; invalid: number; total: number };

export function ImportModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (r: Result) => void }) {
  const [file, setFile] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [target, setTarget] = useState<{ listId?: string; newListName?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setTarget({});
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const parse = (f: File) => {
    setError(null);
    if (f.size > 10 * 1024 * 1024) return setError("File is larger than 10 MB");
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const hs = (res.meta.fields || []).filter(Boolean);
        if (!hs.length || !res.data.length) return setError("That file has no rows. Make sure the first row contains column headers.");
        if (res.data.length > 5000) return setError(`That file has ${res.data.length.toLocaleString()} rows. Import up to 5,000 at a time.`);
        setFile(f.name);
        setHeaders(hs);
        setRows(res.data);
        setMapping(autoMap(hs));
        setTarget({ newListName: f.name.replace(/\.csv$/i, "") });
      },
      error: (err) => setError(err.message),
    });
  };

  const hasIdentity = !!(mapping.email || mapping.first_name || mapping.full_name || mapping.linkedin_url);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const mapped = rows.map((r) => {
        const o: Record<string, string> = {};
        for (const f of FIELDS) {
          const col = mapping[f.id];
          if (col && r[col] != null) o[f.id] = String(r[col]).trim();
        }
        return o;
      });
      const res = await post<Result>("/api/contacts/import", { rows: mapped, ...target });
      onImported(res);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title="Import people from CSV"
      footer={
        file ? (
          <>
            <Button variant="ghost" onClick={reset}>
              Choose another file
            </Button>
            <Button variant="primary" loading={busy} disabled={!hasIdentity} onClick={submit} icon={<Upload className="size-3.5" />}>
              Import {rows.length.toLocaleString()} rows
            </Button>
          </>
        ) : undefined
      }
    >
      {!file ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) parse(f);
            }}
            className={cx(
              "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors",
              drag ? "border-brand-400 bg-brand-50" : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50",
            )}
          >
            <FileUp className="mb-2 size-6 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-900">Drop a CSV here or click to browse</span>
            <span className="mt-1 text-xs text-zinc-500">Columns like name, email, title, company, domain, LinkedIn. Up to 5,000 rows.</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parse(f);
              e.target.value = "";
            }}
          />
          <ErrorNote error={error} />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-[13px] text-zinc-600">
            <span className="font-medium text-zinc-900">{file}</span> · {rows.length.toLocaleString()} rows. Map your columns — duplicates (same email, LinkedIn, or name + company) are skipped.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.id} label={f.label}>
                <Select value={mapping[f.id] || ""} onChange={(e) => setMapping((m) => ({ ...m, [f.id]: e.target.value || undefined }))}>
                  <option value="">— Skip —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                      {rows[0]?.[h] ? ` (e.g. ${String(rows[0][h]).slice(0, 24)})` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          {!hasIdentity && <ErrorNote error="Map at least one of: email, first name, full name or LinkedIn URL." />}
          <Field label="Add imported people to a list">
            <ListPicker value={target} onChange={setTarget} allowNone />
          </Field>
          <ErrorNote error={error} />
        </div>
      )}
    </Modal>
  );
}

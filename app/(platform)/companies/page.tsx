"use client";
import { Suspense, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, Plus, Search, Trash2 } from "lucide-react";
import { post, timeAgo, useApi } from "@/lib/client";
import type { Company } from "@/lib/types";
import { Button, Card, Empty, ErrorNote, Field, Input, Loading, Modal, PageHeader, Score, Select, Table, Td, Th } from "@/components/app/ui";
import { CompanyDrawer } from "@/components/prospect/CompanyDrawer";
import { ContactDrawer } from "@/components/prospect/ContactDrawer";
import { BulkBar, Checkbox, Notice, Pagination, useDebounced } from "@/components/prospect/shared";

type CompanyRow = Company & { people_count: number };
const PAGE = 50;

export default function CompaniesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Companies />
    </Suspense>
  );
}

type BulkResult = { ok: number; failed: number; error: string | null; truncated: boolean };

function Companies() {
  const sp = useSearchParams();
  const [qText, setQText] = useState("");
  const [minScore, setMinScore] = useState("");
  const [sort, setSort] = useState("created");
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(sp.get("open"));
  const [contactId, setContactId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const q = useDebounced(qText, 300);

  const url = useMemo(() => {
    const p = new URLSearchParams({ sort, limit: String(PAGE), offset: String(offset) });
    if (q.trim()) p.set("q", q.trim());
    if (minScore) p.set("minScore", minScore);
    return `/api/companies?${p.toString()}`;
  }, [q, minScore, sort, offset]);
  const { data, error: loadError, loading, reload } = useApi<{ companies: CompanyRow[]; total: number }>(url);
  const companies = data?.companies || [];
  const ids = [...sel];
  const reset = () => {
    setOffset(0);
    setSel(new Set());
  };
  const onChanged = useCallback(() => reload(), [reload]);
  const clearNotice = useCallback(() => setNotice(null), []);

  const bulk = async (name: string, body: Record<string, unknown>, msg: (r: Record<string, unknown>) => string) => {
    setBusy(name);
    setError(null);
    try {
      const r = await post<Record<string, unknown>>("/api/companies/bulk", { ids, ...body });
      setNotice(msg(r));
      if ((r as Partial<BulkResult>).error) setError((r as Partial<BulkResult>).error!);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Companies"
        subtitle="Target accounts — enrich firmographics, research priorities and find the right people."
        actions={
          <>
            <Link href="/prospect?mode=companies" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 text-[13px] font-medium text-white hover:bg-violet-500">
              <Search className="size-3.5" /> Find accounts
            </Link>
            <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setAddOpen(true)}>
              Add company
            </Button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="!w-full sm:!w-72" placeholder="Search name, domain, industry, location…" value={qText} onChange={(e) => (setQText(e.target.value), reset())} />
        <Input className="!w-[110px]" type="number" min={0} max={100} placeholder="Min score" value={minScore} onChange={(e) => (setMinScore(e.target.value), reset())} aria-label="Minimum score" />
        <Select className="!w-auto" value={sort} onChange={(e) => (setSort(e.target.value), reset())} aria-label="Sort">
          <option value="created">Newest</option>
          <option value="score">Highest score</option>
          <option value="people">Most people</option>
          <option value="name">Name A–Z</option>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <BulkBar count={sel.size} onClear={() => setSel(new Set())}>
          <Button size="sm" variant="ai" loading={busy === "enrich"} disabled={!!busy} onClick={() => bulk("enrich", { action: "enrich" }, (r) => {
            const b = r as unknown as BulkResult;
            return `Enriched ${b.ok}${b.failed ? ` · ${b.failed} failed` : ""}${b.truncated ? " (batch limit 20 — run again for the rest)" : ""}`;
          })}>
            Enrich
          </Button>
          <Button size="sm" variant="ai" loading={busy === "score"} disabled={!!busy} onClick={() => bulk("score", { action: "score" }, (r) => `Scored ${(r.scores as unknown[]).length}`)}>
            Score
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" />}
            loading={busy === "delete"}
            disabled={!!busy}
            onClick={() => {
              if (!confirm(`Delete ${sel.size} ${sel.size === 1 ? "company" : "companies"}? People are kept but unlinked.`)) return;
              bulk("delete", { action: "delete" }, (r) => `Deleted ${r.deleted}`).then(() => setSel(new Set()));
            }}
          >
            Delete
          </Button>
        </BulkBar>
        {error && (
          <div className="border-b border-zinc-100 p-3">
            <ErrorNote error={error} />
          </div>
        )}
        {loadError ? (
          <div className="p-4">
            <ErrorNote error={loadError} />
          </div>
        ) : !data && loading ? (
          <Loading />
        ) : companies.length === 0 ? (
          <Empty
            icon={<Building2 className="size-5" />}
            title={q || minScore ? "No companies match" : "No companies yet"}
            body={q || minScore ? "Try a different search." : "Discover target accounts with AI, or they'll appear here as you add people."}
            action={
              !q && !minScore ? (
                <Link href="/prospect?mode=companies" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 text-[13px] font-medium text-white hover:bg-violet-500">
                  <Search className="size-3.5" /> Find accounts with AI
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <thead>
                <tr>
                  <Th className="w-8">
                    <Checkbox
                      label="Select page"
                      checked={companies.every((c) => sel.has(c.id))}
                      indeterminate={companies.some((c) => sel.has(c.id))}
                      onChange={(on) =>
                        setSel((s) => {
                          const n = new Set(s);
                          for (const c of companies) {
                            if (on) n.add(c.id);
                            else n.delete(c.id);
                          }
                          return n;
                        })
                      }
                    />
                  </Th>
                  <Th>Company</Th>
                  <Th>Industry</Th>
                  <Th className="hidden md:table-cell">Size</Th>
                  <Th className="hidden lg:table-cell">Location</Th>
                  <Th>People</Th>
                  <Th>Score</Th>
                  <Th className="hidden xl:table-cell">Added</Th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id} className={sel.has(c.id) ? "cursor-pointer bg-violet-50/40" : "cursor-pointer hover:bg-zinc-50/70"} onClick={() => setOpenId(c.id)}>
                    <Td>
                      <Checkbox
                        label={`Select ${c.name}`}
                        checked={sel.has(c.id)}
                        onChange={() =>
                          setSel((s) => {
                            const n = new Set(s);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          })
                        }
                      />
                    </Td>
                    <Td>
                      <div className="flex min-w-[180px] items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-semibold uppercase text-zinc-500">{c.name.slice(0, 2)}</span>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-zinc-900">{c.name}</div>
                          <div className="truncate text-xs text-zinc-500">{c.domain || "—"}</div>
                        </div>
                      </div>
                    </Td>
                    <Td className="max-w-[180px] truncate">{c.industry || <span className="text-zinc-400">—</span>}</Td>
                    <Td className="hidden whitespace-nowrap md:table-cell">{c.size || <span className="text-zinc-400">—</span>}</Td>
                    <Td className="hidden max-w-[180px] truncate lg:table-cell">{c.location || <span className="text-zinc-400">—</span>}</Td>
                    <Td>
                      {c.people_count > 0 ? (
                        <Link href={`/contacts?companyId=${c.id}`} onClick={(e) => e.stopPropagation()} className="tabular-nums text-violet-700 hover:underline">
                          {c.people_count}
                        </Link>
                      ) : (
                        <span className="text-zinc-400">0</span>
                      )}
                    </Td>
                    <Td>
                      <span title={c.score_reason || undefined}>
                        <Score value={c.score} />
                      </span>
                    </Td>
                    <Td className="hidden whitespace-nowrap text-xs text-zinc-500 xl:table-cell">{timeAgo(c.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination total={data?.total || 0} limit={PAGE} offset={offset} onChange={setOffset} />
          </div>
        )}
      </Card>

      {openId && <CompanyDrawer key={openId} companyId={openId} onClose={() => setOpenId(null)} onChanged={onChanged} onOpenContact={setContactId} />}
      {contactId && <ContactDrawer key={contactId} contactId={contactId} onClose={() => setContactId(null)} onChanged={onChanged} />}
      {addOpen && (
        <AddCompanyModal
          onClose={() => setAddOpen(false)}
          onCreated={(id) => {
            setNotice("Company saved");
            setOpenId(id);
            reload();
          }}
        />
      )}
      <Notice text={notice} onDone={clearNotice} />
    </div>
  );
}

function AddCompanyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [form, setForm] = useState({ name: "", domain: "", industry: "", size: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ id: string }>("/api/companies", form);
      onCreated(r.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const fields: { key: keyof typeof form; label: string; placeholder?: string }[] = [
    { key: "name", label: "Name", placeholder: "Acme Inc." },
    { key: "domain", label: "Domain", placeholder: "acme.com" },
    { key: "industry", label: "Industry" },
    { key: "size", label: "Employees", placeholder: "51-200" },
    { key: "location", label: "HQ location" },
  ];
  return (
    <Modal
      open
      onClose={onClose}
      title="Add company"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Add company
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
        {fields.map((f) => (
          <Field key={f.key} label={f.label} className={f.key === "name" ? "sm:col-span-2" : undefined}>
            <Input placeholder={f.placeholder} value={form[f.key]} onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))} />
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

"use client";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Download, ListMinus, ListPlus, MailSearch, Send, ShieldCheck, Trash2, Users } from "lucide-react";
import { fullName, post, timeAgo, useApi } from "@/lib/client";
import type { Contact } from "@/lib/types";
import { Avatar, Button, Card, Empty, ErrorNote, Input, Loading, Score, Select, Table, Td, Th } from "@/components/app/ui";
import { ContactDrawer } from "./ContactDrawer";
import { AddToListModal, AddToSequenceModal, type ListRow } from "./modals";
import { BulkBar, Checkbox, CONTACT_STATUSES, EmailCell, LinkedInLink, Notice, Pagination, StatusBadge, useDebounced } from "./shared";

export type PeopleFilters = {
  q: string;
  status: string;
  listId: string;
  companyId: string;
  emailStatus: string;
  minScore: string;
  maxScore: string;
  sort: string;
};

export const EMPTY_FILTERS: PeopleFilters = { q: "", status: "", listId: "", companyId: "", emailStatus: "", minScore: "", maxScore: "", sort: "created" };

const PAGE = 50;

type BulkResult = { ok: number; failed: number; error: string | null; truncated: boolean };

/**
 * The full People table: filters, pagination, selection + bulk actions, and the contact drawer.
 * Used by /contacts and /lists/[id] (with a fixed listId).
 */
export function PeopleTable({
  initial,
  fixedListId,
  initialOpenId,
  toolbarExtra,
  emptyAction,
  reloadKey = 0,
}: {
  initial?: Partial<PeopleFilters>;
  fixedListId?: string;
  initialOpenId?: string | null;
  toolbarExtra?: ReactNode;
  emptyAction?: ReactNode;
  reloadKey?: number;
}) {
  const [f, setF] = useState<PeopleFilters>({ ...EMPTY_FILTERS, ...initial, ...(fixedListId ? { listId: fixedListId } : {}) });
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(initialOpenId || null);
  const [modal, setModal] = useState<"list" | "sequence" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const q = useDebounced(f.q, 300);

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    for (const k of ["status", "listId", "companyId", "emailStatus", "minScore", "maxScore", "sort"] as const) if (f[k]) p.set(k, f[k]);
    return p;
  }, [q, f]);

  const url = `/api/contacts?${params.toString()}&limit=${PAGE}&offset=${offset}&_k=${reloadKey}`;
  const { data, error: loadError, loading, reload } = useApi<{ contacts: Contact[]; total: number }>(url);
  const { data: listsData } = useApi<{ lists: ListRow[] }>(fixedListId ? null : "/api/lists");

  const set = (patch: Partial<PeopleFilters>) => {
    setF((s) => ({ ...s, ...patch }));
    setOffset(0);
    setSel(new Set());
  };

  const contacts = data?.contacts || [];
  const ids = [...sel];
  const pageAllSelected = contacts.length > 0 && contacts.every((c) => sel.has(c.id));

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const bulk = async (name: string, body: Record<string, unknown>, msg: (r: Record<string, unknown>) => string) => {
    setBusy(name);
    setError(null);
    try {
      const r = await post<Record<string, unknown>>("/api/contacts/bulk", { ids, ...body });
      setNotice(msg(r));
      const e = (r as Partial<BulkResult>).error;
      if (e) setError(e);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const perRecord = (verb: string) => (r: Record<string, unknown>) => {
    const b = r as unknown as BulkResult;
    return `${verb} ${b.ok}${b.failed ? ` · ${b.failed} failed` : ""}${b.truncated ? " (batch limit reached — run again for the rest)" : ""}`;
  };

  const exportHref = `/api/contacts/export?${sel.size ? `ids=${ids.join(",")}` : params.toString()}`;
  const onChanged = useCallback(() => reload(), [reload]);
  const clearNotice = useCallback(() => setNotice(null), []);
  const hasFilters = !!(q || f.status || f.emailStatus || f.minScore || f.maxScore || (!fixedListId && (f.listId || f.companyId)));

  return (
    <>
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="!w-full sm:!w-64" placeholder="Search name, email, title, company…" value={f.q} onChange={(e) => set({ q: e.target.value })} />
        <Select className="!w-auto" value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">All statuses</option>
          {CONTACT_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        {!fixedListId && (
          <Select className="!w-auto max-w-[180px]" value={f.listId} onChange={(e) => set({ listId: e.target.value })} aria-label="List">
            <option value="">All lists</option>
            {listsData?.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </Select>
        )}
        <Select className="!w-auto" value={f.emailStatus} onChange={(e) => set({ emailStatus: e.target.value })} aria-label="Email status">
          <option value="">Any email</option>
          <option value="valid">Valid email</option>
          <option value="risky">Risky email</option>
          <option value="invalid">Invalid email</option>
          <option value="unknown">Unverified email</option>
          <option value="missing">No email</option>
        </Select>
        <div className="flex items-center gap-1">
          <Input className="!w-[92px]" type="number" min={0} max={100} placeholder="Min score" value={f.minScore} onChange={(e) => set({ minScore: e.target.value })} aria-label="Minimum score" />
          <span className="text-zinc-400">–</span>
          <Input className="!w-[72px]" type="number" min={0} max={100} placeholder="Max" value={f.maxScore} onChange={(e) => set({ maxScore: e.target.value })} aria-label="Maximum score" />
        </div>
        <Select className="!w-auto" value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
          <option value="created">Newest</option>
          <option value="updated">Recently updated</option>
          <option value="score">Highest score</option>
          <option value="name">Name A–Z</option>
        </Select>
        {f.companyId && !fixedListId && (
          <Button size="sm" variant="ghost" onClick={() => set({ companyId: "" })}>
            Company filter ×
          </Button>
        )}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={() => set({ ...EMPTY_FILTERS, ...(fixedListId ? { listId: fixedListId } : {}) })}>
            Reset
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbarExtra}
          <a href={exportHref} download className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50">
            <Download className="size-3.5" /> Export{sel.size ? ` ${sel.size}` : ""}
          </a>
        </div>
      </div>

      <Card className="overflow-hidden">
        <BulkBar count={sel.size} onClear={() => setSel(new Set())}>
          <Button size="sm" icon={<ListPlus className="size-3.5" />} onClick={() => setModal("list")} disabled={!!busy}>
            Add to list
          </Button>
          {fixedListId && (
            <Button size="sm" icon={<ListMinus className="size-3.5" />} disabled={!!busy} loading={busy === "remove"} onClick={() => bulk("remove", { action: "remove_from_list", listId: fixedListId }, (r) => `Removed ${r.removed} from list`).then(() => setSel(new Set()))}>
              Remove from list
            </Button>
          )}
          <Button size="sm" icon={<Send className="size-3.5" />} onClick={() => setModal("sequence")} disabled={!!busy}>
            Sequence
          </Button>
          <Button size="sm" variant="ai" loading={busy === "score"} disabled={!!busy} onClick={() => bulk("score", { action: "score" }, (r) => `Scored ${(r.scores as unknown[]).length}`)}>
            Score
          </Button>
          <Button size="sm" variant="ai" loading={busy === "enrich"} disabled={!!busy} onClick={() => bulk("enrich", { action: "enrich" }, perRecord("Enriched"))}>
            Enrich
          </Button>
          <Button size="sm" icon={<MailSearch className="size-3.5" />} loading={busy === "find"} disabled={!!busy} onClick={() => bulk("find", { action: "find_email" }, perRecord("Email search ran for"))}>
            Find emails
          </Button>
          <Button size="sm" icon={<ShieldCheck className="size-3.5" />} loading={busy === "verify"} disabled={!!busy} onClick={() => bulk("verify", { action: "verify_email" }, perRecord("Verified"))}>
            Verify
          </Button>
          <Select
            className="!h-7 !w-auto !text-[12px]"
            value=""
            disabled={!!busy}
            aria-label="Set status"
            onChange={(e) => e.target.value && bulk("status", { action: "set_status", status: e.target.value }, (r) => `Updated ${r.updated}`)}
          >
            <option value="">Set status…</option>
            {CONTACT_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" />}
            loading={busy === "delete"}
            disabled={!!busy}
            onClick={() => {
              if (!confirm(`Delete ${sel.size} ${sel.size === 1 ? "person" : "people"}? This can't be undone.`)) return;
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
        ) : contacts.length === 0 ? (
          <Empty
            icon={<Users className="size-5" />}
            title={hasFilters ? "No people match these filters" : fixedListId ? "This list is empty" : "No people yet"}
            body={hasFilters ? "Try clearing a filter or searching for something else." : "Find leads with AI, import a CSV, or add people manually."}
            action={!hasFilters ? emptyAction : undefined}
          />
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : undefined}>
            <Table>
              <thead>
                <tr>
                  <Th className="w-8">
                    <Checkbox
                      label="Select page"
                      checked={pageAllSelected}
                      indeterminate={contacts.some((c) => sel.has(c.id))}
                      onChange={(on) =>
                        setSel((s) => {
                          const n = new Set(s);
                          for (const c of contacts) {
                            if (on) n.add(c.id);
                            else n.delete(c.id);
                          }
                          return n;
                        })
                      }
                    />
                  </Th>
                  <Th>Name</Th>
                  <Th>Company</Th>
                  <Th>Email</Th>
                  <Th>Status</Th>
                  <Th>Score</Th>
                  <Th className="hidden lg:table-cell">Location</Th>
                  <Th className="hidden xl:table-cell">Added</Th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className={sel.has(c.id) ? "cursor-pointer bg-brand-50/40" : "cursor-pointer hover:bg-zinc-50/70"} onClick={() => setOpenId(c.id)}>
                    <Td>
                      <Checkbox label={`Select ${fullName(c)}`} checked={sel.has(c.id)} onChange={() => toggle(c.id)} />
                    </Td>
                    <Td>
                      <div className="flex min-w-[180px] items-center gap-2">
                        <Avatar name={fullName(c)} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-zinc-900">
                            <span className="truncate">{fullName(c)}</span> <LinkedInLink url={c.linkedin_url} />
                          </div>
                          <div className="max-w-[240px] truncate text-xs text-zinc-500">{c.title || "—"}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="max-w-[180px] truncate">{c.company_name || <span className="text-zinc-400">—</span>}</div>
                    </Td>
                    <Td>
                      <EmailCell email={c.email} status={c.email_status} />
                    </Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                    <Td>
                      <span title={c.score_reason || undefined}>
                        <Score value={c.score} />
                      </span>
                    </Td>
                    <Td className="hidden max-w-[160px] truncate lg:table-cell">{c.location || <span className="text-zinc-400">—</span>}</Td>
                    <Td className="hidden whitespace-nowrap text-xs text-zinc-500 xl:table-cell">{timeAgo(c.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination total={data?.total || 0} limit={PAGE} offset={offset} onChange={setOffset} />
          </div>
        )}
      </Card>

      {openId && <ContactDrawer key={openId} contactId={openId} onClose={() => setOpenId(null)} onChanged={onChanged} />}
      {modal === "list" && <AddToListModal open onClose={() => setModal(null)} contactIds={ids} onDone={(m) => (setNotice(m), reload())} />}
      {modal === "sequence" && <AddToSequenceModal open onClose={() => setModal(null)} contactIds={ids} onDone={(m) => (setNotice(m), reload())} />}
      <Notice text={notice} onDone={clearNotice} />
    </>
  );
}

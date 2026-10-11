"use client";
import { useState } from "react";
import Link from "next/link";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { del, timeAgo, useApi } from "@/lib/client";
import { Button, Card, Empty, ErrorNote, Loading, PageHeader, Table, Td, Th } from "@/components/app/ui";
import { ListNameModal } from "@/components/prospect/ListNameModal";
import type { ListRow } from "@/components/prospect/modals";

export default function ListsPage() {
  const { data, error, loading, reload } = useApi<{ lists: ListRow[] }>("/api/lists");
  const [editing, setEditing] = useState<{ id?: string; name: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async (l: ListRow) => {
    if (!confirm(`Delete the list “${l.name}”? People in it are kept.`)) return;
    setActionError(null);
    try {
      await del(`/api/lists/${l.id}`);
      reload();
    } catch (e) {
      setActionError((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Lists"
        subtitle="Group people for campaigns, sequences and exports."
        actions={
          <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEditing({ name: "" })}>
            New list
          </Button>
        }
      />
      <div className="mb-3">
        <ErrorNote error={actionError} />
      </div>
      <Card className="overflow-hidden">
        {error ? (
          <div className="p-4">
            <ErrorNote error={error} />
          </div>
        ) : loading && !data ? (
          <Loading />
        ) : !data?.lists.length ? (
          <Empty
            icon={<ListChecks className="size-5" />}
            title="No lists yet"
            body="Create a list here, or save AI-discovered leads straight into a new list from Find leads."
            action={
              <Button variant="primary" icon={<Plus className="size-3.5" />} onClick={() => setEditing({ name: "" })}>
                New list
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>People</Th>
                <Th className="hidden sm:table-cell">Created</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {data.lists.map((l) => (
                <tr key={l.id} className="hover:bg-zinc-50/70">
                  <Td>
                    <Link href={`/lists/${l.id}`} className="font-medium text-zinc-900 hover:underline">
                      {l.name}
                    </Link>
                  </Td>
                  <Td className="tabular-nums">{l.member_count.toLocaleString()}</Td>
                  <Td className="hidden text-xs text-zinc-500 sm:table-cell">{timeAgo(l.created_at)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" aria-label="Rename" icon={<Pencil className="size-3.5" />} onClick={() => setEditing({ id: l.id, name: l.name })} />
                      <Button size="sm" variant="ghost" aria-label="Delete" icon={<Trash2 className="size-3.5 text-red-500" />} onClick={() => remove(l)} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {editing && <ListNameModal initial={editing} onClose={() => setEditing(null)} onSaved={() => reload()} />}
    </div>
  );
}

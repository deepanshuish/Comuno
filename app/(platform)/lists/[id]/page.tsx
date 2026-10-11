"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, UserPlus } from "lucide-react";
import { del, useApi } from "@/lib/client";
import { Button, ErrorNote, Loading, PageHeader } from "@/components/app/ui";
import { PeopleTable } from "@/components/prospect/PeopleTable";
import { ListNameModal } from "@/components/prospect/ListNameModal";

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, error, reload } = useApi<{ list: { id: string; name: string; created_at: string } }>(`/api/lists/${id}`);
  const [renaming, setRenaming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/lists" className="inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800">
          <ArrowLeft className="size-3.5" /> Lists
        </Link>
        <ErrorNote error={error} />
      </div>
    );
  }
  if (!data) return <Loading />;

  return (
    <div>
      <Link href="/lists" className="mb-2 inline-flex items-center gap-1 text-[13px] text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="size-3.5" /> Lists
      </Link>
      <PageHeader
        title={data.list.name}
        subtitle="People in this list. Select people to enrich, verify, score or enroll them in a sequence."
        actions={
          <>
            <Button icon={<Pencil className="size-3.5" />} onClick={() => setRenaming(true)}>
              Rename
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 className="size-3.5" />}
              onClick={async () => {
                if (!confirm(`Delete the list “${data.list.name}”? People in it are kept.`)) return;
                try {
                  await del(`/api/lists/${id}`);
                  router.push("/lists");
                } catch (e) {
                  setActionError((e as Error).message);
                }
              }}
            >
              Delete
            </Button>
          </>
        }
      />
      <div className="mb-3">
        <ErrorNote error={actionError} />
      </div>
      <PeopleTable
        fixedListId={id}
        emptyAction={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/prospect" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 text-[13px] font-medium text-white hover:bg-violet-500">
              Find leads
            </Link>
            <Link href="/contacts" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50">
              <UserPlus className="size-3.5" /> Add from People
            </Link>
          </div>
        }
      />
      {renaming && <ListNameModal initial={{ id, name: data.list.name }} onClose={() => setRenaming(false)} onSaved={() => reload()} />}
    </div>
  );
}

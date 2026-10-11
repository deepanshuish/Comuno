import { bad, body, route } from "@/lib/api";
import { createList, importContacts } from "@/lib/services/prospect";

type Row = Record<string, string | null | undefined>;

/** POST { rows: [{ first_name, last_name, full_name, email, title, company, domain, phone, linkedin_url, location }], listId?, newListName? } */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ rows?: Row[]; listId?: string; newListName?: string }>(req);
  if (!Array.isArray(b.rows) || !b.rows.length) bad("No rows to import");
  let listId = b.listId || undefined;
  if (!listId && b.newListName?.trim()) listId = await createList(ctx.workspace.id, b.newListName);
  const r = await importContacts(ctx.workspace.id, b.rows, { listId });
  return { created: r.created, duplicates: r.duplicates, invalid: r.invalid, total: b.rows.length, listId: listId ?? null };
});

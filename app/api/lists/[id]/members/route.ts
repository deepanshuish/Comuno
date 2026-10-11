import { bad, body, route } from "@/lib/api";
import { addToList, removeFromList, searchContacts } from "@/lib/services/prospect";

type P = { id: string };

/** GET ?q&limit&offset — contacts in the list. */
export const GET = route<P>(async ({ req, ctx, params }) => {
  const s = new URL(req.url).searchParams;
  return searchContacts(ctx.workspace.id, {
    listId: params.id,
    q: s.get("q") || undefined,
    limit: s.get("limit") ? Number(s.get("limit")) : undefined,
    offset: s.get("offset") ? Number(s.get("offset")) : undefined,
  });
});

/** POST { contactIds } */
export const POST = route<P>(async ({ req, ctx, params }) => {
  const { contactIds } = await body<{ contactIds?: string[] }>(req);
  if (!contactIds?.length) bad("No contacts given");
  return { added: await addToList(ctx.workspace.id, params.id, contactIds) };
});

/** DELETE { contactIds } */
export const DELETE = route<P>(async ({ req, ctx, params }) => {
  const { contactIds } = await body<{ contactIds?: string[] }>(req);
  if (!contactIds?.length) bad("No contacts given");
  return { removed: await removeFromList(ctx.workspace.id, params.id, contactIds) };
});

import { body, route } from "@/lib/api";
import { addToList, createList, getLists } from "@/lib/services/prospect";

export const GET = route(async ({ ctx }) => ({ lists: await getLists(ctx.workspace.id) }));

/** POST { name, contactIds? } */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ name?: string; contactIds?: string[] }>(req);
  const id = await createList(ctx.workspace.id, b.name || "");
  const added = b.contactIds?.length ? await addToList(ctx.workspace.id, id, b.contactIds) : 0;
  return { id, added };
});

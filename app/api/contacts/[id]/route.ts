import { body, route } from "@/lib/api";
import { deleteContacts, getContactDetail, updateContact } from "@/lib/services/prospect";

type P = { id: string };

export const GET = route<P>(async ({ ctx, params }) => getContactDetail(ctx.workspace.id, params.id));

export const PATCH = route<P>(async ({ req, ctx, params }) => {
  const b = await body<Record<string, unknown>>(req);
  return { contact: await updateContact(ctx.workspace.id, params.id, b) };
});

export const DELETE = route<P>(async ({ ctx, params }) => ({ deleted: await deleteContacts(ctx.workspace.id, [params.id]) }));

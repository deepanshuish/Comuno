import { body, route } from "@/lib/api";
import { deleteList, getList, renameList } from "@/lib/services/prospect";

type P = { id: string };

export const GET = route<P>(async ({ ctx, params }) => ({ list: await getList(ctx.workspace.id, params.id) }));

export const PATCH = route<P>(async ({ req, ctx, params }) => {
  const { name } = await body<{ name?: string }>(req);
  await renameList(ctx.workspace.id, params.id, name || "");
  return { list: await getList(ctx.workspace.id, params.id) };
});

export const DELETE = route<P>(async ({ ctx, params }) => {
  await deleteList(ctx.workspace.id, params.id);
  return { ok: true };
});

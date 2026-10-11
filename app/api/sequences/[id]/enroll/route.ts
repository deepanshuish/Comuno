import { bad, body, route } from "@/lib/api";
import { enrollContacts, pickContacts } from "@/lib/services/engage";

/** Enroll contacts by id and/or every member of a list. */
export const POST = route<{ id: string }>(async ({ req, ctx, params }) => {
  const b = await body<{ contactIds?: string[]; listId?: string }>(req);
  const ids = new Set(Array.isArray(b.contactIds) ? b.contactIds : []);
  if (b.listId) {
    const { contacts } = await pickContacts(ctx.workspace.id, { listId: b.listId, limit: 1000 });
    contacts.forEach((c) => ids.add(c.id));
  }
  if (!ids.size) bad("Pick at least one contact");
  return enrollContacts(ctx.workspace.id, params.id, [...ids]);
});

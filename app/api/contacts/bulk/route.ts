import { bad, body, route } from "@/lib/api";
import {
  addToList, createList, deleteContacts, enrichContact, findEmail, removeFromList, runBulk, scoreContacts,
  setContactStatus, verifyContactEmail,
} from "@/lib/services/prospect";

type Action = "delete" | "score" | "enrich" | "find_email" | "verify_email" | "add_to_list" | "remove_from_list" | "set_status";

/** POST { action, ids, listId?, newListName?, status? } — bulk operations on contacts. */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<{ action?: Action; ids?: string[]; listId?: string; newListName?: string; status?: string }>(req);
  const ids = Array.isArray(b.ids) ? b.ids.filter((x) => typeof x === "string") : [];
  if (!ids.length) bad("Select at least one contact");
  const ws = ctx.workspace;
  switch (b.action) {
    case "delete":
      return { deleted: await deleteContacts(ws.id, ids) };
    case "set_status":
      return { updated: await setContactStatus(ws.id, ids, b.status || "") };
    case "add_to_list": {
      let listId = b.listId;
      if (!listId && b.newListName?.trim()) listId = await createList(ws.id, b.newListName);
      if (!listId) bad("Choose a list");
      return { added: await addToList(ws.id, listId, ids), listId };
    }
    case "remove_from_list":
      if (!b.listId) bad("Choose a list");
      return { removed: await removeFromList(ws.id, b.listId, ids) };
    case "score": {
      const scores = await scoreContacts(ws, ids);
      return { scores, credits: ws.credits };
    }
    case "enrich":
      return { ...(await runBulk(ids, 25, (id) => enrichContact(ws, id).then(() => true))), credits: ws.credits };
    case "find_email":
      return { ...(await runBulk(ids, 50, (id) => findEmail(ws, id))), credits: ws.credits };
    case "verify_email":
      return { ...(await runBulk(ids, 200, (id) => verifyContactEmail(ws, id))), credits: ws.credits };
    default:
      bad("Unknown action");
  }
});

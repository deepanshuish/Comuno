import { body, route } from "@/lib/api";
import { contactFiltersFromUrl, createContact, searchContacts } from "@/lib/services/prospect";

/** GET ?q&status&listId&companyId&emailStatus&minScore&maxScore&sort&limit&offset */
export const GET = route(async ({ req, ctx }) => searchContacts(ctx.workspace.id, contactFiltersFromUrl(req.url)));

/** POST { first_name, last_name, email, title, company, domain, ... } — create one contact. */
export const POST = route(async ({ req, ctx }) => {
  const b = await body<Record<string, string | null>>(req);
  const r = await createContact(ctx.workspace.id, { ...b, source: "manual" });
  return { id: r.id, created: r.created };
});

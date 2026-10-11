import { body, route } from "@/lib/api";
import { deleteCompanies, getCompanyDetail, updateCompany } from "@/lib/services/prospect";

type P = { id: string };

export const GET = route<P>(async ({ ctx, params }) => getCompanyDetail(ctx.workspace.id, params.id));

export const PATCH = route<P>(async ({ req, ctx, params }) => ({ company: await updateCompany(ctx.workspace.id, params.id, await body(req)) }));

export const DELETE = route<P>(async ({ req, ctx, params }) => {
  const withPeople = new URL(req.url).searchParams.get("withPeople") === "1";
  return { deleted: await deleteCompanies(ctx.workspace.id, [params.id], { withPeople }) };
});

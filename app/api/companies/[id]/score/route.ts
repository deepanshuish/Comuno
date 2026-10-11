import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { scoreCompanies } from "@/lib/services/prospect";

export const POST = route<{ id: string }>(async ({ ctx, params }) => {
  const [r] = await scoreCompanies(ctx.workspace, [params.id]);
  if (!r) throw new HttpError(404, "Company not found");
  return { ...r, credits: ctx.workspace.credits };
});

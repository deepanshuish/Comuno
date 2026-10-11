import { route } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { scoreContacts } from "@/lib/services/prospect";

export const POST = route<{ id: string }>(async ({ ctx, params }) => {
  const [r] = await scoreContacts(ctx.workspace, [params.id]);
  if (!r) throw new HttpError(404, "Contact not found");
  return { ...r, credits: ctx.workspace.credits };
});

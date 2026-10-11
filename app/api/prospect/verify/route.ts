import { bad, body, route } from "@/lib/api";
import { withCredits } from "@/lib/credits";
import { verifyEmail } from "@/lib/services/prospect";

/** POST { email } — standalone email verification (syntax, disposable, role account, MX). */
export const POST = route(async ({ req, ctx }) => {
  const { email } = await body<{ email?: string }>(req);
  if (!email?.trim()) bad("Enter an email address");
  const r = await withCredits(ctx.workspace, "verify_email", 1, () => verifyEmail(email));
  return { email: email.trim().toLowerCase(), ...r };
});

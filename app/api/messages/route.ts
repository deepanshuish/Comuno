import { body, route } from "@/lib/api";
import { rememberOrigin } from "@/lib/mailer";
import { sendEmail } from "@/lib/services/engage";

/** Send a one-off email (compose or reply) to a contact. */
export const POST = route(async ({ req, ctx }) => {
  rememberOrigin(req);
  const b = await body<{ contactId: string; subject: string; body: string }>(req);
  const message = await sendEmail(ctx.workspace, { contactId: b.contactId, subject: b.subject, body: b.body });
  return { message };
});

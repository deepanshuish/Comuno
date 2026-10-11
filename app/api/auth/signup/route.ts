import { body, publicRoute } from "@/lib/api";
import { createUser, HttpError, startSession } from "@/lib/auth";

export const POST = publicRoute(async ({ req }) => {
  const { email, password, name, company } = await body<{ email?: string; password?: string; name?: string; company?: string }>(req);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address");
  if (!password || password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  const userId = await createUser({ email, password, name, company });
  await startSession(userId);
  return { ok: true };
});

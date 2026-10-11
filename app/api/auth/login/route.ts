import { body, publicRoute } from "@/lib/api";
import { HttpError, startSession, verifyPassword } from "@/lib/auth";
import { one } from "@/lib/db";

export const POST = publicRoute(async ({ req }) => {
  const { email, password } = await body<{ email?: string; password?: string }>(req);
  if (!email || !password) throw new HttpError(400, "Email and password are required");
  const user = await one<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = ?",
    [email.trim().toLowerCase()],
  );
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw new HttpError(401, "Incorrect email or password");
  }
  await startSession(user.id);
  return { ok: true };
});

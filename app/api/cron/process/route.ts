import { timingSafeEqual } from "node:crypto";
import { errorResponse, route } from "@/lib/api";
import { rememberOrigin } from "@/lib/mailer";
import { processDue } from "@/lib/services/engage";

/**
 * Runs the sequence engine.
 *
 * - `Authorization: Bearer $CRON_SECRET` → processes every workspace. Point an external scheduler
 *   (cron-job.org, GitHub Actions, Render/Vercel cron, or `crontab` + curl) here every 5–10 minutes:
 *     curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/process
 * - Otherwise requires a signed-in session (or API key) and processes only that workspace ("Run now").
 */
export const maxDuration = 300;

function isCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || !auth.startsWith("Bearer ")) return false;
  const a = Buffer.from(auth.slice(7).trim());
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const userRun = route(async ({ req, ctx }) => {
  rememberOrigin(req);
  return processDue(ctx.workspace.id);
});

async function handler(req: Request) {
  if (isCron(req)) {
    try {
      rememberOrigin(req);
      return Response.json({ scope: "all", ...(await processDue()) });
    } catch (e) {
      return errorResponse(e);
    }
  }
  return userRun(req);
}

export const POST = handler;
export const GET = handler;

import { route } from "@/lib/api";
import { DEFAULT_MODEL, generateText } from "@/lib/gemini";

export const POST = route(async ({ ctx }) => {
  const started = Date.now();
  const { text } = await generateText({ workspace: ctx.workspace, prompt: "Reply with exactly: Comuno AI engine online." });
  return { ok: true, model: DEFAULT_MODEL, reply: text, ms: Date.now() - started };
});

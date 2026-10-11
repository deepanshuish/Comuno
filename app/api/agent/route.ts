import { bad, body, errorResponse, route } from "@/lib/api";
import { runAgentTurn, type AgentEvent } from "@/lib/services/agent";

export const maxDuration = 300;

/** Run an agent turn, streaming display events as newline-delimited JSON. */
export const POST = route(async ({ req, ctx }) => {
  const { message, threadId } = await body<{ message?: string; threadId?: string }>(req);
  if (!message?.trim()) bad("Message is empty");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent | { kind: "fatal"; error: string }) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        const id = await runAgentTurn(ctx, { message: message!, threadId }, emit);
        emit({ kind: "done", threadId: id });
      } catch (e) {
        const res = errorResponse(e);
        const { error } = (await res.json()) as { error: string };
        emit({ kind: "fatal", error });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
});

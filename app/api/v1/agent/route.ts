import { bad, body, route } from "@/lib/api";
import { runAgentTurn, type AgentEvent } from "@/lib/services/agent";

export const maxDuration = 300;

/** Public API: run one agent turn and return all events (non-streaming). */
export const POST = route(async ({ req, ctx }) => {
  const { message, threadId } = await body<{ message?: string; threadId?: string }>(req);
  if (!message?.trim()) bad("message is required");
  const events: AgentEvent[] = [];
  const id = await runAgentTurn(ctx, { message: message!, threadId }, (e) => events.push(e));
  const reply = events.filter((e) => e.kind === "assistant").map((e) => (e as { text: string }).text).join("\n\n");
  return { threadId: id, reply, events };
});

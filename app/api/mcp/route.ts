import { getCtx } from "@/lib/auth";
import { AGENT_TOOLS, runTool } from "@/lib/services/agent-tools";

/**
 * Comuno MCP server (Streamable HTTP transport, stateless, JSON responses).
 * Lets Claude and other MCP clients use Comuno's agent tools.
 * Auth: `Authorization: Bearer <Comuno API key>` (Settings → API & integrations).
 */

export const maxDuration = 300;

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

type RpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const rpcResult = (id: RpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: RpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) {
    return Response.json(rpcError(null, -32001, "Unauthorized: pass a Comuno API key as a Bearer token"), {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="comuno"' },
    });
  }

  let payload: RpcRequest | RpcRequest[];
  try {
    payload = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }

  const handle = async (msg: RpcRequest) => {
    switch (msg.method) {
      case "initialize": {
        const requested = String(msg.params?.protocolVersion || "");
        return rpcResult(msg.id, {
          protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "comuno", title: "Comuno", version: "1.0.0" },
          instructions:
            "Comuno is an AI outbound sales platform. Use these tools to find and enrich prospects, research accounts, write and send outreach, run sequences and manage deals in the user's Comuno workspace. send_email and enroll_in_sequence contact real people: confirm with the user first.",
        });
      }
      case "ping":
        return rpcResult(msg.id, {});
      case "tools/list":
        return rpcResult(msg.id, {
          tools: AGENT_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.parameters,
            annotations: t.approval ? { destructiveHint: false, openWorldHint: true, readOnlyHint: false } : undefined,
          })),
        });
      case "tools/call": {
        const name = String(msg.params?.name || "");
        const args = (msg.params?.arguments as Record<string, unknown>) || {};
        const out = await runTool(ctx, name, args);
        return rpcResult(msg.id, {
          content: [{ type: "text", text: JSON.stringify(out.ok ? out.result : { error: out.error }, null, 2) }],
          isError: !out.ok,
        });
      }
      default:
        if (msg.id === undefined) return null; // notification (e.g. notifications/initialized)
        return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
    }
  };

  if (Array.isArray(payload)) {
    const results = (await Promise.all(payload.map(handle))).filter(Boolean);
    return results.length ? Response.json(results) : new Response(null, { status: 202 });
  }
  const result = await handle(payload);
  return result ? Response.json(result) : new Response(null, { status: 202 });
}

export async function GET() {
  // No server-initiated SSE stream in this stateless server.
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}

import { bad, body, route } from "@/lib/api";
import { resolveApproval } from "@/lib/services/agent";

export const POST = route<{ id: string }>(async ({ req, ctx, params }) => {
  const { decision } = await body<{ decision?: string }>(req);
  if (decision !== "approve" && decision !== "reject") bad("decision must be approve or reject");
  return resolveApproval(ctx, params.id, decision);
});

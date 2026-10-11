import { trackClick } from "@/lib/services/engage";

/** Click tracking redirect. Only redirects to URLs that appear in the tracked message (no open redirect). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url).searchParams.get("u") || "";
  let dest: string | null = null;
  try {
    dest = await trackClick(id, url);
  } catch (e) {
    console.error("[track] click failed", e);
  }
  if (!dest) return new Response("Link not found", { status: 404 });
  return Response.redirect(dest, 302);
}

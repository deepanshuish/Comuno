import { trackOpen } from "@/lib/services/engage";

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Email open-tracking pixel. Public; the message id is unguessable. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await trackOpen(id.replace(/\.gif$/, ""));
  } catch (e) {
    console.error("[track] open failed", e);
  }
  return new Response(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}

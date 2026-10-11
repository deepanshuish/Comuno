import { route } from "@/lib/api";
import { contactFiltersFromUrl, exportContactsCsv } from "@/lib/services/prospect";

/** GET (same filters as /api/contacts, plus ids=a,b,c) — CSV download, up to 1,000 rows. */
export const GET = route(async ({ req, ctx }) => {
  const csv = await exportContactsCsv(ctx.workspace.id, contactFiltersFromUrl(req.url));
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="comuno-people-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

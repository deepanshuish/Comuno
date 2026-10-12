import { machineMarkdown } from "@/components/landing/machine";

export async function GET(req: Request) {
  return new Response(machineMarkdown(new URL(req.url).origin), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}

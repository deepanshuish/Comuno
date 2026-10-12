import Link from "next/link";
import { headers } from "next/headers";
import Markdown from "@/components/agent/Markdown";
import { machineMarkdown } from "@/components/landing/machine";

export const metadata = { title: "Comuno — Machine version" };

export default async function MachineVersion() {
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") || "http"}://${h.get("host") || "localhost:3000"}`;
  return (
    <div className="min-h-screen bg-[#f7f7f5] text-zinc-900">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="mb-8 inline-flex rounded-lg border border-zinc-900/10 bg-white p-1 text-[13px]">
          <Link href="/" className="rounded-md px-3 py-1.5 text-zinc-600 hover:text-zinc-900">
            Human
          </Link>
          <span className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white">Machine</span>
        </div>
        <div className="rounded-2xl border border-zinc-900/10 bg-white p-6 font-mono sm:p-8">
          <Markdown text={machineMarkdown(origin)} />
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Raw markdown: <a className="underline" href="/llms.txt">/llms.txt</a>
        </p>
      </div>
    </div>
  );
}

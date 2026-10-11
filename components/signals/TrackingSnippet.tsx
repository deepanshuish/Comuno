"use client";
import { useState } from "react";
import { Check, CircleCheck, Code2, Copy } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/app/ui";

/** Install instructions for the website tracking script, with copy-to-clipboard. */
export function TrackingSnippet({ snippet, installed, defaultOpen }: { snippet: string; installed: boolean; defaultOpen?: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen ?? !installed);
  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  const identify = `<script>\n  // after sign-up / login / form submit:\n  window.comuno && window.comuno.identify("jane@acme.com");\n</script>`;
  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Code2 className="size-4 text-zinc-400" /> Tracking pixel
            {installed ? (
              <Badge tone="green">
                <CircleCheck className="size-3" /> Receiving data
              </Badge>
            ) : (
              <Badge tone="amber">Not installed</Badge>
            )}
          </span>
        }
        subtitle="Identify the companies and people visiting your website."
        actions={
          <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "Hide" : "Install"}
          </Button>
        }
      />
      {open && (
        <div className="space-y-4 px-5 py-4 text-[13px] text-zinc-600">
          <div>
            <p className="mb-2">
              1. Paste this before <code className="rounded bg-zinc-100 px-1 text-[12px]">&lt;/head&gt;</code> on every page of your site:
            </p>
            <CodeBlock code={snippet} copied={copied === "snippet"} onCopy={() => copy(snippet, "snippet")} />
          </div>
          <div>
            <p className="mb-2">
              2. Optional — identify people. Any page opened with <code className="rounded bg-zinc-100 px-1 text-[12px]">?cid=&lt;contact id&gt;</code> or{" "}
              <code className="rounded bg-zinc-100 px-1 text-[12px]">?email=</code> in the URL (e.g. links in your outbound emails) is tied to that person, and
              you can call <code className="rounded bg-zinc-100 px-1 text-[12px]">identify()</code> after sign-up or login:
            </p>
            <CodeBlock code={identify} copied={copied === "identify"} onCopy={() => copy(identify, "identify")} />
          </div>
          <p className="text-xs text-zinc-500">
            Companies are matched from the visitor&apos;s network (ISPs, mobile carriers and cloud providers are ignored). The script is ~1.5 KB,
            async, respects Do Not Track and stores only a random first-party visitor id.
          </p>
        </div>
      )}
    </Card>
  );
}

function CodeBlock({ code, copied, onCopy }: { code: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-zinc-900 p-3 pr-20 text-[12px] leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
      <button
        onClick={onCopy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-white hover:bg-white/20"
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

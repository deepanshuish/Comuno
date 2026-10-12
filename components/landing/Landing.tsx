"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Bot, Check, Copy, Menu, Minus, Plus, Sparkles, X } from "lucide-react";
import Logo from "@/components/Logo";
import { AGENT_PROMPTS, FAQ, HOW_IT_WORKS, PLANS, PRODUCTS, ROTATING, TRUST } from "./content";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="min-h-screen bg-[#f6f5f1] font-sans text-zinc-900 antialiased">
      <Announcement />
      <Nav signedIn={signedIn} />
      <Hero signedIn={signedIn} />
      <ProductShot />
      <How />
      <Offer />
      <AgentSection />
      <Trust />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── Chrome ─────────────────────────────────────────────────────────── */

function Announcement() {
  return (
    <div className="bg-zinc-950 px-4 py-2 text-center text-[12.5px] text-zinc-300">
      <span className="mr-2 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">New</span>
      Comuno now works inside Claude. Give your agent the ability to prospect, write and run outreach.{" "}
      <Link href="/signup" className="font-medium text-white underline-offset-4 hover:underline">
        Connect over MCP →
      </Link>
    </div>
  );
}

function Nav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-900/5 bg-[#f6f5f1]/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={24} />
          <span className="text-[17px] font-semibold tracking-tight">comuno</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-zinc-600 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-zinc-900">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Link href="/dashboard" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
              Open app
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50">
                Login
              </Link>
              <Link href="/signup" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                Start for free
              </Link>
            </>
          )}
        </div>
        <button className="ml-auto rounded-md p-1.5 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-zinc-900/5 px-4 pb-5 pt-2 md:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block border-b border-zinc-900/5 py-3 text-[15px] text-zinc-700">
              {n.label}
            </a>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={signedIn ? "/dashboard" : "/login"} className="rounded-lg border border-zinc-300 bg-white py-2.5 text-center text-sm font-medium">
              {signedIn ? "Open app" : "Login"}
            </Link>
            <Link href="/signup" className="rounded-lg bg-zinc-900 py-2.5 text-center text-sm font-medium text-white">
              Start for free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────── */

function Rotator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % ROTATING.length), 2200);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="relative inline-block min-w-[3ch] text-orange-600">
      <span key={i} className="inline-block animate-[rot_0.5s_ease-out]">
        {ROTATING[i]}
      </span>
      <style>{`@keyframes rot{from{opacity:0;transform:translateY(0.35em)}to{opacity:1;transform:none}}`}</style>
    </span>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  const [origin, setOrigin] = useState("https://your-comuno-host");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    // Read the real host after hydration; the server render uses a placeholder.
    const id = requestAnimationFrame(() => setOrigin(window.location.origin));
    return () => cancelAnimationFrame(id);
  }, []);
  const mcpUrl = `${origin}/api/mcp`;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
      <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
        <span className="size-2.5 bg-orange-500" /> Powered by <span className="text-orange-600">Google Gemini</span>
      </div>
      <h1 className="mt-5 max-w-4xl font-serif text-[44px] leading-[1.02] tracking-tight sm:text-[72px]">
        Grow revenue with AI agents built for <Rotator />
      </h1>
      <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-zinc-600">
        The AI-native outbound platform. Use AI agents to find, qualify and engage high-intent customers in your market, all in one place.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={signedIn ? "/agent" : "/signup"} className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700">
          <Bot className="size-4" /> Launch Agent
        </Link>
        <a href="mailto:sales@comuno.ai?subject=Comuno%20demo" className="rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium hover:bg-zinc-50">
          Request demo
        </a>
      </div>

      <div className="mt-12 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-xl rounded-xl border border-zinc-900/10 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Give this to your agent</div>
          <p className="mt-1 text-[13px] text-zinc-600">Your agent connects to Comuno over MCP. You just add your API key.</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-zinc-950 px-3 py-2.5 font-mono text-[12.5px] text-zinc-100">
            <span className="min-w-0 flex-1 truncate">{mcpUrl}</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(mcpUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 font-sans text-[11px] hover:bg-white/20"
            >
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-zinc-900/10 bg-white p-1 text-[13px]">
          <span className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white">Human</span>
          <Link href="/machine-version" className="rounded-md px-3 py-1.5 text-zinc-600 hover:text-zinc-900">
            Machine
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Product shot: the Agent at work ───────────────────────────────── */

function ProductShot() {
  const steps = [
    { label: "Finding prospects", detail: "Heads of Sales · Series B fintech · London" },
    { label: "Enriching companies", detail: "firmographics, funding, tech stack" },
    { label: "Finding emails", detail: "pattern match + MX verification" },
    { label: "Scoring fit", detail: "against your ideal customer profile" },
    { label: "Drafting emails", detail: "personalized to each person" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="overflow-hidden rounded-2xl border border-zinc-900/10 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-3">
          <span className="size-2.5 rounded-full bg-zinc-200" />
          <span className="size-2.5 rounded-full bg-zinc-200" />
          <span className="size-2.5 rounded-full bg-zinc-200" />
          <span className="ml-3 text-[12px] text-zinc-400">Comuno Agent</span>
        </div>
        <div className="grid md:grid-cols-[220px_1fr]">
          <div className="hidden border-r border-zinc-100 bg-zinc-50/70 p-4 text-[12.5px] text-zinc-500 md:block">
            {["Comuno Agent", "Home", "Find leads", "People", "Companies", "Sequences", "Inbox", "Power dialer", "Deals", "Buying signals"].map((l, i) => (
              <div key={l} className={`rounded-md px-2 py-1.5 ${i === 0 ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200" : ""}`}>
                {l}
              </div>
            ))}
          </div>
          <div className="space-y-4 p-5 sm:p-8">
            <div className="flex justify-end">
              <div className="max-w-md rounded-2xl rounded-br-md bg-zinc-900 px-4 py-2.5 text-[13.5px] text-white">
                Find Heads of Sales at Series B fintechs in London, verify their emails and draft a first touch for each.
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                <Bot className="size-4" />
              </div>
              <div className="flex-1 space-y-2">
                {steps.map((s) => (
                  <div key={s.label} className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[12px] text-zinc-600">
                    <Check className="size-3 text-emerald-600" />
                    <span className="font-medium text-zinc-800">{s.label}</span>
                    <span className="truncate text-zinc-400">· {s.detail}</span>
                  </div>
                ))}
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-[12.5px] text-amber-900">
                  <div className="font-semibold">Drafts ready for your approval</div>
                  <div className="mt-0.5 text-amber-800">Review each personalized email, then approve to send from your mailbox.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Sections ───────────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-600">{children}</div>;
}

function How() {
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-28 sm:px-6">
      <Eyebrow>How it works</Eyebrow>
      <h2 className="mt-3 max-w-3xl font-serif text-[36px] leading-[1.08] tracking-tight sm:text-[52px]">
        Upgrade your legacy sales stack with an agentic harness.
      </h2>
      <p className="mt-4 max-w-2xl text-[16px] text-zinc-600">
        Comuno replaces the patchwork of data, sequencing, dialer, CRM and intent tools with one platform, where AI agents do the busywork and you make the calls.
      </p>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS.map((s) => (
          <div key={s.n} className="rounded-2xl border border-zinc-900/10 bg-white p-6">
            <div className="font-mono text-xs text-zinc-400">{s.n}</div>
            <h3 className="mt-6 font-serif text-2xl tracking-tight">{s.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Offer() {
  return (
    <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-28 sm:px-6">
      <Eyebrow>What we offer</Eyebrow>
      <h2 className="mt-3 font-serif text-[36px] leading-[1.08] tracking-tight sm:text-[52px]">Less complexity. More pipeline.</h2>
      <p className="mt-4 max-w-2xl text-[16px] text-zinc-600">
        Comuno automates the busywork so you spend more time selling and less time switching tabs.
      </p>
      <div className="mt-14 space-y-6">
        {PRODUCTS.map((p, i) => (
          <div key={p.id} className="grid items-center gap-8 rounded-3xl border border-zinc-900/10 bg-white p-6 sm:p-10 lg:grid-cols-2">
            <div className={i % 2 ? "lg:order-2" : ""}>
              <Eyebrow>{p.eyebrow}</Eyebrow>
              <h3 className="mt-3 font-serif text-[30px] leading-tight tracking-tight sm:text-[38px]">{p.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">{p.body}</p>
              <ul className="mt-5 space-y-2">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-2 text-[14px] text-zinc-700">
                    <Check className="mt-0.5 size-4 shrink-0 text-orange-600" /> {pt}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-zinc-900 hover:gap-2 transition-all">
                Try {p.eyebrow} <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className={i % 2 ? "lg:order-1" : ""}>
              <Mock kind={p.id} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Illustrative UI previews (roles and stages only; no real or invented people). */
function Mock({ kind }: { kind: string }) {
  const frame = "rounded-2xl border border-zinc-200 bg-[#fbfbfa] p-4 text-[12px]";
  if (kind === "prospect")
    return (
      <div className={frame}>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-500">
          <Sparkles className="size-3.5 text-violet-600" /> VPs of Sales at Series B SaaS in the US
        </div>
        <div className="mt-3 overflow-hidden rounded-lg border border-zinc-200 bg-white">
          {[["VP Sales", "SaaS · 120 people", 92], ["Head of Revenue", "Fintech · 85 people", 86], ["CRO", "DevTools · 210 people", 81], ["VP Sales", "HR Tech · 64 people", 74]].map(([t, c, s]) => (
            <div key={`${t}${c}`} className="flex items-center gap-3 border-b border-zinc-100 px-3 py-2 last:border-0">
              <span className="size-6 rounded-full bg-zinc-100" />
              <div className="flex-1">
                <div className="font-medium text-zinc-800">{t}</div>
                <div className="text-zinc-400">{c}</div>
              </div>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">valid</span>
              <span className="w-8 text-right font-semibold tabular-nums text-zinc-800">{s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (kind === "engage")
    return (
      <div className={frame}>
        {[["Day 1", "Email", "Personalized intro"], ["Day 2", "LinkedIn", "Connection request"], ["Day 4", "Call", "AI talk track"], ["Day 6", "Email", "Follow-up in thread"]].map(([d, c, t], i) => (
          <div key={d} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex size-7 items-center justify-center rounded-full text-[10px] font-semibold ${i === 0 ? "bg-zinc-900 text-white" : "bg-white ring-1 ring-zinc-200"}`}>{i + 1}</span>
              {i < 3 && <span className="h-6 w-px bg-zinc-200" />}
            </div>
            <div className="-mt-5 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <span className="text-zinc-400">{d} · </span>
              <span className="font-medium text-zinc-800">{c}</span>
              <span className="text-zinc-500"> · {t}</span>
            </div>
          </div>
        ))}
      </div>
    );
  if (kind === "manage")
    return (
      <div className={`${frame} grid grid-cols-3 gap-2`}>
        {[["Qualified", 3], ["Meeting", 2], ["Proposal", 1]].map(([s, n]) => (
          <div key={s} className="rounded-lg bg-zinc-100/70 p-2">
            <div className="mb-2 font-medium text-zinc-600">{s}</div>
            {Array.from({ length: Number(n) }).map((_, i) => (
              <div key={i} className="mb-1.5 rounded-md border border-zinc-200 bg-white p-2">
                <div className="h-1.5 w-16 rounded bg-zinc-200" />
                <div className="mt-1.5 h-1.5 w-10 rounded bg-zinc-100" />
              </div>
            ))}
          </div>
        ))}
        <div className="col-span-3 rounded-lg border border-violet-200 bg-violet-50 p-2.5 text-violet-800">
          <Sparkles className="mr-1 inline size-3" /> Next best action: send the security review and book a call with the economic buyer.
        </div>
      </div>
    );
  return (
    <div className={`${frame} space-y-2`}>
      {[["Website visit", "Viewed pricing 3 times", "bg-sky-50 text-sky-700"], ["Funding", "Raised a Series B", "bg-emerald-50 text-emerald-700"], ["Hiring", "Hiring 4 SDRs", "bg-amber-50 text-amber-700"], ["Job change", "Champion moved to a new company", "bg-violet-50 text-violet-700"]].map(([t, d, c]) => (
        <div key={t} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c}`}>{t}</span>
          <span className="flex-1 text-zinc-700">{d}</span>
          <ArrowRight className="size-3.5 text-zinc-300" />
        </div>
      ))}
    </div>
  );
}

function AgentSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-28 sm:px-6">
      <div className="rounded-3xl bg-zinc-950 p-8 text-white sm:p-12">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-orange-400">Comuno Agent</div>
        <h2 className="mt-3 max-w-3xl font-serif text-[34px] leading-[1.08] tracking-tight sm:text-[48px]">Instruct agents in plain English.</h2>
        <p className="mt-4 max-w-2xl text-[15px] text-zinc-400">
          Prospect, engage and run market research from one surface. The agent chains Comuno&apos;s tools together and asks before anything reaches a prospect. It works in Comuno and inside Claude.
        </p>
        <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
          {AGENT_PROMPTS.map((p) => (
            <Link key={p} href={`/agent?q=${encodeURIComponent(p)}`} className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-[14px] text-zinc-200 hover:border-white/25">
              <Bot className="mt-0.5 size-4 shrink-0 text-orange-400" />
              <span className="flex-1">{p}</span>
              <ArrowRight className="mt-0.5 size-4 shrink-0 text-zinc-500 transition group-hover:translate-x-0.5 group-hover:text-white" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Trust() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-28 sm:px-6">
      <Eyebrow>Built for teams</Eyebrow>
      <h2 className="mt-3 font-serif text-[36px] leading-[1.08] tracking-tight sm:text-[52px]">Automation you can trust.</h2>
      <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-zinc-900/10 bg-zinc-900/10 sm:grid-cols-2 lg:grid-cols-3">
        {TRUST.map((t) => (
          <div key={t.title} className="bg-white p-6">
            <h3 className="text-[15px] font-semibold">{t.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">{t.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-28 sm:px-6">
      <Eyebrow>Pricing</Eyebrow>
      <h2 className="mt-3 font-serif text-[36px] leading-[1.08] tracking-tight sm:text-[52px]">Start free. Scale with credits.</h2>
      <p className="mt-4 text-[15px] text-zinc-600">Annual billing saves 25%.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => (
          <div key={p.name} className={`flex flex-col rounded-2xl border p-6 ${p.featured ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-900/10 bg-white"}`}>
            <div className="text-sm font-semibold">{p.name}</div>
            <div className="mt-4 font-serif text-[44px] leading-none">
              {p.price}
              <span className={`font-sans text-sm ${p.featured ? "text-zinc-400" : "text-zinc-500"}`}>{p.cadence}</span>
            </div>
            <div className={`mt-3 text-[13px] ${p.featured ? "text-zinc-300" : "text-zinc-600"}`}>
              {p.credits} · {p.seats}
            </div>
            <ul className="mt-5 flex-1 space-y-2">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2 text-[13.5px]">
                  <Check className={`mt-0.5 size-4 shrink-0 ${p.featured ? "text-orange-400" : "text-orange-600"}`} /> {f}
                </li>
              ))}
            </ul>
            <a href={p.href} className={`mt-6 rounded-lg py-2.5 text-center text-sm font-medium ${p.featured ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-700"}`}>
              {p.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pt-28 sm:px-6">
      <Eyebrow>FAQ</Eyebrow>
      <h2 className="mt-3 font-serif text-[36px] leading-[1.08] tracking-tight sm:text-[48px]">Questions, answered.</h2>
      <div className="mt-10 divide-y divide-zinc-900/10 border-y border-zinc-900/10">
        {FAQ.map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px] font-medium">
              {f.q}
              {open === i ? <Minus className="size-4 shrink-0" /> : <Plus className="size-4 shrink-0" />}
            </button>
            {open === i && <p className="-mt-1 pb-5 text-[15px] leading-relaxed text-zinc-600">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-28 sm:px-6">
      <div className="rounded-3xl border border-zinc-900/10 bg-white px-6 py-16 text-center sm:px-12">
        <h2 className="mx-auto max-w-3xl font-serif text-[36px] leading-[1.08] tracking-tight sm:text-[56px]">
          You&apos;re 30 seconds from never missing a buying signal again.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-medium text-white hover:bg-zinc-700">
            Start for free
          </Link>
          <a href="mailto:sales@comuno.ai" className="rounded-lg border border-zinc-300 bg-white px-6 py-3 text-sm font-medium hover:bg-zinc-50">
            Contact sales
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { h: "Product", l: [["Prospect", "/prospect"], ["Engage", "/sequences"], ["Manage", "/deals"], ["Signals", "/signals"], ["Agent", "/agent"]] },
    { h: "Resources", l: [["Pricing", "#pricing"], ["FAQ", "#faq"], ["Machine version", "/machine-version"], ["llms.txt", "/llms.txt"]] },
    { h: "Company", l: [["Contact", "mailto:sales@comuno.ai"], ["Login", "/login"], ["Start for free", "/signup"]] },
  ];
  return (
    <footer className="border-t border-zinc-900/10">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <span className="font-semibold tracking-tight">comuno</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] text-zinc-500">The AI-native outbound sales platform. Powered by Google Gemini.</p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">{c.h}</div>
            <ul className="mt-3 space-y-2 text-[14px]">
              {c.l.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-zinc-600 hover:text-zinc-900">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-10 text-[12px] text-zinc-400 sm:px-6">© {new Date().getFullYear()} Comuno. All rights reserved.</div>
    </footer>
  );
}

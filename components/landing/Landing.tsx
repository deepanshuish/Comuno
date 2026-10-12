"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight, ArrowUp, Bot, Building2, Check, Inbox, KanbanSquare, Mail, Menu, Minus, PhoneCall, Plus, Radar, Search,
  ShieldCheck, Sparkles, Users, X, type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import { AGENT_PROMPTS, FAQ, HOW_IT_WORKS, PLANS, PRODUCTS, TRUST } from "./content";

/*
 * Comuno marketing site. Neutral zinc palette with a single accent: `brand` (green).
 * Display type is Bricolage Grotesque; body is Inter.
 */

const NAV = [
  { href: "#flow", label: "How it works" },
  { href: "#product", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function Landing({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="min-h-screen bg-[#f7f7f5] text-zinc-900 antialiased">
      <Nav signedIn={signedIn} />
      <Hero signedIn={signedIn} />
      <Flow />
      <ProductTour />
      <AgentBand signedIn={signedIn} />
      <Trust />
      <Pricing />
      <Faq />
      <Closing />
      <Footer />
    </div>
  );
}

/* ── Nav ────────────────────────────────────────────────────────────── */

function Nav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-[#f7f7f5]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="font-display text-[19px] font-bold tracking-tight">comuno</span>
        </Link>
        <nav className="ml-10 hidden items-center gap-7 text-[14px] text-zinc-600 md:flex">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="transition-colors hover:text-zinc-900">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-1 md:flex">
          {signedIn ? (
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-[14px] font-medium text-white hover:bg-zinc-700">
              Open app <ArrowRight className="size-3.5" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-4 py-2 text-[14px] font-medium text-zinc-700 hover:text-zinc-900">
                Sign in
              </Link>
              <Link href="/signup" className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-[14px] font-medium text-white hover:bg-zinc-700">
                Get started <ArrowRight className="size-3.5" />
              </Link>
            </>
          )}
        </div>
        <button className="ml-auto rounded-md p-1.5 md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-zinc-200 px-4 pb-5 pt-2 md:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="block border-b border-zinc-200/70 py-3 text-[15px] text-zinc-700">
              {n.label}
            </a>
          ))}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={signedIn ? "/dashboard" : "/login"} className="rounded-full border border-zinc-300 bg-white py-2.5 text-center text-sm font-medium">
              {signedIn ? "Open app" : "Sign in"}
            </Link>
            <Link href="/signup" className="rounded-full bg-zinc-900 py-2.5 text-center text-sm font-medium text-white">
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Hero: headline + live agent activity feed ──────────────────────── */

const FEED: { icon: LucideIcon; title: string; detail: string }[] = [
  { icon: Search, title: "Found 18 decision makers", detail: "Heads of Sales · Series B fintech · London" },
  { icon: Building2, title: "Enriched 14 companies", detail: "funding, headcount, tech stack" },
  { icon: Mail, title: "Verified 16 work emails", detail: "pattern match + MX check" },
  { icon: Sparkles, title: "Scored fit against your ICP", detail: "11 leads above 75" },
  { icon: Mail, title: "Drafted 11 personalized emails", detail: "waiting for your approval" },
  { icon: Radar, title: "New signal", detail: "a target account viewed your pricing page" },
  { icon: Inbox, title: "Reply classified: interested", detail: "draft response ready" },
];

function ActivityFeed() {
  const [n, setN] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v >= FEED.length ? 3 : v + 1)), 1600);
    return () => clearInterval(t);
  }, []);
  const items = FEED.slice(0, n).slice(-5);
  return (
    <div className="relative rounded-[28px] border border-zinc-200 bg-white p-2 shadow-[0_40px_100px_-40px_rgba(24,24,27,0.35)]">
      <div className="rounded-[22px] bg-zinc-950 p-5 text-white sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-brand-400" />
            </span>
            Agent running
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-zinc-300">Q4 outbound</span>
        </div>
        <div className="mt-5 space-y-2.5">
          {items.map((it, i) => (
            <div
              key={`${it.title}-${n}-${i}`}
              className="flex items-start gap-3 rounded-xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-white/10 animate-[feedIn_0.45s_ease-out]"
            >
              <it.icon className="mt-0.5 size-4 shrink-0 text-brand-400" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-medium">{it.title}</div>
                <div className="truncate text-[12px] text-zinc-400">{it.detail}</div>
              </div>
              {i === items.length - 1 ? (
                <span className="ml-auto mt-1 size-1.5 shrink-0 animate-pulse rounded-full bg-brand-400" />
              ) : (
                <Check className="ml-auto mt-0.5 size-3.5 shrink-0 text-zinc-500" />
              )}
            </div>
          ))}
        </div>
      </div>
      <style>{`@keyframes feedIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white py-1 pl-1 pr-3 text-[12.5px] text-zinc-600">
          <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">AI sales platform</span>
          Powered by Google Gemini
        </div>
        <h1 className="mt-6 font-display text-[46px] font-bold leading-[1.0] tracking-[-0.035em] sm:text-[68px]">
          Your outbound team, with{" "}
          <span className="relative whitespace-nowrap">
            <span className="relative z-10">AI agents</span>
            <span className="absolute inset-x-0 bottom-[0.08em] -z-0 h-[0.28em] rounded-sm bg-brand-200" />
          </span>{" "}
          on every step.
        </h1>
        <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-zinc-600">
          Comuno finds the right buyers, verifies their details, writes outreach that sounds like you, and keeps your pipeline moving. You stay in the loop on everything that matters.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={signedIn ? "/agent" : "/signup"} className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3.5 text-[15px] font-medium text-white hover:bg-zinc-700">
            {signedIn ? "Open the Agent" : "Get started free"} <ArrowRight className="size-4" />
          </Link>
          <a href="#flow" className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-6 py-3.5 text-[15px] font-medium hover:border-zinc-400">
            See how it works
          </a>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-zinc-500">
          {["2,000 free credits", "No card required", "Works inside Claude"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <Check className="size-3.5 text-brand-600" /> {t}
            </span>
          ))}
        </div>
      </div>
      <ActivityFeed />
    </section>
  );
}

/* ── Flow: search to signed ─────────────────────────────────────────── */

const FLOW_ICONS: LucideIcon[] = [Search, Users, Mail, KanbanSquare];

function Flow() {
  return (
    <section id="flow" className="scroll-mt-20 border-y border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">From search to signed, in one place.</h2>
          <p className="mt-4 text-[16px] text-zinc-600">
            Stop stitching together a data tool, a sequencer, a dialer, a CRM and an intent feed. Comuno runs the whole motion, and the agents do the repetitive parts.
          </p>
        </div>
        <div className="relative mt-14 grid gap-8 md:grid-cols-4 md:gap-6">
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-zinc-200 md:block" />
          {HOW_IT_WORKS.map((s, i) => {
            const Icon = FLOW_ICONS[i];
            return (
              <div key={s.n} className="relative">
                <div className="relative flex size-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
                  <Icon className={`size-5 ${i === 3 ? "text-brand-600" : "text-zinc-700"}`} />
                </div>
                <div className="mt-5 font-mono text-[11px] text-zinc-400">{s.n}</div>
                <h3 className="mt-1 font-display text-[22px] font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-600">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Product tour (tabs) ────────────────────────────────────────────── */

const TAB_ICONS: Record<string, LucideIcon> = { prospect: Search, engage: Mail, manage: KanbanSquare, signals: Radar };

function ProductTour() {
  const [tab, setTab] = useState(PRODUCTS[0].id);
  const p = PRODUCTS.find((x) => x.id === tab)!;
  return (
    <section id="product" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h2 className="max-w-xl font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">Four tools. One workspace.</h2>
        <div className="flex flex-wrap gap-1.5 rounded-full border border-zinc-200 bg-white p-1.5">
          {PRODUCTS.map((x) => {
            const Icon = TAB_ICONS[x.id];
            return (
              <button
                key={x.id}
                onClick={() => setTab(x.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[14px] font-medium transition-colors ${tab === x.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:text-zinc-900"}`}
              >
                <Icon className="size-4" /> {x.eyebrow}
              </button>
            );
          })}
        </div>
      </div>

      <div key={p.id} className="mt-10 grid gap-10 rounded-[28px] border border-zinc-200 bg-white p-6 animate-[feedIn_0.35s_ease-out] sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h3 className="font-display text-[28px] font-semibold leading-tight tracking-tight sm:text-[34px]">{p.title}</h3>
          <p className="mt-3 text-[15.5px] leading-relaxed text-zinc-600">{p.body}</p>
          <ul className="mt-6 grid gap-2.5">
            {p.points.map((pt) => (
              <li key={pt} className="flex gap-2.5 text-[14.5px] text-zinc-700">
                <span className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-50">
                  <Check className="size-2.5 text-brand-700" />
                </span>
                {pt}
              </li>
            ))}
          </ul>
          <Link href={p.href} className="mt-7 inline-flex items-center gap-1.5 text-[14px] font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-900">
            Open {p.eyebrow} <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <Preview kind={p.id} />
      </div>
    </section>
  );
}

/** Illustrative UI previews (roles and stages only; no real or invented people). */
function Preview({ kind }: { kind: string }) {
  const frame = "rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200 text-[12.5px]";
  if (kind === "prospect")
    return (
      <div className={frame}>
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-zinc-500 ring-1 ring-zinc-200">
          <Search className="size-3.5" /> VPs of Sales at Series B SaaS companies in the US
        </div>
        <div className="mt-3 overflow-hidden rounded-xl bg-white ring-1 ring-zinc-200">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-zinc-100 px-3 py-2 text-[10.5px] uppercase tracking-wide text-zinc-400">
            <span>Lead</span>
            <span>Email</span>
            <span className="w-8 text-right">Fit</span>
          </div>
          {[["VP Sales", "SaaS · 120 people", 92], ["Head of Revenue", "Fintech · 85 people", 86], ["CRO", "DevTools · 210 people", 81], ["VP Sales", "HR Tech · 64 people", 74]].map(([t, c, s]) => (
            <div key={`${t}${c}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-0">
              <div>
                <div className="font-medium text-zinc-800">{t}</div>
                <div className="text-zinc-400">{c}</div>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-700">verified</span>
              <span className={`w-8 text-right font-semibold tabular-nums ${Number(s) >= 80 ? "text-brand-700" : "text-zinc-700"}`}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (kind === "engage")
    return (
      <div className={`${frame} space-y-2`}>
        {[
          [Mail, "Day 1", "Email", "Personalized intro"],
          [Users, "Day 2", "LinkedIn", "Connection request"],
          [PhoneCall, "Day 4", "Call", "AI talk track ready"],
          [Mail, "Day 6", "Email", "Follow-up in the same thread"],
        ].map(([Icon, d, c, t], i) => {
          const I = Icon as LucideIcon;
          return (
            <div key={String(d)} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-zinc-200">
              <span className={`flex size-8 items-center justify-center rounded-lg ${i === 0 ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                <I className="size-4" />
              </span>
              <div className="flex-1">
                <div className="font-medium text-zinc-800">{String(c)}</div>
                <div className="text-zinc-500">{String(t)}</div>
              </div>
              <span className="text-zinc-400">{String(d)}</span>
            </div>
          );
        })}
      </div>
    );
  if (kind === "manage")
    return (
      <div className={frame}>
        <div className="grid grid-cols-3 gap-2">
          {[["Qualified", 3, "bg-brand-200"], ["Meeting", 2, "bg-brand-400"], ["Proposal", 1, "bg-brand-600"]].map(([s, n, c]) => (
            <div key={String(s)} className="rounded-xl bg-white p-2.5 ring-1 ring-zinc-200">
              <div className="mb-2 flex items-center gap-1.5 font-medium text-zinc-600">
                <span className={`size-1.5 rounded-full ${c}`} /> {s}
              </div>
              {Array.from({ length: Number(n) }).map((_, i) => (
                <div key={i} className="mb-1.5 rounded-lg bg-zinc-50 p-2 ring-1 ring-zinc-100">
                  <div className="h-1.5 w-16 rounded bg-zinc-300" />
                  <div className="mt-1.5 h-1.5 w-10 rounded bg-zinc-200" />
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2 rounded-xl bg-zinc-900 p-3 text-zinc-100">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand-400" />
          Next step: send the security review and book time with the economic buyer.
        </div>
      </div>
    );
  return (
    <div className={`${frame} space-y-2`}>
      {[["Website visit", "A target account viewed pricing 3 times"], ["Funding", "Raised a Series B this week"], ["Hiring", "Posted 4 SDR roles"], ["Job change", "Your champion joined a new company"]].map(([t, d], i) => (
        <div key={t} className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-zinc-200">
          <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${i === 0 ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-700"}`}>{t}</span>
          <span className="flex-1 text-zinc-700">{d}</span>
          <ArrowRight className="size-3.5 text-zinc-300" />
        </div>
      ))}
    </div>
  );
}

/* ── Agent band ─────────────────────────────────────────────────────── */

function AgentBand({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="bg-zinc-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-[13px] text-zinc-400">
            <Bot className="size-4 text-brand-400" /> Comuno Agent
          </div>
          <h2 className="mt-4 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">Just ask.</h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-zinc-400">
            Tell the agent what you need in plain English. It chains Comuno&apos;s tools together, shows its work, and waits for your approval before anything reaches a prospect.
          </p>
          <p className="mt-4 max-w-md text-[14px] text-zinc-500">Also available inside Claude and other assistants through Comuno&apos;s MCP server.</p>
        </div>
        <div className="rounded-3xl bg-white/[0.04] p-3 ring-1 ring-white/10">
          <div className="space-y-2">
            {AGENT_PROMPTS.map((p) => (
              <Link
                key={p}
                href={signedIn ? `/agent?q=${encodeURIComponent(p)}` : "/signup"}
                className="group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[14.5px] text-zinc-200 transition-colors hover:bg-white/[0.06]"
              >
                <Sparkles className="size-4 shrink-0 text-zinc-500 group-hover:text-brand-400" />
                <span className="flex-1">{p}</span>
              </Link>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-[14px] text-zinc-400">
            <span className="flex-1">Ask Comuno to prospect, research or follow up…</span>
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-white">
              <ArrowUp className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Trust ──────────────────────────────────────────────────────────── */

function Trust() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <ShieldCheck className="size-6 text-brand-600" />
          <h2 className="mt-4 font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[44px]">Automation with a human in charge.</h2>
          <p className="mt-4 text-[15.5px] text-zinc-600">Agents handle the busywork. You decide what goes out, and every action is logged.</p>
        </div>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {TRUST.map((t) => (
            <div key={t.title} className="border-t border-zinc-200 pt-5">
              <h3 className="text-[15px] font-semibold">{t.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ────────────────────────────────────────────────────────── */

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 border-y border-zinc-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[48px]">Simple, credit-based pricing.</h2>
          <p className="mt-3 text-[15.5px] text-zinc-600">Every plan includes every module. Pay for usage, not features. Annual billing saves 25%.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => (
            <div key={p.name} className={`relative flex flex-col rounded-3xl p-6 ${p.featured ? "bg-zinc-950 text-white" : "bg-[#f7f7f5] ring-1 ring-zinc-200"}`}>
              {p.featured && <span className="absolute right-5 top-5 rounded-full bg-brand-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">Popular</span>}
              <div className="text-[15px] font-semibold">{p.name}</div>
              <div className="mt-5 font-display text-[44px] font-bold leading-none tracking-tight">
                {p.price}
                <span className={`ml-0.5 font-sans text-[14px] font-normal ${p.featured ? "text-zinc-400" : "text-zinc-500"}`}>{p.cadence}</span>
              </div>
              <div className={`mt-3 text-[13px] ${p.featured ? "text-zinc-400" : "text-zinc-500"}`}>
                {p.credits} · {p.seats}
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-[13.5px]">
                    <Check className={`mt-0.5 size-4 shrink-0 ${p.featured ? "text-brand-400" : "text-brand-600"}`} /> {f}
                  </li>
                ))}
              </ul>
              <a href={p.href} className={`mt-7 rounded-full py-2.5 text-center text-[14px] font-medium ${p.featured ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-zinc-900 text-white hover:bg-zinc-700"}`}>
                {p.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ────────────────────────────────────────────────────────────── */

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h2 className="font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[44px]">Good questions.</h2>
        <p className="mt-4 text-[15.5px] text-zinc-600">
          Something else?{" "}
          <a href="mailto:sales@comuno.ai" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4">
            Talk to us
          </a>
          .
        </p>
      </div>
      <div className="divide-y divide-zinc-200 border-y border-zinc-200">
        {FAQ.map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px] font-medium">
              {f.q}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-zinc-200">
                {open === i ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
              </span>
            </button>
            {open === i && <p className="-mt-1 pb-5 pr-10 text-[15px] leading-relaxed text-zinc-600">{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Closing CTA + footer ───────────────────────────────────────────── */

function Closing() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <div className="relative overflow-hidden rounded-[32px] bg-zinc-950 px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div className="pointer-events-none absolute -bottom-40 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-brand-600/30 blur-3xl" />
        <h2 className="relative mx-auto max-w-2xl font-display text-[36px] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[52px]">
          Build your next quarter&apos;s pipeline this afternoon.
        </h2>
        <p className="relative mx-auto mt-4 max-w-md text-[15.5px] text-zinc-400">Start with 2,000 free credits. Set up takes about a minute.</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-[15px] font-medium text-zinc-900 hover:bg-zinc-100">
            Get started free <ArrowRight className="size-4" />
          </Link>
          <a href="mailto:sales@comuno.ai" className="rounded-full px-6 py-3.5 text-[15px] font-medium text-white ring-1 ring-white/20 hover:ring-white/40">
            Talk to sales
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { h: "Product", l: [["Prospect", "/prospect"], ["Engage", "/sequences"], ["Manage", "/deals"], ["Signals", "/signals"], ["Agent", "/agent"]] },
    { h: "Resources", l: [["Pricing", "#pricing"], ["FAQ", "#faq"], ["For AI agents", "/machine-version"], ["llms.txt", "/llms.txt"]] },
    { h: "Company", l: [["Contact", "mailto:sales@comuno.ai"], ["Sign in", "/login"], ["Get started", "/signup"]] },
  ];
  return (
    <footer className="border-t border-zinc-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="font-display text-[18px] font-bold tracking-tight">comuno</span>
          </div>
          <p className="mt-3 max-w-xs text-[13.5px] text-zinc-500">The AI-native outbound sales platform. Powered by Google Gemini.</p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <div className="text-[12px] font-semibold text-zinc-900">{c.h}</div>
            <ul className="mt-3 space-y-2 text-[14px]">
              {c.l.map(([label, href]) => (
                <li key={label}>
                  <a href={href} className="text-zinc-500 hover:text-zinc-900">
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

"use client";
import Link from "next/link";
import { useState } from "react";
import Logo from "@/components/Logo";
import { post } from "@/lib/client";
import { Button, ErrorNote, Field, Input } from "./ui";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [form, setForm] = useState({ email: "", password: "", name: "", company: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await post(mode === "login" ? "/api/auth/login" : "/api/auth/signup", form);
      window.location.href = mode === "login" ? "/dashboard" : "/settings?welcome=1";
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="platform flex min-h-screen bg-[#fbfbfa] text-zinc-900">
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          <Link href="/" className="mb-10 flex items-center gap-2">
            <Logo size={26} />
            <span className="text-base font-semibold tracking-tight">comuno</span>
          </Link>
          <h1 className="font-display font-semibold text-[34px] leading-tight tracking-tight">
            {mode === "login" ? "Welcome back" : "Build pipeline with AI agents"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {mode === "login" ? "Sign in to your Comuno workspace." : "Start free with 2,000 credits. No card required."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Your name">
                  <Input value={form.name} onChange={set("name")} autoComplete="name" placeholder="Ada Lovelace" />
                </Field>
                <Field label="Company">
                  <Input value={form.company} onChange={set("company")} autoComplete="organization" placeholder="Acme Inc." />
                </Field>
              </div>
            )}
            <Field label="Work email">
              <Input type="email" required value={form.email} onChange={set("email")} autoComplete="email" placeholder="you@company.com" />
            </Field>
            <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
              <Input
                type="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                value={form.password}
                onChange={set("password")}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </Field>
            <ErrorNote error={error} />
            <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
              {mode === "login" ? "Sign in" : "Create workspace"}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-zinc-500">
            {mode === "login" ? (
              <>
                New to Comuno?{" "}
                <Link href="/signup" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
                  Start for free
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-zinc-900 underline-offset-4 hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="hidden flex-1 flex-col justify-between border-l border-zinc-200 bg-zinc-900 p-12 text-zinc-100 lg:flex">
        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Comuno · AI-native outbound</div>
        <div>
          <p className="font-display font-semibold text-[40px] leading-[1.1] tracking-tight">
            Find, qualify and engage high-intent buyers, with AI agents doing the busywork.
          </p>
          <ul className="mt-8 space-y-2 text-sm text-zinc-400">
            <li>→ AI lead discovery grounded in live web search</li>
            <li>→ Waterfall enrichment and email verification</li>
            <li>→ Personalized multi-channel sequences, inbox and dialer</li>
            <li>→ CRM, buying signals and website visitor tracking</li>
          </ul>
        </div>
        <div className="text-xs text-zinc-500">Powered by Google Gemini</div>
      </div>
    </div>
  );
}

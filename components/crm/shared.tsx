"use client";
import {
  Activity as ActivityIcon, ArrowRightLeft, Briefcase, CalendarDays, Eye, KanbanSquare, Mail, MailOpen, MousePointerClick, Phone, Radar, Reply, Search, Send, Sparkles, StickyNote, UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/client";
import { DEAL_STAGES, type Activity, type Deal, type DealStage } from "@/lib/types";
import { cx } from "@/components/app/ui";

export type DealRow = Deal & {
  company_name: string | null;
  contact_name: string | null;
  contact_email?: string | null;
  contact_title?: string | null;
  company_domain?: string | null;
};

export type PipelineSummary = {
  stages: { stage: DealStage; count: number; value: number }[];
  total: number;
  weighted: number;
  winRate: number;
  wonValue: number;
  openCount: number;
  avgDealSize: number;
};

/** Stage accent (a dot / bar beside text — text itself stays neutral). */
export const STAGE_COLOR: Record<DealStage, string> = {
  // One-hue ramp: deals get greener as they progress; lost is neutral.
  lead: "#d4d4d8",
  qualified: "#a6f4c5",
  meeting: "#6ce9a6",
  proposal: "#32d583",
  negotiation: "#039855",
  won: "#05603a",
  lost: "#a1a1aa",
};

export function stageLabel(s: string) {
  return DEAL_STAGES.find((x) => x.id === s)?.label ?? s;
}

export function StageDot({ stage, className }: { stage: DealStage; className?: string }) {
  return <span className={cx("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: STAGE_COLOR[stage] }} />;
}

export function compactMoney(n: number) {
  if (!n) return "$0";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}k`;
  return `$${Math.round(n)}`;
}

/** Parse a SQLite UTC timestamp or a YYYY-MM-DD date. */
export function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00`) : new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

export function shortDate(s: string | null | undefined) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}

export function isOverdue(deal: Pick<Deal, "close_date" | "stage">) {
  if (!deal.close_date || deal.stage === "won" || deal.stage === "lost") return false;
  const d = parseDate(deal.close_date);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: CalendarDays,
  stage_change: ArrowRightLeft,
  deal: KanbanSquare,
  visit: Eye,
  signal: Radar,
  ai: Sparkles,
  job_change: Briefcase,
  email_sent: Mail,
  email_opened: MailOpen,
  email_clicked: MousePointerClick,
  email_reply: Reply,
  sequence: Send,
  research: Search,
  prospect: UserPlus,
  created: UserPlus,
};

export type ActivityRow = Activity & { contact_name?: string | null; company_name?: string | null; deal_name?: string | null };

export function ActivityList({ items, showContext, compact }: { items: ActivityRow[]; showContext?: boolean; compact?: boolean }) {
  return (
    <ol className="relative">
      {items.map((a, i) => {
        const Icon = ACTIVITY_ICONS[a.type] ?? ActivityIcon;
        const context = showContext ? [a.contact_name, a.company_name, a.deal_name].filter(Boolean).join(" · ") : "";
        return (
          <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-px bg-zinc-200" aria-hidden />}
            <span
              className={cx(
                "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border bg-white",
                a.type === "ai" ? "border-brand-200 text-brand-600" : "border-zinc-200 text-zinc-500",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[13px] font-medium text-zinc-900">{a.title}</span>
                <span className="text-[11px] text-zinc-400" title={parseDate(a.created_at)?.toLocaleString()}>
                  {timeAgo(a.created_at)}
                </span>
              </div>
              {context && <div className="truncate text-xs text-zinc-500">{context}</div>}
              {a.body && !compact && <p className="mt-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-zinc-600">{a.body}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

const linkBtnVariants = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  ai: "bg-brand-600 text-white hover:bg-brand-500",
};

/** A Next.js Link styled like the ui.tsx Button (avoids nesting <button> in <a>). */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon,
  children,
  className,
  title,
}: {
  href: string;
  variant?: keyof typeof linkBtnVariants;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        linkBtnVariants[variant],
        size === "sm" ? "h-7 px-2.5" : "h-9 px-3.5",
        className,
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

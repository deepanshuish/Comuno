"use client";
import Link from "next/link";
import {
  Briefcase, Check, DollarSign, ExternalLink, Eye, Globe, KanbanSquare, Newspaper, Rocket, Send, Target, Trash2, UserCog, Users,
  type LucideIcon,
} from "lucide-react";
import { timeAgo } from "@/lib/client";
import type { Signal, SignalType } from "@/lib/types";
import { Badge, Button, cx, type Tone } from "@/components/app/ui";
import { ButtonLink } from "@/components/crm/shared";

export type SignalRow = Signal & {
  company_name: string | null;
  company_domain: string | null;
  contact_name: string | null;
  engage_contact_id: string | null;
};

export const SIGNAL_META: Record<SignalType, { label: string; icon: LucideIcon; tone: Tone }> = {
  visit: { label: "Website visit", icon: Eye, tone: "blue" },
  funding: { label: "Funding", icon: DollarSign, tone: "green" },
  hiring: { label: "Hiring", icon: Users, tone: "violet" },
  job_change: { label: "Job change", icon: Briefcase, tone: "amber" },
  news: { label: "News", icon: Newspaper, tone: "zinc" },
  intent: { label: "Intent", icon: Target, tone: "red" },
  leadership: { label: "Leadership", icon: UserCog, tone: "amber" },
  product: { label: "Product launch", icon: Rocket, tone: "violet" },
  expansion: { label: "Expansion", icon: Globe, tone: "green" },
};

const toneBg: Record<Tone, string> = {
  zinc: "bg-zinc-100 text-zinc-600",
  violet: "bg-brand-50 text-brand-600",
  green: "bg-brand-50 text-brand-600",
  amber: "bg-zinc-50 text-zinc-600",
  red: "bg-red-50 text-red-600",
  blue: "bg-zinc-50 text-zinc-600",
};

export function SignalIcon({ type, className }: { type: SignalType; className?: string }) {
  const m = SIGNAL_META[type] ?? SIGNAL_META.news;
  return (
    <span className={cx("flex size-8 shrink-0 items-center justify-center rounded-lg", toneBg[m.tone], className)}>
      <m.icon className="size-4" />
    </span>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

export function StrengthBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone: Tone = score >= 75 ? "green" : score >= 50 ? "amber" : "zinc";
  return (
    <Badge tone={tone} className="tabular-nums">
      <span className="sr-only">Strength</span>
      {score}
    </Badge>
  );
}

export function SignalItem({
  s,
  onSeen,
  onDelete,
  onCreateDeal,
  compact,
}: {
  s: SignalRow;
  onSeen?: (seen: boolean) => void;
  onDelete?: () => void;
  onCreateDeal?: () => void;
  compact?: boolean;
}) {
  const meta = SIGNAL_META[s.type] ?? SIGNAL_META.news;
  const unseen = !s.seen;
  return (
    <article className={cx("flex gap-3 px-4 py-3.5 sm:px-5", unseen && !compact && "bg-brand-50/30")}>
      <div className="relative">
        <SignalIcon type={s.type} />
        {unseen && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white bg-brand-500" title="New" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">{meta.label}</span>
          {s.company_name && s.company_id && (
            <>
              <span aria-hidden>·</span>
              {compact ? (
                <span className="truncate">{s.company_name}</span>
              ) : (
                <Link href={`/companies?open=${s.company_id}`} className="truncate hover:text-zinc-900 hover:underline">
                  {s.company_name}
                </Link>
              )}
            </>
          )}
          <span aria-hidden>·</span>
          <span>{timeAgo(s.created_at)}</span>
          <span className="ml-auto">
            <StrengthBadge score={s.score} />
          </span>
        </div>
        <h3 className={cx("mt-0.5 text-[13px] leading-snug text-zinc-900", unseen ? "font-semibold" : "font-medium")}>{s.title}</h3>
        {s.body && !compact && <p className="mt-1 line-clamp-3 text-[13px] leading-relaxed text-zinc-600">{s.body}</p>}
        {!compact && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {s.engage_contact_id && (
              <ButtonLink size="sm" href={`/inbox?compose=${s.engage_contact_id}`} icon={<Send className="size-3.5" />}>
                Engage{s.contact_name ? ` ${s.contact_name.split(" ")[0]}` : ""}
              </ButtonLink>
            )}
            {onCreateDeal && (
              <Button size="sm" icon={<KanbanSquare className="size-3.5" />} onClick={onCreateDeal}>
                Create deal
              </Button>
            )}
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              >
                <ExternalLink className="size-3" /> {s.type === "visit" ? "Last page" : hostOf(s.url)}
              </a>
            )}
            <span className="ml-auto flex items-center gap-1">
              {onSeen && (
                <Button size="sm" variant="ghost" icon={<Check className="size-3.5" />} onClick={() => onSeen(unseen)} title={unseen ? "Mark as seen" : "Mark as new"}>
                  {unseen ? "Mark seen" : "Mark new"}
                </Button>
              )}
              {onDelete && (
                <Button size="sm" variant="ghost" icon={<Trash2 className="size-3.5" />} onClick={onDelete} aria-label="Dismiss signal" title="Dismiss" />
              )}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

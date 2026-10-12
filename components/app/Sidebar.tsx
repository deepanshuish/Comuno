"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3, Bot, Building2, Coins, Eye, Home, Inbox, KanbanSquare, ListChecks, LogOut, Menu, PhoneCall,
  Radar, Search, Send, Settings, Users, X, Zap, type LucideIcon,
} from "lucide-react";
import Logo from "@/components/Logo";
import { cx } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon };
const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/agent", label: "Comuno Agent", icon: Bot },
      { href: "/dashboard", label: "Home", icon: Home },
    ],
  },
  {
    section: "Prospect",
    items: [
      { href: "/prospect", label: "Find leads", icon: Search },
      { href: "/contacts", label: "People", icon: Users },
      { href: "/companies", label: "Companies", icon: Building2 },
      { href: "/lists", label: "Lists", icon: ListChecks },
    ],
  },
  {
    section: "Engage",
    items: [
      { href: "/sequences", label: "Sequences", icon: Send },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/dialer", label: "Power dialer", icon: PhoneCall },
      { href: "/tasks", label: "Tasks", icon: Zap },
    ],
  },
  {
    section: "Manage",
    items: [
      { href: "/deals", label: "Deals", icon: KanbanSquare },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Signals",
    items: [
      { href: "/signals", label: "Buying signals", icon: Radar },
      { href: "/visitors", label: "Website visitors", icon: Eye },
    ],
  },
];

export default function Sidebar({ user, workspace }: { user: { name: string | null; email: string }; workspace: { name: string; credits: number; plan: string } }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex h-full flex-col">
      <Link href="/dashboard" className="flex items-center gap-2 px-4 pb-4 pt-5">
        <Logo size={24} />
        <span className="text-[15px] font-semibold tracking-tight text-zinc-900">comuno</span>
      </Link>
      <div className="flex-1 space-y-4 overflow-y-auto px-2.5 pb-4">
        {NAV.map((group, i) => (
          <div key={i}>
            {group.section && <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-400">{group.section}</div>}
            {group.items.map((item) => {
              const active = path === item.href || path.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cx(
                    "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                    active ? "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-zinc-200/50 hover:text-zinc-900",
                  )}
                >
                  <item.icon className={cx("size-4", item.href === "/agent" ? "text-brand-600" : active ? "text-zinc-900" : "text-zinc-400")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-zinc-200 p-2.5">
        <Link href="/settings?tab=billing" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-zinc-600 hover:bg-zinc-200/50">
          <Coins className="size-3.5 text-zinc-500" />
          <span className="tabular-nums">{workspace.credits.toLocaleString()} credits</span>
          <span className="ml-auto rounded bg-zinc-200/70 px-1.5 text-[10px] font-medium uppercase text-zinc-600">{workspace.plan}</span>
        </Link>
        <Link
          href="/settings"
          className={cx("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px]", path.startsWith("/settings") ? "bg-white font-medium text-zinc-900 ring-1 ring-zinc-200" : "text-zinc-600 hover:bg-zinc-200/50")}
        >
          <Settings className="size-4 text-zinc-400" /> Settings
        </Link>
        <div className="flex items-center gap-2 px-2 pt-1">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-zinc-800">{user.name || user.email}</div>
            <div className="truncate text-[11px] text-zinc-500">{workspace.name}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700" title="Sign out" aria-label="Sign out">
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-zinc-200 bg-zinc-50 lg:block">{nav}</aside>
      <div className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-zinc-200 bg-zinc-50/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-md p-1 text-zinc-600" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <Logo size={20} />
        <span className="text-sm font-semibold text-zinc-900">comuno</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 bg-zinc-900/30 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="relative h-full w-[260px] bg-zinc-50 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute right-3 top-5 rounded-md p-1 text-zinc-500" aria-label="Close menu">
              <X className="size-4" />
            </button>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}

"use client";
import { useEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, Sparkles, X } from "lucide-react";

/* Comuno platform UI kit. Light, quiet surfaces; violet accent for primary and AI actions. */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "ai";
const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700",
  secondary: "bg-white text-zinc-800 border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  ai: "bg-violet-600 text-white hover:bg-violet-500",
};
const btnSizes = { sm: "h-7 px-2.5", md: "h-9 px-3.5", lg: "h-11 px-5 text-sm" };

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: keyof typeof btnSizes;
  loading?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(btnBase, btnVariants[variant], btnSizes[size], className)}
    >
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : variant === "ai" && !icon ? <Sparkles className="size-3.5" /> : icon}
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-xl border border-zinc-200 bg-white", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-3.5">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-[28px] leading-tight tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputCls, "h-9", className)} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputCls, "py-2 leading-relaxed", className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputCls, "h-9 pr-8", className)}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const badgeTones = {
  zinc: "bg-zinc-100 text-zinc-700",
  violet: "bg-violet-50 text-violet-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-sky-50 text-sky-700",
};
export type Tone = keyof typeof badgeTones;

export function Badge({ tone = "zinc", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

/** Colored 0–100 fit score pill. */
export function Score({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-xs text-zinc-400">—</span>;
  const tone: Tone = value >= 75 ? "green" : value >= 50 ? "amber" : "zinc";
  return <Badge tone={tone}>{value}</Badge>;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx("size-4 animate-spin text-zinc-400", className)} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
      <Spinner /> {label}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && <div className="mb-3 rounded-xl bg-zinc-100 p-3 text-zinc-500">{icon}</div>}
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-zinc-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>;
}

/** Escape closes only the top-most open overlay (modal over drawer, etc.). */
const overlayStack: symbol[] = [];
function useEscape(open: boolean, onClose: () => void) {
  // Keep the stack position stable across re-renders that pass a new onClose.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const me = Symbol("overlay");
    overlayStack.push(me);
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape" && overlayStack[overlayStack.length - 1] === me) closeRef.current();
    };
    window.addEventListener("keydown", fn);
    return () => {
      window.removeEventListener("keydown", fn);
      overlayStack.splice(overlayStack.indexOf(me), 1);
    };
  }, [open]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/30 p-4 pt-[8vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        className={cx("w-full rounded-2xl border border-zinc-200 bg-white shadow-xl", wide ? "max-w-3xl" : "max-w-lg")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold text-zinc-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** Slide-over panel from the right, for record details. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-zinc-900/20" onMouseDown={onClose}>
      <div className="flex h-full w-full max-w-xl flex-col border-l border-zinc-200 bg-white shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <div className="min-w-0 text-[15px] font-semibold text-zinc-900">{title}</div>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: ReactNode }[] }) {
  return (
    <div className="flex gap-1 border-b border-zinc-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
            value === t.id ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500 hover:text-zinc-800",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="px-4 py-3.5">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-zinc-500">{sub}</div>}
    </Card>
  );
}

/** Simple table primitives. */
export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">{children}</table>
    </div>
  );
}
export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx("whitespace-nowrap border-b border-zinc-200 bg-zinc-50/60 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("border-b border-zinc-100 px-3 py-2.5 align-middle text-zinc-700", className)}>{children}</td>;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", className)}
      style={{ background: `hsl(${hue} 70% 94%)`, color: `hsl(${hue} 45% 32%)` }}
    >
      {initials || "?"}
    </span>
  );
}

/** Rendered list of web sources returned by search-grounded Gemini calls. */
export function Sources({ sources }: { sources?: { title: string; url: string }[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {sources.slice(0, 8).map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="max-w-[220px] truncate rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 hover:bg-zinc-200">
          {s.title}
        </a>
      ))}
    </div>
  );
}

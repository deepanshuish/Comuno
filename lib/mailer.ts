import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { parseJson } from "./db";
import type { Workspace } from "./types";

/**
 * Outbound email delivery.
 *
 * SMTP settings come from the workspace (`smtp_json` = {host, port, secure, user, pass, from})
 * or from the environment (SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM / SMTP_SECURE).
 * When neither is configured the mailer runs in **sandbox mode**: nothing leaves the server,
 * the message is recorded as sent with `delivery = 'sandbox'`, and the UI shows a banner.
 */

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
};

export type MailerStatus = {
  mode: "smtp" | "sandbox";
  source: "workspace" | "env" | null;
  from: string | null;
  host: string | null;
};

export function smtpConfig(ws: Workspace): { config: SmtpConfig; source: "workspace" | "env" } | null {
  const w = parseJson<Record<string, unknown>>(ws.smtp_json, {});
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  if (str(w.host)) {
    const port = Number(w.port) || 587;
    return {
      source: "workspace",
      config: {
        host: str(w.host)!,
        port,
        secure: w.secure === undefined || w.secure === null || w.secure === "" ? port === 465 : w.secure === true || w.secure === "true",
        user: str(w.user),
        pass: typeof w.pass === "string" ? w.pass : undefined,
        from: str(w.from),
      },
    };
  }
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT) || 587;
    return {
      source: "env",
      config: {
        host: process.env.SMTP_HOST,
        port,
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
        user: process.env.SMTP_USER || undefined,
        pass: process.env.SMTP_PASS || undefined,
        from: process.env.SMTP_FROM || undefined,
      },
    };
  }
  return null;
}

export function fromAddress(ws: Workspace, cfg?: SmtpConfig | null): string | null {
  const addr = cfg?.from || ws.sender_email || cfg?.user || null;
  if (!addr) return null;
  if (addr.includes("<")) return addr;
  return ws.sender_name ? `"${ws.sender_name.replace(/"/g, "")}" <${addr}>` : addr;
}

export function mailerStatus(ws: Workspace): MailerStatus {
  const s = smtpConfig(ws);
  return {
    mode: s ? "smtp" : "sandbox",
    source: s?.source ?? null,
    from: fromAddress(ws, s?.config),
    host: s?.config.host ?? null,
  };
}

/* ---------- public base URL (for tracking links) ---------- */

let originHint: string | null = null;

/** Remember the public origin from an incoming request, used when APP_URL isn't set. */
export function rememberOrigin(req: Request) {
  if (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL) return;
  try {
    const h = req.headers;
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || new URL(req.url).protocol.replace(":", "");
    if (host) originHint = `${proto}://${host}`;
  } catch {
    /* ignore */
  }
}

export function appUrl(): string {
  const env = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  if (originHint) return originHint;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

/* ---------- HTML rendering ---------- */

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+[^\s<>"').,;:!?]/g;

/** Convert a plain-text email body (+ signature) into simple HTML with tracked links and an open pixel. */
export function renderEmailHtml(text: string, opts: { messageId?: string; signature?: string | null; track?: boolean }) {
  const base = appUrl();
  const linkify = (s: string) =>
    escapeHtml(s).replace(URL_RE, (url) => {
      const raw = url.replace(/&amp;/g, "&");
      const href =
        opts.track && opts.messageId ? `${base}/api/t/c/${opts.messageId}?u=${encodeURIComponent(raw)}` : raw;
      return `<a href="${escapeHtml(href)}">${url}</a>`;
    });
  const paras = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${linkify(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const sig = opts.signature?.trim()
    ? `<div style="margin-top:16px;color:#555">${linkify(opts.signature.trim()).replace(/\n/g, "<br>")}</div>`
    : "";
  const pixel =
    opts.track && opts.messageId
      ? `<img src="${base}/api/t/o/${opts.messageId}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />`
      : "";
  return `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111">${paras}${sig}${pixel}</div>`;
}

export function plainWithSignature(text: string, signature?: string | null) {
  return signature?.trim() ? `${text.trim()}\n\n${signature.trim()}` : text.trim();
}

/* ---------- sending ---------- */

export type SendResult = {
  delivery: "smtp" | "sandbox";
  providerId: string | null;
  from: string | null;
};

export class MailError extends Error {
  constructor(message: string, public permanent: boolean) {
    super(message);
  }
}

const transports = new Map<string, Transporter>();

function transportFor(cfg: SmtpConfig) {
  const key = JSON.stringify(cfg);
  let t = transports.get(key);
  if (!t) {
    t = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass || "" } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
    transports.set(key, t);
  }
  return t;
}

/**
 * Deliver an email. Returns delivery mode and the provider Message-ID.
 * Throws MailError (permanent = true for recipient rejections, i.e. a bounce).
 */
export async function deliver(
  ws: Workspace,
  m: { to: string; subject: string; text: string; html: string; inReplyTo?: string | null; messageId: string },
): Promise<SendResult> {
  const smtp = smtpConfig(ws);
  const from = fromAddress(ws, smtp?.config);
  if (!smtp) {
    return { delivery: "sandbox", providerId: `<${m.messageId}.sandbox@comuno.local>`, from };
  }
  if (!from) throw new MailError("No sender address. Set a sender email in Settings or `from` in SMTP settings.", false);
  try {
    const domain = (from.match(/@([^>\s]+)/)?.[1] || "comuno.local").toLowerCase();
    const info = await transportFor(smtp.config).sendMail({
      from,
      to: m.to,
      subject: m.subject,
      text: m.text,
      html: m.html,
      messageId: `<${m.messageId}@${domain}>`,
      inReplyTo: m.inReplyTo || undefined,
      references: m.inReplyTo || undefined,
    });
    if (info.rejected?.length && !info.accepted?.length) {
      throw new MailError(`Recipient rejected: ${info.rejected.join(", ")}`, true);
    }
    return { delivery: "smtp", providerId: info.messageId || null, from };
  } catch (e) {
    if (e instanceof MailError) throw e;
    const err = e as { message?: string; responseCode?: number; code?: string };
    const permanent = err.code === "EENVELOPE" || (typeof err.responseCode === "number" && err.responseCode >= 550 && err.responseCode < 560);
    throw new MailError(`SMTP error: ${err.message || "send failed"}`, permanent);
  }
}

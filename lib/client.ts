"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Fetch JSON from our API. Throws an Error carrying the server's message on failure. */
export async function api<T = unknown>(url: string, init?: Omit<RequestInit, "body"> & { body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
  }
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export const post = <T = unknown>(url: string, body?: unknown) => api<T>(url, { method: "POST", body: body ?? {} });
export const patch = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: "PATCH", body });
export const del = <T = unknown>(url: string) => api<T>(url, { method: "DELETE" });

/** Minimal data-fetching hook. Pass null to skip. `reload()` refetches and resolves when done. */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [nonce, setNonce] = useState(0);
  const waiters = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    api<T>(url)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        waiters.current.splice(0).forEach((w) => w());
      });
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => {
    if (!url) return Promise.resolve();
    setLoading(true);
    setNonce((n) => n + 1);
    return new Promise<void>((resolve) => waiters.current.push(resolve));
  }, [url]);

  return { data, error, loading, reload, setData };
}

/** Wrap an async action with loading + error state. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setLoading(true);
      setError(null);
      try {
        return await fn(...args);
      } catch (e) {
        setError((e as Error).message);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );
  return { run, loading, error, setError };
}

export function fullName(c: { first_name?: string | null; last_name?: string | null; email?: string | null }) {
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.email || "Unnamed";
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString();
}

export function money(n: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
}

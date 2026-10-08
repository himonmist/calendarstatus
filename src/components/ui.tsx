"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export function Badge({ tone = "neutral", children }: { tone?: "ok" | "warn" | "busy" | "info" | "neutral"; children: ReactNode }) {
  const t = { ok: "bg-green-50 text-green-700 ring-green-200", warn: "bg-amber-50 text-amber-800 ring-amber-200", busy: "bg-red-50 text-red-700 ring-red-200",
    info: "bg-blue-50 text-blue-700 ring-blue-200", neutral: "bg-ink-100 text-ink-700 ring-ink-300" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${t}`}>{children}</span>;
}

export const statusTone = (s: string) => (s === "confirmed" || s === "completed" ? "ok" : s === "pending" ? "warn" : s === "cancelled" || s === "rejected" || s === "no_show" ? "busy" : "info") as "ok" | "warn" | "busy" | "info";

type Toast = { id: number; msg: string; kind: "ok" | "err" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems(x => [...x, { id, msg, kind }]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:items-end">
        {items.map(t => (
          <div key={t.id} role="status" className={`max-w-sm rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.kind === "ok" ? "bg-ink-950" : "bg-red-600"}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return <div className="rounded-2xl border border-dashed border-ink-300 p-10 text-center"><p className="font-semibold">{title}</p>{hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p>{message}</p>{onRetry && <button onClick={onRetry} className="btn-ghost mt-3">Try again</button>}
    </div>
  );
}

export async function api<T = any>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init, method: init?.method ?? (init?.json ? "POST" : "GET"), credentials: "same-origin",
    headers: { ...(init?.json ? { "content-type": "application/json" } : {}), ...init?.headers },
    body: init?.json ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Something went wrong. Please try again."), { status: res.status, code: data.code, fields: data.fields });
  return data as T;
}

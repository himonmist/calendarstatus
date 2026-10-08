"use client";
import { useState } from "react";
import { api, Badge, EmptyState, ErrorState, statusTone, useToast } from "@/components/ui";
import { useApi } from "@/components/use-api";

const STATUSES = ["pending", "confirmed", "rejected", "cancelled", "completed", "no_show"];
const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

export default function Bookings() {
  const toast = useToast(); const [filter, setFilter] = useState(""); const [open, setOpen] = useState<string | null>(null);
  const { data, error, reload } = useApi<{ bookings: any[] }>(`/api/admin/bookings${filter ? `?status=${filter}` : ""}`);
  async function setStatus(id: string, status: string) {
    try { await api(`/api/admin/bookings/${id}`, { method: "PATCH", json: { status } }); toast(`Marked ${status}`); void reload(); } catch (e: any) { toast(e.message, "err"); }
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Bookings &amp; leads</h1>
        <select aria-label="Filter by status" className="input !w-auto" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}</select>
      </header>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="skeleton h-48" /> : data.bookings.length === 0 ? <EmptyState title="No bookings yet" hint="New requests will appear here." /> : (
        <div className="card divide-y divide-ink-100">
          {data.bookings.map(b => (
            <div key={b.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button className="text-left" onClick={() => setOpen(open === b.id ? null : b.id)} aria-expanded={open === b.id}>
                  <p className="font-medium">{b.organization} <span className="text-ink-500">· {b.fullName}</span></p>
                  <p className="text-sm text-ink-500">{b.programTitle} · {fmt(b.start, b.timezone)} · {b.participants} pax · <span className="font-mono text-xs">{b.reference}</span></p>
                </button>
                <div className="flex items-center gap-2"><Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  {b.status === "pending" && <><button className="btn-brand !py-1.5" onClick={() => setStatus(b.id, "confirmed")}>Approve</button><button className="btn-ghost !py-1.5" onClick={() => setStatus(b.id, "rejected")}>Reject</button></>}
                  {b.status === "confirmed" && <><button className="btn-ghost !py-1.5" onClick={() => setStatus(b.id, "completed")}>Complete</button><button className="btn-ghost !py-1.5" onClick={() => setStatus(b.id, "no_show")}>No show</button><button className="btn-ghost !py-1.5 text-red-700" onClick={() => setStatus(b.id, "cancelled")}>Cancel</button></>}
                </div>
              </div>
              {open === b.id && (
                <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  {([["Contact", `${b.fullName} · ${b.email} · ${b.phone}`], ["Industry", b.industry], ["Location", [b.city, b.country].filter(Boolean).join(", ")], ["Format", b.format], ["Lead source", b.leadSource], ["Budget", b.budgetRange],
                    ["Calendar", b.calendarSynced ? "Synced to Google Calendar" : b.syncError ?? "Not synced"], ["Notes", b.notes]] as const).map(([k, v]) => v ? <div key={k}><dt className="text-ink-500">{k}</dt><dd className="font-medium">{v}</dd></div> : null)}
                  <div className="sm:col-span-2"><dt className="text-ink-500">History</dt><dd className="text-xs">{b.history.map((h: any) => `${h.status} (${h.actor})`).join(" → ")}</dd></div>
                </dl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

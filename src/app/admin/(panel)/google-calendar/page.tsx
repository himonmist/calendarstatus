"use client";
import { useState } from "react";
import { api, Badge, ErrorState, useToast } from "@/components/ui";
import { useApi } from "@/components/use-api";

export default function GoogleCalendar() {
  const toast = useToast(); const { data, error, reload } = useApi<any>("/api/admin/calendar/status"); const [busy, setBusy] = useState(false);
  async function sync() {
    setBusy(true);
    try { await api("/api/admin/calendar/sync", { method: "POST" }); toast("Calendar synchronized"); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); void reload(); }
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <div className="skeleton h-48" />;
  const attention = data.health !== "healthy";
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Google Calendar</h1>
      {attention && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">⚠ Calendar synchronization requires attention.{data.health === "needs_reauth" && " Your Google Calendar connection needs to be re-authorized."}</div>}
      <section className="card space-y-3 p-5">
        <p className="flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full ${data.connected && !attention ? "bg-ok" : "bg-warn"}`} />{data.demo ? "Demo calendar (no Google account connected)" : data.connected ? "Connected" : "Not connected"}</p>
        {data.googleEmail && <p className="text-sm text-ink-700">Account: {data.googleEmail}</p>}
        <p className="text-sm text-ink-700">Last synchronized: {data.lastSyncedAt ? new Date(data.lastSyncedAt).toLocaleString() : "never"}</p>
        <p className="text-sm text-ink-700">Sync status: <Badge tone={attention ? "warn" : "ok"}>{attention ? "Needs attention" : "Healthy"}</Badge></p>
        <div className="flex flex-wrap gap-3 pt-2">
          <a className="btn-primary" href="/api/admin/calendar/connect">{data.connected && !data.demo ? "Reconnect Google Calendar" : "Connect Google Calendar"}</a>
          <button className="btn-ghost" onClick={sync} disabled={busy}>{busy ? "Syncing…" : "Sync now"}</button>
        </div>
      </section>
      <p className="text-xs text-ink-500">The public site only ever shows “Available” or “Busy”. Event titles, attendees and locations never leave the server.</p>
    </div>
  );
}

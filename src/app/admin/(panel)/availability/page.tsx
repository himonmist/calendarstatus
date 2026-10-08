"use client";
import { useEffect, useState } from "react";
import { api, ErrorState, useToast } from "@/components/ui";
import { useApi } from "@/components/use-api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Availability() {
  const toast = useToast();
  const { data, error, reload } = useApi<any>("/api/admin/availability");
  const [cfg, setCfg] = useState<any>(null); const [newDate, setNewDate] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setCfg(structuredClone(data.availability)); }, [data]);
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!cfg) return <div className="skeleton h-96" />;
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const day = (i: number, v: any) => setCfg({ ...cfg, weekly: { ...cfg.weekly, [i]: v } });

  async function save() {
    setBusy(true);
    try { await api("/api/admin/availability", { json: cfg }); toast("Availability saved"); void reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(false); }
  }
  const num = (k: string, l: string, unit: string) => <div><label className="label" htmlFor={k}>{l}</label><div className="flex items-center gap-2"><input id={k} type="number" min={0} className="input" value={cfg[k]} onChange={e => set(k, Number(e.target.value))} /><span className="text-xs text-ink-500">{unit}</span></div></div>;
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Availability settings</h1>
      <section className="card space-y-4 p-5"><h2 className="font-semibold">General</h2>
        <div><label className="label" htmlFor="tz">Timezone</label><input id="tz" className="input" value={cfg.timezone} onChange={e => set("timezone", e.target.value)} list="tzs" /><datalist id="tzs">{["Asia/Dhaka", "UTC", "Europe/London", "America/New_York"].map(z => <option key={z} value={z} />)}</datalist></div>
        <div className="grid gap-4 sm:grid-cols-2">{num("minNoticeHours", "Minimum booking notice", "hours")}{num("maxAdvanceDays", "Advance booking limit", "days")}{num("bufferBeforeMin", "Buffer before", "min")}{num("bufferAfterMin", "Buffer after", "min")}{num("stepMin", "Slot interval", "min")}</div>
      </section>
      <section className="card p-5"><h2 className="font-semibold">Working hours</h2>
        <ul className="mt-3 divide-y divide-ink-100">{DAYS.map((n, i) => { const h = cfg.weekly[i]; return (
          <li key={n} className="flex flex-wrap items-center gap-3 py-2.5">
            <span className="w-28 text-sm font-medium">{n}</span>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!h} onChange={e => day(i, e.target.checked ? { start: "10:00", end: "18:00" } : null)} /> Open</label>
            {h ? <><input aria-label={`${n} start`} type="time" className="input !w-auto" value={h.start} onChange={e => day(i, { ...h, start: e.target.value })} /><span>–</span><input aria-label={`${n} end`} type="time" className="input !w-auto" value={h.end} onChange={e => day(i, { ...h, end: e.target.value })} /></> : <span className="text-sm text-ink-500">Closed</span>}
          </li>); })}</ul>
      </section>
      <section className="card p-5"><h2 className="font-semibold">Blocked dates &amp; holidays</h2>
        <div className="mt-3 flex gap-2"><input type="date" aria-label="Date to block" className="input !w-auto" value={newDate} onChange={e => setNewDate(e.target.value)} /><button className="btn-ghost" disabled={!newDate} onClick={() => { if (!cfg.blockedDates.includes(newDate)) set("blockedDates", [...cfg.blockedDates, newDate].sort()); setNewDate(""); }}>Block date</button></div>
        <ul className="mt-3 flex flex-wrap gap-2">{cfg.blockedDates.map((d: string) => <li key={d} className="flex items-center gap-2 rounded-full bg-ink-100 px-3 py-1 text-sm">{d}<button aria-label={`Unblock ${d}`} onClick={() => set("blockedDates", cfg.blockedDates.filter((x: string) => x !== d))}>×</button></li>)}{!cfg.blockedDates.length && <li className="text-sm text-ink-500">No blocked dates</li>}</ul>
      </section>
      <button className="btn-brand" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
    </div>
  );
}

"use client";
import { useState } from "react";
import { BarList, Kpi, toList } from "@/components/charts";
import { ErrorState } from "@/components/ui";
import { useApi } from "@/components/use-api";

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
export default function Analytics() {
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const q = new URLSearchParams({ ...(from && { from }), ...(to && { to: `${to}T23:59:59Z` }) }).toString();
  const { data, error, reload } = useApi<any>(`/api/admin/dashboard${q ? `?${q}` : ""}`);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <div className="flex gap-3 text-sm">
          <div><label className="label" htmlFor="f">From</label><input id="f" type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><label className="label" htmlFor="t">To</label><input id="t" type="date" className="input" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
      </header>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="skeleton h-40" /> : (() => {
        const a = data.analytics, k = a.kpis;
        return (<>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Total bookings" value={k.total} /><Kpi label="Confirmed" value={k.confirmed} /><Kpi label="Cancellation rate" value={pct(k.cancellationRate)} /><Kpi label="Lead conversion" value={pct(k.leadConversion)} />
            <Kpi label="Organizations" value={k.organizations} /><Kpi label="Participants" value={k.participants} /><Kpi label="Training hours" value={k.trainingHours} /><Kpi label="Customers" value={k.customers} />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <BarList title="Monthly booking trend" data={a.byMonth.map((m: any) => ({ label: m.month, value: m.count }))} />
            <BarList title="Most requested training" data={a.byProgram.map((p: any) => ({ label: p.title, value: p.count }))} />
            <BarList title="Lead sources" data={toList(a.byLeadSource)} />
            <BarList title="Most popular days" data={a.byWeekday.map((v: number, i: number) => ({ label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i], value: v }))} />
            <BarList title="Most popular times" data={toList(a.byHour)} />
          </div></>);
      })()}
    </div>
  );
}

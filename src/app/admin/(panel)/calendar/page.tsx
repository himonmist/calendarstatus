"use client";
import { useMemo, useState } from "react";
import { Badge, ErrorState } from "@/components/ui";
import { useApi } from "@/components/use-api";

type Item = { id: string; title: string; start: string; end: string; kind: "busy" | "confirmed" | "pending" | "blocked" };
const VIEWS = ["Month", "Week", "Day", "Agenda"] as const;
const COLORS: Record<Item["kind"], string> = { busy: "bg-red-100 text-red-800", confirmed: "bg-blue-100 text-blue-800", pending: "bg-amber-100 text-amber-900", blocked: "bg-ink-300 text-ink-900" };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export default function CalendarPage() {
  const [view, setView] = useState<(typeof VIEWS)[number]>("Month");
  const [cursor, setCursor] = useState(() => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z"));
  const [sel, setSel] = useState(iso(new Date()));
  const range = useMemo(() => {
    if (view === "Month") { const f = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1)); const s = addDays(f, -f.getUTCDay()); return { from: s, to: addDays(s, 41) }; }
    if (view === "Week") { const s = addDays(cursor, -cursor.getUTCDay()); return { from: s, to: addDays(s, 6) }; }
    if (view === "Day") return { from: cursor, to: cursor };
    return { from: cursor, to: addDays(cursor, 30) };
  }, [view, cursor]);
  const { data, error, reload } = useApi<any>(`/api/admin/calendar?from=${iso(range.from)}&to=${iso(range.to)}`);
  const tz = data?.timezone ?? "Asia/Dhaka";
  const dayOf = (s: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(s));
  const time = (s: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(s));
  const items: Item[] = useMemo(() => !data ? [] : [
    ...data.events.map((e: any) => ({ ...e, kind: "busy" as const })),
    ...data.bookings.filter((b: any) => ["pending", "confirmed", "rescheduled"].includes(b.status)).map((b: any) => ({ id: b.id, title: b.title, start: b.start, end: b.end, kind: b.status === "pending" ? "pending" as const : "confirmed" as const })),
  ], [data]);
  const byDay = (d: string) => items.filter(i => dayOf(i.start) === d).sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const step = view === "Month" ? 30 : view === "Week" ? 7 : view === "Day" ? 1 : 30;
  const days = (n: number, s: Date) => Array.from({ length: n }, (_, i) => iso(addDays(s, i)));
  const Row = ({ i }: { i: Item }) => <div className={`rounded-md px-2 py-1 text-xs ${COLORS[i.kind]}`}><span className="font-medium">{time(i.start)}</span> {i.title}</div>;
  const dayStatus = (d: string) => data?.blockedDates.includes(d) ? "blocked" : data?.weekly?.[new Date(d + "T12:00:00Z").getUTCDay()] ? null : "closed";

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar <span className="text-sm font-normal text-ink-500">({tz})</span></h1>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" className="flex rounded-xl bg-ink-100 p-1">{VIEWS.map(v => <button key={v} role="tab" aria-selected={v === view} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-sm ${v === view ? "bg-white font-medium shadow-sm" : "text-ink-700"}`}>{v}</button>)}</div>
          <button className="btn-ghost" onClick={() => setCursor(addDays(cursor, -step))} aria-label="Previous">‹</button>
          <button className="btn-ghost" onClick={() => setCursor(new Date(iso(new Date()) + "T00:00:00Z"))}>Today</button>
          <button className="btn-ghost" onClick={() => setCursor(addDays(cursor, step))} aria-label="Next">›</button>
        </div>
      </header>
      <ul className="flex flex-wrap gap-3 text-xs"><li><Badge tone="ok">Available</Badge></li><li><Badge tone="busy">Busy (Google)</Badge></li><li><Badge tone="info">Confirmed</Badge></li><li><Badge tone="warn">Pending</Badge></li><li><Badge>Blocked</Badge></li></ul>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="skeleton h-96" /> : (
        <>
          {view === "Month" && (
            <div className="card overflow-x-auto p-2"><div className="grid min-w-[640px] grid-cols-7 gap-px text-xs">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className="p-2 text-center font-medium text-ink-500">{d}</div>)}
              {days(42, range.from).map(d => { const st = dayStatus(d), its = byDay(d), inMonth = d.slice(0, 7) === iso(cursor).slice(0, 7);
                return (<button key={d} onClick={() => setSel(d)} className={`min-h-24 rounded-lg p-1.5 text-left align-top ${sel === d ? "ring-2 ring-brand" : ""} ${st ? "bg-ink-100" : "bg-green-50/60"} ${inMonth ? "" : "opacity-50"}`}>
                  <span className="font-medium">{Number(d.slice(8))}</span>{st && <span className="ml-1 text-[10px] text-ink-500">{st}</span>}
                  <div className="mt-1 space-y-0.5">{its.slice(0, 3).map(i => <Row key={i.id} i={i} />)}{its.length > 3 && <p className="text-ink-500">+{its.length - 3} more</p>}</div></button>); })}
            </div></div>
          )}
          {view === "Week" && <div className="grid gap-3 md:grid-cols-7">{days(7, range.from).map(d => <div key={d} className="card p-3"><p className="text-xs font-semibold">{new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}</p><div className="mt-2 space-y-1">{byDay(d).map(i => <Row key={i.id} i={i} />)}{!byDay(d).length && <p className="text-xs text-ink-500">{dayStatus(d) ?? "Free"}</p>}</div></div>)}</div>}
          {view === "Day" && <div className="card p-4"><div className="space-y-1.5">{byDay(iso(cursor)).map(i => <Row key={i.id} i={i} />)}{!byDay(iso(cursor)).length && <p className="text-sm text-ink-500">Nothing scheduled — {dayStatus(iso(cursor)) ?? "available"}.</p>}</div></div>}
          {view === "Agenda" && <div className="card divide-y divide-ink-100">{days(31, range.from).filter(d => byDay(d).length).map(d => <div key={d} className="p-4"><p className="text-sm font-semibold">{d}</p><div className="mt-2 space-y-1">{byDay(d).map(i => <Row key={i.id} i={i} />)}</div></div>)}</div>}
          <section className="card p-5" aria-live="polite">
            <h2 className="font-semibold">{sel}</h2>
            <p className="text-xs text-ink-500">Private Google Calendar details are visible only to signed-in admins.</p>
            <div className="mt-3 space-y-1.5">{byDay(sel).map(i => <Row key={i.id} i={i} />)}{!byDay(sel).length && <p className="text-sm text-ink-500">No events. {dayStatus(sel) === "blocked" ? "Blocked date." : dayStatus(sel) === "closed" ? "Outside working days." : "Available."}</p>}</div>
          </section>
        </>
      )}
    </div>
  );
}

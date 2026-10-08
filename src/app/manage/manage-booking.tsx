"use client";
import { useState } from "react";
import { api, Badge, statusTone, useToast } from "@/components/ui";

type B = { reference: string; status: string; programTitle: string; start: string; end: string; timezone: string; format: string; organization: string; fullName: string };
type Slot = { start: string; end: string; available: boolean };
const fmt = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "full", timeStyle: "short" }).format(new Date(iso));

export function ManageBooking() {
  const toast = useToast();
  const [ref, setRef] = useState(""); const [email, setEmail] = useState("");
  const [b, setB] = useState<B | null>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(""); const [slots, setSlots] = useState<Slot[] | null>(null); const [programId, setProgramId] = useState("");

  async function find(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const r = await api<{ booking: B }>(`/api/public/bookings/${encodeURIComponent(ref.trim().toUpperCase())}`, { json: { email } }); setB(r.booking); }
    catch (x: any) { setErr(x.message); setB(null); } finally { setBusy(false); }
  }
  async function cancel() {
    if (!b || !confirm("Cancel this booking?")) return;
    try { const r = await api<{ booking: B }>(`/api/public/bookings/${b.reference}/cancel`, { json: { email } }); setB(r.booking); toast("Booking cancelled"); } catch (x: any) { toast(x.message, "err"); }
  }
  async function loadSlots(d: string) {
    setDate(d); setSlots(null);
    try {
      const progs = await api<{ programs: { id: string; title: string }[] }>("/api/public/training-programs");
      const pid = programs(progs.programs, b!.programTitle) ?? progs.programs[0].id; setProgramId(pid);
      setSlots((await api<{ slots: Slot[] }>(`/api/public/availability/${d}?program=${pid}`)).slots);
    } catch (x: any) { toast(x.message, "err"); }
  }
  const programs = (list: { id: string; title: string }[], title: string) => list.find(p => p.title === title)?.id;
  async function move(s: Slot) {
    try { const r = await api<{ booking: B }>(`/api/public/bookings/${b!.reference}/reschedule`, { json: { email, slotStart: s.start } }); setB(r.booking); setSlots(null); setDate(""); toast("Booking rescheduled"); }
    catch (x: any) { toast(x.message, "err"); if (x.status === 409) void loadSlots(date); }
  }
  void programId;
  const active = b && ["pending", "confirmed", "rescheduled"].includes(b.status);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Manage your booking</h1>
      <p className="mt-1 text-sm text-ink-500">Enter your booking reference and the email you used to book.</p>
      <form onSubmit={find} className="card mt-6 grid gap-4 p-5">
        <div><label className="label" htmlFor="ref">Booking reference</label><input id="ref" className="input" placeholder="TRN-2026-00125" value={ref} onChange={e => setRef(e.target.value)} required /></div>
        <div><label className="label" htmlFor="em">Email</label><input id="em" type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? "Searching…" : "Find booking"}</button>
      </form>
      {b && (
        <div className="card mt-6 p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">{b.programTitle}</h2><Badge tone={statusTone(b.status)}>{b.status}</Badge></div>
          <p className="mt-2 text-sm text-ink-700">{fmt(b.start, b.timezone)} ({b.timezone})</p>
          <p className="text-sm text-ink-500">{b.organization} · <span className="capitalize">{b.format}</span> · {b.reference}</p>
          {active && (
            <div className="mt-5 space-y-4">
              <div><label className="label" htmlFor="rd">Reschedule — pick a new date</label><input id="rd" type="date" className="input !w-auto" value={date} onChange={e => e.target.value && loadSlots(e.target.value)} /></div>
              {date && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{slots === null ? <div className="skeleton h-12" /> : slots.filter(s => s.available).map(s => (
                <button key={s.start} className="btn-ghost" onClick={() => move(s)}>{new Intl.DateTimeFormat("en-US", { timeZone: b.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(s.start))}</button>))}
                {slots?.filter(s => s.available).length === 0 && <p className="col-span-full text-sm text-ink-500">No available times that day.</p>}</div>}
              <button className="btn-ghost text-red-700" onClick={cancel}>Cancel booking</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

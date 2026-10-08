"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { bookingInputSchema, FORMATS } from "@/lib/validation";
import { api, Badge, ErrorState, useToast } from "@/components/ui";

type Program = { id: string; title: string; shortDescription: string; durationMin: number; formats: string[]; audience?: string; minParticipants: number; maxParticipants: number; priceText: string };
type Slot = { start: string; end: string; available: boolean };
type DayStatus = "available" | "limited" | "busy" | "unavailable";
type Booking = { reference: string; status: string; programTitle: string; start: string; end: string; timezone: string; format: string; organization: string; fullName: string };

const STEPS = ["Training", "Date", "Time", "Details", "Confirmed"];
const formSchema = bookingInputSchema.omit({ programId: true, slotStart: true, holdToken: true });
type FormValues = z.input<typeof formSchema>;

const dur = (m: number) => (m >= 480 ? "1 day" : m % 60 === 0 ? `${m / 60} hours` : `${m} min`);
const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const fmtTime = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
const fmtDay = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, dateStyle: "full" }).format(new Date(iso));

export function BookingFlow() {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [programs, setPrograms] = useState<Program[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [program, setProgram] = useState<Program | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [days, setDays] = useState<Record<string, DayStatus> | null>(null);
  const [trainerTz, setTrainerTz] = useState("Asia/Dhaka");
  const [viewTz, setViewTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dhaka");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [hold, setHold] = useState<{ token: string; expiresAt: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState<Booking | null>(null);

  useEffect(() => {
    api<{ programs: Program[] }>("/api/public/training-programs").then(r => {
      setPrograms(r.programs);
      const pre = new URLSearchParams(window.location.search).get("program");
      const p = r.programs.find(x => x.id === pre);
      if (p) { setProgram(p); setStep(1); }
    }).catch(e => setLoadErr(e.message));
  }, []);

  const loadMonth = useCallback(async () => {
    if (!program) return;
    setDays(null);
    try { const r = await api<{ days: Record<string, DayStatus>; timezone: string }>(`/api/public/availability?program=${program.id}&month=${month}`); setDays(r.days); setTrainerTz(r.timezone); setLoadErr(""); }
    catch (e: any) { setLoadErr(e.message); }
  }, [program, month]);
  useEffect(() => { if (step === 1) void loadMonth(); }, [step, loadMonth]);

  const loadDay = useCallback(async (d: string) => {
    if (!program) return;
    setSlots(null); setSlot(null);
    try { setSlots((await api<{ slots: Slot[] }>(`/api/public/availability/${d}?program=${program.id}`)).slots); setLoadErr(""); }
    catch (e: any) { setLoadErr(e.message); }
  }, [program]);

  // Reservation countdown
  useEffect(() => {
    if (!hold) return;
    const t = setInterval(() => {
      const r = Math.max(0, Math.round((hold.expiresAt - Date.now()) / 1000));
      setLeft(r);
      if (r === 0) { setHold(null); setNotice("Your reservation expired. Please choose a time again."); setStep(2); void loadDay(date); }
    }, 1000);
    setLeft(Math.max(0, Math.round((hold.expiresAt - Date.now()) / 1000)));
    return () => clearInterval(t);
  }, [hold, date, loadDay]);

  async function reserve(s: Slot) {
    if (!program) return;
    setBusy(true); setNotice("");
    try {
      const r = await api<{ token: string; expiresAt: string }>("/api/public/reservations", { json: { programId: program.id, slotStart: s.start } });
      setSlot(s); setHold({ token: r.token, expiresAt: new Date(r.expiresAt).getTime() }); setStep(3);
    } catch (e: any) {
      setNotice(e.message); toast(e.message, "err"); void loadDay(date);
    } finally { setBusy(false); }
  }

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: { format: "online", leadSource: "website" } as any });
  async function submit(v: FormValues) {
    if (!program || !slot || !hold) return;
    setBusy(true); setNotice("");
    try {
      const params = new URLSearchParams(window.location.search);
      const src = params.get("src");
      const body = { ...v, participants: Number(v.participants), programId: program.id, slotStart: slot.start, holdToken: hold.token, ...(src && (["linkedin", "whatsapp", "email", "referral", "qr", "direct"] as string[]).includes(src) ? { leadSource: src } : {}) };
      const r = await api<{ booking: Booking }>("/api/public/bookings", { json: body });
      setHold(null); setDone(r.booking); setStep(4);
    } catch (e: any) {
      if (e.status === 409) { setNotice(e.message); setHold(null); setStep(2); void loadDay(date); }
      else if (e.fields) e.fields.forEach((f: any) => form.setError(f.path, { message: f.message }));
      else toast(e.message, "err");
    } finally { setBusy(false); }
  }

  const grid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { y, m, cells: [...Array(first).fill(null), ...Array.from({ length: n }, (_, i) => i + 1)] };
  }, [month]);
  const shiftMonth = (d: number) => { const [y, m] = month.split("-").map(Number); setMonth(new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7)); };
  const tzList = useMemo(() => { try { return (Intl as any).supportedValuesOf("timeZone") as string[]; } catch { return ["Asia/Dhaka", "UTC", "Europe/London"]; } }, []);
  const mmss = `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div>
      <ol className="mb-8 flex items-center gap-2 overflow-x-auto text-xs" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 font-medium ${i === step ? "bg-ink-950 text-white" : i < step ? "bg-brand-soft text-brand-dark" : "bg-ink-100 text-ink-500"}`}>
            <span>{i + 1}</span>{s}
          </li>
        ))}
      </ol>

      {notice && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{notice}</div>}
      {loadErr && step !== 0 && <div className="mb-5"><ErrorState message={loadErr} onRetry={() => (step === 1 ? loadMonth() : loadDay(date))} /></div>}

      {step === 0 && (
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Select a training program</h1>
          {loadErr && <div className="mt-4"><ErrorState message={loadErr} /></div>}
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {programs === null && !loadErr && Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton h-44" />)}
            {programs?.map(p => (
              <article key={p.id} className="card flex flex-col p-5">
                <h2 className="font-semibold">{p.title}</h2>
                <p className="mt-1 flex-1 text-sm text-ink-500">{p.shortDescription}</p>
                <p className="mt-3 text-xs text-ink-700">{dur(p.durationMin)} · <span className="capitalize">{p.formats.join(" / ")}</span>{p.audience ? ` · ${p.audience}` : ""}</p>
                <button className="btn-primary mt-4" onClick={() => { setProgram(p); setNotice(""); setStep(1); }}>Book This Program</button>
              </article>
            ))}
          </div>
          <p className="mt-6 text-sm text-ink-500">Need something different? <a className="font-medium text-brand underline" href="/custom-request">Request a custom AI training program</a>.</p>
        </section>
      )}

      {step === 1 && program && (
        <section>
          <button className="text-sm text-ink-500 underline" onClick={() => setStep(0)}>← Change program</button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Choose a date</h1>
          <p className="text-sm text-ink-500">{program.title} · {dur(program.durationMin)}</p>
          <div className="card mt-6 p-4 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <button className="btn-ghost" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</button>
              <h2 className="font-semibold" aria-live="polite">{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}</h2>
              <button className="btn-ghost" onClick={() => shiftMonth(1)} aria-label="Next month">›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-500">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-1">{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {grid.cells.map((d, i) => {
                if (d === null) return <div key={i} />;
                const key = ymd(grid.y, grid.m, d), st = days?.[key];
                const ok = st === "available" || st === "limited";
                const tone = st === "available" ? "bg-green-50 text-green-800 ring-green-200 hover:bg-green-100" : st === "limited" ? "bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100" : st === "busy" ? "bg-red-50 text-red-700 ring-red-100" : "bg-ink-50 text-ink-300 ring-transparent";
                return (
                  <button key={i} disabled={!ok} onClick={() => { setDate(key); setNotice(""); setStep(2); void loadDay(key); }}
                    aria-label={`${key} ${st ?? "loading"}`} className={`aspect-square rounded-xl text-sm font-medium ring-1 ring-inset transition-colors disabled:cursor-not-allowed ${days ? tone : "skeleton"}`}>{d}</button>
                );
              })}
            </div>
            <ul className="mt-5 flex flex-wrap gap-4 text-xs text-ink-700">
              <li>🟢 Available</li><li>🟡 Limited availability</li><li>🔴 Busy</li><li>⚪ Unavailable</li>
            </ul>
          </div>
        </section>
      )}

      {step === 2 && program && (
        <section>
          <button className="text-sm text-ink-500 underline" onClick={() => setStep(1)}>← Change date</button>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Choose a time</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <label className="text-ink-700" htmlFor="tz">Times shown in</label>
            <select id="tz" className="input !w-auto" value={viewTz} onChange={e => setViewTz(e.target.value)}>
              {[...new Set([trainerTz, viewTz, ...tzList])].map(z => <option key={z}>{z}</option>)}
            </select>
            {viewTz !== trainerTz && <Badge tone="info">Trainer is in {trainerTz}</Badge>}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {slots === null && !loadErr && Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-16" />)}
            {slots?.length === 0 && <p className="col-span-full text-ink-500">No times on this date. Please pick another day.</p>}
            {slots?.map(s => (
              <button key={s.start} disabled={!s.available || busy} onClick={() => reserve(s)}
                className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${s.available ? "border-green-200 bg-green-50 text-green-900 hover:bg-green-100" : "cursor-not-allowed border-ink-100 bg-ink-50 text-ink-300"}`}>
                {fmtTime(s.start, viewTz)} – {fmtTime(s.end, viewTz)}
                <span className="mt-0.5 block text-xs font-normal">{s.available ? "Available" : "Busy"}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && program && slot && (
        <section>
          <div role="status" className="sticky top-16 z-10 mb-6 flex items-center justify-between rounded-xl bg-ink-950 px-4 py-3 text-sm text-white">
            <span>This time slot is temporarily reserved for you.</span><span className="font-mono text-base" aria-label="time remaining">{mmss}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Your details</h1>
          <p className="mt-1 text-sm text-ink-500">{program.title} · {fmtDay(slot.start, viewTz)} · {fmtTime(slot.start, viewTz)} – {fmtTime(slot.end, viewTz)} ({viewTz})</p>
          <form onSubmit={form.handleSubmit(submit)} className="card mt-6 grid gap-4 p-5 sm:grid-cols-2 sm:p-6" noValidate>
            {([["fullName", "Full name *", "text"], ["organization", "Organization *", "text"], ["designation", "Designation", "text"], ["email", "Email *", "email"], ["phone", "Phone * (+8801…)", "tel"],
              ["country", "Country", "text"], ["city", "City", "text"], ["industry", "Industry", "text"], ["organizationType", "Organization type", "text"], ["experienceLevel", "Participants' AI experience", "text"]] as const).map(([k, l, t]) => (
              <div key={k}><label className="label" htmlFor={k}>{l}</label>
                <input id={k} type={t} className="input" autoComplete={k === "email" ? "email" : k === "phone" ? "tel" : "off"} aria-invalid={!!(form.formState.errors as any)[k]} {...form.register(k as any)} />
                {(form.formState.errors as any)[k] && <p className="mt-1 text-xs text-red-600">{(form.formState.errors as any)[k].message}</p>}
              </div>
            ))}
            <div><label className="label" htmlFor="participants">Number of participants * ({program.minParticipants}–{program.maxParticipants})</label>
              <input id="participants" type="number" min={program.minParticipants} max={program.maxParticipants} className="input" {...form.register("participants", { valueAsNumber: true })} />
              {form.formState.errors.participants && <p className="mt-1 text-xs text-red-600">{form.formState.errors.participants.message}</p>}</div>
            <div><label className="label" htmlFor="format">Preferred format</label>
              <select id="format" className="input" {...form.register("format")}>{FORMATS.filter(f => program.formats.includes(f)).map(f => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}</select></div>
            <div><label className="label" htmlFor="location">Preferred location (on-site)</label><input id="location" className="input" {...form.register("location")} /></div>
            <div><label className="label" htmlFor="budgetRange">Budget range</label><input id="budgetRange" className="input" {...form.register("budgetRange")} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="notes">Tell us about your training requirements</label>
              <textarea id="notes" rows={4} maxLength={5000} className="input" {...form.register("notes")} /></div>
            <p className="text-xs text-ink-500 sm:col-span-2">We use your details only to arrange and confirm this booking.</p>
            <div className="sm:col-span-2"><button className="btn-brand w-full sm:w-auto" disabled={busy}>{busy ? "Booking…" : "Submit booking request"}</button></div>
          </form>
        </section>
      )}

      {step === 4 && done && (
        <section className="card mx-auto max-w-xl p-6 sm:p-8">
          <Badge tone={done.status === "confirmed" ? "ok" : "warn"}>{done.status === "confirmed" ? "🟢 Confirmed" : "🟡 Pending Confirmation"}</Badge>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">{done.status === "confirmed" ? "Booking Confirmed" : "Booking Request Received"}</h1>
          <p className="mt-1 text-ink-500">Thank you, {done.fullName}. A confirmation email is on its way.</p>
          <dl className="mt-6 divide-y divide-ink-100 text-sm">
            {([["Training", done.programTitle], ["Date", fmtDay(done.start, viewTz)], ["Time", `${fmtTime(done.start, viewTz)} – ${fmtTime(done.end, viewTz)} (${viewTz})`], ["Format", done.format], ["Organization", done.organization], ["Reference", done.reference]] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2.5"><dt className="text-ink-500">{k}</dt><dd className="text-right font-medium capitalize-first">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-6 flex gap-3"><a className="btn-primary" href="/manage">Manage booking</a><a className="btn-ghost" href="/">Back to home</a></div>
        </section>
      )}
    </div>
  );
}

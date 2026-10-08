"use client";
import { useState } from "react";
import { api, useToast } from "@/components/ui";

export function CustomRequestForm() {
  const toast = useToast();
  const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [errs, setErrs] = useState<Record<string, string>>({});
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErrs({});
    const f = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    try { await api("/api/public/custom-requests", { json: { ...f, participants: Number(f.participants) } }); setSent(true); }
    catch (x: any) { if (x.fields) setErrs(Object.fromEntries(x.fields.map((y: any) => [y.path, y.message]))); toast(x.message, "err"); } finally { setBusy(false); }
  }
  if (sent) return <div className="card p-8 text-center"><h1 className="text-xl font-semibold">Request received</h1><p className="mt-2 text-ink-500">Thank you — you'll hear back shortly with a tailored proposal.</p></div>;
  const F = ({ n, l, t = "text", req = false }: { n: string; l: string; t?: string; req?: boolean }) => (
    <div><label className="label" htmlFor={n}>{l}{req && " *"}</label><input id={n} name={n} type={t} required={req} className="input" />{errs[n] && <p className="mt-1 text-xs text-red-600">{errs[n]}</p>}</div>);
  return (
    <form onSubmit={onSubmit} className="card grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:col-span-2">Request a custom AI training program</h1>
      <F n="fullName" l="Full name" req /><F n="organization" l="Organization" req /><F n="email" l="Email" t="email" req /><F n="phone" l="Phone" t="tel" req />
      <F n="industry" l="Industry" /><F n="targetAudience" l="Target audience" /><F n="participants" l="Number of participants" t="number" req /><F n="preferredDuration" l="Preferred duration" />
      <F n="preferredDate" l="Preferred date" t="date" /><F n="budgetRange" l="Budget range" />
      <div><label className="label" htmlFor="format">Format</label><select id="format" name="format" className="input"><option value="online">Online</option><option value="onsite">On-site</option><option value="hybrid">Hybrid</option></select></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="objective">Training objective *</label><textarea id="objective" name="objective" rows={3} required className="input" />{errs.objective && <p className="mt-1 text-xs text-red-600">{errs.objective}</p>}</div>
      <div className="sm:col-span-2"><label className="label" htmlFor="topics">Required topics</label><textarea id="topics" name="topics" rows={3} className="input" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="notes">Additional requirements</label><textarea id="notes" name="notes" rows={3} className="input" /></div>
      <div className="sm:col-span-2"><button className="btn-brand" disabled={busy}>{busy ? "Sending…" : "Send request"}</button></div>
    </form>
  );
}

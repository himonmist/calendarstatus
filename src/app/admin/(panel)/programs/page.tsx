"use client";
import { useState } from "react";
import { api, Badge, ErrorState, useToast } from "@/components/ui";
import { useApi } from "@/components/use-api";

const blank = { id: "", title: "", shortDescription: "", fullDescription: "", durationMin: 240, formats: ["online", "onsite", "hybrid"], minParticipants: 5, maxParticipants: 50, priceText: "Contact for Pricing", objectives: [] as string[], audience: "", modules: [] as string[], active: true, sortOrder: 0 };

export default function Programs() {
  const toast = useToast(); const { data, error, reload } = useApi<{ programs: any[] }>("/api/admin/programs");
  const [edit, setEdit] = useState<any>(null); const [busy, setBusy] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { slug: _s, ...p } = edit; void _s;
    const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v !== undefined));
    try { await api("/api/admin/programs", { json: clean }); toast("Program saved"); setEdit(null); void reload(); }
    catch (x: any) { toast(x.fields?.[0] ? `${x.fields[0].path}: ${x.fields[0].message}` : x.message, "err"); } finally { setBusy(false); }
  }
  const f = (k: string, l: string, t = "text") => <div><label className="label" htmlFor={k}>{l}</label><input id={k} type={t} className="input" value={edit[k] ?? ""} onChange={e => setEdit({ ...edit, [k]: t === "number" ? Number(e.target.value) : e.target.value })} /></div>;
  const list = (k: string, l: string) => <div className="sm:col-span-2"><label className="label" htmlFor={k}>{l} (one per line)</label><textarea id={k} rows={3} className="input" value={(edit[k] ?? []).join("\n")} onChange={e => setEdit({ ...edit, [k]: e.target.value.split("\n").filter(Boolean) })} /></div>;
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between"><h1 className="text-2xl font-semibold tracking-tight">Training programs</h1><button className="btn-primary" onClick={() => setEdit({ ...blank })}>New program</button></header>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="skeleton h-48" /> : (
        <div className="card divide-y divide-ink-100">{data.programs.map(p => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div><p className="font-medium">{p.title}</p><p className="text-sm text-ink-500">{p.durationMin} min · {p.minParticipants}–{p.maxParticipants} participants · {p.priceText}</p></div>
            <div className="flex items-center gap-2"><Badge tone={p.active ? "ok" : "neutral"}>{p.active ? "Active" : "Inactive"}</Badge><button className="btn-ghost !py-1.5" onClick={() => setEdit(p)}>Edit</button></div>
          </div>))}</div>
      )}
      {edit && (
        <form onSubmit={save} className="card grid gap-4 p-5 sm:grid-cols-2" aria-label="Edit program">
          <h2 className="font-semibold sm:col-span-2">{data?.programs.some(p => p.id === edit.id) ? "Edit program" : "New program"}</h2>
          {f("id", "ID (lowercase-with-dashes)")}{f("title", "Title")}
          <div className="sm:col-span-2">{f("shortDescription", "Short description")}</div>
          <div className="sm:col-span-2"><label className="label" htmlFor="fd">Full description</label><textarea id="fd" rows={3} className="input" value={edit.fullDescription ?? ""} onChange={e => setEdit({ ...edit, fullDescription: e.target.value })} /></div>
          {f("durationMin", "Duration (minutes)", "number")}{f("priceText", "Price / “Contact for Pricing”")}{f("minParticipants", "Min participants", "number")}{f("maxParticipants", "Max participants", "number")}{f("audience", "Target audience")}{f("sortOrder", "Sort order", "number")}
          {list("objectives", "Learning objectives")}{list("modules", "Training modules")}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked })} /> Active (visible to the public)</label>
          <div className="flex gap-2 sm:col-span-2"><button className="btn-brand" disabled={busy}>Save program</button><button type="button" className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div>
        </form>)}
    </div>
  );
}

export const toList = (o: Record<string, number> = {}) => Object.entries(o).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

export function BarList({ title, data, unit = "" }: { title: string; data: { label: string; value: number }[]; unit?: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <section className="card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {data.length === 0 ? <p className="mt-4 text-sm text-ink-500">No data yet</p> : (
        <ul className="mt-4 space-y-2.5">
          {data.map(d => (
            <li key={d.label} className="text-xs">
              <div className="mb-1 flex justify-between gap-3"><span className="truncate text-ink-700">{d.label}</span><span className="font-medium tabular-nums">{d.value}{unit}</span></div>
              <div className="h-2 rounded-full bg-ink-100" role="img" aria-label={`${d.label}: ${d.value}`}><div className="h-2 rounded-full bg-brand" style={{ width: `${(d.value / max) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <div className="card p-5"><p className="text-xs font-medium text-ink-500">{label}</p><p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>{hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}</div>;
}

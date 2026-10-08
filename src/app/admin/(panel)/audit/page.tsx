"use client";
import { EmptyState, ErrorState } from "@/components/ui";
import { useApi } from "@/components/use-api";

export default function Audit() {
  const { data, error, reload } = useApi<{ entries: any[] }>("/api/admin/audit");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Audit logs</h1>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="skeleton h-48" /> : data.entries.length === 0 ? <EmptyState title="No activity recorded" /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs text-ink-500"><tr>{["When", "Actor", "Action", "Entity", "IP", "Change"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-ink-100">{data.entries.map((e, i) => <tr key={i}><td className="whitespace-nowrap px-4 py-2.5 text-xs">{new Date(e.at).toLocaleString()}</td><td className="px-4 py-2.5">{e.actor}</td><td className="px-4 py-2.5 font-mono text-xs">{e.action}</td><td className="px-4 py-2.5">{e.entityId ?? "—"}</td><td className="px-4 py-2.5 text-xs">{e.ip ?? "—"}</td><td className="max-w-xs truncate px-4 py-2.5 text-xs text-ink-500">{e.previous || e.next ? `${JSON.stringify(e.previous ?? null)} → ${JSON.stringify(e.next ?? null)}` : ""}</td></tr>)}</tbody></table></div>)}
    </div>
  );
}

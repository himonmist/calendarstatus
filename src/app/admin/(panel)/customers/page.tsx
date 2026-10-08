"use client";
import { EmptyState, ErrorState } from "@/components/ui";
import { useApi } from "@/components/use-api";

export default function Customers() {
  const { data, error, reload } = useApi<{ customers: any[] }>("/api/admin/customers");
  const orgs = data ? [...data.customers.reduce((m, c) => m.set(c.organization, (m.get(c.organization) ?? 0) + c.bookings), new Map<string, number>())] : [];
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Customers &amp; organizations</h1>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="skeleton h-48" /> : data.customers.length === 0 ? <EmptyState title="No customers yet" /> : (
        <>
          <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="text-xs text-ink-500"><tr>{["Customer", "Organization", "Industry", "Source", "Bookings", "Participants"].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-ink-100">{data.customers.map(c => <tr key={c.email}><td className="px-4 py-3"><p className="font-medium">{c.fullName}</p><p className="text-xs text-ink-500">{c.email} · {c.phone}</p></td><td className="px-4 py-3">{c.organization}</td><td className="px-4 py-3">{c.industry ?? "—"}</td><td className="px-4 py-3 capitalize">{c.leadSource}</td><td className="px-4 py-3 tabular-nums">{c.bookings}</td><td className="px-4 py-3 tabular-nums">{c.participants}</td></tr>)}</tbody></table></div>
          <p className="text-sm text-ink-500">{orgs.length} organization(s)</p>
        </>)}
    </div>
  );
}

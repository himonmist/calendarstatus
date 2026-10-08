"use client";
import { EmptyState, ErrorState } from "@/components/ui";
import { useApi } from "@/components/use-api";

export default function Requests() {
  const { data, error, reload } = useApi<{ requests: any[] }>("/api/admin/custom-requests");
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Custom training requests</h1>
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? <div className="skeleton h-48" /> : data.requests.length === 0 ? <EmptyState title="No custom requests yet" /> : (
        <div className="space-y-3">{data.requests.map(r => (
          <article key={r.id} className="card p-5">
            <div className="flex justify-between gap-3"><h2 className="font-semibold">{r.payload.organization} <span className="font-normal text-ink-500">· {r.payload.fullName}</span></h2><time className="text-xs text-ink-500">{new Date(r.createdAt).toLocaleDateString()}</time></div>
            <p className="mt-2 text-sm">{r.payload.objective}</p>
            <p className="mt-2 text-xs text-ink-500">{r.payload.participants} participants · {r.payload.format} · {r.payload.budgetRange ?? "no budget stated"} · {r.payload.email} · {r.payload.phone}</p>
          </article>))}</div>)}
    </div>
  );
}

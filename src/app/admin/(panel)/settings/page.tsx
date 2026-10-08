"use client";
import { api, ErrorState, useToast } from "@/components/ui";
import { useApi } from "@/components/use-api";

export default function Settings() {
  const toast = useToast(); const { data, error, reload } = useApi<any>("/api/admin/availability");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <div className="skeleton h-32" />;
  async function toggle(enabled: boolean) { try { await api("/api/admin/auto-confirm", { json: { enabled } }); toast(enabled ? "Auto-confirm enabled" : "Manual approval enabled"); void reload(); } catch (e: any) { toast(e.message, "err"); } }
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Booking rules</h1>
      <section className="card p-5">
        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1" checked={data.autoConfirm} onChange={e => toggle(e.target.checked)} />
          <span><span className="font-medium">Auto-confirm bookings</span><span className="block text-sm text-ink-500">When on, valid requests are confirmed instantly and added to your Google Calendar. When off, each request waits for your approval.</span></span></label>
      </section>
    </div>
  );
}

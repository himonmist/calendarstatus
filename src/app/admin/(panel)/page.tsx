"use client";
import Link from "next/link";
import { BarList, Kpi, toList } from "@/components/charts";
import { Badge, ErrorState } from "@/components/ui";
import { useApi } from "@/components/use-api";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Dashboard() {
  const { data, error, reload } = useApi<any>("/api/admin/dashboard");
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-24" />)}</div>;
  const { analytics: a, calendar: cal } = data, k = a.kpis;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Link href="/admin/google-calendar" className="flex items-center gap-2 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${cal.health === "healthy" ? "bg-ok" : "bg-warn"}`} />
          {cal.demo ? "Demo calendar" : cal.connected ? "Google Calendar connected" : "Not connected"}
          {cal.health !== "healthy" && <Badge tone="warn">Needs attention</Badge>}
        </Link>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Today's bookings" value={k.todaysBookings} /><Kpi label="Upcoming training" value={k.upcoming} />
        <Kpi label="Pending requests" value={k.pending} hint={`${data.requests} custom request(s)`} /><Kpi label="Confirmed bookings" value={k.confirmed} />
        <Kpi label="Total customers" value={k.customers} /><Kpi label="Organizations" value={k.organizations} />
        <Kpi label="Training hours (delivered/confirmed)" value={k.trainingHours} /><Kpi label="Participants" value={k.participants} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <BarList title="Bookings by month" data={a.byMonth.map((m: any) => ({ label: m.month, value: m.count }))} />
        <BarList title="Program popularity" data={a.byProgram.map((p: any) => ({ label: p.title, value: p.count }))} />
        <BarList title="Booking status" data={toList(a.byStatus)} />
        <BarList title="Customer industry" data={toList(a.byIndustry)} />
        <BarList title="Online vs on-site" data={toList(a.byFormat)} />
        <BarList title="Demand by weekday" data={a.byWeekday.map((v: number, i: number) => ({ label: DAYS[i], value: v }))} />
      </div>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/ui";

const GROUPS = [
  [["/admin", "Dashboard"]],
  [["/admin/calendar", "Calendar"], ["/admin/availability", "Availability"], ["/admin/bookings", "Bookings"], ["/admin/programs", "Training Programs"], ["/admin/customers", "Customers & Organizations"], ["/admin/requests", "Custom Requests"], ["/admin/analytics", "Analytics"]],
  [["/admin/google-calendar", "Google Calendar"], ["/admin/settings", "Settings"], ["/admin/audit", "Audit Logs"]],
];

export function AdminNav() {
  const path = usePathname(); const [open, setOpen] = useState(false);
  async function logout() { await api("/api/admin/logout", { method: "POST" }).catch(() => {}); window.location.href = "/admin/login"; }
  return (
    <aside className="border-b border-ink-100 bg-white md:sticky md:top-0 md:h-screen md:border-b-0 md:border-r">
      <div className="flex items-center justify-between px-4 py-3 md:py-5">
        <Link href="/admin" className="font-semibold tracking-tight">Training Admin</Link>
        <button className="btn-ghost md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="admin-nav">Menu</button>
      </div>
      <nav id="admin-nav" aria-label="Admin" className={`${open ? "block" : "hidden"} px-3 pb-4 md:block`}>
        {GROUPS.map((g, i) => (
          <ul key={i} className={`space-y-0.5 ${i ? "mt-4 border-t border-ink-100 pt-4" : ""}`}>
            {g.map(([h, l]) => (
              <li key={h}><Link href={h} onClick={() => setOpen(false)} aria-current={path === h ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm ${path === h ? "bg-ink-950 font-medium text-white" : "text-ink-700 hover:bg-ink-100"}`}>{l}</Link></li>
            ))}
          </ul>
        ))}
        <button onClick={logout} className="mt-4 w-full rounded-lg px-3 py-2 text-left text-sm text-ink-500 hover:bg-ink-100">Sign out</button>
      </nav>
    </aside>
  );
}

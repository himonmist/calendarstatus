import type { Metadata } from "next";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <AdminNav />
      <main className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}

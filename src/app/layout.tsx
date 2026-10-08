import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui";

// Strict nonce-based CSP (middleware) requires per-request rendering so Next can stamp the nonce on its scripts.
export const dynamic = "force-dynamic";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: "AI Training Programs & Booking | Md Hasan Mahfuz", template: "%s | Md Hasan Mahfuz" },
  description: "Check real-time availability and book corporate AI training, workshops and consulting with Md Hasan Mahfuz — pharma, healthcare, analytics, leadership and custom programs.",
  openGraph: { type: "website", siteName: "Md Hasan Mahfuz — AI Training", title: "AI Training Programs & Booking | Md Hasan Mahfuz", description: "Check availability and book an AI training program.", url: site },
  twitter: { card: "summary_large_image", title: "AI Training Programs & Booking | Md Hasan Mahfuz", description: "Check availability and book an AI training program." },
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1220" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><ToastProvider>{children}</ToastProvider></body></html>;
}

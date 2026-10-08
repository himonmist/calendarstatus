import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { BookingFlow } from "./booking-flow";

export const metadata: Metadata = {
  title: "Check Availability & Book AI Training",
  description: "Choose an AI training program, see live availability and book your session with Md Hasan Mahfuz.",
  alternates: { canonical: "/book-training" },
};

export default function Page() {
  return (<><SiteHeader /><main className="mx-auto max-w-5xl px-4 py-8 md:py-12"><BookingFlow /></main></>);
}

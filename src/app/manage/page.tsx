import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ManageBooking } from "./manage-booking";

export const metadata: Metadata = { title: "Manage Your Booking", description: "View, reschedule or cancel your AI training booking.", alternates: { canonical: "/manage" } };
export default function Page() { return (<><SiteHeader /><main className="mx-auto max-w-2xl px-4 py-10"><ManageBooking /></main></>); }

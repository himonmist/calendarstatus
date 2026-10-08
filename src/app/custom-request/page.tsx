import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { CustomRequestForm } from "./form";

export const metadata: Metadata = { title: "Request a Custom AI Training Program", description: "Tell us about your audience and goals and we'll design a custom AI training program.", alternates: { canonical: "/custom-request" } };
export default function Page() { return (<><SiteHeader /><main className="mx-auto max-w-2xl px-4 py-10"><CustomRequestForm /></main></>); }

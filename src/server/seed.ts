import { zonedToUtc } from "@/lib/time";
import type { Booking } from "@/lib/booking/types";
import type { ProgramFull } from "./repos";

const P = (o: Partial<ProgramFull> & Pick<ProgramFull, "id" | "title" | "shortDescription">, i: number): ProgramFull => ({
  slug: o.id, durationMin: 360, formats: ["online", "onsite", "hybrid"], minParticipants: 5, maxParticipants: 50, priceText: "Contact for Pricing",
  objectives: [], modules: [], active: true, sortOrder: i, ...o,
});

export const SEED_PROGRAMS: ProgramFull[] = [
  P({ id: "pharma-marketing-sales", title: "AI for Pharmaceutical Marketing & Sales", shortDescription: "Practical AI for pharma sales forecasting, customer segmentation and promotion.", durationMin: 360, audience: "Pharma sales & marketing teams",
    objectives: ["Apply AI to sales forecasting", "Segment HCPs and customers with AI", "Automate promotional content workflows"], modules: ["AI foundations for sales", "Forecasting & segmentation", "Content & campaign automation", "Compliance guardrails"] }, 0),
  P({ id: "medical-professionals", title: "AI for Medical Professionals", shortDescription: "Safe, evidence-aware use of AI in clinical research, documentation and patient communication.", durationMin: 240, audience: "Doctors, clinicians, medical educators", maxParticipants: 40 }, 1),
  P({ id: "procurement-compliance", title: "AI for Procurement & Compliance", shortDescription: "Contract review, vendor analysis and compliance monitoring with AI.", durationMin: 240, audience: "Procurement, legal and compliance teams" }, 2),
  P({ id: "genai-business", title: "Generative AI for Business Professionals", shortDescription: "Hands-on generative AI for everyday productivity, writing, analysis and decisions.", durationMin: 180, audience: "Managers and business professionals", maxParticipants: 60 }, 3),
  P({ id: "ai-agents-workshop", title: "AI Agent Automation Workshop", shortDescription: "Design and deploy AI agents that automate real business workflows.", durationMin: 360, audience: "Technical leads, analysts, operations", maxParticipants: 25 }, 4),
  P({ id: "data-analytics", title: "AI for Data Analytics", shortDescription: "From spreadsheets to insight: AI-assisted analysis, visualisation and reporting.", durationMin: 300, audience: "Analysts and data-driven teams", maxParticipants: 30 }, 5),
  P({ id: "custom-corporate", title: "Custom Corporate AI Training", shortDescription: "A programme designed around your organisation, audience and objectives.", durationMin: 480, audience: "Any organisation", minParticipants: 1, maxParticipants: 500 }, 6),
];

/** Realistic demo data for development (in-memory mode only). */
export function demoBookings(now: Date): Booking[] {
  const mk = (n: number, daysAhead: number, hour: string, p: ProgramFull, o: Partial<Booking>): Booking => {
    const d = new Date(now.getTime() + daysAhead * 86_400_000).toISOString().slice(0, 10);
    const start = zonedToUtc(d, hour, "Asia/Dhaka");
    return { id: crypto.randomUUID(), reference: `TRN-2026-${String(n).padStart(5, "0")}`, programId: p.id, programTitle: p.title, start,
      end: new Date(start.getTime() + p.durationMin * 60_000), timezone: "Asia/Dhaka", status: "confirmed", fullName: "Demo Customer",
      email: `demo${n}@example.com`, phone: "+8801700000000", organization: "Demo Org", participants: 20, format: "online", leadSource: "website",
      createdAt: now, updatedAt: now, history: [{ status: "confirmed", at: now, actor: "seed" }], ...o };
  };
  return [
    mk(101, 10, "10:00", SEED_PROGRAMS[0], { fullName: "Farhana Akter", organization: "Beximco Pharmaceuticals Ltd.", industry: "Pharmaceutical", email: "farhana@example.com", participants: 30, leadSource: "linkedin" }),
    mk(102, 15, "10:00", SEED_PROGRAMS[1], { fullName: "Dr. Imran Hossain", organization: "Dhaka Medical College", industry: "Healthcare", email: "imran@example.com", status: "pending", format: "onsite", leadSource: "referral" }),
    mk(103, 22, "10:00", SEED_PROGRAMS[4], { fullName: "Nusrat Jahan", organization: "BRAC University", industry: "Education", email: "nusrat@example.com", format: "hybrid", leadSource: "whatsapp" }),
  ];
}

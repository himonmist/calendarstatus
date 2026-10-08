import { z } from "zod";

// eslint-disable-next-line no-control-regex
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const text = (max: number, min = 1) => z.string().transform(clean).pipe(z.string().min(min).max(max));
const optText = (max: number) => z.string().transform(clean).pipe(z.string().max(max)).optional();

export const FORMATS = ["online", "onsite", "hybrid"] as const;
export const LEAD_SOURCES = ["website", "linkedin", "whatsapp", "email", "referral", "qr", "direct"] as const;

export const bookingInputSchema = z.object({
  programId: text(64),
  slotStart: z.string().datetime(),
  holdToken: z.string().min(16).max(128),
  fullName: text(120),
  organization: text(160),
  designation: optText(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Invalid phone"),
  country: optText(80), city: optText(80),
  industry: optText(80), organizationType: optText(80), experienceLevel: optText(40),
  participants: z.number().int().min(1).max(5000),
  format: z.enum(FORMATS),
  location: optText(200),
  budgetRange: optText(80),
  notes: optText(5000),
  leadSource: z.enum(LEAD_SOURCES).default("website"),
}).strip();

export type BookingInput = z.infer<typeof bookingInputSchema>;

export const lookupSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^TRN-\d{4}-\d{5}$/),
  email: z.string().trim().toLowerCase().email().max(254),
});

export const customRequestSchema = z.object({
  fullName: text(120), organization: text(160),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  industry: optText(80), targetAudience: optText(300),
  participants: z.number().int().min(1).max(5000),
  objective: text(3000), topics: optText(3000), preferredDuration: optText(80),
  preferredDate: optText(40), format: z.enum(FORMATS), budgetRange: optText(80), notes: optText(3000),
}).strip();

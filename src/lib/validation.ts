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

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const tzOk = (tz: string) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; } };
const dayHours = z.object({ start: hhmm, end: hhmm }).refine(h => h.end > h.start, "End must be after start").nullable();

export const availabilitySchema = z.object({
  timezone: z.string().max(64).refine(tzOk, "Unknown timezone"),
  weekly: z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), dayHours),
  blockedDates: z.array(z.string().regex(/^20\d{2}-\d{2}-\d{2}$/)).max(500),
  bufferBeforeMin: z.number().int().min(0).max(240), bufferAfterMin: z.number().int().min(0).max(240),
  stepMin: z.number().int().min(15).max(240),
  minNoticeHours: z.number().int().min(0).max(24 * 60), maxAdvanceDays: z.number().int().min(1).max(730),
}).partial().strip();

export const statusSchema = z.object({ status: z.enum(["pending", "confirmed", "rejected", "cancelled", "rescheduled", "completed", "no_show"]) });
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().max(254), password: z.string().min(1).max(200) });

const free = (max: number) => z.string().trim().max(max);
export const programSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,64}$/), title: free(160).min(2), shortDescription: free(300).min(2), fullDescription: free(5000).optional(),
  durationMin: z.number().int().min(30).max(1440), formats: z.array(z.enum(FORMATS)).min(1),
  minParticipants: z.number().int().min(1).max(5000), maxParticipants: z.number().int().min(1).max(5000),
  priceText: free(80).default("Contact for Pricing"), objectives: z.array(free(300)).max(20).default([]), audience: free(300).optional(),
  modules: z.array(free(300)).max(30).default([]), bannerUrl: z.string().url().max(500).startsWith("https://").optional(),
  active: z.boolean().default(true), sortOrder: z.number().int().default(0),
}).strip().refine(p => p.minParticipants <= p.maxParticipants, "Min participants must not exceed max");

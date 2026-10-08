import { test, expect, type Page } from "@playwright/test";

async function pickFirstAvailableDay(page: Page) {
  for (let i = 0; i < 3; i++) {
    const day = page.locator('button[aria-label$=" available"], button[aria-label$=" limited"]').first();
    if (await day.count()) { await day.click(); return; }
    await page.getByRole("button", { name: "Next month" }).click();
    await page.waitForTimeout(400);
  }
  throw new Error("no available day found");
}

test("customer books a slot → confirmation → admin approves and sees it", async ({ page, browser }, info) => {
  await page.goto("/book-training");
  await page.getByRole("button", { name: "Book This Program" }).first().click();
  await pickFirstAvailableDay(page);
  const slot = page.locator("button:has-text('Available')").first();
  await expect(slot).toBeVisible();
  await slot.click();

  await expect(page.getByText("temporarily reserved for you")).toBeVisible();
  await expect(page.getByLabel("time remaining")).toHaveText(/0[89]:\d\d/);

  const email = `e2e-${info.project.name}-${Date.now()}@example.com`;
  await page.getByLabel("Full name *").fill("Md Rahman");
  await page.getByLabel("Organization *").fill("ABC Pharmaceuticals Ltd.");
  await page.getByLabel("Email *").fill(email);
  await page.getByLabel(/Phone/).fill("+8801712345678");
  await page.getByLabel(/Number of participants/).fill("12");
  await page.getByRole("button", { name: "Submit booking request" }).click();

  await expect(page.getByRole("heading", { name: "Booking Request Received" })).toBeVisible();
  await expect(page.getByText("Pending Confirmation")).toBeVisible();
  const ref = (await page.getByText(/TRN-\d{4}-\d{5}/).first().textContent())!.match(/TRN-\d{4}-\d{5}/)![0];

  // Customer can look up their booking with reference + email
  await page.goto("/manage");
  await page.getByLabel("Booking reference").fill(ref);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Find booking" }).click();
  await expect(page.getByText(ref)).toBeVisible();

  // Admin approves
  const admin = await (await browser.newContext()).newPage();
  await admin.goto("/admin");
  await expect(admin).toHaveURL(/\/admin\/login/);          // unauthenticated → redirected
  await admin.getByLabel("Email").fill("admin@example.com");
  await admin.getByLabel("Password").fill("Correct Horse 9!");
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await admin.goto("/admin/bookings");
  await expect(admin.getByText(ref)).toBeVisible();
  await admin.getByRole("button", { name: "Approve" }).first().click();
  await expect(admin.getByText("Marked confirmed")).toBeVisible();
});

test("public pages never expose private calendar details; admin API is closed", async ({ request }) => {
  const progs = await (await request.get("/api/public/training-programs")).json();
  const id = progs.programs[0].id;
  const m = await request.get(`/api/public/availability?program=${id}&month=${new Date().toISOString().slice(0, 7)}`);
  expect(m.ok()).toBeTruthy();
  expect(await m.text()).not.toMatch(/Confidential|title|summary/i);
  expect((await request.get("/api/admin/bookings")).status()).toBe(401);
  expect((await request.get("/api/admin/calendar?from=2026-10-01&to=2026-10-31")).status()).toBe(401);
});

test("security headers and CSP are present", async ({ request }) => {
  const r = await request.get("/");
  const h = r.headers();
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age");
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
  expect(h["x-powered-by"]).toBeUndefined();
});

test("two browsers racing for the same slot: exactly one wins", async ({ browser }) => {
  const mk = async () => (await browser.newContext()).request;
  const [a, b] = await Promise.all([mk(), mk()]);
  const base = "http://localhost:3100";
  const id = (await (await a.get(`${base}/api/public/training-programs`)).json()).programs[2].id;
  const month = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 7);
  const days = (await (await a.get(`${base}/api/public/availability?program=${id}&month=${month}`)).json()).days as Record<string, string>;
  const d = Object.entries(days).find(([, s]) => s === "available")![0];
  const slot = (await (await a.get(`${base}/api/public/availability/${d}?program=${id}`)).json()).slots.find((s: any) => s.available);
  const attempt = (ctx: typeof a, ip: string) => ctx.post(`${base}/api/public/reservations`, { data: { programId: id, slotStart: slot.start }, headers: { "x-forwarded-for": ip, origin: base } });
  const [r1, r2] = await Promise.all([attempt(a, "10.0.0.1"), attempt(b, "10.0.0.2")]);
  expect([r1.status(), r2.status()].sort()).toEqual([200, 409]);
});

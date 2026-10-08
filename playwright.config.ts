import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";

const hash = execSync("node scripts/hash-password.mjs 'Correct Horse 9!'").toString().trim();
export default defineConfig({
  testDir: "e2e", timeout: 60_000, fullyParallel: false, workers: 1, retries: 0,
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined } },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npx next start -p 3100", url: "http://localhost:3100", reuseExistingServer: false, timeout: 60_000,
    env: { NEXT_PUBLIC_SITE_URL: "http://localhost:3100", NEXTAUTH_SECRET: "e2e-secret-".padEnd(48, "x"), ADMIN_EMAIL: "admin@example.com",
      ADMIN_PASSWORD_HASH: hash, CRON_SECRET: "e2e-cron-secret-value", TOKEN_ENCRYPTION_KEY: "ab".repeat(32) },
  },
});

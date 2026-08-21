import { defineConfig, devices } from "@playwright/test";

/**
 * Aniq ERP — Playwright E2E config.
 *
 * Run:  npm run test:e2e
 * Web URL is read from BASE_URL env (default http://localhost:3010).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,           // serial — shared seed data
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3010",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

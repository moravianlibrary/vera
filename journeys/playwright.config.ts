import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "specs",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  projects: [{ name: "Chromium", use: { browserName: "chromium" } }],
  use: {
    baseURL: process.env.VERA_JOURNEYS_URL ?? "http://127.0.0.1:5290",
    locale: "en-US",
    timezoneId: "Europe/Prague",
    trace: "retain-on-failure",
  },
  outputDir: "test-results",
});

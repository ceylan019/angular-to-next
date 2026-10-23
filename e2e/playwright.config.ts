import { defineConfig } from "@playwright/test";
import { ENABLED_NEXT_FLOWS, flowGrep } from "./support/flows.js";
import { reportFolder } from "./support/report.js";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: process.env.CI !== undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: reportFolder(process.argv), open: "never" }],
  ],
  use: {
    browserName: "chromium",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "legacy",
      use: { baseURL: process.env.LEGACY_URL ?? "http://localhost:4000" },
    },
    {
      name: "next",
      grep: flowGrep(ENABLED_NEXT_FLOWS),
      use: { baseURL: process.env.WEB_URL ?? "http://localhost:3000" },
    },
  ],
});

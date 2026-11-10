import { defineConfig } from "@playwright/test";

const base = process.env.VITE_BASE_PATH || "/Biomechanic_visualization/pr-1/";
if (base === "/") throw new Error("Preview tests need a nested VITE_BASE_PATH.");

export default defineConfig({
  testDir: "./e2e",
  testMatch: "preview.spec.ts",
  outputDir: "test-results/preview",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:4175${base.endsWith("/") ? base : `${base}/`}`,
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: "node scripts/preview-test-server.mjs",
    url: "http://127.0.0.1:4175/__preview-test-ready__",
    env: { VITE_BASE_PATH: base },
    timeout: 120000,
    reuseExistingServer: false,
  },
});

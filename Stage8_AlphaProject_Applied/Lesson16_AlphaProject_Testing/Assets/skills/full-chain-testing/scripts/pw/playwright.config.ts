// SPDX-License-Identifier: MIT
// Minimal Playwright config to run knife5's generated E2E spec against the LIVE demo-app.
// Boots the stdlib demo server (FE index.html + BE endpoints + cron scheduler) and points
// the browser at it. condition-based readiness via webServer.url (no fixed sleep).
import { defineConfig, devices } from "@playwright/test";

const PORT = 8801;

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `python3 ../../demo-app/server.py --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/deliveries`,
    reuseExistingServer: false,
    timeout: 15_000,
  },
});

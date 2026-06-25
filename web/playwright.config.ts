import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:5173/queens-puzzle/",
    trace: "retain-on-failure",
  },
  // In CI: dist/ is pre-built; vite preview serves it. Locally: reuses running dev server.
  webServer: {
    command: "npx vite preview --port 5173",
    url: "http://localhost:5173/queens-puzzle/",
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

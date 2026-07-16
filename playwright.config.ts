import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } }
  ],
  webServer: [
    {
      command: "pnpm --filter @dominoes/api build && pnpm --filter @dominoes/api start",
      url: "http://127.0.0.1:4000/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { ...process.env, NODE_ENV: "development", WEB_ORIGINS: "http://127.0.0.1:3000" }
    },
    {
      command: "pnpm --filter @dominoes/web build && pnpm --filter @dominoes/web start --hostname 127.0.0.1",
      url: "http://127.0.0.1:3000/en",
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: { ...process.env, NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000/v1" }
    }
  ]
});

import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Serial, no en paralelo: varios tests loguean al mismo usuario sembrado
  // (Dueño) contra el Supabase Auth real. En paralelo, dos logins casi
  // simultáneos del mismo usuario invalidan la sesión del otro (rotación de
  // refresh token) y un test falla de forma intermitente.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3101",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec next build && pnpm exec next start -p 3101",
    url: "http://localhost:3101",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

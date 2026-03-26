import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3005";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure"
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/login`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: "",
      UPLOAD_RUNTIME: "local",
      RUNTIME_DATA_DIR: ".e2e-runtime",
      TRUST_PROXY_IP_HEADERS: "false",
      UPLOAD_TOKEN_SECRET: "e2e-upload-secret",
      UPLOAD_TOKEN_TTL_MS: "3600000",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      ADMIN_EMAILS: "",
      OPENAI_API_KEY: ""
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});

import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"]],
  use: {
    baseURL,
    channel: "msedge",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: `${baseURL}/api/v1/subjects`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      KNOWGATE_DB_PATH: resolve(process.cwd(), ".data", "e2e.sqlite"),
    },
  },
});

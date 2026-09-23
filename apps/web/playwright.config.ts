import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:3100";
const databasePath = resolve(
  process.cwd(),
  ".data",
  `e2e-${process.pid}-${Date.now()}.sqlite`,
);

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
      // A per-run database keeps published content from an earlier run from
      // leaking into the next one and tripping content-version checks.
      KNOWGATE_DB_PATH: databasePath,
    },
  },
});

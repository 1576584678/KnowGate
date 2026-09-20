/**
 * Runs the hard-rule promptfoo suite and the soft-score RAGAS suite in
 * parallel. This is the one-command audit entry point for content reviewers.
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const promptfooEntry = resolve(
  repoRoot,
  "node_modules",
  "promptfoo",
  "dist",
  "src",
  "entrypoint.js",
);

function run(label, command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          `${label} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`,
        ),
      );
    });
  });
}

try {
  await run("content export", process.execPath, [
    "evals/scripts/export-questions.mjs",
  ]);
  await Promise.all([
    run("promptfoo hard rules", process.execPath, [
      promptfooEntry,
      "eval",
      "-c",
      "evals/promptfoo/promptfooconfig.yaml",
      "--no-cache",
      "--no-progress-bar",
      "-o",
      "evals/reports/promptfoo.json",
    ]),
    run("RAGAS soft scores", process.execPath, [
      "evals/scripts/run-ragas.mjs",
    ]),
  ]);
  console.log("Content audits finished. Reports are in evals/reports/.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

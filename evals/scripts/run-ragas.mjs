/**
 * Cross-platform launcher for the Python RAGAS runner.
 *
 * The audit is optional when OPENAI_API_KEY is absent, so this script avoids
 * failing just because the local virtual environment has not been created yet.
 */
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const runner = resolve(repoRoot, "evals", "ragas", "run_ragas.py");
const venvPython =
  process.platform === "win32"
    ? resolve(repoRoot, "evals", ".venv-ragas", "Scripts", "python.exe")
    : resolve(repoRoot, "evals", ".venv-ragas", "bin", "python");
const python = process.env.PYTHON || (existsSync(venvPython) ? venvPython : "python");

const result = spawnSync(python, [runner, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (result.error) {
  console.error(
    [
      `Could not start RAGAS runner with ${python}.`,
      "Create the optional environment with:",
      "  python -m venv evals/.venv-ragas",
      "  evals/.venv-ragas/Scripts/python.exe -m pip install -r evals/ragas/requirements.txt",
    ].join("\n"),
  );
  process.exit(1);
}

process.exit(result.status ?? 1);

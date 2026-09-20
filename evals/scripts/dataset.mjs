import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDuplicateIndex } from "../assertions/lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(here, "..", "..");
export const questionsPath = resolve(repoRoot, "evals", "data", "questions.jsonl");
export const graphPath = resolve(repoRoot, "evals", "data", "graph.json");
export const reportsDir = resolve(repoRoot, "evals", "reports");

export function loadQuestions(path = questionsPath) {
  const raw = readFileSync(path, "utf8");
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export function loadGraph(path = graphPath) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Context every rule needs but that cannot be derived from a single record.
 * Built once per run and handed to each rule module through `dataset`.
 *
 * The full question list is deliberately *not* part of this context: promptfoo
 * serializes `vars` into its report once per test case, so carrying all records
 * here inflated `evals/reports/promptfoo.json` to ~129MB. Callers already hold
 * the records they iterate over, and no rule reads them back from `dataset`.
 */
export function buildDatasetContext(records, graph) {
  const chapterNodeIds = new Map();
  for (const chapter of graph.chapters) {
    chapterNodeIds.set(chapter.id, chapter.nodeIds);
  }

  const bossSizes = new Map();
  for (const boss of graph.bosses) {
    bossSizes.set(boss.id, boss.questionIds.length);
  }

  return {
    contentVersion: graph.contentVersion,
    nodeIds: new Set(graph.nodes.map((node) => node.id)),
    chapterNodeIds,
    bossSizes,
    duplicateIndex: buildDuplicateIndex(records),
  };
}

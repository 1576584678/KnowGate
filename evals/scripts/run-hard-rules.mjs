/**
 * Standalone hard-rule report.
 *
 * Runs the exact same rule modules the promptfoo config imports, so CI can gate
 * on content quality without needing a promptfoo release, and the reviewer gets
 * a readable "which question broke which rule" list.
 *
 * Usage: node evals/scripts/run-hard-rules.mjs [--json] [--quiet]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import * as duplicates from "../assertions/duplicates.mjs";
import * as graph from "../assertions/graph.mjs";
import * as options from "../assertions/options.mjs";
import * as steps from "../assertions/steps.mjs";
import * as structure from "../assertions/structure.mjs";
import * as wording from "../assertions/wording.mjs";
import {
  buildDatasetContext,
  loadGraph,
  loadQuestions,
  reportsDir,
} from "./dataset.mjs";

const RULES = [
  { group: "structure", check: structure.check },
  { group: "steps", check: steps.check },
  { group: "options", check: options.check },
  { group: "wording", check: wording.check },
  { group: "duplicates", check: duplicates.check },
  { group: "graph", check: graph.check },
];

export function runHardRules(records, dataset) {
  const findings = [];

  for (const record of records) {
    for (const rule of RULES) {
      for (const finding of rule.check(record, dataset)) {
        findings.push({
          rule: rule.group,
          questionId: record.id,
          origin: record.origin,
          chapterId: record.chapterId ?? null,
          bossId: record.bossId ?? null,
          prompt: record.prompt,
          ...finding,
        });
      }
    }
  }

  return findings;
}

function summarize(findings) {
  const byCode = new Map();
  const byQuestion = new Map();
  let errors = 0;
  let warnings = 0;

  for (const finding of findings) {
    if (finding.severity === "error") errors += 1;
    else warnings += 1;

    byCode.set(finding.code, (byCode.get(finding.code) ?? 0) + 1);
    byQuestion.set(finding.questionId, (byQuestion.get(finding.questionId) ?? 0) + 1);
  }

  return {
    errors,
    warnings,
    byCode: [...byCode.entries()].sort((a, b) => b[1] - a[1]),
    byQuestion: [...byQuestion.entries()].sort((a, b) => b[1] - a[1]),
  };
}

async function main() {
  const json = process.argv.includes("--json");
  const quiet = process.argv.includes("--quiet");

  const records = loadQuestions();
  const graphData = loadGraph();
  const dataset = buildDatasetContext(records, graphData);
  const findings = runHardRules(records, dataset);
  const summary = summarize(findings);

  mkdirSync(reportsDir, { recursive: true });
  const reportPath = resolve(reportsDir, "hard-rules.json");
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        contentVersion: graphData.contentVersion,
        generatedAt: new Date().toISOString(),
        questionCount: records.length,
        errorCount: summary.errors,
        warningCount: summary.warnings,
        byCode: Object.fromEntries(summary.byCode),
        findings,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  if (json) {
    console.log(JSON.stringify({ summary: Object.fromEntries(summary.byCode), findings }, null, 2));
  } else if (!quiet) {
    console.log(
      `硬性规则检查：${records.length} 道题，${summary.errors} 个 error，${summary.warnings} 个 warning`,
    );
    console.log("");
    console.log("按规则汇总：");
    for (const [code, count] of summary.byCode) {
      console.log(`  ${String(count).padStart(4)}  ${code}`);
    }
    console.log("");
    console.log("违反规则最多的题目：");
    for (const [questionId, count] of summary.byQuestion.slice(0, 15)) {
      console.log(`  ${String(count).padStart(4)}  ${questionId}`);
    }
    console.log("");
    console.log(`完整报告：${reportPath}`);
  }

  if (summary.errors > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

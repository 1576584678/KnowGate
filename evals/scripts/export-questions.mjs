/**
 * Flattens the grade-4 math content module into a machine-readable question set
 * that both audit pipelines consume.
 *
 * promptfoo (hard rules) and RAGAS (soft scoring) must review the *same*
 * records, so this script is the single source of truth for the dataset. It
 * bundles the TypeScript content module with esbuild instead of reaching for
 * the running dev server, so it works in CI without a server or a database.
 *
 * Usage: node evals/scripts/export-questions.mjs [--out <path>]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const webRoot = resolve(repoRoot, "apps", "web");
const cacheBundle = resolve(repoRoot, "evals", ".cache", "content.mjs");
const defaultOut = resolve(repoRoot, "evals", "data", "questions.jsonl");
const defaultGraphOut = resolve(repoRoot, "evals", "data", "graph.json");

function outPathFromArgv() {
  const index = process.argv.indexOf("--out");
  if (index === -1) return defaultOut;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--out requires a path");
  return resolve(process.cwd(), value);
}

async function loadContentModule() {
  mkdirSync(dirname(cacheBundle), { recursive: true });

  await build({
    entryPoints: [resolve(webRoot, "src", "content", "math-grade4.ts")],
    outfile: cacheBundle,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    logLevel: "warning",
    alias: { "@": resolve(webRoot, "src") },
  });

  return import(pathToFileURL(cacheBundle).href);
}

function toRecord(question, origin) {
  const options = question.options ?? [];
  const answerIndex = question.answerIndex;
  const answer =
    Number.isInteger(answerIndex) && answerIndex >= 0 && answerIndex < options.length
      ? options[answerIndex]
      : null;

  return {
    id: question.id,
    nodeId: question.nodeId,
    kind: question.kind,
    origin: origin.origin, // "chapter" | "boss"
    chapterId: origin.chapterId,
    chapterTitle: origin.chapterTitle,
    stageNo: origin.stageNo,
    milestoneId: origin.milestoneId,
    milestoneName: origin.milestoneName,
    stepPhase: origin.stepPhase,
    stepTitle: origin.stepTitle ?? null,
    stepBody: origin.stepBody ?? null,
    bossId: origin.bossId,
    bossName: origin.bossName,
    prompt: question.prompt,
    options,
    answerIndex,
    answer,
    explanation: question.explanation,
    timeLimitSec: question.timeLimitSec,
    damage: question.damage,
    difficulty: question.difficulty ?? null,
    errorTags: question.errorTags ?? [],
    sourceType: question.sourceType ?? null,
    license: question.license ?? null,
    authorId: question.authorId ?? null,
    hasVisual: Boolean(question.visual),
    visual: question.visual ?? null,
  };
}

export async function collectQuestions() {
  const content = await loadContentModule();
  const { chapters, milestones, bosses, bossQuestions, gradeWorld, knowledgeNodes } =
    content;

  const milestoneById = new Map(milestones.map((m) => [m.id, m]));
  const bossById = new Map(bosses.map((b) => [b.id, b]));
  const records = [];

  for (const chapter of chapters) {
    const milestone = milestoneById.get(chapter.milestoneId);
    for (const step of chapter.steps) {
      if (!step.question) continue;
      records.push(
        toRecord(step.question, {
          origin: "chapter",
          chapterId: chapter.id,
          chapterTitle: chapter.title,
          stageNo: chapter.stageNo,
          milestoneId: chapter.milestoneId,
          milestoneName: milestone?.name ?? null,
          stepPhase: step.phase,
          stepTitle: step.title,
          stepBody: step.body,
        }),
      );
    }
  }

  for (const question of bossQuestions) {
    const boss = bosses.find((candidate) =>
      candidate.questionIds.includes(question.id),
    );
    const milestone = boss ? milestoneById.get(boss.milestoneId) : undefined;
    records.push(
      toRecord(question, {
        origin: "boss",
        bossId: boss?.id ?? null,
        bossName: boss?.name ?? null,
        stageNo: milestone?.stageNo ?? null,
        milestoneId: boss?.milestoneId ?? null,
        milestoneName: milestone?.name ?? null,
      }),
    );
  }

  // Bosses reuse chapter prompts verbatim (shuffled options), so the two
  // pipelines need stable ordering to diff runs. Sort by id for determinism.
  records.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return {
    contentVersion: gradeWorld.contentVersion,
    gradeWorldId: gradeWorld.id,
    nodes: knowledgeNodes.length,
    chapters: chapters.length,
    milestones: milestones.length,
    bosses: bosses.length,
    records,
  };
}

async function main() {
  const dataset = await collectQuestions();
  const out = outPathFromArgv();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    dataset.records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    "utf8",
  );

  const content = await loadContentModule();
  const graphOut = resolve(dirname(out), "graph.json");
  writeFileSync(
    graphOut,
    JSON.stringify(
      {
        contentVersion: content.gradeWorld.contentVersion,
        nodes: content.knowledgeNodes.map((node) => ({
          id: node.id,
          name: node.name,
          domain: node.domain,
          stage: node.stage,
          prerequisites: node.prerequisites,
        })),
        chapters: content.chapters.map((chapter) => ({
          id: chapter.id,
          milestoneId: chapter.milestoneId,
          stageNo: chapter.stageNo,
          title: chapter.title,
          nodeIds: chapter.nodeIds,
        })),
        milestones: content.milestones.map((milestone) => ({
          id: milestone.id,
          stageNo: milestone.stageNo,
          name: milestone.name,
          chapterIds: milestone.chapterIds,
          nodeIds: milestone.nodeIds,
          bossId: milestone.bossId,
        })),
        bosses: content.bosses.map((boss) => ({
          id: boss.id,
          milestoneId: boss.milestoneId,
          name: boss.name,
          questionIds: boss.questionIds,
        })),
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const unique = new Set(dataset.records.map((record) => record.id));
  console.log(
    `content ${dataset.contentVersion}: ${dataset.records.length} question slots ` +
      `(${unique.size} unique ids) across ${dataset.chapters} chapters / ` +
      `${dataset.bosses} bosses -> ${out} + ${defaultGraphOut === graphOut ? "graph.json" : graphOut}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

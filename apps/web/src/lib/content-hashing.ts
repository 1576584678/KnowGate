import { createHash } from "node:crypto";
import type {
  Boss,
  Chapter,
  ContentQuestion,
  KnowledgeNode,
  Milestone,
} from "@knowgate/domain";
import type { ContentGraph } from "@/lib/content-validation";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }

  return value;
}

function stableStringify(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function hash(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function byId<Entity extends { id: string }>(left: Entity, right: Entity) {
  return left.id.localeCompare(right.id);
}

function chapterQuestions(chapters: Chapter[]) {
  return chapters
    .flatMap((chapter) =>
      chapter.steps.flatMap((step) =>
        step.question ? [step.question] : [],
      ),
    )
    .sort(byId);
}

export function canonicalContentGraph(graph: ContentGraph) {
  const nodes = [...graph.nodes].sort(byId) satisfies KnowledgeNode[];
  const milestones = [...graph.milestones].sort(
    (left, right) =>
      left.stageNo - right.stageNo || left.id.localeCompare(right.id),
  ) satisfies Milestone[];
  const chapters = [...graph.chapters].sort(
    (left, right) =>
      left.stageNo - right.stageNo || left.id.localeCompare(right.id),
  ) satisfies Chapter[];
  const bosses = [...graph.bosses].sort(byId) satisfies Boss[];
  const bossQuestions = [...graph.questions].sort(byId);
  const questions = [
    ...new Map(
      [...bossQuestions, ...chapterQuestions(chapters)].map((question) => [
        question.id,
        question,
      ]),
    ).values(),
  ].sort(byId) satisfies ContentQuestion[];

  return {
    contentVersion: graph.contentVersion,
    nodes,
    milestones,
    chapters,
    bosses,
    questions,
  };
}

export function hashContentGraph(graph: ContentGraph) {
  const canonical = canonicalContentGraph(graph);

  return {
    graphHash: hash(canonical),
    curriculumHash: hash({
      contentVersion: canonical.contentVersion,
      nodes: canonical.nodes,
      milestones: canonical.milestones,
      chapters: canonical.chapters.map((chapter) => ({
        id: chapter.id,
        milestoneId: chapter.milestoneId,
        stageNo: chapter.stageNo,
        nodeIds: chapter.nodeIds,
      })),
      bosses: canonical.bosses.map((boss) => ({
        id: boss.id,
        milestoneId: boss.milestoneId,
        questionIds: boss.questionIds,
      })),
    }),
    itemSetHash: hash(canonical.questions),
  };
}

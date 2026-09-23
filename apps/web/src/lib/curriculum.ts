import type { Milestone } from "@knowgate/domain";
import { gradeWorld } from "@/content/math-grade4";
import {
  validateContentGraph,
  type ContentGraph,
} from "@/lib/content-validation";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

function orderedMilestones(milestones: Milestone[]) {
  return [...milestones].sort(
    (left, right) =>
      left.stageNo - right.stageNo || left.id.localeCompare(right.id),
  );
}

export function getCurriculumPlan() {
  const runtimeGraph = buildRuntimeContentGraph();
  const gradeMilestones = runtimeGraph.milestones.filter((milestone) =>
    milestone.id.startsWith("math.g4."),
  );
  const gradeMilestoneIds = new Set(
    gradeMilestones.map((milestone) => milestone.id),
  );
  const gradeBosses = runtimeGraph.bosses.filter((boss) =>
    gradeMilestoneIds.has(boss.milestoneId),
  );
  const gradeBossQuestionIds = new Set(
    gradeBosses.flatMap((boss) => boss.questionIds),
  );
  const runtimeNodesById = new Map(
    runtimeGraph.nodes.map((node) => [node.id, node]),
  );
  const gradeNodeIds = new Set<string>();
  function includeNodeWithPrerequisites(nodeId: string) {
    if (gradeNodeIds.has(nodeId)) return;
    const node = runtimeNodesById.get(nodeId);
    if (!node) return;
    gradeNodeIds.add(node.id);
    for (const prerequisiteId of node.prerequisites) {
      includeNodeWithPrerequisites(prerequisiteId);
    }
  }
  for (const milestone of gradeMilestones) {
    for (const nodeId of milestone.nodeIds) {
      includeNodeWithPrerequisites(nodeId);
    }
  }
  const graph: ContentGraph = {
    contentVersion: runtimeGraph.contentVersion,
    nodes: runtimeGraph.nodes.filter((node) => gradeNodeIds.has(node.id)),
    chapters: runtimeGraph.chapters.filter((chapter) =>
      gradeMilestoneIds.has(chapter.milestoneId),
    ),
    milestones: gradeMilestones,
    bosses: gradeBosses,
    questions: runtimeGraph.questions.filter((question) =>
      gradeBossQuestionIds.has(question.id),
    ),
  };
  const ordered = orderedMilestones(graph.milestones);
  const validationIssues = validateContentGraph(graph);

  return {
    subjectId: gradeWorld.subjectId,
    gradeWorldId: gradeWorld.id,
    contentVersion: graph.contentVersion,
    totalStages: graph.milestones.length,
    stages: ordered.map((milestone, index) => {
      const milestoneChapters = graph.chapters
        .filter((chapter) => milestone.chapterIds.includes(chapter.id))
        .sort((left, right) => left.stageNo - right.stageNo);
      const boss = graph.bosses.find((item) => item.id === milestone.bossId);
      const previous = ordered[index - 1];

      return {
        stageNo: milestone.stageNo,
        milestoneId: milestone.id,
        name: milestone.name,
        theme: milestone.theme,
        prerequisiteMilestoneId: previous?.id ?? null,
        nodeIds: milestone.nodeIds,
        chapters: milestoneChapters.map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          estimatedMinutes: chapter.estimatedMinutes,
        })),
        boss: boss
          ? {
              id: boss.id,
              name: boss.name,
              questionCount: boss.questionIds.length,
            }
          : null,
      };
    }),
    validation: {
      valid: validationIssues.every((issue) => issue.severity !== "error"),
      issueCount: validationIssues.length,
      errors: validationIssues.filter((issue) => issue.severity === "error"),
      warnings: validationIssues.filter((issue) => issue.severity === "warning"),
    },
    counts: {
      nodes: graph.nodes.length,
      chapters: graph.chapters.length,
      milestones: graph.milestones.length,
      bosses: graph.bosses.length,
    },
  };
}

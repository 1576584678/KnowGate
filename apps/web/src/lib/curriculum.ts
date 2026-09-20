import type { Milestone } from "@knowgate/domain";
import { gradeWorld } from "@/content/math-grade4";
import { validateContentGraph } from "@/lib/content-validation";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

function orderedMilestones(milestones: Milestone[]) {
  return [...milestones].sort(
    (left, right) =>
      left.stageNo - right.stageNo || left.id.localeCompare(right.id),
  );
}

export function getCurriculumPlan() {
  const graph = buildRuntimeContentGraph();
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

import {
  bosses,
  chapters,
  gradeWorld,
  knowledgeNodes,
  milestones,
} from "@/content/math-grade4";
import { validateContentGraph } from "@/lib/content-validation";

function orderedMilestones() {
  return [...milestones].sort(
    (left, right) =>
      left.stageNo - right.stageNo || left.id.localeCompare(right.id),
  );
}

export function getCurriculumPlan() {
  const ordered = orderedMilestones();
  const validationIssues = validateContentGraph();

  return {
    subjectId: gradeWorld.subjectId,
    gradeWorldId: gradeWorld.id,
    contentVersion: gradeWorld.contentVersion,
    totalStages: gradeWorld.totalStages,
    stages: ordered.map((milestone, index) => {
      const milestoneChapters = chapters
        .filter((chapter) => milestone.chapterIds.includes(chapter.id))
        .sort((left, right) => left.stageNo - right.stageNo);
      const boss = bosses.find((item) => item.id === milestone.bossId);
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
      nodes: knowledgeNodes.length,
      chapters: chapters.length,
      milestones: milestones.length,
      bosses: bosses.length,
    },
  };
}

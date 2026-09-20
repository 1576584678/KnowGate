import { publicQuestion, type ProgressSnapshot } from "@knowgate/domain";
import {
  bosses,
  chapters,
  getBoss,
  getChapter,
  getMilestone,
  getNode,
  gradeWorld,
  milestones,
  knowledgeNodes,
} from "@/content/math-grade4";

export function getSubjects() {
  return [
    {
      id: gradeWorld.subjectId,
      name: "数学",
      gradeWorlds: [
        {
          id: gradeWorld.id,
          grade: gradeWorld.grade,
          name: gradeWorld.name,
        },
      ],
      contentVersion: gradeWorld.contentVersion,
    },
  ];
}

export function getGradeWorld(
  gradeWorldId: string,
  progress: ProgressSnapshot,
) {
  if (gradeWorldId !== gradeWorld.id) {
    throw new Error("GRADE_WORLD_NOT_FOUND");
  }

  return {
    ...gradeWorld,
    milestones: milestones.map((milestone, index) => {
      const milestoneChapters = chapters.filter((chapter) =>
        milestone.chapterIds.includes(chapter.id),
      );
      const completedChapterCount = milestoneChapters.filter((chapter) =>
        progress.passedChapterIds.includes(chapter.id),
      ).length;
      const previousMilestone = milestones[index - 1];
      const previousWon =
        !previousMilestone ||
        progress.battleOutcomes[previousMilestone.id]?.status === "won";
      const hasContent = milestone.chapterIds.length > 0;
      const bossWon = progress.battleOutcomes[milestone.id]?.status === "won";

      return {
        id: milestone.id,
        stageNo: milestone.stageNo,
        name: milestone.name,
        theme: milestone.theme,
        summary: milestone.summary,
        nodeIds: milestone.nodeIds,
        chapterCount: milestoneChapters.length,
        completedChapterCount,
        bossStatus:
          progress.battleOutcomes[milestone.id]?.status ??
          (completedChapterCount === milestoneChapters.length && hasContent
            ? "available"
            : "locked"),
        stars: bossWon ? 3 : 0,
        unlocked: hasContent && previousWon,
      };
    }),
  };
}

export function getMilestoneDetail(milestoneId: string) {
  const milestone = getMilestone(milestoneId);
  if (!milestone) {
    throw new Error("MILESTONE_NOT_FOUND");
  }

  return {
    ...milestone,
    nodes: milestone.nodeIds
      .map((nodeId) => getNode(nodeId))
      .filter((node) => node !== undefined),
    chapters: chapters
      .filter((chapter) => milestone.chapterIds.includes(chapter.id))
      .map((chapter) => ({
        id: chapter.id,
        stageNo: chapter.stageNo,
        title: chapter.title,
        summary: chapter.summary,
        estimatedMinutes: chapter.estimatedMinutes,
        nodeIds: chapter.nodeIds,
      })),
    boss: getBoss(milestone.bossId) ?? null,
    contentVersion: gradeWorld.contentVersion,
  };
}

export function getChapterDetail(chapterId: string) {
  const chapter = getChapter(chapterId);
  if (!chapter) {
    throw new Error("CHAPTER_NOT_FOUND");
  }

  return {
    ...chapter,
    steps: chapter.steps.map((step) => ({
      ...step,
      question: step.question ? publicQuestion(step.question) : undefined,
    })),
    contentVersion: gradeWorld.contentVersion,
  };
}

export function getKnowledgeNodes() {
  return knowledgeNodes;
}

export function getBosses() {
  return bosses;
}

import {
  publicContentQuestion,
  publicQuestion,
  type Chapter,
  type ProgressSnapshot,
  type PublicChapter,
} from "@knowgate/domain";
import { gradeWorld } from "@/content/math-grade4";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

function publicChapter(chapter: Chapter): PublicChapter {
  return {
    ...chapter,
    steps: chapter.steps.map((step) => ({
      ...step,
      question: step.question
        ? publicContentQuestion(step.question)
        : undefined,
    })),
  };
}

export function getPublicRuntimeContentGraph() {
  const graph = buildRuntimeContentGraph();
  return {
    ...graph,
    chapters: graph.chapters.map(publicChapter),
    questions: graph.questions.map(publicContentQuestion),
  };
}

export function getSubjects() {
  const graph = buildRuntimeContentGraph();
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
      contentVersion: graph.contentVersion,
    },
  ];
}

export function getGradeWorld(
  gradeWorldId: string,
  progress: ProgressSnapshot,
) {
  const graph = buildRuntimeContentGraph();
  const world = {
    ...gradeWorld,
    contentVersion: graph.contentVersion,
    totalStages: graph.milestones.length,
  };

  if (gradeWorldId !== world.id) {
    throw new Error("GRADE_WORLD_NOT_FOUND");
  }

  return {
    ...world,
    milestones: graph.milestones.map((milestone, index) => {
      const milestoneChapters = graph.chapters.filter((chapter) =>
        milestone.chapterIds.includes(chapter.id),
      );
      const completedChapterCount = milestoneChapters.filter((chapter) =>
        progress.passedChapterIds.includes(chapter.id),
      ).length;
      const previousMilestone = graph.milestones[index - 1];
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
  const graph = buildRuntimeContentGraph();
  const milestone = graph.milestones.find((item) => item.id === milestoneId);
  if (!milestone) {
    throw new Error("MILESTONE_NOT_FOUND");
  }

  return {
    ...milestone,
    nodes: milestone.nodeIds
      .map((nodeId) => graph.nodes.find((node) => node.id === nodeId))
      .filter((node) => node !== undefined),
    chapters: graph.chapters
      .filter((chapter) => milestone.chapterIds.includes(chapter.id))
      .map((chapter) => ({
        id: chapter.id,
        stageNo: chapter.stageNo,
        title: chapter.title,
        summary: chapter.summary,
        estimatedMinutes: chapter.estimatedMinutes,
        nodeIds: chapter.nodeIds,
      })),
    boss:
      graph.bosses.find((boss) => boss.id === milestone.bossId) ?? null,
    contentVersion: graph.contentVersion,
  };
}

export function getChapterDetail(chapterId: string) {
  const graph = buildRuntimeContentGraph();
  const chapter = graph.chapters.find((item) => item.id === chapterId);
  if (!chapter) {
    throw new Error("CHAPTER_NOT_FOUND");
  }

  return {
    ...chapter,
    steps: chapter.steps.map((step) => ({
      ...step,
      question: step.question ? publicQuestion(step.question) : undefined,
    })),
    contentVersion: graph.contentVersion,
  };
}

export function getKnowledgeNodes() {
  return buildRuntimeContentGraph().nodes;
}

export function getBosses() {
  return buildRuntimeContentGraph().bosses;
}

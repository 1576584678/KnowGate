import {
  publicContentQuestion,
  publicQuestion,
  type Chapter,
  type ProgressSnapshot,
  type PublicChapter,
} from "@knowgate/domain";
import { mathGradeWorlds } from "@/content/math-curriculum";
import type { ContentGraph } from "@/lib/content-validation";
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

function publicGradeWorldSummaries(contentVersion: string) {
  return mathGradeWorlds.map((world) => ({
    ...world,
    contentVersion,
  }));
}

function buildPublicRuntimeContentGraph(graph: ContentGraph) {
  return {
    ...graph,
    worlds: publicGradeWorldSummaries(graph.contentVersion),
    chapters: graph.chapters.map(publicChapter),
    questions: graph.questions.map(publicContentQuestion),
  };
}

function buildPublicGradeGraph(graph: ContentGraph, grade: number) {
  const prefix = `math.g${grade}.`;
  const milestones = graph.milestones.filter((milestone) =>
    milestone.id.startsWith(prefix),
  );
  const milestoneIds = new Set(milestones.map((milestone) => milestone.id));
  const chapters = graph.chapters.filter((chapter) =>
    milestoneIds.has(chapter.milestoneId),
  );
  const bossIds = new Set(milestones.map((milestone) => milestone.bossId));
  const bosses = graph.bosses.filter((boss) => bossIds.has(boss.id));
  const nodeIds = new Set([
    ...milestones.flatMap((milestone) => milestone.nodeIds),
    ...chapters.flatMap((chapter) => chapter.nodeIds),
  ]);

  return {
    contentVersion: graph.contentVersion,
    worlds: publicGradeWorldSummaries(graph.contentVersion),
    nodes: graph.nodes.filter((node) => nodeIds.has(node.id)),
    chapters: chapters.map(publicChapter),
    milestones,
    bosses,
    questions: graph.questions
      .filter((question) => nodeIds.has(question.nodeId))
      .map(publicContentQuestion),
  };
}

type PublicRuntimeContentGraph = ReturnType<
  typeof buildPublicRuntimeContentGraph
>;

// Mapping the graph into its public shape touches every entity, so reuse the
// previous result while the underlying graph object is unchanged.
let publicRuntimeContentCache:
  | { graph: ContentGraph; payload: PublicRuntimeContentGraph }
  | undefined;

export function getPublicRuntimeContentGraph(): PublicRuntimeContentGraph {
  const graph = buildRuntimeContentGraph();
  if (publicRuntimeContentCache?.graph === graph) {
    return publicRuntimeContentCache.payload;
  }

  const payload = buildPublicRuntimeContentGraph(graph);
  publicRuntimeContentCache = { graph, payload };
  return payload;
}

type PublicGradeGraph = ReturnType<typeof buildPublicGradeGraph>;

let publicGradeGraphCache:
  | { graph: ContentGraph; byGrade: Map<number, PublicGradeGraph> }
  | undefined;

export function getSupportedGrades() {
  return mathGradeWorlds.map((world) => world.grade);
}

// The full graph is a few hundred kilobytes, so the client only downloads the
// grade it is showing. Slices are cached per grade while the graph is unchanged.
export function getPublicRuntimeGradeGraph(grade: number): PublicGradeGraph {
  const graph = buildRuntimeContentGraph();
  if (publicGradeGraphCache?.graph !== graph) {
    publicGradeGraphCache = { graph, byGrade: new Map() };
  }

  const cached = publicGradeGraphCache.byGrade.get(grade);
  if (cached) return cached;

  const payload = buildPublicGradeGraph(graph, grade);
  publicGradeGraphCache.byGrade.set(grade, payload);
  return payload;
}

export function getSubjects() {
  const graph = buildRuntimeContentGraph();
  return [
    {
      id: "math",
      name: "数学",
      gradeWorlds: mathGradeWorlds.map((world) => ({
        id: world.id,
        grade: world.grade,
        name: world.name,
      })),
      contentVersion: graph.contentVersion,
    },
  ];
}

export function getGradeWorld(
  gradeWorldId: string,
  progress: ProgressSnapshot,
) {
  const graph = buildRuntimeContentGraph();
  const summary = mathGradeWorlds.find((item) => item.id === gradeWorldId);
  if (!summary) {
    throw new Error("GRADE_WORLD_NOT_FOUND");
  }

  const gradePrefix = `math.g${summary.grade}.`;
  const gradeMilestones = graph.milestones
    .filter((milestone) => milestone.id.startsWith(gradePrefix))
    .sort((left, right) => left.stageNo - right.stageNo);
  const gradeMilestoneIds = new Set(
    gradeMilestones.map((milestone) => milestone.id),
  );
  const gradeChapters = graph.chapters.filter((chapter) =>
    gradeMilestoneIds.has(chapter.milestoneId),
  );
  const world = {
    ...summary,
    contentVersion: graph.contentVersion,
    totalStages: gradeMilestones.length,
  };

  return {
    ...world,
    milestones: gradeMilestones.map((milestone, index) => {
      const milestoneChapters = gradeChapters.filter((chapter) =>
        milestone.chapterIds.includes(chapter.id),
      );
      const completedChapterCount = milestoneChapters.filter((chapter) =>
        progress.passedChapterIds.includes(chapter.id),
      ).length;
      const previousMilestone = gradeMilestones[index - 1];
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

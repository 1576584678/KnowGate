import {
  calculateMasteryBreakdown,
  getMasteryStatus,
  publicQuestion,
  type BattleOutcome,
  type KnowledgeNode,
} from "@knowgate/domain";
import {
  bossQuestions,
  chapters,
  getNode,
  gradeWorld,
  knowledgeNodes,
  milestones,
} from "@/content/math-grade4";
import { getPersistence, type PersistenceStore } from "@/lib/persistence";

export type NodeMasteryReport = {
  nodeId: string;
  name: string;
  mastery: number;
  status: ReturnType<typeof getMasteryStatus>;
  breakdown: ReturnType<typeof calculateMasteryBreakdown>;
  completedChapters: number;
  totalChapters: number;
  nextReviewAt: string | null;
};

function latestOutcome(
  outcomes: Array<BattleOutcome | undefined>,
): BattleOutcome | undefined {
  return outcomes
    .filter((outcome): outcome is BattleOutcome => outcome !== undefined)
    .sort(
      (left, right) =>
        Date.parse(right.completedAt) - Date.parse(left.completedAt),
    )[0];
}

function outcomeForNode(
  nodeId: string,
  outcomes: Record<string, BattleOutcome>,
) {
  const nodeMilestones = milestones.filter((milestone) =>
    milestone.nodeIds.includes(nodeId),
  );
  return latestOutcome(
    nodeMilestones.map((milestone) => outcomes[milestone.id]),
  );
}

function nextReviewAt(
  node: KnowledgeNode,
  outcome: BattleOutcome | undefined,
  completedAt: string | undefined,
) {
  const evidenceAt = outcome?.completedAt ?? completedAt;
  if (!evidenceAt) return null;

  const reviewAt = new Date(Date.parse(evidenceAt) + 7 * 24 * 60 * 60 * 1000);
  return Number.isNaN(reviewAt.getTime()) ? null : reviewAt.toISOString();
}

export function getNodeMasteryReport(
  profileId: string,
  persistence: PersistenceStore = getPersistence(),
): NodeMasteryReport[] {
  const progress = persistence.getProgress(profileId);

  return knowledgeNodes.map((node) => {
    const nodeChapters = chapters.filter((chapter) =>
      chapter.nodeIds.includes(node.id),
    );
    const completedChapters = nodeChapters.filter((chapter) =>
      progress.passedChapterIds.includes(chapter.id),
    ).length;
    const outcome = outcomeForNode(node.id, progress.battleOutcomes);
    const breakdown = calculateMasteryBreakdown({
      completedChapters,
      totalChapters: nodeChapters.length,
      bossOutcome: outcome,
    });
    const completions = nodeChapters
      .map((chapter) =>
        persistence.getChapterCompletion(profileId, chapter.id),
      )
      .filter((completion) => completion !== undefined)
      .sort(
        (left, right) =>
          Date.parse(right.completedAt) - Date.parse(left.completedAt),
      );

    return {
      nodeId: node.id,
      name: node.name,
      mastery: breakdown.score,
      status: breakdown.status,
      breakdown,
      completedChapters,
      totalChapters: nodeChapters.length,
      nextReviewAt: nextReviewAt(
        node,
        outcome,
        completions[0]?.completedAt,
      ),
    };
  });
}

function prerequisitePath(nodeId: string) {
  const path: KnowledgeNode[] = [];
  const visited = new Set<string>();

  function visit(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const node = getNode(currentId);
    if (!node) return;

    for (const prerequisiteId of node.prerequisites) {
      visit(prerequisiteId);
    }
    path.push(node);
  }

  visit(nodeId);
  return path;
}

export function getRemediationPlan(
  profileId: string,
  nodeId: string,
  persistence: PersistenceStore = getPersistence(),
) {
  const targetNode = getNode(nodeId);
  if (!targetNode) {
    throw new Error("NODE_NOT_FOUND");
  }

  const path = prerequisitePath(nodeId);
  const pathNodeIds = new Set(path.map((node) => node.id));
  const reportByNode = new Map(
    getNodeMasteryReport(profileId, persistence).map((report) => [
      report.nodeId,
      report,
    ]),
  );
  const relatedChapters = chapters.filter((chapter) =>
    chapter.nodeIds.some((chapterNodeId) => pathNodeIds.has(chapterNodeId)),
  );
  const exercises = bossQuestions
    .filter((question) => pathNodeIds.has(question.nodeId))
    .slice(0, 3)
    .map((question) => publicQuestion(question));

  return {
    node: {
      ...targetNode,
      mastery: reportByNode.get(nodeId)?.mastery ?? 0,
      status: reportByNode.get(nodeId)?.status ?? "learning",
    },
    prerequisitePath: path.map((node) => ({
      nodeId: node.id,
      name: node.name,
      mastery: reportByNode.get(node.id)?.mastery ?? 0,
      status: reportByNode.get(node.id)?.status ?? "learning",
    })),
    chapters: relatedChapters.map((chapter) => ({
      id: chapter.id,
      milestoneId: chapter.milestoneId,
      title: chapter.title,
      summary: chapter.summary,
      estimatedMinutes: chapter.estimatedMinutes,
      nodeIds: chapter.nodeIds,
    })),
    exercises,
    contentVersion: gradeWorld.contentVersion,
  };
}

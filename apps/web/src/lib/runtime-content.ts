import type {
  Boss,
  Chapter,
  ContentQuestion,
  KnowledgeNode,
  Milestone,
} from "@knowgate/domain";
import {
  bossQuestions,
  bosses,
  chapters,
  gradeWorld,
  knowledgeNodes,
  milestones,
} from "@/content/math-grade4";
import type { ContentGraph } from "@/lib/content-validation";
import {
  getPersistence,
  type PersistenceStore,
  type PublishedContentRecord,
} from "@/lib/persistence";

function upsertById<Entity extends { id: string }>(
  current: Entity[],
  incoming: Entity[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) {
    byId.set(item.id, item);
  }
  return [...byId.values()];
}

function readEntities<Entity>(value: unknown): Entity[] | undefined {
  return Array.isArray(value) ? (value as Entity[]) : undefined;
}

function applyPublication(
  graph: ContentGraph,
  publication: PublishedContentRecord,
): ContentGraph {
  const payload = publication.payload;

  if (publication.kind === "curriculum") {
    const contentVersion =
      typeof payload.contentVersion === "string"
        ? payload.contentVersion
        : graph.contentVersion;
    const nodes = readEntities<KnowledgeNode>(payload.nodes);
    const curriculumChapters = readEntities<Chapter>(payload.chapters);
    const curriculumMilestones = readEntities<Milestone>(payload.milestones);
    const curriculumBosses = readEntities<Boss>(payload.bosses);
    const questions = readEntities<ContentQuestion>(payload.questions);

    return {
      contentVersion,
      nodes: nodes ? upsertById(graph.nodes, nodes) : graph.nodes,
      chapters: curriculumChapters
        ? upsertById(graph.chapters, curriculumChapters)
        : graph.chapters,
      milestones: curriculumMilestones
        ? upsertById(graph.milestones, curriculumMilestones)
        : graph.milestones,
      bosses: curriculumBosses
        ? upsertById(graph.bosses, curriculumBosses)
        : graph.bosses,
      questions: questions
        ? upsertById(graph.questions, questions)
        : graph.questions,
    };
  }

  if (publication.kind === "knowledge_node") {
    return {
      ...graph,
      nodes: upsertById(graph.nodes, [payload as unknown as KnowledgeNode]),
    };
  }

  if (publication.kind === "chapter") {
    return {
      ...graph,
      chapters: upsertById(graph.chapters, [payload as unknown as Chapter]),
    };
  }

  if (publication.kind === "boss") {
    return {
      ...graph,
      bosses: upsertById(graph.bosses, [payload as unknown as Boss]),
    };
  }

  return {
    ...graph,
    questions: upsertById(graph.questions, [
      payload as unknown as ContentQuestion,
    ]),
  };
}

export function buildRuntimeContentGraph(
  persistence: PersistenceStore = getPersistence(),
): ContentGraph {
  let graph: ContentGraph = {
    contentVersion: gradeWorld.contentVersion,
    nodes: [...knowledgeNodes],
    chapters: [...chapters],
    milestones: [...milestones],
    bosses: [...bosses],
    questions: [...bossQuestions],
  };

  // getPublishedContent returns publications oldest-first, so later
  // publications override earlier ones by entity id.
  for (const publication of persistence.getPublishedContent()) {
    graph = applyPublication(graph, publication);
  }

  return graph;
}

export function getRuntimeGradeWorld(
  persistence: PersistenceStore = getPersistence(),
) {
  const graph = buildRuntimeContentGraph(persistence);
  return { ...gradeWorld, contentVersion: graph.contentVersion };
}

export function getRuntimeChapter(
  chapterId: string,
  persistence: PersistenceStore = getPersistence(),
) {
  return buildRuntimeContentGraph(persistence).chapters.find(
    (chapter) => chapter.id === chapterId,
  );
}

export function getRuntimeMilestone(
  milestoneId: string,
  persistence: PersistenceStore = getPersistence(),
) {
  return buildRuntimeContentGraph(persistence).milestones.find(
    (milestone) => milestone.id === milestoneId,
  );
}

export function getRuntimeBoss(
  bossId: string,
  persistence: PersistenceStore = getPersistence(),
) {
  return buildRuntimeContentGraph(persistence).bosses.find(
    (boss) => boss.id === bossId,
  );
}

export function getRuntimeNode(
  nodeId: string,
  persistence: PersistenceStore = getPersistence(),
) {
  return buildRuntimeContentGraph(persistence).nodes.find(
    (node) => node.id === nodeId,
  );
}

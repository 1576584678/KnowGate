import type {
  Boss,
  Chapter,
  ContentQuestion,
  ContentSnapshot,
  KnowledgeNode,
  Milestone,
} from "@knowgate/domain";
import {
  fullMathContentGraph,
  mathGradeWorlds,
} from "@/content/math-curriculum";
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

function mergeContentGraph(
  base: ContentGraph,
  overlay: ContentGraph,
): ContentGraph {
  return {
    contentVersion: overlay.contentVersion || base.contentVersion,
    nodes: upsertById(base.nodes, overlay.nodes),
    chapters: upsertById(base.chapters, overlay.chapters),
    milestones: upsertById(base.milestones, overlay.milestones),
    bosses: upsertById(base.bosses, overlay.bosses),
    questions: upsertById(base.questions, overlay.questions),
  };
}

function snapshotGraph(snapshot: ContentSnapshot): ContentGraph {
  const graph = snapshot.graph as Partial<ContentGraph>;
  if (
    typeof graph.contentVersion !== "string" ||
    !Array.isArray(graph.nodes) ||
    !Array.isArray(graph.chapters) ||
    !Array.isArray(graph.milestones) ||
    !Array.isArray(graph.bosses) ||
    !Array.isArray(graph.questions)
  ) {
    throw new Error("CONTENT_SNAPSHOT_INVALID");
  }

  return mergeContentGraph(fullMathContentGraph, graph as ContentGraph);
}

export function contentRolloutBucket(profileId: string) {
  let hash = 2166136261;
  for (const character of profileId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

function selectActiveSnapshot(snapshots: ContentSnapshot[]) {
  if (snapshots.length === 0) return undefined;
  return snapshots.at(-1);
}

function legacyRuntimeContent(
  persistence: PersistenceStore = getPersistence(),
): ContentGraph {
  let graph: ContentGraph = {
    contentVersion: fullMathContentGraph.contentVersion,
    nodes: [...fullMathContentGraph.nodes],
    chapters: [...fullMathContentGraph.chapters],
    milestones: [...fullMathContentGraph.milestones],
    bosses: [...fullMathContentGraph.bosses],
    questions: [...fullMathContentGraph.questions],
  };

  // getPublishedContent returns publications oldest-first, so later
  // publications override earlier ones by entity id.
  for (const publication of persistence.getPublishedContent()) {
    graph = applyPublication(graph, publication);
  }

  return graph;
}

export function resolveRuntimeContent(
  persistence: PersistenceStore = getPersistence(),
  options: { profileId?: string; snapshotId?: string } = {},
) {
  const snapshots = persistence.getContentSnapshots("active");
  // A pinned snapshot is resolved even after retirement so that an
  // in-progress session keeps the exact content version it started on.
  const pinned = options.snapshotId
    ? persistence.getContentSnapshot(options.snapshotId)
    : undefined;
  const snapshot = pinned ?? selectActiveSnapshot(snapshots);
  const current = snapshots.at(-1);
  const rolloutSnapshot =
    !options.snapshotId &&
    options.profileId &&
    current &&
    contentRolloutBucket(options.profileId) >= current.rolloutPercent &&
    current.previousSnapshotId
      ? persistence.getContentSnapshot(current.previousSnapshotId)
      : undefined;
  const resolved =
    rolloutSnapshot && rolloutSnapshot.status !== "retired"
      ? rolloutSnapshot
      : snapshot;

  if (!resolved) {
    const graph = legacyRuntimeContent(persistence);
    return {
      graph,
      snapshotId: undefined,
      graphHash: undefined,
      curriculumHash: undefined,
      itemSetHash: undefined,
    };
  }

  return {
    graph: snapshotGraph(resolved),
    snapshotId: resolved.id,
    graphHash: resolved.graphHash,
    curriculumHash: resolved.curriculumHash,
    itemSetHash: resolved.itemSetHash,
  };
}

export function buildRuntimeContentGraph(
  persistence: PersistenceStore = getPersistence(),
  options: { profileId?: string; snapshotId?: string } = {},
): ContentGraph {
  return resolveRuntimeContent(persistence, options).graph;
}

export function getRuntimeGradeWorld(
  persistence: PersistenceStore = getPersistence(),
  gradeWorldId = "math.g4",
) {
  const graph = buildRuntimeContentGraph(persistence);
  const world = mathGradeWorlds.find((item) => item.id === gradeWorldId);
  if (!world) throw new Error("GRADE_WORLD_NOT_FOUND");
  return { ...world, contentVersion: graph.contentVersion };
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

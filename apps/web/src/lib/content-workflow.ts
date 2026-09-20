import type {
  Boss,
  Chapter,
  ContentDraft,
  ContentDraftKind,
  ContentDraftStatus,
  ContentQuestion,
  ContentReviewRecord,
  KnowledgeNode,
  LessonPhase,
  LessonStep,
  Milestone,
  QuestionKind,
} from "@knowgate/domain";
import { gradeWorld } from "@/content/math-grade4";
import {
  validateContentGraph,
  type ContentGraph,
} from "@/lib/content-validation";
import {
  getPersistence,
  type PersistenceStore,
} from "@/lib/persistence";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

const DRAFT_KINDS: ContentDraftKind[] = [
  "knowledge_node",
  "chapter",
  "boss",
  "question_template",
  "curriculum",
];

const QUESTION_KINDS: QuestionKind[] = [
  "identify",
  "judge",
  "apply",
  "transfer",
  "decisive",
];

const LESSON_PHASES: LessonPhase[] = [
  "hook",
  "concept",
  "example",
  "guided",
  "practice",
  "quiz",
];

export type ContentReviewAction = "submit" | "approve" | "reject" | "publish";

const reviewActions: Record<
  ContentReviewAction,
  ContentReviewRecord["action"]
> = {
  submit: "submitted",
  approve: "approved",
  reject: "rejected",
  publish: "published",
};

type ContentDraftPayload = Record<string, unknown>;

type DraftPublication = {
  entityId: string;
  contentVersion: string;
  payload: ContentDraftPayload;
  graph: ContentGraph;
};

function createReview(input: {
  draftId: string;
  action: ContentReviewRecord["action"];
  operatorId: string;
  note?: string;
}) {
  return {
    id: crypto.randomUUID(),
    draftId: input.draftId,
    action: input.action,
    operatorId: input.operatorId,
    note: input.note,
    occurredAt: new Date().toISOString(),
  } satisfies ContentReviewRecord;
}

function requiredText(value: string, code: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function asRecord(value: unknown, field: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`INVALID_DRAFT_PAYLOAD:${field}`);
  }
  return value as Record<string, unknown>;
}

function readText(
  record: Record<string, unknown>,
  field: string,
  { allowEmpty = false } = {},
) {
  const value = record[field];
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    throw new Error(`INVALID_DRAFT_PAYLOAD:${field}`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`INVALID_DRAFT_PAYLOAD:${field}`);
  }
  return value;
}

function readTextArray(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`INVALID_DRAFT_PAYLOAD:${field}`);
  }
  return value as string[];
}

function readRecordArray(record: Record<string, unknown>, field: string) {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw new Error(`INVALID_DRAFT_PAYLOAD:${field}`);
  }
  return value.map((item) => asRecord(item, field));
}

function readOptionalVisual(record: Record<string, unknown>) {
  if (record.visual === undefined) return undefined;
  const visual = asRecord(record.visual, "visual");
  if (visual.kind !== "fraction-bar") {
    throw new Error("INVALID_DRAFT_PAYLOAD:visual.kind");
  }
  return {
    kind: "fraction-bar" as const,
    total: readNumber(visual, "total"),
    active: readNumber(visual, "active"),
    ...(visual.compareTo === undefined
      ? {}
      : { compareTo: readNumber(visual, "compareTo") }),
    ...(visual.labels === undefined
      ? {}
      : { labels: readTextArray(visual, "labels") }),
  };
}

function parseQuestion(value: unknown): ContentQuestion {
  const record = asRecord(value, "question");
  const kind = readText(record, "kind");
  if (!QUESTION_KINDS.includes(kind as QuestionKind)) {
    throw new Error("INVALID_DRAFT_PAYLOAD:question.kind");
  }

  return {
    id: readText(record, "id"),
    nodeId: readText(record, "nodeId"),
    kind: kind as QuestionKind,
    prompt: readText(record, "prompt"),
    options: readTextArray(record, "options"),
    answerIndex: readNumber(record, "answerIndex"),
    explanation: readText(record, "explanation", { allowEmpty: true }),
    timeLimitSec: readNumber(record, "timeLimitSec"),
    damage: readNumber(record, "damage"),
    visual: readOptionalVisual(record),
  };
}

function parseStep(value: unknown): LessonStep {
  const record = asRecord(value, "step");
  const phase = readText(record, "phase");
  if (!LESSON_PHASES.includes(phase as LessonPhase)) {
    throw new Error("INVALID_DRAFT_PAYLOAD:step.phase");
  }

  return {
    id: readText(record, "id"),
    phase: phase as LessonPhase,
    title: readText(record, "title"),
    body: readText(record, "body", { allowEmpty: true }),
    question:
      record.question === undefined ? undefined : parseQuestion(record.question),
    visual: readOptionalVisual(record),
  };
}

function parseChapter(value: unknown): Chapter {
  const record = asRecord(value, "chapter");
  return {
    id: readText(record, "id"),
    milestoneId: readText(record, "milestoneId"),
    stageNo: readNumber(record, "stageNo"),
    title: readText(record, "title"),
    summary: readText(record, "summary", { allowEmpty: true }),
    estimatedMinutes: readNumber(record, "estimatedMinutes"),
    nodeIds: readTextArray(record, "nodeIds"),
    steps: readRecordArray(record, "steps").map(parseStep),
  };
}

function parseMilestone(value: unknown): Milestone {
  const record = asRecord(value, "milestone");
  return {
    id: readText(record, "id"),
    stageNo: readNumber(record, "stageNo"),
    name: readText(record, "name"),
    theme: readText(record, "theme"),
    summary: readText(record, "summary", { allowEmpty: true }),
    nodeIds: readTextArray(record, "nodeIds"),
    chapterIds: readTextArray(record, "chapterIds"),
    bossId: readText(record, "bossId"),
  };
}

function parseBoss(value: unknown): Boss {
  const record = asRecord(value, "boss");
  return {
    id: readText(record, "id"),
    milestoneId: readText(record, "milestoneId"),
    name: readText(record, "name"),
    epithet: readText(record, "epithet"),
    hp: readNumber(record, "hp"),
    initialDistance: readNumber(record, "initialDistance"),
    questionIds: readTextArray(record, "questionIds"),
  };
}

function parseKnowledgeNode(value: unknown): KnowledgeNode {
  const record = asRecord(value, "node");
  return {
    id: readText(record, "id"),
    name: readText(record, "name"),
    domain: readText(record, "domain"),
    stage: readText(record, "stage"),
    mastery: readTextArray(record, "mastery"),
    prerequisites: readTextArray(record, "prerequisites"),
  };
}

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

function baseGraph(persistence: PersistenceStore): ContentGraph {
  // Validate each new draft on top of the content that is live right now, so
  // successive publications compose instead of each being checked against the
  // static seed graph.
  return buildRuntimeContentGraph(persistence);
}

function parseCurriculum(payload: ContentDraftPayload) {
  const fields = [
    "nodes",
    "chapters",
    "milestones",
    "bosses",
    "questions",
  ] as const;
  if (!fields.some((field) => payload[field] !== undefined)) {
    throw new Error("INVALID_DRAFT_PAYLOAD:curriculum");
  }

  return {
    contentVersion:
      payload.contentVersion === undefined
        ? gradeWorld.contentVersion
        : readText(payload, "contentVersion"),
    nodes:
      payload.nodes === undefined
        ? undefined
        : readRecordArray(payload, "nodes").map(parseKnowledgeNode),
    chapters:
      payload.chapters === undefined
        ? undefined
        : readRecordArray(payload, "chapters").map(parseChapter),
    milestones:
      payload.milestones === undefined
        ? undefined
        : readRecordArray(payload, "milestones").map(parseMilestone),
    bosses:
      payload.bosses === undefined
        ? undefined
        : readRecordArray(payload, "bosses").map(parseBoss),
    questions:
      payload.questions === undefined
        ? undefined
        : readRecordArray(payload, "questions").map(parseQuestion),
  };
}

function buildDraftPublication(
  draft: ContentDraft,
  persistence: PersistenceStore,
): DraftPublication {
  const base = baseGraph(persistence);

  if (draft.kind === "curriculum") {
    const curriculum = parseCurriculum(draft.payload);
    return {
      entityId: "curriculum",
      contentVersion: curriculum.contentVersion,
      payload: {
        contentVersion: curriculum.contentVersion,
        ...(curriculum.nodes ? { nodes: curriculum.nodes } : {}),
        ...(curriculum.chapters ? { chapters: curriculum.chapters } : {}),
        ...(curriculum.milestones ? { milestones: curriculum.milestones } : {}),
        ...(curriculum.bosses ? { bosses: curriculum.bosses } : {}),
        ...(curriculum.questions ? { questions: curriculum.questions } : {}),
      },
      graph: {
        contentVersion: curriculum.contentVersion,
        nodes: curriculum.nodes
          ? upsertById(base.nodes, curriculum.nodes)
          : base.nodes,
        chapters: curriculum.chapters
          ? upsertById(base.chapters, curriculum.chapters)
          : base.chapters,
        milestones: curriculum.milestones
          ? upsertById(base.milestones, curriculum.milestones)
          : base.milestones,
        bosses: curriculum.bosses
          ? upsertById(base.bosses, curriculum.bosses)
          : base.bosses,
        questions: curriculum.questions
          ? upsertById(base.questions, curriculum.questions)
          : base.questions,
      },
    };
  }

  if (draft.kind === "knowledge_node") {
    const node = parseKnowledgeNode(draft.payload);
    return {
      entityId: node.id,
      contentVersion: base.contentVersion,
      payload: node as unknown as ContentDraftPayload,
      graph: { ...base, nodes: upsertById(base.nodes, [node]) },
    };
  }

  if (draft.kind === "chapter") {
    const chapter = parseChapter(draft.payload);
    return {
      entityId: chapter.id,
      contentVersion: base.contentVersion,
      payload: chapter as unknown as ContentDraftPayload,
      graph: { ...base, chapters: upsertById(base.chapters, [chapter]) },
    };
  }

  if (draft.kind === "boss") {
    const boss = parseBoss(draft.payload);
    return {
      entityId: boss.id,
      contentVersion: base.contentVersion,
      payload: boss as unknown as ContentDraftPayload,
      graph: { ...base, bosses: upsertById(base.bosses, [boss]) },
    };
  }

  const question = parseQuestion(draft.payload);
  return {
    entityId: question.id,
    contentVersion: base.contentVersion,
    payload: question as unknown as ContentDraftPayload,
    graph: { ...base, questions: upsertById(base.questions, [question]) },
  };
}

function assertPublishable(publication: DraftPublication) {
  const errors = validateContentGraph(publication.graph).filter(
    (issue) => issue.severity === "error",
  );

  if (errors.length > 0) {
    throw new Error(
      `CONTENT_GRAPH_INVALID:${errors.map((issue) => issue.code).join(",")}`,
    );
  }
}

function assertTransition(
  draft: ContentDraft,
  action: ContentReviewAction,
) {
  if (action === "submit" && !["draft", "rejected"].includes(draft.status)) {
    throw new Error("INVALID_REVIEW_TRANSITION");
  }

  if (
    (action === "approve" || action === "reject") &&
    draft.status !== "in_review"
  ) {
    throw new Error("INVALID_REVIEW_TRANSITION");
  }

  if (action === "publish" && draft.status !== "approved") {
    throw new Error("INVALID_REVIEW_TRANSITION");
  }
}

export function listContentDrafts(
  status?: ContentDraftStatus,
  persistence: PersistenceStore = getPersistence(),
) {
  return persistence.listContentDrafts(status).map((draft) => ({
    ...draft,
    reviews: persistence.getContentReviews(draft.id),
  }));
}

export function createContentDraft(
  input: {
    kind: ContentDraftKind;
    title: string;
    payload: Record<string, unknown>;
    authorId: string;
  },
  persistence: PersistenceStore = getPersistence(),
) {
  if (!DRAFT_KINDS.includes(input.kind)) {
    throw new Error("INVALID_DRAFT_KIND");
  }

  const now = new Date().toISOString();
  const draft: ContentDraft = {
    id: crypto.randomUUID(),
    kind: input.kind,
    title: requiredText(input.title, "DRAFT_TITLE_REQUIRED"),
    payload: input.payload,
    status: "draft",
    authorId: requiredText(input.authorId, "AUTHOR_REQUIRED"),
    createdAt: now,
    updatedAt: now,
  };

  persistence.saveContentDraft(draft);
  return draft;
}

export function updateContentDraft(
  input: {
    draftId: string;
    title?: string;
    payload?: Record<string, unknown>;
    operatorId: string;
  },
  persistence: PersistenceStore = getPersistence(),
) {
  const draft = persistence.getContentDraft(input.draftId);
  if (!draft) throw new Error("DRAFT_NOT_FOUND");
  if (!["draft", "rejected"].includes(draft.status)) {
    throw new Error("DRAFT_READ_ONLY");
  }
  if (draft.authorId !== input.operatorId) {
    throw new Error("DRAFT_AUTHOR_REQUIRED");
  }

  const updated = {
    ...draft,
    title:
      input.title === undefined
        ? draft.title
        : requiredText(input.title, "DRAFT_TITLE_REQUIRED"),
    payload: input.payload ?? draft.payload,
    status: "draft" as const,
    reviewNote: undefined,
    reviewerId: undefined,
    reviewedAt: undefined,
    updatedAt: new Date().toISOString(),
  };

  persistence.saveContentDraft(updated);
  return updated;
}

export function reviewContentDraft(
  input: {
    draftId: string;
    action: ContentReviewAction;
    operatorId: string;
    note?: string;
  },
  persistence: PersistenceStore = getPersistence(),
) {
  const draft = persistence.getContentDraft(input.draftId);
  if (!draft) throw new Error("DRAFT_NOT_FOUND");
  assertTransition(draft, input.action);

  if (input.action === "publish") {
    const publication = buildDraftPublication(draft, persistence);
    assertPublishable(publication);
    persistence.recordPublication({
      id: crypto.randomUUID(),
      draftId: draft.id,
      kind: draft.kind,
      entityId: publication.entityId,
      contentVersion: publication.contentVersion,
      payload: publication.payload,
      publishedAt: new Date().toISOString(),
    });
  }

  const now = new Date().toISOString();
  const nextStatus: Record<ContentReviewAction, ContentDraftStatus> = {
    submit: "in_review",
    approve: "approved",
    reject: "rejected",
    publish: "published",
  };
  const next: ContentDraft = {
    ...draft,
    status: nextStatus[input.action],
    reviewerId:
      input.action === "approve" ||
      input.action === "reject" ||
      input.action === "publish"
        ? requiredText(input.operatorId, "REVIEWER_REQUIRED")
        : draft.reviewerId,
    reviewNote: input.note?.trim() || draft.reviewNote,
    updatedAt: now,
    submittedAt: input.action === "submit" ? now : draft.submittedAt,
    reviewedAt:
      input.action === "approve" || input.action === "reject"
        ? now
        : draft.reviewedAt,
    publishedAt: input.action === "publish" ? now : draft.publishedAt,
  };

  persistence.saveContentDraft(next);
  persistence.recordContentReview(
    createReview({
      draftId: draft.id,
      action: reviewActions[input.action],
      operatorId: input.operatorId,
      note: input.note,
    }),
  );

  return {
    ...next,
    reviews: persistence.getContentReviews(draft.id),
  };
}

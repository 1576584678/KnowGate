import type {
  ContentDraft,
  ContentDraftKind,
  ContentDraftStatus,
  ContentReviewRecord,
} from "@knowgate/domain";
import { getCurriculumPlan } from "@/lib/curriculum";
import {
  getPersistence,
  type PersistenceStore,
} from "@/lib/persistence";

const DRAFT_KINDS: ContentDraftKind[] = [
  "knowledge_node",
  "chapter",
  "boss",
  "question_template",
  "curriculum",
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
    const validation = getCurriculumPlan().validation;
    if (!validation.valid) {
      throw new Error("CONTENT_GRAPH_INVALID");
    }
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

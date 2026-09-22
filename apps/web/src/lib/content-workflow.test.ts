import { afterEach, describe, expect, it } from "vitest";
import type { Chapter } from "@knowgate/domain";
import { chapters } from "@/content/math-grade4";
import {
  activateContentSnapshot,
  createContentDraft,
  listContentDrafts,
  retireContentSnapshot,
  reviewContentDraft,
  updateContentDraft,
} from "./content-workflow";
import { hashContentGraph } from "./content-hashing";
import type { ContentGraph } from "./content-validation";
import { createPersistence, type PersistenceStore } from "./persistence";

const stores: PersistenceStore[] = [];

function createStore() {
  const store = createPersistence(":memory:");
  stores.push(store);
  return store;
}

function draftChapter(): Chapter {
  return {
    ...chapters[0],
    id: "chapter.draft.test",
    title: "New chapter",
  };
}

function publishDraft(
  persistence: PersistenceStore,
  input: {
    kind: "chapter" | "question_template";
    title: string;
    payload: Record<string, unknown>;
  },
) {
  const draft = createContentDraft(
    {
      ...input,
      authorId: "author.1",
    },
    persistence,
  );
  reviewContentDraft(
    { draftId: draft.id, action: "submit", operatorId: "author.1" },
    persistence,
  );
  reviewContentDraft(
    { draftId: draft.id, action: "approve", operatorId: "reviewer.1" },
    persistence,
  );
  return reviewContentDraft(
    { draftId: draft.id, action: "publish", operatorId: "publisher.1" },
    persistence,
  );
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
});

describe("content review workflow", () => {
  it("validates and persists the draft payload on publication", () => {
    const persistence = createStore();
    const draft = createContentDraft(
      {
        kind: "chapter",
        title: "New chapter",
        payload: draftChapter() as unknown as Record<string, unknown>,
        authorId: "author.1",
      },
      persistence,
    );

    const submitted = reviewContentDraft(
      {
        draftId: draft.id,
        action: "submit",
        operatorId: "author.1",
      },
      persistence,
    );
    expect(submitted.status).toBe("in_review");

    const approved = reviewContentDraft(
      {
        draftId: draft.id,
        action: "approve",
        operatorId: "reviewer.1",
        note: "Ready",
      },
      persistence,
    );
    expect(approved.status).toBe("approved");

    const published = reviewContentDraft(
      {
        draftId: draft.id,
        action: "publish",
        operatorId: "publisher.1",
      },
      persistence,
    );

    expect(published.status).toBe("published");
    expect(published.reviewerId).toBe("publisher.1");
    expect(published.reviews.map((review) => review.action)).toEqual([
      "submitted",
      "approved",
      "published",
    ]);
    expect(listContentDrafts("published", persistence)).toHaveLength(1);

    const publications = persistence.getPublishedContent();
    expect(publications).toHaveLength(1);
    expect(publications[0]).toMatchObject({
      draftId: draft.id,
      kind: "chapter",
      entityId: "chapter.draft.test",
    });
  });

  it("rejects publishing a malformed draft payload", () => {
    const persistence = createStore();
    const draft = createContentDraft(
      {
        kind: "chapter",
        title: "Broken chapter",
        payload: { title: "Broken chapter" },
        authorId: "author.1",
      },
      persistence,
    );
    reviewContentDraft(
      { draftId: draft.id, action: "submit", operatorId: "author.1" },
      persistence,
    );
    reviewContentDraft(
      { draftId: draft.id, action: "approve", operatorId: "reviewer.1" },
      persistence,
    );

    expect(() =>
      reviewContentDraft(
        { draftId: draft.id, action: "publish", operatorId: "publisher.1" },
        persistence,
      ),
    ).toThrow(/INVALID_DRAFT_PAYLOAD/);
    expect(persistence.getPublishedContent()).toHaveLength(0);
  });

  it("rejects publishing a payload that breaks the content graph", () => {
    const persistence = createStore();
    const chapter = {
      ...draftChapter(),
      milestoneId: "milestone.missing",
    };
    const draft = createContentDraft(
      {
        kind: "chapter",
        title: "Orphan chapter",
        payload: chapter as unknown as Record<string, unknown>,
        authorId: "author.1",
      },
      persistence,
    );
    reviewContentDraft(
      { draftId: draft.id, action: "submit", operatorId: "author.1" },
      persistence,
    );
    reviewContentDraft(
      { draftId: draft.id, action: "approve", operatorId: "reviewer.1" },
      persistence,
    );

    expect(() =>
      reviewContentDraft(
        { draftId: draft.id, action: "publish", operatorId: "publisher.1" },
        persistence,
      ),
    ).toThrow(/CONTENT_GRAPH_INVALID/);
    expect(persistence.getPublishedContent()).toHaveLength(0);
  });

  it("allows author edits only while a draft is editable", () => {
    const persistence = createStore();
    const draft = createContentDraft(
      {
        kind: "question_template",
        title: "Question",
        payload: { prompt: "Initial" },
        authorId: "author.1",
      },
      persistence,
    );
    const updated = updateContentDraft(
      {
        draftId: draft.id,
        title: "Updated question",
        payload: { prompt: "Updated" },
        operatorId: "author.1",
      },
      persistence,
    );

    expect(updated.title).toBe("Updated question");
    reviewContentDraft(
      {
        draftId: draft.id,
        action: "submit",
        operatorId: "author.1",
      },
      persistence,
    );

    expect(() =>
      updateContentDraft(
        {
          draftId: draft.id,
          title: "Forbidden",
          operatorId: "author.1",
        },
        persistence,
      ),
    ).toThrow("DRAFT_READ_ONLY");
    expect(() =>
      reviewContentDraft(
        {
          draftId: draft.id,
          action: "publish",
          operatorId: "publisher.1",
        },
        persistence,
      ),
    ).toThrow("INVALID_REVIEW_TRANSITION");
  });

  it("only lets the author submit their own draft", () => {
    const persistence = createStore();
    const draft = createContentDraft(
      {
        kind: "question_template",
        title: "Owned question",
        payload: { prompt: "Initial" },
        authorId: "author.1",
      },
      persistence,
    );

    expect(() =>
      reviewContentDraft(
        {
          draftId: draft.id,
          action: "submit",
          operatorId: "author.2",
        },
        persistence,
      ),
    ).toThrow("DRAFT_AUTHOR_REQUIRED");
  });

  it("preserves question quality metadata when publishing", () => {
    const persistence = createStore();
    const question = {
      id: "item.metadata.test",
      nodeId: "math.fractions_decimals.fraction_meaning",
      kind: "apply",
      difficulty: "standard",
      prompt: "1/2 与下面哪个分数相等？",
      options: ["2/4", "2/3", "3/2"],
      answerIndex: 0,
      explanation: "分子和分母同时乘 2，得到 2/4。",
      timeLimitSec: 45,
      damage: 1,
      errorTags: ["fraction_equivalence"],
      sourceType: "original",
      license: "CC-BY-4.0",
      authorId: "author.1",
    };
    const draft = createContentDraft(
      {
        kind: "question_template",
        title: "Metadata question",
        payload: question,
        authorId: "author.1",
      },
      persistence,
    );
    reviewContentDraft(
      { draftId: draft.id, action: "submit", operatorId: "author.1" },
      persistence,
    );
    reviewContentDraft(
      { draftId: draft.id, action: "approve", operatorId: "reviewer.1" },
      persistence,
    );
    reviewContentDraft(
      { draftId: draft.id, action: "publish", operatorId: "publisher.1" },
      persistence,
    );

    const published = persistence.getPublishedContent()[0];
    expect(published.payload).toMatchObject({
      difficulty: "standard",
      errorTags: ["fraction_equivalence"],
      sourceType: "original",
      license: "CC-BY-4.0",
      authorId: "author.1",
    });
  });

  it("records an immutable snapshot with hashes and trusted audit on publish", () => {
    const persistence = createStore();
    const chapter = {
      ...draftChapter(),
      id: "chapter.snapshot.one",
      title: "Snapshot one",
    };
    publishDraft(persistence, {
      kind: "chapter",
      title: chapter.title,
      payload: chapter as unknown as Record<string, unknown>,
    });

    const snapshots = persistence.getContentSnapshots();
    expect(snapshots).toHaveLength(1);
    const snapshot = snapshots[0];
    expect(snapshot.status).toBe("active");
    expect(snapshot.rolloutPercent).toBe(100);
    expect(snapshot.graphHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(snapshot.curriculumHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(snapshot.itemSetHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashContentGraph(snapshot.graph as unknown as ContentGraph)).toEqual({
      graphHash: snapshot.graphHash,
      curriculumHash: snapshot.curriculumHash,
      itemSetHash: snapshot.itemSetHash,
    });

    const audit = persistence.getPublicationAudit(snapshot.id);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "published",
      operatorId: "publisher.1",
    });
  });

  it("supersedes the previous snapshot and links it for rollback", () => {
    const persistence = createStore();
    const first = {
      ...draftChapter(),
      id: "chapter.snapshot.a",
      title: "Snapshot A",
    };
    const second = {
      ...draftChapter(),
      id: "chapter.snapshot.b",
      title: "Snapshot B",
    };
    publishDraft(persistence, {
      kind: "chapter",
      title: first.title,
      payload: first as unknown as Record<string, unknown>,
    });
    publishDraft(persistence, {
      kind: "chapter",
      title: second.title,
      payload: second as unknown as Record<string, unknown>,
    });

    const snapshots = persistence.getContentSnapshots();
    expect(snapshots).toHaveLength(2);
    const [snapshotA, snapshotB] = snapshots;
    expect(snapshotA.status).toBe("superseded");
    expect(snapshotB.status).toBe("active");
    expect(snapshotB.previousSnapshotId).toBe(snapshotA.id);
  });

  it("rolls back to an older snapshot and records the operator", () => {
    const persistence = createStore();
    const first = {
      ...draftChapter(),
      id: "chapter.snapshot.rollback.a",
      title: "Rollback A",
    };
    const second = {
      ...draftChapter(),
      id: "chapter.snapshot.rollback.b",
      title: "Rollback B",
    };
    publishDraft(persistence, {
      kind: "chapter",
      title: first.title,
      payload: first as unknown as Record<string, unknown>,
    });
    publishDraft(persistence, {
      kind: "chapter",
      title: second.title,
      payload: second as unknown as Record<string, unknown>,
    });
    const [snapshotA, snapshotB] = persistence.getContentSnapshots();

    const restored = activateContentSnapshot(
      {
        snapshotId: snapshotA.id,
        operatorId: "publisher.1",
        action: "rollback",
        note: "先回滚一版",
      },
      persistence,
    );

    expect(restored?.status).toBe("active");
    expect(persistence.getContentSnapshot(snapshotB.id)?.status).toBe(
      "retired",
    );
    expect(persistence.getContentSnapshots("active")).toHaveLength(1);
    expect(
      persistence
        .getPublicationAudit(snapshotA.id)
        .map((record) => record.action),
    ).toContain("rollback");
  });

  it("retires a snapshot and records the operator", () => {
    const persistence = createStore();
    const chapter = {
      ...draftChapter(),
      id: "chapter.snapshot.retire",
      title: "Retire me",
    };
    publishDraft(persistence, {
      kind: "chapter",
      title: chapter.title,
      payload: chapter as unknown as Record<string, unknown>,
    });
    const [snapshot] = persistence.getContentSnapshots();

    const retired = retireContentSnapshot(
      {
        snapshotId: snapshot.id,
        operatorId: "publisher.1",
        note: "下线旧内容",
      },
      persistence,
    );

    expect(retired?.status).toBe("retired");
    expect(persistence.getContentSnapshots("active")).toHaveLength(0);
    expect(
      persistence
        .getPublicationAudit(snapshot.id)
        .map((record) => record.action),
    ).toContain("retired");
  });
});

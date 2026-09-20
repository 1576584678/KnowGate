import { afterEach, describe, expect, it } from "vitest";
import type { Chapter } from "@knowgate/domain";
import { chapters } from "@/content/math-grade4";
import {
  createContentDraft,
  listContentDrafts,
  reviewContentDraft,
  updateContentDraft,
} from "./content-workflow";
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
});

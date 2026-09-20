import { afterEach, describe, expect, it } from "vitest";
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

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
});

describe("content review workflow", () => {
  it("runs draft through review, approval, and publication", () => {
    const persistence = createStore();
    const draft = createContentDraft(
      {
        kind: "chapter",
        title: "New chapter",
        payload: { title: "New chapter" },
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
    expect(published.reviews.map((review) => review.action)).toEqual([
      "submitted",
      "approved",
      "published",
    ]);
    expect(listContentDrafts("published", persistence)).toHaveLength(1);
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

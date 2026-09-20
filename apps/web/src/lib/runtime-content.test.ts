import { afterEach, describe, expect, it } from "vitest";
import type { Chapter, ContentQuestion } from "@knowgate/domain";
import { chapters } from "@/content/math-grade4";
import { completeChapter } from "./chapter-store";
import { createPersistence, type PersistenceStore } from "./persistence";
import { buildRuntimeContentGraph, getRuntimeChapter } from "./runtime-content";

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

function publishChapter(
  persistence: PersistenceStore,
  chapter: Chapter,
) {
  persistence.recordPublication({
    id: `publication.${chapter.id}`,
    draftId: `draft.${chapter.id}`,
    kind: "chapter",
    entityId: chapter.id,
    contentVersion: "2026.09.20.99",
    payload: chapter as unknown as Record<string, unknown>,
    publishedAt: new Date().toISOString(),
  });
}

function chapterQuestions(chapter: Chapter): ContentQuestion[] {
  return chapter.steps
    .map((step) => step.question)
    .filter((question): question is ContentQuestion => question !== undefined);
}

describe("runtime content", () => {
  it("resolves published chapters over the static seed graph", () => {
    const persistence = createStore();
    const source = chapters[0];
    const published: Chapter = {
      ...source,
      id: "chapter.runtime.published",
      title: "Published runtime chapter",
    };
    publishChapter(persistence, published);

    const graph = buildRuntimeContentGraph(persistence);
    expect(
      graph.chapters.find((chapter) => chapter.id === published.id)?.title,
    ).toBe("Published runtime chapter");
    expect(getRuntimeChapter(published.id, persistence)?.title).toBe(
      "Published runtime chapter",
    );
    // Static seed chapters remain available alongside published overrides.
    expect(getRuntimeChapter(source.id, persistence)?.id).toBe(source.id);
  });

  it("grades chapter completion against published answer keys", () => {
    const persistence = createStore();
    const source = chapters[0];
    const questions = chapterQuestions(source);
    expect(questions.length).toBeGreaterThan(1);

    const target = questions[0];
    const flippedAnswerIndex =
      (target.answerIndex + 1) % target.options.length;
    const published: Chapter = {
      ...source,
      steps: source.steps.map((step) =>
        step.question?.id === target.id
          ? {
              ...step,
              question: { ...step.question, answerIndex: flippedAnswerIndex },
            }
          : step,
      ),
    };
    publishChapter(persistence, published);

    const graph = buildRuntimeContentGraph(persistence);
    const answersFor = (chapter: Chapter) =>
      chapterQuestions(chapter).map((question) => ({
        itemId: question.id,
        answer: String(question.answerIndex),
      }));

    const publishedResult = completeChapter(
      {
        profileId: "profile.published",
        chapterId: source.id,
        answers: answersFor(published),
        durationSec: 30,
        contentVersion: graph.contentVersion,
      },
      persistence,
    );
    expect(publishedResult.passed).toBe(true);
    expect(publishedResult.correctCount).toBe(questions.length);

    const staticResult = completeChapter(
      {
        profileId: "profile.static",
        chapterId: source.id,
        answers: answersFor(source),
        durationSec: 30,
        contentVersion: graph.contentVersion,
      },
      persistence,
    );
    expect(staticResult.correctCount).toBeLessThan(questions.length);
  });
});

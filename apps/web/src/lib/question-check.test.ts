import { afterEach, describe, expect, it } from "vitest";
import { chapters } from "@/content/math-grade4";
import { createPersistence, type PersistenceStore } from "./persistence";
import { checkQuestion } from "./question-check";

const stores: PersistenceStore[] = [];

function createStore() {
  const store = createPersistence(":memory:");
  stores.push(store);
  return store;
}

function privateQuestion() {
  const question = chapters
    .flatMap((chapter) => chapter.steps)
    .find((step) => step.question)?.question;
  if (!question) throw new Error("Test content is missing a question.");
  return question;
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
});

describe("question checking", () => {
  it("checks answers against server-side content", () => {
    const question = privateQuestion();
    const persistence = createStore();

    expect(
      checkQuestion(
        { questionId: question.id, selectedIndex: question.answerIndex },
        persistence,
      ),
    ).toEqual({
      questionId: question.id,
      correct: true,
      correctIndex: question.answerIndex,
      explanation: question.explanation,
    });

    expect(
      checkQuestion(
        {
          questionId: question.id,
          selectedIndex:
            (question.answerIndex + 1) % question.options.length,
        },
        persistence,
      ).correct,
    ).toBe(false);
  });

  it("rejects invalid indexes and unknown questions", () => {
    const question = privateQuestion();
    const persistence = createStore();

    expect(() =>
      checkQuestion(
        { questionId: question.id, selectedIndex: -1 },
        persistence,
      ),
    ).toThrow("INVALID_ANSWER");
    expect(() =>
      checkQuestion(
        {
          questionId: "question.missing",
          selectedIndex: 0,
        },
        persistence,
      ),
    ).toThrow("QUESTION_NOT_FOUND");
  });
});

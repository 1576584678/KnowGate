import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chapters } from "@/content/math-grade4";
import { completeChapter } from "./chapter-store";
import { createPersistence, type PersistenceStore } from "./persistence";

const temporaryDirectories: string[] = [];
const stores: PersistenceStore[] = [];

function createTestStore() {
  const directory = mkdtempSync(join(tmpdir(), "knowgate-chapter-"));
  const store = createPersistence(join(directory, "test.sqlite"));
  temporaryDirectories.push(directory);
  stores.push(store);
  return store;
}

function correctAnswers(chapterId: string) {
  const chapter = chapters.find((item) => item.id === chapterId);
  if (!chapter) throw new Error(`Missing chapter ${chapterId}`);

  return chapter.steps.flatMap((step) =>
    step.question
      ? [
          {
            itemId: step.question.id,
            answer: String.fromCharCode(65 + step.question.answerIndex),
          },
        ]
      : [],
  );
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("chapter completion", () => {
  it("grades answers on the server and records completion evidence", () => {
    const persistence = createTestStore();
    const result = completeChapter(
      {
        profileId: "profile.test",
        chapterId: "chapter.fraction.parts",
        answers: correctAnswers("chapter.fraction.parts"),
        durationSec: 180,
      },
      persistence,
    );

    expect(result).toMatchObject({
      chapterId: "chapter.fraction.parts",
      passed: true,
      score: 100,
      correctCount: 3,
      questionCount: 3,
      nextAction: "next_chapter",
    });
    expect(
      persistence.getChapterCompletion(
        "profile.test",
        "chapter.fraction.parts",
      ),
    ).toMatchObject({
      score: 100,
      durationSec: 180,
    });
    expect(
      persistence
        .getLearningEvents("profile.test")
        .some((event) => event.eventType === "chapter_completed"),
    ).toBe(true);
  });

  it("requires enough correct answers before completing a chapter", () => {
    const persistence = createTestStore();
    const result = completeChapter(
      {
        profileId: "profile.test",
        chapterId: "chapter.fraction.parts",
        answers: correctAnswers("chapter.fraction.parts").map((answer) => ({
          ...answer,
          answer: "B",
        })),
        durationSec: 60,
      },
      persistence,
    );

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(
      persistence.getProgress("profile.test").passedChapterIds,
    ).toEqual([]);
  });

  it("unlocks the boss only after all milestone chapters are complete", () => {
    const persistence = createTestStore();
    const milestoneChapters = chapters.map((chapter) => chapter.id);

    const results = milestoneChapters.map((chapterId) =>
      completeChapter(
        {
          profileId: "profile.test",
          chapterId,
          answers: correctAnswers(chapterId),
          durationSec: 120,
        },
        persistence,
      ),
    );

    expect(results.at(-1)?.nextAction).toBe("boss_available");
    expect(
      persistence.getProgress("profile.test").passedChapterIds,
    ).toHaveLength(milestoneChapters.length);
  });

  it("returns the original result when completion is submitted twice", () => {
    const persistence = createTestStore();
    const input = {
      profileId: "profile.test",
      chapterId: "chapter.fraction.parts",
      answers: correctAnswers("chapter.fraction.parts"),
      durationSec: 180,
    };

    const first = completeChapter(input, persistence);
    const repeated = completeChapter(
      {
        ...input,
        answers: input.answers.map((answer) => ({ ...answer, answer: "B" })),
        durationSec: 5,
      },
      persistence,
    );

    expect(repeated.completedAt).toBe(first.completedAt);
    expect(repeated.score).toBe(100);
    expect(
      persistence
        .getLearningEvents("profile.test")
        .filter((event) => event.eventType === "chapter_completed"),
    ).toHaveLength(1);
  });
});

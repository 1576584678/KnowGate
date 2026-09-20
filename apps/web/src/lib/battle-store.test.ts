import { afterEach, describe, expect, it } from "vitest";
import type { BattleOutcome } from "@knowgate/domain";
import { chapters, milestones } from "@/content/math-grade4";
import { createMilestoneBattle } from "./battle-store";
import { completeChapter } from "./chapter-store";
import { createPersistence, type PersistenceStore } from "./persistence";

const stores: PersistenceStore[] = [];

function createStore() {
  const store = createPersistence(":memory:");
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

function completeMilestoneChapters(
  persistence: PersistenceStore,
  milestoneId: string,
) {
  const milestone = milestones.find((item) => item.id === milestoneId);
  if (!milestone) throw new Error(`Missing milestone ${milestoneId}`);

  for (const chapterId of milestone.chapterIds) {
    completeChapter(
      {
        profileId: "profile.test",
        chapterId,
        answers: correctAnswers(chapterId),
        durationSec: 60,
      },
      persistence,
    );
  }
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
});

describe("milestone battle ordering", () => {
  it("requires the previous milestone boss before starting the next one", () => {
    const persistence = createStore();
    const secondMilestone = milestones[1];
    completeMilestoneChapters(persistence, secondMilestone.id);

    expect(() =>
      createMilestoneBattle(
        {
          profileId: "profile.test",
          milestoneId: secondMilestone.id,
          mode: "learning",
        },
        persistence,
      ),
    ).toThrow("PREVIOUS_MILESTONE_LOCKED");

    const previousWin: BattleOutcome = {
      milestoneId: milestones[0].id,
      status: "won",
      accuracy: 100,
      maxCombo: 8,
      mistakes: [],
      completedAt: new Date().toISOString(),
    };
    persistence.saveBattleOutcome("profile.test", previousWin);

    const session = createMilestoneBattle(
      {
        profileId: "profile.test",
        milestoneId: secondMilestone.id,
        mode: "learning",
      },
      persistence,
    );
    expect(session.milestoneId).toBe(secondMilestone.id);
    expect(session.status).toBe("active");
  });

  it("keeps the first milestone available without a prior boss", () => {
    const persistence = createStore();
    const firstMilestone = milestones[0];
    completeMilestoneChapters(persistence, firstMilestone.id);

    const session = createMilestoneBattle(
      {
        profileId: "profile.test",
        milestoneId: firstMilestone.id,
        mode: "learning",
      },
      persistence,
    );

    expect(session.milestoneId).toBe(firstMilestone.id);
  });
});

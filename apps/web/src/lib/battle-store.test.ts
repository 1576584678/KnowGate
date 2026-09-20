import { afterEach, describe, expect, it } from "vitest";
import type { BattleOutcome } from "@knowgate/domain";
import { bosses, chapters, milestones } from "@/content/math-grade4";
import { createMilestoneBattle } from "./battle-store";
import { completeChapter } from "./chapter-store";
import { createContentDraft, reviewContentDraft } from "./content-workflow";
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

function publish(
  persistence: PersistenceStore,
  input: {
    kind: "chapter" | "boss";
    title: string;
    payload: Record<string, unknown>;
  },
) {
  const draft = createContentDraft(
    { ...input, authorId: "author.1" },
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

  it("locks an in-progress battle to the snapshot it started on", () => {
    const persistence = createStore();
    const firstMilestone = milestones[0];
    const sourceChapter = chapters.find(
      (chapter) => chapter.id === firstMilestone.chapterIds[0],
    );
    if (!sourceChapter) throw new Error("Missing first chapter");
    publish(persistence, {
      kind: "chapter",
      title: "Snapshot A chapter",
      payload: {
        ...sourceChapter,
        title: "Snapshot A chapter",
      },
    });
    const snapshotA = persistence.getContentSnapshots("active").at(-1);
    expect(snapshotA).toBeDefined();

    completeMilestoneChapters(persistence, firstMilestone.id);
    const sessionA = createMilestoneBattle(
      {
        profileId: "profile.test",
        milestoneId: firstMilestone.id,
        mode: "learning",
      },
      persistence,
    );
    expect(sessionA.contentSnapshotId).toBe(snapshotA?.id);

    const sourceBoss = bosses.find(
      (boss) => boss.id === firstMilestone.bossId,
    );
    if (!sourceBoss) throw new Error("Missing first boss");
    const reversedBoss = {
      ...sourceBoss,
      questionIds: [...sourceBoss.questionIds].reverse(),
    };
    publish(persistence, {
      kind: "boss",
      title: "Snapshot B boss",
      payload: reversedBoss,
    });
    const snapshotB = persistence.getContentSnapshots("active").at(-1);
    expect(snapshotB?.id).toBeDefined();
    expect(snapshotB?.id).not.toBe(snapshotA?.id);

    const sessionB = createMilestoneBattle(
      {
        profileId: "profile.test",
        milestoneId: firstMilestone.id,
        mode: "learning",
      },
      persistence,
    );
    expect(sessionB.contentSnapshotId).toBe(snapshotB?.id);
    expect(sessionB.questions.map((question) => question.id)).toEqual(
      reversedBoss.questionIds,
    );

    // The older session keeps the question set it was created with.
    expect(
      persistence
        .getBattleSession("profile.test", sessionA.id)
        ?.questions.map((question) => question.id),
    ).toEqual(sourceBoss.questionIds);
  });
});

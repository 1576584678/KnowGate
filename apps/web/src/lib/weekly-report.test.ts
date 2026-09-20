import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPersistence, type PersistenceStore } from "./persistence";
import { getWeeklyStudentReport } from "./weekly-report";

const temporaryDirectories: string[] = [];
const stores: PersistenceStore[] = [];

function createTestStore() {
  const directory = mkdtempSync(join(tmpdir(), "knowgate-weekly-"));
  const store = createPersistence(join(directory, "test.sqlite"));
  temporaryDirectories.push(directory);
  stores.push(store);
  return store;
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("weekly student report", () => {
  it("summarizes the selected week without public ranking data", () => {
    const persistence = createTestStore();
    persistence.completeChapter(
      "profile.test",
      "chapter.fraction.parts",
      "2026-09-15T01:00:00.000Z",
      100,
      300,
    );
    persistence.completeChapter(
      "profile.test",
      "chapter.fraction.units",
      "2026-09-08T01:00:00.000Z",
      90,
      180,
    );
    persistence.recordEvent({
      id: "event.chapter",
      profileId: "profile.test",
      eventType: "chapter_completed",
      entityType: "chapter",
      entityId: "chapter.fraction.parts",
      payload: { durationSec: 300, score: 100 },
      occurredAt: "2026-09-15T01:00:00.000Z",
      contentVersion: "test.1",
    });
    persistence.recordEvent({
      id: "event.boss",
      profileId: "profile.test",
      eventType: "boss_won",
      entityType: "battle",
      entityId: "battle.test",
      payload: {
        milestoneId: "math.g4.milestone.01",
        accuracy: 92,
        maxCombo: 5,
      },
      occurredAt: "2026-09-15T02:00:00.000Z",
      contentVersion: "test.1",
    });
    persistence.saveBattleOutcome("profile.test", {
      milestoneId: "math.g4.milestone.01",
      status: "won",
      accuracy: 92,
      maxCombo: 5,
      mistakes: [],
      completedAt: "2026-09-15T02:00:00.000Z",
    });

    const report = getWeeklyStudentReport(
      "profile.test",
      {
        weekStart: "2026-09-14",
        now: new Date("2026-09-20T04:00:00.000Z"),
      },
      persistence,
    );

    expect(report.period).toEqual({
      weekStart: "2026-09-14",
      weekEnd: "2026-09-20",
      timezone: "Asia/Shanghai",
      label: "2026年9月14日 - 2026年9月20日",
    });
    expect(report.completedChapters.map((chapter) => chapter.id)).toEqual([
      "chapter.fraction.parts",
    ]);
    expect(report.summary).toMatchObject({
      learningDurationSec: 300,
      completedChapterCount: 1,
      bossAttemptCount: 1,
      bossWinCount: 1,
    });
    expect(report.bossResults[0]).toMatchObject({
      milestoneName: "分数裂谷",
      status: "won",
      accuracy: 92,
      maxCombo: 5,
    });
    expect(report.suggestedReviews.length).toBeGreaterThan(0);
    expect(
      report.suggestedReviews.flatMap((review) =>
        review.chapters.map((chapter) => chapter.id),
      ),
    ).not.toContain("chapter.fraction.parts");
    expect(report).not.toHaveProperty("ranking");
  });

  it("rejects an invalid week start", () => {
    const persistence = createTestStore();

    expect(() =>
      getWeeklyStudentReport(
        "profile.test",
        { weekStart: "2026-02-30" },
        persistence,
      ),
    ).toThrow("INVALID_WEEK_START");
  });
});

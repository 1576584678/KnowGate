import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { chapters } from "@/content/math-grade4";
import { getNodeMasteryReport, getRemediationPlan } from "./learning-report";
import { createPersistence, type PersistenceStore } from "./persistence";

const temporaryDirectories: string[] = [];
const stores: PersistenceStore[] = [];

function createTestStore() {
  const directory = mkdtempSync(join(tmpdir(), "knowgate-report-"));
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

describe("learning reports", () => {
  it("combines chapter and boss evidence into node mastery", () => {
    const persistence = createTestStore();
    for (const chapter of chapters) {
      persistence.completeChapter(
        "profile.test",
        chapter.id,
        "2026-09-20T01:00:00.000Z",
        100,
        120,
      );
    }
    persistence.saveBattleOutcome("profile.test", {
      milestoneId: "math.g4.milestone.01",
      status: "won",
      accuracy: 100,
      maxCombo: 4,
      mistakes: [],
      completedAt: "2026-09-20T02:00:00.000Z",
    });

    const report = getNodeMasteryReport("profile.test", persistence).find(
      (node) => node.nodeId === "math.fractions_decimals.fraction_meaning",
    );

    expect(report).toMatchObject({
      mastery: 90,
      status: "mastered",
      completedChapters: 3,
      totalChapters: 3,
      nextReviewAt: "2026-09-27T02:00:00.000Z",
    });
  });

  it("returns prerequisites before the target node in a remediation plan", () => {
    const persistence = createTestStore();
    const plan = getRemediationPlan(
      "profile.test",
      "math.fractions_decimals.fraction_meaning",
      persistence,
    );

    expect(plan.prerequisitePath.map((node) => node.nodeId)).toEqual([
      "math.arithmetic.multiplication_table",
      "math.arithmetic.division_inverse",
      "math.fractions_decimals.fraction_meaning",
    ]);
    expect(plan.chapters).toHaveLength(3);
    expect(plan.exercises).toHaveLength(3);
    expect(
      plan.exercises.every(
        (exercise) => !Object.hasOwn(exercise, "answerIndex"),
      ),
    ).toBe(true);
  });
});

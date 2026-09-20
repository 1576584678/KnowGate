import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createBattleSession,
  type BattleOutcome,
  type Boss,
} from "@knowgate/domain";
import { createPersistence, type PersistenceStore } from "./persistence";

const boss: Boss = {
  id: "boss.test",
  milestoneId: "milestone.test",
  name: "测试守卫",
  epithet: "测试",
  hp: 1,
  initialDistance: 2,
  questionIds: ["q1"],
};

const temporaryDirectories: string[] = [];
const stores: PersistenceStore[] = [];

function createTestStore() {
  const directory = mkdtempSync(join(tmpdir(), "knowgate-"));
  const store = createPersistence(join(directory, "test.sqlite"));
  temporaryDirectories.push(directory);
  stores.push(store);
  return { directory, store };
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("persistence", () => {
  it("persists a battle session across store instances", () => {
    const { directory, store } = createTestStore();
    const session = createBattleSession({
      id: "battle.test",
      milestoneId: "milestone.test",
      contentVersion: "test.1",
      boss,
      mode: "standard",
      questions: [
        {
          id: "q1",
          nodeId: "node.test",
          kind: "identify",
          prompt: "1 + 1 = ?",
          options: ["1", "2"],
          answerIndex: 1,
          explanation: "1 加 1 等于 2。",
          damage: 1,
          timeLimitSec: 30,
        },
      ],
    });

    store.saveBattleSession("profile.test", session);
    store.close();
    stores.splice(stores.indexOf(store), 1);

    const reopened = createPersistence(join(directory, "test.sqlite"));
    stores.push(reopened);
    const restored = reopened.getBattleSession("profile.test", "battle.test");

    expect(restored?.contentVersion).toBe("test.1");
    expect(restored?.boss.hp).toBe(1);
  });

  it("persists chapter progress and battle outcomes", () => {
    const { store } = createTestStore();
    const outcome: BattleOutcome = {
      milestoneId: "milestone.test",
      status: "won",
      accuracy: 100,
      maxCombo: 3,
      mistakes: [],
      completedAt: "2026-09-20T01:00:00.000Z",
    };

    store.completeChapter("profile.test", "chapter.1");
    store.saveBattleOutcome("profile.test", outcome);

    const progress = store.getProgress("profile.test");

    expect(progress.passedChapterIds).toEqual(["chapter.1"]);
    expect(progress.battleOutcomes["milestone.test"]).toEqual(outcome);
  });

  it("resets only the selected profile", () => {
    const { store } = createTestStore();
    store.completeChapter("profile.a", "chapter.1");
    store.completeChapter("profile.b", "chapter.2");

    store.resetProgress("profile.a");

    expect(store.getProgress("profile.a").passedChapterIds).toEqual([]);
    expect(store.getProgress("profile.b").passedChapterIds).toEqual([
      "chapter.2",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  createBattleSession,
  resolveBattleAnswer,
  type BattleQuestion,
  type Boss,
} from "./index";

const boss: Boss = {
  id: "boss.test",
  milestoneId: "milestone.test",
  name: "测试守卫",
  epithet: "测试",
  hp: 3,
  initialDistance: 2,
  questionIds: ["q1", "q2", "q3"],
};

const questions: BattleQuestion[] = [
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
  {
    id: "q2",
    nodeId: "node.test",
    kind: "judge",
    prompt: "2 + 2 = 4?",
    options: ["对", "错"],
    answerIndex: 0,
    explanation: "2 加 2 等于 4。",
    damage: 1,
    timeLimitSec: 30,
  },
  {
    id: "q3",
    nodeId: "node.test",
    kind: "apply",
    prompt: "3 + 3 = ?",
    options: ["5", "6"],
    answerIndex: 1,
    explanation: "3 加 3 等于 6。",
    damage: 2,
    timeLimitSec: 30,
  },
];

describe("battle engine", () => {
  it("damages the boss and advances through questions", () => {
    const session = createBattleSession({
      id: "battle.test",
      milestoneId: "milestone.test",
      boss,
      mode: "standard",
      questions,
    });

    const result = resolveBattleAnswer({
      session,
      questionId: "q1",
      selectedIndex: 1,
    });

    expect(result.correct).toBe(true);
    expect(result.state.boss.hp).toBe(2);
    expect(result.state.currentQuestion?.id).toBe("q2");
  });

  it("moves the boss forward on a wrong answer", () => {
    const session = createBattleSession({
      id: "battle.test",
      milestoneId: "milestone.test",
      boss,
      mode: "standard",
      questions,
    });

    const result = resolveBattleAnswer({
      session,
      questionId: "q1",
      selectedIndex: 0,
    });

    expect(result.correct).toBe(false);
    expect(result.state.boss.distance).toBe(1);
    expect(result.state.mistakes).toHaveLength(1);
  });

  it("wins as soon as boss hp reaches zero", () => {
    const session = createBattleSession({
      id: "battle.test",
      milestoneId: "milestone.test",
      boss: { ...boss, hp: 2 },
      mode: "standard",
      questions,
    });

    resolveBattleAnswer({
      session,
      questionId: "q1",
      selectedIndex: 1,
    });
    const result = resolveBattleAnswer({
      session,
      questionId: "q2",
      selectedIndex: 0,
    });

    expect(result.state.status).toBe("won");
    expect(result.state.currentQuestion).toBeNull();
  });

  it("keeps boss distance in learning mode when time expires", () => {
    const session = createBattleSession({
      id: "battle.test",
      milestoneId: "milestone.test",
      boss,
      mode: "learning",
      questions,
    });

    const result = resolveBattleAnswer({
      session,
      questionId: "q1",
      selectedIndex: -1,
      submittedAt: new Date(Date.now() + 60_000),
    });

    expect(result.timedOut).toBe(true);
    expect(result.state.boss.distance).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  abandonBattleSession,
  calculateMastery,
  calculateMasteryBreakdown,
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

  it("returns the original resolution for a repeated answer", () => {
    const session = createBattleSession({
      id: "battle.test",
      milestoneId: "milestone.test",
      boss,
      mode: "standard",
      questions,
    });

    resolveBattleAnswer({
      session,
      questionId: "q1",
      selectedIndex: 1,
    });

    const repeated = resolveBattleAnswer({
      session,
      questionId: "q1",
      selectedIndex: 0,
    });

    expect(repeated.accepted).toBe(false);
    expect(repeated.correct).toBe(true);
    expect(repeated.state.answeredCount).toBe(1);
    expect(repeated.state.boss.hp).toBe(2);
  });

  it("uses the decisive question to finish a battle that is still active", () => {
    const decisiveQuestion: BattleQuestion = {
      id: "q.decisive",
      nodeId: "node.test",
      kind: "decisive",
      prompt: "最终问题",
      options: ["错误", "正确"],
      answerIndex: 1,
      explanation: "最终作答正确。",
      damage: 3,
      timeLimitSec: 300,
    };
    const session = createBattleSession({
      id: "battle.decisive",
      milestoneId: "milestone.test",
      boss: { ...boss, hp: 9 },
      mode: "standard",
      questions: [decisiveQuestion],
    });

    const result = resolveBattleAnswer({
      session,
      questionId: decisiveQuestion.id,
      selectedIndex: 1,
    });

    expect(result.state.status).toBe("won");
    expect(result.state.boss.hp).toBe(0);
    expect(result.state.currentQuestion).toBeNull();
  });

  it("abandons an active battle without recording a fake answer", () => {
    const session = createBattleSession({
      id: "battle.abandon",
      milestoneId: "milestone.test",
      boss,
      mode: "standard",
      questions,
    });

    const state = abandonBattleSession(session);

    expect(state.status).toBe("abandoned");
    expect(state.answeredCount).toBe(0);
    expect(state.currentQuestion).toBeNull();
  });
});

describe("mastery model", () => {
  it("returns zero evidence as learning", () => {
    const breakdown = calculateMasteryBreakdown({
      completedChapters: 0,
      totalChapters: 3,
    });

    expect(breakdown.score).toBe(0);
    expect(breakdown.status).toBe("learning");
    expect(breakdown.chapterScore).toBe(0);
    expect(breakdown.practiceScore).toBe(0);
    expect(breakdown.bossScore).toBe(0);
  });

  it("combines chapter, practice, boss, and delayed review evidence", () => {
    const breakdown = calculateMasteryBreakdown({
      completedChapters: 3,
      totalChapters: 3,
      bossOutcome: {
        milestoneId: "milestone.test",
        status: "won",
        accuracy: 90,
        maxCombo: 4,
        mistakes: [],
        completedAt: "2026-09-20T01:00:00.000Z",
      },
      delayedReviewScore: 7,
    });

    expect(breakdown).toMatchObject({
      score: 97,
      status: "mastered",
      chapterScore: 20,
      practiceScore: 30,
      bossScore: 40,
      delayedReviewScore: 7,
    });
    expect(calculateMastery({
      completedChapters: 3,
      totalChapters: 3,
      bossOutcome: {
        milestoneId: "milestone.test",
        status: "won",
        accuracy: 90,
        maxCombo: 4,
        mistakes: [],
        completedAt: "2026-09-20T01:00:00.000Z",
      },
      delayedReviewScore: 7,
    })).toBe(97);
  });

  it("clamps incomplete and invalid evidence to the scoring ranges", () => {
    const breakdown = calculateMasteryBreakdown({
      completedChapters: 99,
      totalChapters: 3,
      bossOutcome: {
        milestoneId: "milestone.test",
        status: "lost",
        accuracy: 75,
        maxCombo: 2,
        mistakes: [],
        completedAt: "2026-09-20T01:00:00.000Z",
      },
      delayedReviewScore: 50,
    });

    expect(breakdown).toMatchObject({
      score: 90,
      status: "mastered",
      chapterScore: 20,
      practiceScore: 30,
      bossScore: 30,
      delayedReviewScore: 10,
    });
  });
});

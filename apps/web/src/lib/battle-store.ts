import {
  createBattleSession,
  resolveBattleAnswer,
  type BattleMode,
  type BattleSession,
} from "@knowgate/domain";
import {
  bossQuestions,
  getBoss,
  getMilestone,
} from "@/content/math-grade4";

const globalForBattles = globalThis as typeof globalThis & {
  knowGateBattleStore?: Map<string, BattleSession>;
};

const battles =
  globalForBattles.knowGateBattleStore ??
  (globalForBattles.knowGateBattleStore = new Map<string, BattleSession>());

export function createMilestoneBattle(input: {
  milestoneId: string;
  mode: BattleMode;
}) {
  const milestone = getMilestone(input.milestoneId);
  if (!milestone) {
    throw new Error("MILESTONE_NOT_FOUND");
  }

  if (milestone.chapterIds.length === 0) {
    throw new Error("MILESTONE_NOT_AVAILABLE");
  }

  const boss = getBoss(milestone.bossId);
  if (!boss) {
    throw new Error("BOSS_NOT_FOUND");
  }

  const questions = boss.questionIds
    .map((questionId) =>
      bossQuestions.find((question) => question.id === questionId),
    )
    .filter((question) => question !== undefined);

  const session = createBattleSession({
    id: crypto.randomUUID(),
    milestoneId: milestone.id,
    boss,
    mode: input.mode,
    questions,
  });

  battles.set(session.id, session);
  return session;
}

export function getBattle(battleId: string) {
  return battles.get(battleId);
}

export function answerBattle(input: {
  battleId: string;
  questionId: string;
  selectedIndex: number;
}) {
  const session = getBattle(input.battleId);
  if (!session) {
    throw new Error("BATTLE_NOT_FOUND");
  }

  return resolveBattleAnswer({
    session,
    questionId: input.questionId,
    selectedIndex: input.selectedIndex,
  });
}

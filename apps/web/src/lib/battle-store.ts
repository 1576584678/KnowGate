import {
  abandonBattleSession,
  battleAccuracy,
  createBattleSession,
  resolveBattleAnswer,
  type BattleMode,
} from "@knowgate/domain";
import {
  bossQuestions,
  chapters,
  getBoss,
  getMilestone,
  gradeWorld,
} from "@/content/math-grade4";
import { getPersistence } from "@/lib/persistence";

export function createMilestoneBattle(input: {
  profileId: string;
  milestoneId: string;
  mode: BattleMode;
  extendedTime?: boolean;
}) {
  const milestone = getMilestone(input.milestoneId);
  if (!milestone) {
    throw new Error("MILESTONE_NOT_FOUND");
  }

  if (milestone.chapterIds.length === 0) {
    throw new Error("MILESTONE_NOT_AVAILABLE");
  }

  const milestoneChapters = chapters.filter((chapter) =>
    milestone.chapterIds.includes(chapter.id),
  );
  const progress = getPersistence().getProgress(input.profileId);
  const ready =
    milestoneChapters.length > 0 &&
    milestoneChapters.every((chapter) =>
      progress.passedChapterIds.includes(chapter.id),
    );

  if (!ready) {
    throw new Error("MILESTONE_LOCKED");
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
  const battleQuestions = input.extendedTime
    ? questions.map((question) => ({
        ...question,
        timeLimitSec: Math.ceil(question.timeLimitSec * 1.5),
      }))
    : questions;

  const session = createBattleSession({
    id: crypto.randomUUID(),
    milestoneId: milestone.id,
    contentVersion: gradeWorld.contentVersion,
    boss,
    mode: input.mode,
    questions: battleQuestions,
  });

  getPersistence().saveBattleSession(input.profileId, session);
  return session;
}

export function getBattle(profileId: string, battleId: string) {
  return getPersistence().getBattleSession(profileId, battleId);
}

export function answerBattle(input: {
  profileId: string;
  battleId: string;
  questionId: string;
  selectedIndex: number;
}) {
  const session = getBattle(input.profileId, input.battleId);
  if (!session) {
    throw new Error("BATTLE_NOT_FOUND");
  }

  const result = resolveBattleAnswer({
    session,
    questionId: input.questionId,
    selectedIndex: input.selectedIndex,
  });

  const persistence = getPersistence();
  persistence.saveBattleSession(input.profileId, session);

  if (session.status === "won" || session.status === "lost") {
    persistence.saveBattleOutcome(input.profileId, {
      milestoneId: session.milestoneId,
      status: session.status,
      accuracy: battleAccuracy(session),
      maxCombo: session.maxCombo,
      mistakes: session.mistakes,
      completedAt: new Date().toISOString(),
    });
  }

  return result;
}

export function abandonBattle(profileId: string, battleId: string) {
  const session = getBattle(profileId, battleId);
  if (!session) {
    throw new Error("BATTLE_NOT_FOUND");
  }

  const state = abandonBattleSession(session);
  getPersistence().saveBattleSession(profileId, session);
  return state;
}

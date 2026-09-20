import {
  abandonBattleSession,
  battleAccuracy,
  createBattleSession,
  resolveBattleAnswer,
  type BattleMode,
} from "@knowgate/domain";
import { recordLearningEvent } from "@/lib/chapter-store";
import {
  getPersistence,
  type PersistenceStore,
} from "@/lib/persistence";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

export function createMilestoneBattle(
  input: {
    profileId: string;
    milestoneId: string;
    mode: BattleMode;
    extendedTime?: boolean;
  },
  persistence: PersistenceStore = getPersistence(),
) {
  const graph = buildRuntimeContentGraph(persistence);
  const milestone = graph.milestones.find(
    (item) => item.id === input.milestoneId,
  );
  if (!milestone) {
    throw new Error("MILESTONE_NOT_FOUND");
  }

  if (milestone.chapterIds.length === 0) {
    throw new Error("MILESTONE_NOT_AVAILABLE");
  }

  const milestoneChapters = graph.chapters.filter((chapter) =>
    milestone.chapterIds.includes(chapter.id),
  );
  const progress = persistence.getProgress(input.profileId);
  const ready =
    milestoneChapters.length > 0 &&
    milestoneChapters.every((chapter) =>
      progress.passedChapterIds.includes(chapter.id),
    );

  if (!ready) {
    throw new Error("MILESTONE_LOCKED");
  }

  const previousMilestone = [...graph.milestones]
    .sort((left, right) => left.stageNo - right.stageNo)
    .filter((item) => item.stageNo < milestone.stageNo)
    .at(-1);
  if (
    previousMilestone &&
    progress.battleOutcomes[previousMilestone.id]?.status !== "won"
  ) {
    throw new Error("PREVIOUS_MILESTONE_LOCKED");
  }

  const boss = graph.bosses.find((item) => item.id === milestone.bossId);
  if (!boss) {
    throw new Error("BOSS_NOT_FOUND");
  }

  const questions = boss.questionIds
    .map((questionId) =>
      graph.questions.find((question) => question.id === questionId),
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
    contentVersion: graph.contentVersion,
    boss,
    mode: input.mode,
    questions: battleQuestions,
  });

  persistence.saveBattleSession(input.profileId, session);
  recordLearningEvent(
    {
      profileId: input.profileId,
      eventType: "boss_started",
      entityType: "battle",
      entityId: session.id,
      payload: {
        milestoneId: session.milestoneId,
        mode: session.mode,
        questionCount: session.questions.length,
      },
    },
    persistence,
  );
  recordLearningEvent(
    {
      profileId: input.profileId,
      eventType: "boss_question_served",
      entityType: "battle",
      entityId: session.id,
      payload: {
        questionId: session.questions[session.questionIndex]?.id,
        sequence: session.questionIndex + 1,
      },
    },
    persistence,
  );
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

  const wasActive = session.status === "active";
  const result = resolveBattleAnswer({
    session,
    questionId: input.questionId,
    selectedIndex: input.selectedIndex,
  });

  const persistence = getPersistence();
  persistence.saveBattleSession(input.profileId, session);

  if (result.accepted) {
    recordLearningEvent(
      {
        profileId: input.profileId,
        eventType: "boss_answer_submitted",
        entityType: "battle",
        entityId: session.id,
        payload: {
          questionId: input.questionId,
          selectedIndex: input.selectedIndex,
        },
      },
      persistence,
    );
    recordLearningEvent(
      {
        profileId: input.profileId,
        eventType: "boss_answer_resolved",
        entityType: "battle",
        entityId: session.id,
        payload: {
          questionId: input.questionId,
          correct: result.correct,
          timedOut: result.timedOut,
          damage: result.damage,
          bossAdvance: result.bossAdvance,
        },
      },
      persistence,
    );
  }

  if (session.status === "won" || session.status === "lost") {
    persistence.saveBattleOutcome(input.profileId, {
      milestoneId: session.milestoneId,
      status: session.status,
      accuracy: battleAccuracy(session),
      maxCombo: session.maxCombo,
      mistakes: session.mistakes,
      completedAt: new Date().toISOString(),
    });
    if (wasActive) {
      recordLearningEvent(
        {
          profileId: input.profileId,
          eventType: session.status === "won" ? "boss_won" : "boss_lost",
          entityType: "battle",
          entityId: session.id,
          payload: {
            milestoneId: session.milestoneId,
            accuracy: battleAccuracy(session),
            maxCombo: session.maxCombo,
          },
        },
        persistence,
      );
    }
  } else if (result.accepted && result.state.currentQuestion) {
    recordLearningEvent(
      {
        profileId: input.profileId,
        eventType: "boss_question_served",
        entityType: "battle",
        entityId: session.id,
        payload: {
          questionId: result.state.currentQuestion.id,
          sequence: session.questionIndex + 1,
        },
      },
      persistence,
    );
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

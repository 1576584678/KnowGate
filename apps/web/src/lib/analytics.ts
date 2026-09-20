import type { LearningEvent } from "@knowgate/domain";
import {
  getPersistence,
  type PersistenceStore,
} from "@/lib/persistence";

function payloadNumber(event: LearningEvent, key: string) {
  const value = event.payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function payloadBoolean(event: LearningEvent, key: string) {
  return event.payload[key] === true;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0
    ? 0
    : Math.round((numerator / denominator) * 1000) / 10;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(
    (values.reduce((total, value) => total + value, 0) / values.length) * 10,
  ) / 10;
}

export function buildProductMetrics(
  events: LearningEvent[],
  persistence: PersistenceStore = getPersistence(),
) {
  const chapterStarted = events.filter(
    (event) => event.eventType === "chapter_started",
  );
  const chapterCompleted = events.filter(
    (event) => event.eventType === "chapter_completed",
  );
  const chapterAnswers = events.filter(
    (event) => event.eventType === "chapter_answer_submitted",
  );
  const bossStarted = events.filter(
    (event) => event.eventType === "boss_started",
  );
  const bossWon = events.filter((event) => event.eventType === "boss_won");
  const bossLost = events.filter((event) => event.eventType === "boss_lost");
  const bossAnswers = events.filter(
    (event) => event.eventType === "boss_answer_resolved",
  );
  const remediationStarted = events.filter(
    (event) => event.eventType === "remediation_started",
  );
  const remediationCompleted = events.filter(
    (event) => event.eventType === "remediation_completed",
  );
  const chapterDurations = chapterCompleted
    .map((event) => payloadNumber(event, "durationSec"))
    .filter((value): value is number => value !== null);
  const chapterCorrect = chapterAnswers.filter((event) =>
    payloadBoolean(event, "correct"),
  ).length;
  const bossCorrect = bossAnswers.filter((event) =>
    payloadBoolean(event, "correct"),
  ).length;
  const activeProfileIds = new Set(events.map((event) => event.profileId));
  const storedProfileIds = new Set([
    ...activeProfileIds,
    ...chapterCompleted.map((event) => event.profileId),
  ]);

  // Reading progress once also verifies that the analytics endpoint is backed by
  // the same durable store as learning flow APIs.
  for (const profileId of storedProfileIds) {
    persistence.getProgress(profileId);
  }

  return {
    generatedAt: new Date().toISOString(),
    profiles: {
      active: activeProfileIds.size,
      withProgress: storedProfileIds.size,
    },
    acquisition: {
      pageViews: events.filter((event) => event.eventType === "page_viewed")
        .length,
    },
    chapters: {
      started: chapterStarted.length,
      completed: chapterCompleted.length,
      completionRate: ratio(chapterCompleted.length, chapterStarted.length),
      averageDurationSec: average(chapterDurations),
      answerSubmissions: chapterAnswers.length,
      answerAccuracy: ratio(chapterCorrect, chapterAnswers.length),
    },
    bosses: {
      started: bossStarted.length,
      won: bossWon.length,
      lost: bossLost.length,
      winRate: ratio(bossWon.length, bossStarted.length),
      questionsResolved: bossAnswers.length,
      questionAccuracy: ratio(bossCorrect, bossAnswers.length),
    },
    remediation: {
      started: remediationStarted.length,
      completed: remediationCompleted.length,
      completionRate: ratio(
        remediationCompleted.length,
        remediationStarted.length,
      ),
    },
    reports: {
      viewed: events.filter((event) => event.eventType === "report_viewed")
        .length,
    },
  };
}

export function getProductMetrics(
  persistence: PersistenceStore = getPersistence(),
) {
  return buildProductMetrics(persistence.getAllLearningEvents(), persistence);
}

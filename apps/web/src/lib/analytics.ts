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

function orderEvents(events: LearningEvent[]) {
  return [...events].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.id.localeCompare(right.id),
  );
}

function isPassingChapterCompletion(event: LearningEvent) {
  return (
    event.eventType === "chapter_completed" &&
    event.payload.passed === true
  );
}

function countProfilesWithProgress(
  profileIds: Set<string>,
  persistence: PersistenceStore,
) {
  let count = 0;

  for (const profileId of profileIds) {
    const progress = persistence.getProgress(profileId);
    if (
      progress.passedChapterIds.length > 0 ||
      Object.keys(progress.battleOutcomes).length > 0
    ) {
      count += 1;
    }
  }

  return count;
}

export function buildProductMetrics(
  events: LearningEvent[],
  persistence: PersistenceStore = getPersistence(),
) {
  const orderedEvents = orderEvents(events);
  const chapterStarted = orderedEvents.filter(
    (event) => event.eventType === "chapter_started",
  );
  const chapterCompletedByChapter = new Map<string, LearningEvent>();
  for (const event of orderedEvents) {
    if (!isPassingChapterCompletion(event)) continue;
    const key = `${event.profileId}:${event.entityId}`;
    if (!chapterCompletedByChapter.has(key)) {
      chapterCompletedByChapter.set(key, event);
    }
  }
  const chapterCompleted = [...chapterCompletedByChapter.values()];
  const chapterAnswers = orderedEvents.filter(
    (event) => event.eventType === "chapter_answer_submitted",
  );
  const bossStarted = orderedEvents.filter(
    (event) => event.eventType === "boss_started",
  );
  const bossWon = orderedEvents.filter(
    (event) => event.eventType === "boss_won",
  );
  const bossLost = orderedEvents.filter(
    (event) => event.eventType === "boss_lost",
  );
  const bossAnswers = orderedEvents.filter(
    (event) => event.eventType === "boss_answer_resolved",
  );
  const remediationStarted = orderedEvents.filter(
    (event) => event.eventType === "remediation_started",
  );
  const remediationCompleted = orderedEvents.filter(
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
  const activeProfileIds = new Set(orderedEvents.map((event) => event.profileId));

  return {
    generatedAt: new Date().toISOString(),
    profiles: {
      active: activeProfileIds.size,
      withProgress: countProfilesWithProgress(activeProfileIds, persistence),
    },
    acquisition: {
      pageViews: orderedEvents.filter(
        (event) => event.eventType === "page_viewed",
      ).length,
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
      viewed: orderedEvents.filter(
        (event) => event.eventType === "report_viewed",
      ).length,
    },
  };
}

export function getProductMetrics(
  persistence: PersistenceStore = getPersistence(),
) {
  return buildProductMetrics(persistence.getAllLearningEvents(), persistence);
}

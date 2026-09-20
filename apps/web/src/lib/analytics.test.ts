import { afterEach, describe, expect, it } from "vitest";
import type { LearningEvent, LearningEventType } from "@knowgate/domain";
import { buildProductMetrics } from "./analytics";
import { createPersistence, type PersistenceStore } from "./persistence";

const stores: PersistenceStore[] = [];

function event({
  eventType,
  payload = {},
  index = 0,
  profileId = "profile.1",
  entityId = "entity.1",
}: {
  eventType: LearningEventType;
  payload?: Record<string, unknown>;
  index?: number;
  profileId?: string;
  entityId?: string;
}): LearningEvent {
  return {
    id: `event.${profileId}.${eventType}.${index}`,
    profileId,
    eventType,
    entityType: "test",
    entityId,
    payload,
    occurredAt: `2026-09-20T01:00:${String(index).padStart(2, "0")}.000Z`,
  };
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
});

describe("product analytics", () => {
  it("aggregates funnel, accuracy, duration, and report metrics", () => {
    const persistence = createPersistence(":memory:");
    stores.push(persistence);
    persistence.completeChapter("profile.1", "chapter.1");
    const events = [
      event({ eventType: "page_viewed", payload: { path: "/" }, index: 0 }),
      event({ eventType: "chapter_started", index: 1 }),
      event({
        eventType: "chapter_answer_submitted",
        payload: { correct: true },
        index: 2,
      }),
      event({
        eventType: "chapter_answer_submitted",
        payload: { correct: false },
        index: 3,
      }),
      event({
        eventType: "chapter_completed",
        payload: { passed: true, durationSec: 90 },
        index: 4,
      }),
      event({ eventType: "boss_started", index: 5 }),
      event({
        eventType: "boss_answer_resolved",
        payload: { correct: true },
        index: 6,
      }),
      event({
        eventType: "boss_answer_resolved",
        payload: { correct: true },
        index: 7,
      }),
      event({ eventType: "boss_won", index: 8 }),
      event({ eventType: "remediation_started", index: 9 }),
      event({ eventType: "remediation_completed", index: 10 }),
      event({ eventType: "report_viewed", index: 11 }),
    ];

    const metrics = buildProductMetrics(events, persistence);

    expect(metrics.profiles).toEqual({ active: 1, withProgress: 1 });
    expect(metrics.acquisition.pageViews).toBe(1);
    expect(metrics.chapters).toMatchObject({
      started: 1,
      completed: 1,
      completionRate: 100,
      averageDurationSec: 90,
      answerSubmissions: 2,
      answerAccuracy: 50,
    });
    expect(metrics.bosses).toMatchObject({
      started: 1,
      won: 1,
      winRate: 100,
      questionsResolved: 2,
      questionAccuracy: 100,
    });
    expect(metrics.remediation).toEqual({
      started: 1,
      completed: 1,
      completionRate: 100,
    });
    expect(metrics.reports.viewed).toBe(1);
  });

  it("excludes failed chapter quizzes from completion metrics", () => {
    const persistence = createPersistence(":memory:");
    stores.push(persistence);
    const events = [
      event({ eventType: "chapter_started", index: 0 }),
      event({
        eventType: "chapter_completed",
        payload: { passed: false, durationSec: 120 },
        index: 1,
      }),
      event({
        eventType: "chapter_quiz_failed",
        payload: { passed: false, durationSec: 120 },
        index: 2,
      }),
    ];

    const metrics = buildProductMetrics(events, persistence);

    expect(metrics.chapters).toMatchObject({
      started: 1,
      completed: 0,
      completionRate: 0,
      averageDurationSec: 0,
    });
    expect(metrics.profiles.withProgress).toBe(0);
  });

  it("does not count page-view-only profiles as having progress", () => {
    const persistence = createPersistence(":memory:");
    stores.push(persistence);
    persistence.completeChapter("profile.with-progress", "chapter.1");
    const events = [
      event({ eventType: "page_viewed", index: 0 }),
      event({
        eventType: "page_viewed",
        index: 1,
        profileId: "profile.with-progress",
      }),
      event({
        eventType: "page_viewed",
        index: 2,
        profileId: "profile.visitor",
      }),
    ];

    const metrics = buildProductMetrics(events, persistence);

    expect(metrics.profiles).toEqual({ active: 3, withProgress: 1 });
  });

  it("handles out-of-order and duplicate completion events", () => {
    const persistence = createPersistence(":memory:");
    stores.push(persistence);
    persistence.completeChapter("profile.1", "chapter.1");
    const events = [
      event({
        eventType: "chapter_completed",
        payload: { passed: true, durationSec: 75 },
        index: 4,
      }),
      event({ eventType: "chapter_started", index: 0 }),
      event({
        eventType: "chapter_completed",
        payload: { passed: true, durationSec: 75 },
        index: 3,
      }),
      event({
        eventType: "chapter_quiz_failed",
        payload: { passed: false, durationSec: 30 },
        index: 2,
      }),
    ];

    const metrics = buildProductMetrics(events, persistence);

    expect(metrics.chapters).toMatchObject({
      started: 1,
      completed: 1,
      completionRate: 100,
      averageDurationSec: 75,
    });
  });

  it("returns stable zero values without events", () => {
    const persistence = createPersistence(":memory:");
    stores.push(persistence);

    const metrics = buildProductMetrics([], persistence);

    expect(metrics.profiles.active).toBe(0);
    expect(metrics.profiles.withProgress).toBe(0);
    expect(metrics.chapters.completionRate).toBe(0);
    expect(metrics.bosses.winRate).toBe(0);
    expect(metrics.remediation.completionRate).toBe(0);
  });
});

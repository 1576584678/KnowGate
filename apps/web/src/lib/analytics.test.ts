import { afterEach, describe, expect, it } from "vitest";
import type { LearningEvent, LearningEventType } from "@knowgate/domain";
import { buildProductMetrics } from "./analytics";
import { createPersistence, type PersistenceStore } from "./persistence";

const stores: PersistenceStore[] = [];

function event(
  eventType: LearningEventType,
  payload: Record<string, unknown> = {},
  index = 0,
): LearningEvent {
  return {
    id: `event.${eventType}.${index}`,
    profileId: "profile.1",
    eventType,
    entityType: "test",
    entityId: "entity.1",
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
    const events = [
      event("page_viewed", { path: "/" }, 0),
      event("chapter_started", {}, 1),
      event("chapter_answer_submitted", { correct: true }, 2),
      event("chapter_answer_submitted", { correct: false }, 3),
      event("chapter_completed", { durationSec: 90 }, 4),
      event("boss_started", {}, 5),
      event("boss_answer_resolved", { correct: true }, 6),
      event("boss_answer_resolved", { correct: true }, 7),
      event("boss_won", {}, 8),
      event("remediation_started", {}, 9),
      event("remediation_completed", {}, 10),
      event("report_viewed", {}, 11),
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

  it("returns stable zero values without events", () => {
    const persistence = createPersistence(":memory:");
    stores.push(persistence);

    const metrics = buildProductMetrics([], persistence);

    expect(metrics.profiles.active).toBe(0);
    expect(metrics.chapters.completionRate).toBe(0);
    expect(metrics.bosses.winRate).toBe(0);
    expect(metrics.remediation.completionRate).toBe(0);
  });
});

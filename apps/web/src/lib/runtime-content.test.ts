import { afterEach, describe, expect, it } from "vitest";
import type { Chapter, ContentQuestion } from "@knowgate/domain";
import {
  bossQuestions as grade4BossQuestions,
  bosses as grade4Bosses,
  chapters,
  knowledgeNodes as grade4KnowledgeNodes,
  milestones as grade4Milestones,
} from "@/content/math-grade4";
import { completeChapter } from "./chapter-store";
import { createPersistence, type PersistenceStore } from "./persistence";
import {
  buildRuntimeContentGraph,
  contentRolloutBucket,
  getRuntimeChapter,
  getRuntimeGradeWorld,
  resolveRuntimeContent,
} from "./runtime-content";

const stores: PersistenceStore[] = [];

function createStore() {
  const store = createPersistence(":memory:");
  stores.push(store);
  return store;
}

afterEach(() => {
  for (const store of stores.splice(0)) {
    store.close();
  }
});

function publishChapter(
  persistence: PersistenceStore,
  chapter: Chapter,
) {
  persistence.recordPublication({
    id: `publication.${chapter.id}`,
    draftId: `draft.${chapter.id}`,
    kind: "chapter",
    entityId: chapter.id,
    contentVersion: "2026.09.20.99",
    payload: chapter as unknown as Record<string, unknown>,
    publishedAt: new Date().toISOString(),
  });
}

function chapterQuestions(chapter: Chapter): ContentQuestion[] {
  return chapter.steps
    .map((step) => step.question)
    .filter((question): question is ContentQuestion => question !== undefined);
}

function recordSnapshot(
  persistence: PersistenceStore,
  input: {
    id: string;
    contentVersion: string;
    rolloutPercent: number;
    previousSnapshotId?: string;
  },
) {
  const graph = buildRuntimeContentGraph(persistence);
  const now = new Date().toISOString();
  persistence.recordContentSnapshot({
    id: input.id,
    draftId: `draft.${input.id}`,
    contentVersion: input.contentVersion,
    graphHash: "a".repeat(64),
    curriculumHash: "b".repeat(64),
    itemSetHash: "c".repeat(64),
    graph: {
      ...graph,
      contentVersion: input.contentVersion,
    } as unknown as Record<string, unknown>,
    status: "active",
    rolloutPercent: input.rolloutPercent,
    createdBy: "publisher.1",
    createdAt: now,
    activatedAt: now,
    previousSnapshotId: input.previousSnapshotId,
  });
}

function recordSnapshotWithGraph(
  persistence: PersistenceStore,
  input: {
    id: string;
    contentVersion: string;
    graph: Record<string, unknown>;
  },
) {
  const now = new Date().toISOString();
  persistence.recordContentSnapshot({
    id: input.id,
    draftId: `draft.${input.id}`,
    contentVersion: input.contentVersion,
    graphHash: "d".repeat(64),
    curriculumHash: "e".repeat(64),
    itemSetHash: "f".repeat(64),
    graph: input.graph,
    status: "active",
    rolloutPercent: 100,
    createdBy: "publisher.1",
    createdAt: now,
    activatedAt: now,
  });
}

describe("runtime content", () => {
  it("serves generated grades alongside grade four", () => {
    const graph = buildRuntimeContentGraph(createStore());

    expect(
      graph.chapters.some((chapter) => chapter.id === "chapter.g2.01.01"),
    ).toBe(true);
    expect(
      graph.milestones.some(
        (milestone) => milestone.id === "math.g2.milestone.01",
      ),
    ).toBe(true);
  });

  it("resolves published chapters over the static seed graph", () => {
    const persistence = createStore();
    const source = chapters[0];
    const published: Chapter = {
      ...source,
      id: "chapter.runtime.published",
      title: "Published runtime chapter",
    };
    publishChapter(persistence, published);

    const graph = buildRuntimeContentGraph(persistence);
    expect(
      graph.chapters.find((chapter) => chapter.id === published.id)?.title,
    ).toBe("Published runtime chapter");
    expect(getRuntimeChapter(published.id, persistence)?.title).toBe(
      "Published runtime chapter",
    );
    // Static seed chapters remain available alongside published overrides.
    expect(getRuntimeChapter(source.id, persistence)?.id).toBe(source.id);
  });

  it("grades chapter completion against published answer keys", () => {
    const persistence = createStore();
    const source = chapters[0];
    const questions = chapterQuestions(source);
    expect(questions.length).toBeGreaterThan(1);

    const target = questions[0];
    const flippedAnswerIndex =
      (target.answerIndex + 1) % target.options.length;
    const published: Chapter = {
      ...source,
      steps: source.steps.map((step) =>
        step.question?.id === target.id
          ? {
              ...step,
              question: { ...step.question, answerIndex: flippedAnswerIndex },
            }
          : step,
      ),
    };
    publishChapter(persistence, published);

    const graph = buildRuntimeContentGraph(persistence);
    const answersFor = (chapter: Chapter) =>
      chapterQuestions(chapter).map((question) => ({
        itemId: question.id,
        answer: String(question.answerIndex),
      }));

    const publishedResult = completeChapter(
      {
        profileId: "profile.published",
        chapterId: source.id,
        answers: answersFor(published),
        durationSec: 30,
        contentVersion: graph.contentVersion,
      },
      persistence,
    );
    expect(publishedResult.passed).toBe(true);
    expect(publishedResult.correctCount).toBe(questions.length);

    const staticResult = completeChapter(
      {
        profileId: "profile.static",
        chapterId: source.id,
        answers: answersFor(source),
        durationSec: 30,
        contentVersion: graph.contentVersion,
      },
      persistence,
    );
    expect(staticResult.correctCount).toBeLessThan(questions.length);
  });

  it("serves the newest snapshot to the configured rollout percentage", () => {
    const persistence = createStore();
    recordSnapshot(persistence, {
      id: "snapshot.rollout.a",
      contentVersion: "v.A",
      rolloutPercent: 100,
    });
    recordSnapshot(persistence, {
      id: "snapshot.rollout.b",
      contentVersion: "v.B",
      rolloutPercent: 1,
      previousSnapshotId: "snapshot.rollout.a",
    });

    const profiles = Array.from({ length: 300 }, (_, index) => `profile.${index}`);
    const inRollout = profiles.find(
      (profileId) => contentRolloutBucket(profileId) === 0,
    );
    const outOfRollout = profiles.find(
      (profileId) => contentRolloutBucket(profileId) >= 1,
    );
    expect(inRollout).toBeDefined();
    expect(outOfRollout).toBeDefined();

    expect(
      resolveRuntimeContent(persistence, { profileId: inRollout }).snapshotId,
    ).toBe("snapshot.rollout.b");
    expect(
      resolveRuntimeContent(persistence, { profileId: outOfRollout })
        .snapshotId,
    ).toBe("snapshot.rollout.a");
  });

  it("resolves a pinned snapshot even after it is retired", () => {
    const persistence = createStore();
    recordSnapshot(persistence, {
      id: "snapshot.pinned",
      contentVersion: "v.PINNED",
      rolloutPercent: 100,
    });
    persistence.retireContentSnapshot("snapshot.pinned");

    const resolved = resolveRuntimeContent(persistence, {
      snapshotId: "snapshot.pinned",
    });

    expect(resolved.snapshotId).toBe("snapshot.pinned");
    expect(resolved.graph.contentVersion).toBe("v.PINNED");
  });

  it("merges missing grades into older grade-four-only snapshots", () => {
    const persistence = createStore();
    recordSnapshotWithGraph(persistence, {
      id: "snapshot.grade4-only",
      contentVersion: "v.GRADE4",
      graph: {
        contentVersion: "v.GRADE4",
        nodes: grade4KnowledgeNodes,
        chapters,
        milestones: grade4Milestones,
        bosses: grade4Bosses,
        questions: grade4BossQuestions,
      },
    });

    const graph = buildRuntimeContentGraph(persistence);

    expect(getRuntimeGradeWorld(persistence, "math.g2").grade).toBe(2);
    expect(getRuntimeChapter("chapter.g2.01.01", persistence)).toBeDefined();
    expect(
      graph.milestones.some(
        (milestone) => milestone.id === "math.g2.milestone.01",
      ),
    ).toBe(true);
  });
});

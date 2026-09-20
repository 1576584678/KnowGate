import type {
  ChapterCompletionAnswer,
  ChapterCompletionResult,
  ContentQuestion,
  LearningEvent,
  LearningEventType,
} from "@knowgate/domain";
import {
  getPersistence,
  type PersistenceStore,
} from "@/lib/persistence";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

const PASS_THRESHOLD = 80;
const CHAPTER_MASTERY_WEIGHT = 10;

function answerToIndex(answer: string) {
  const normalized = answer.trim().toUpperCase();

  if (/^[A-Z]$/.test(normalized)) {
    return normalized.charCodeAt(0) - 65;
  }

  const numeric = Number(normalized);
  return Number.isInteger(numeric) ? numeric : -1;
}

function chapterQuestions(chapter: {
  steps: Array<{ question?: ContentQuestion }>;
}) {
  return chapter.steps
    .map((step) => step.question)
    .filter((question): question is ContentQuestion => question !== undefined);
}

function uniqueNodeIds(chapter: { nodeIds: string[] }) {
  return [...new Set(chapter.nodeIds)];
}

function createEvent(input: {
  profileId: string;
  eventType: LearningEventType;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
  contentVersion?: string;
  now?: Date;
}): LearningEvent {
  return {
    id: crypto.randomUUID(),
    profileId: input.profileId,
    eventType: input.eventType,
    entityType: input.entityType,
    entityId: input.entityId,
    payload: input.payload ?? {},
    occurredAt: (input.now ?? new Date()).toISOString(),
    contentVersion: input.contentVersion,
  };
}

export function completeChapter(
  input: {
    profileId: string;
    chapterId: string;
    answers: ChapterCompletionAnswer[];
    durationSec: number;
    contentVersion?: string;
  },
  persistence: PersistenceStore = getPersistence(),
): ChapterCompletionResult {
  const graph = buildRuntimeContentGraph(persistence);
  const chapter = graph.chapters.find((item) => item.id === input.chapterId);
  if (!chapter) {
    throw new Error("CHAPTER_NOT_FOUND");
  }

  if (
    input.contentVersion !== undefined &&
    input.contentVersion !== graph.contentVersion
  ) {
    throw new Error("CONTENT_VERSION_MISMATCH");
  }

  const questions = chapterQuestions(chapter);
  const existing = persistence.getChapterCompletion(
    input.profileId,
    input.chapterId,
  );
  if (existing) {
    return buildResult({
      chapterId: input.chapterId,
      milestoneId: chapter.milestoneId,
      score: existing.score,
      correctCount: Math.round(
        (existing.score / 100) * questions.length,
      ),
      questionCount: questions.length,
      passed: true,
      milestoneCompleted: isMilestoneCompleted(
        input.profileId,
        chapter.milestoneId,
        graph.milestones,
        persistence,
      ),
      completedAt: existing.completedAt,
      chapter,
      contentVersion: graph.contentVersion,
    });
  }

  if (questions.length === 0) {
    throw new Error("CHAPTER_QUIZ_NOT_FOUND");
  }

  const submittedAnswers = new Map(
    input.answers.map((answer) => [answer.itemId, answerToIndex(answer.answer)]),
  );
  const correctCount = questions.filter(
    (question) => submittedAnswers.get(question.id) === question.answerIndex,
  ).length;
  const score = Math.round((correctCount / questions.length) * 100);
  const passed = score >= PASS_THRESHOLD;
  const completedAt = new Date().toISOString();
  const durationSec = Math.max(0, Math.round(input.durationSec));

  if (passed) {
    persistence.completeChapter(
      input.profileId,
      input.chapterId,
      completedAt,
      score,
      durationSec,
    );
  }

  persistence.recordEvent(
    createEvent({
      profileId: input.profileId,
      eventType: passed ? "chapter_completed" : "chapter_quiz_failed",
      entityType: "chapter",
      entityId: input.chapterId,
      payload: {
        passed,
        score,
        correctCount,
        questionCount: questions.length,
        durationSec,
      },
      contentVersion: graph.contentVersion,
    }),
  );

  return buildResult({
    chapterId: input.chapterId,
    milestoneId: chapter.milestoneId,
    score,
    correctCount,
    questionCount: questions.length,
    passed,
    milestoneCompleted: passed
      ? isMilestoneCompleted(
          input.profileId,
          chapter.milestoneId,
          graph.milestones,
          persistence,
        )
      : false,
    completedAt,
    chapter,
    contentVersion: graph.contentVersion,
  });
}

function buildResult(input: {
  chapterId: string;
  milestoneId: string;
  chapter: { nodeIds: string[] };
  contentVersion: string;
  score: number;
  correctCount: number;
  questionCount: number;
  passed?: boolean;
  milestoneCompleted: boolean;
  completedAt: string;
}): ChapterCompletionResult {
  const masteryDelta = Object.fromEntries(
    uniqueNodeIds(input.chapter).map((nodeId) => [
      nodeId,
      Math.round((input.score / 100) * CHAPTER_MASTERY_WEIGHT),
    ]),
  );
  const passed = input.passed ?? input.score >= PASS_THRESHOLD;

  return {
    chapterId: input.chapterId,
    milestoneId: input.milestoneId,
    passed,
    score: input.score,
    correctCount: input.correctCount,
    questionCount: input.questionCount,
    masteryDelta,
    nextAction: input.milestoneCompleted ? "boss_available" : "next_chapter",
    contentVersion: input.contentVersion,
    completedAt: input.completedAt,
  };
}

function isMilestoneCompleted(
  profileId: string,
  milestoneId: string,
  milestones: Array<{ id: string; chapterIds: string[] }>,
  persistence: PersistenceStore,
) {
  const milestone = milestones.find((item) => item.id === milestoneId);
  if (!milestone) return false;

  const progress = persistence.getProgress(profileId);
  return milestone.chapterIds.every((chapterId) =>
    progress.passedChapterIds.includes(chapterId),
  );
}

export function recordLearningEvent(
  input: {
    profileId: string;
    eventType: LearningEventType;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown>;
    contentVersion?: string;
  },
  persistence: PersistenceStore = getPersistence(),
) {
  persistence.recordEvent(
    createEvent({
      ...input,
      contentVersion:
        input.contentVersion ??
        buildRuntimeContentGraph(persistence).contentVersion,
    }),
  );
}

export function isChapterAvailable(chapterId: string) {
  return buildRuntimeContentGraph().chapters.some(
    (chapter) => chapter.id === chapterId,
  );
}

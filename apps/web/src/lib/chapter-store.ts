import type {
  ChapterCompletionAnswer,
  ChapterCompletionResult,
  ContentQuestion,
  LearningEvent,
  LearningEventType,
} from "@knowgate/domain";
import {
  chapters,
  getChapter,
  getMilestone,
  gradeWorld,
} from "@/content/math-grade4";
import {
  getPersistence,
  type PersistenceStore,
} from "@/lib/persistence";

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

function chapterQuestions(chapterId: string) {
  const chapter = getChapter(chapterId);
  if (!chapter) return [];

  return chapter.steps
    .map((step) => step.question)
    .filter((question): question is ContentQuestion => question !== undefined);
}

function uniqueNodeIds(chapterId: string) {
  return [...new Set(getChapter(chapterId)?.nodeIds ?? [])];
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
  const chapter = getChapter(input.chapterId);
  if (!chapter) {
    throw new Error("CHAPTER_NOT_FOUND");
  }

  if (
    input.contentVersion !== undefined &&
    input.contentVersion !== gradeWorld.contentVersion
  ) {
    throw new Error("CONTENT_VERSION_MISMATCH");
  }

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
        (existing.score / 100) * chapterQuestions(input.chapterId).length,
      ),
      questionCount: chapterQuestions(input.chapterId).length,
      passed: true,
      milestoneCompleted: isMilestoneCompleted(
        input.profileId,
        chapter.milestoneId,
        persistence,
      ),
      completedAt: existing.completedAt,
    });
  }

  const questions = chapterQuestions(input.chapterId);
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
      eventType: "chapter_completed",
      entityType: "chapter",
      entityId: input.chapterId,
      payload: {
        passed,
        score,
        correctCount,
        questionCount: questions.length,
        durationSec,
      },
      contentVersion: gradeWorld.contentVersion,
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
          persistence,
        )
      : false,
    completedAt,
  });
}

function buildResult(input: {
  chapterId: string;
  milestoneId: string;
  score: number;
  correctCount: number;
  questionCount: number;
  passed?: boolean;
  milestoneCompleted: boolean;
  completedAt: string;
}): ChapterCompletionResult {
  const masteryDelta = Object.fromEntries(
    uniqueNodeIds(input.chapterId).map((nodeId) => [
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
    contentVersion: gradeWorld.contentVersion,
    completedAt: input.completedAt,
  };
}

function isMilestoneCompleted(
  profileId: string,
  milestoneId: string,
  persistence: PersistenceStore,
) {
  const milestone = getMilestone(milestoneId);
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
      contentVersion: input.contentVersion ?? gradeWorld.contentVersion,
    }),
  );
}

export function isChapterAvailable(chapterId: string) {
  return chapters.some((chapter) => chapter.id === chapterId);
}

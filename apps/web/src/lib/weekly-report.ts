import type { MasteryStatus } from "@knowgate/domain";
import {
  chapters,
  getMilestone,
  gradeWorld,
} from "@/content/math-grade4";
import {
  getNodeMasteryReport,
  getRemediationPlan,
  type NodeMasteryReport,
} from "@/lib/learning-report";
import {
  getPersistence,
  type ChapterCompletionRecord,
  type PersistenceStore,
} from "@/lib/persistence";

const REPORT_TIME_ZONE = "Asia/Shanghai";
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export type WeeklyStudentReport = {
  studentId: string;
  generatedAt: string;
  contentVersion: string;
  period: {
    weekStart: string;
    weekEnd: string;
    timezone: string;
    label: string;
  };
  summary: {
    learningDurationSec: number;
    completedChapterCount: number;
    masteredNodeCount: number;
    needsRemediationCount: number;
    bossAttemptCount: number;
    bossWinCount: number;
  };
  completedChapters: Array<{
    id: string;
    title: string;
    stageNo: number;
    milestoneId: string;
    nodeIds: string[];
    score: number;
    durationSec: number;
    completedAt: string;
  }>;
  masteredNodes: Array<{
    nodeId: string;
    name: string;
    mastery: number;
    status: MasteryStatus;
    nextReviewAt: string | null;
  }>;
  needsRemediation: Array<{
    nodeId: string;
    name: string;
    mastery: number;
    status: MasteryStatus;
    completedChapters: number;
    totalChapters: number;
    nextReviewAt: string | null;
  }>;
  bossResults: Array<{
    milestoneId: string;
    milestoneName: string;
    status: "won" | "lost";
    accuracy: number;
    maxCombo: number;
    completedAt: string;
  }>;
  suggestedReviews: Array<{
    nodeId: string;
    name: string;
    mastery: number;
    status: MasteryStatus;
    reason: string;
    chapters: Array<{
      id: string;
      title: string;
      estimatedMinutes: number;
    }>;
  }>;
};

type DateKey = string;

function dateKeyFromParts(parts: Intl.DateTimeFormatPart[]) {
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyInReportTimezone(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return dateKeyFromParts(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: REPORT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date),
  );
}

function parseDateKey(value: string | null | undefined) {
  if (!value || !DATE_KEY_PATTERN.test(value)) return undefined;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: DateKey, days: number) {
  return toDateKey(new Date(parseDateKey(value)!.getTime() + days * DAY_MS));
}

function startOfWeek(value: DateKey) {
  const date = parseDateKey(value)!;
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return addDays(value, -daysSinceMonday);
}

function chineseDate(value: DateKey) {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function weekRange(weekStart: string | null | undefined, now: Date) {
  const reference = weekStart
    ? parseDateKey(weekStart)
    : parseDateKey(dateKeyInReportTimezone(now));

  if (!reference) {
    throw new Error("INVALID_WEEK_START");
  }

  const start = startOfWeek(toDateKey(reference));
  const end = addDays(start, 6);

  return {
    start,
    end,
    label: `${chineseDate(start)} - ${chineseDate(end)}`,
  };
}

function isWithinWeek(
  timestamp: string,
  range: { start: DateKey; end: DateKey },
) {
  const date = dateKeyInReportTimezone(timestamp);
  return date !== undefined && date >= range.start && date <= range.end;
}

function completionForChapter(
  persistence: PersistenceStore,
  profileId: string,
  chapterId: string,
) {
  return persistence.getChapterCompletion(profileId, chapterId);
}

function completedChapterEntries(
  persistence: PersistenceStore,
  profileId: string,
  range: { start: DateKey; end: DateKey },
) {
  return chapters
    .map((chapter) => ({
      chapter,
      completion: completionForChapter(persistence, profileId, chapter.id),
    }))
    .filter(
      (
        entry,
      ): entry is {
        chapter: (typeof chapters)[number];
        completion: ChapterCompletionRecord;
      } =>
        entry.completion !== undefined &&
        isWithinWeek(entry.completion.completedAt, range),
    );
}

function nodeSummary(report: NodeMasteryReport) {
  return {
    nodeId: report.nodeId,
    name: report.name,
    mastery: report.mastery,
    status: report.status,
    nextReviewAt: report.nextReviewAt,
  };
}

function remediationSummary(report: NodeMasteryReport) {
  return {
    nodeId: report.nodeId,
    name: report.name,
    mastery: report.mastery,
    status: report.status,
    completedChapters: report.completedChapters,
    totalChapters: report.totalChapters,
    nextReviewAt: report.nextReviewAt,
  };
}

function reviewReason(report: NodeMasteryReport) {
  if (report.status === "learning") {
    return "当前掌握证据不足，建议先回顾核心章节和基础练习。";
  }

  return "已经形成基础，建议用少量练习巩固后再进入下一节点。";
}

function readDurationFromEvent(payload: Record<string, unknown>) {
  return typeof payload.durationSec === "number" &&
    Number.isFinite(payload.durationSec) &&
    payload.durationSec >= 0
    ? Math.round(payload.durationSec)
    : 0;
}

export function getWeeklyStudentReport(
  profileId: string,
  options: {
    weekStart?: string | null;
    now?: Date;
  } = {},
  persistence: PersistenceStore = getPersistence(),
): WeeklyStudentReport {
  const now = options.now ?? new Date();
  const range = weekRange(options.weekStart, now);
  const events = persistence
    .getLearningEvents(profileId)
    .filter((event) => isWithinWeek(event.occurredAt, range));
  const completedChapters = completedChapterEntries(
    persistence,
    profileId,
    range,
  );
  const completionEvents = events.filter(
    (event) => event.eventType === "chapter_completed",
  );
  const eventDurationSec = completionEvents.reduce(
    (total, event) => total + readDurationFromEvent(event.payload),
    0,
  );
  const learningDurationSec =
    completionEvents.length > 0
      ? eventDurationSec
      : completedChapters.reduce(
          (total, entry) => total + entry.completion.durationSec,
          0,
        );
  const mastery = getNodeMasteryReport(profileId, persistence);
  const completedChapterIds = new Set(
    persistence.getProgress(profileId).passedChapterIds,
  );
  const masteredNodes = mastery.filter((report) => report.status === "mastered");
  const needsRemediation = mastery
    .filter((report) => report.status !== "mastered")
    .sort(
      (left, right) =>
        left.mastery - right.mastery || left.nodeId.localeCompare(right.nodeId),
    );
  const bossResults = events
    .filter(
      (event) =>
        event.eventType === "boss_won" || event.eventType === "boss_lost",
    )
    .map((event) => {
      const milestoneId =
        typeof event.payload.milestoneId === "string"
          ? event.payload.milestoneId
          : "";
      return {
        milestoneId,
        milestoneName: getMilestone(milestoneId)?.name ?? "未知关卡",
        status: event.eventType === "boss_won" ? "won" : "lost",
        accuracy:
          typeof event.payload.accuracy === "number"
            ? Math.round(event.payload.accuracy)
            : 0,
        maxCombo:
          typeof event.payload.maxCombo === "number"
            ? Math.round(event.payload.maxCombo)
            : 0,
        completedAt: event.occurredAt,
      } satisfies WeeklyStudentReport["bossResults"][number];
    })
    .sort(
      (left, right) =>
        Date.parse(left.completedAt) - Date.parse(right.completedAt),
    );

  return {
    studentId: profileId,
    generatedAt: now.toISOString(),
    contentVersion: gradeWorld.contentVersion,
    period: {
      weekStart: range.start,
      weekEnd: range.end,
      timezone: REPORT_TIME_ZONE,
      label: range.label,
    },
    summary: {
      learningDurationSec,
      completedChapterCount: completedChapters.length,
      masteredNodeCount: masteredNodes.length,
      needsRemediationCount: needsRemediation.length,
      bossAttemptCount: bossResults.length,
      bossWinCount: bossResults.filter((result) => result.status === "won")
        .length,
    },
    completedChapters: completedChapters.map(({ chapter, completion }) => ({
      id: chapter.id,
      title: chapter.title,
      stageNo: chapter.stageNo,
      milestoneId: chapter.milestoneId,
      nodeIds: chapter.nodeIds,
      score: completion.score,
      durationSec: completion.durationSec,
      completedAt: completion.completedAt,
    })),
    masteredNodes: masteredNodes.map(nodeSummary),
    needsRemediation: needsRemediation.map(remediationSummary),
    bossResults,
    suggestedReviews: needsRemediation.slice(0, 3).map((report) => {
      const plan = getRemediationPlan(profileId, report.nodeId, persistence);
      const recommendedChapters = plan.chapters
        .filter((chapter) => !completedChapterIds.has(chapter.id))
        .slice(0, 2)
        .map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          estimatedMinutes: chapter.estimatedMinutes,
        }));

      return {
        nodeId: report.nodeId,
        name: report.name,
        mastery: report.mastery,
        status: report.status,
        reason: reviewReason(report),
        chapters:
          recommendedChapters.length > 0
            ? recommendedChapters
            : plan.chapters.slice(0, 2).map((chapter) => ({
                id: chapter.id,
                title: chapter.title,
                estimatedMinutes: chapter.estimatedMinutes,
              })),
      };
    }),
  };
}

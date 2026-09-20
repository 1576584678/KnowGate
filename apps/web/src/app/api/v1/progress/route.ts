import { NextResponse } from "next/server";
import type { BattleOutcome } from "@knowgate/domain";
import { getChapter, getMilestone } from "@/content/math-grade4";
import { recordLearningEvent } from "@/lib/chapter-store";
import { getPersistence } from "@/lib/persistence";
import { getProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

function isBattleOutcome(value: unknown): value is BattleOutcome {
  if (!value || typeof value !== "object") return false;
  const outcome = value as Partial<BattleOutcome>;
  return (
    typeof outcome.milestoneId === "string" &&
    (outcome.status === "won" || outcome.status === "lost") &&
    typeof outcome.accuracy === "number" &&
    Number.isFinite(outcome.accuracy) &&
    outcome.accuracy >= 0 &&
    outcome.accuracy <= 100 &&
    typeof outcome.maxCombo === "number" &&
    Number.isInteger(outcome.maxCombo) &&
    outcome.maxCombo >= 0 &&
    Array.isArray(outcome.mistakes) &&
    typeof outcome.completedAt === "string"
  );
}

export async function GET(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  const progress = getPersistence().getProgress(profileId);
  return NextResponse.json({ progress });
}

export async function POST(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  const body = (await request.json()) as {
    type?: string;
    chapterId?: string;
    outcome?: unknown;
  };
  const persistence = getPersistence();

  if (body.type === "chapter_completed" && body.chapterId) {
    if (!getChapter(body.chapterId)) {
      return NextResponse.json(
        {
          error: {
            code: "CHAPTER_NOT_FOUND",
            message: "没有找到这个章节。",
          },
        },
        { status: 404 },
      );
    }
    persistence.completeChapter(profileId, body.chapterId);
    recordLearningEvent(
      {
        profileId,
        eventType: "chapter_migrated",
        entityType: "chapter",
        entityId: body.chapterId,
      },
      persistence,
    );
  } else if (
    body.type === "battle_recorded" &&
    isBattleOutcome(body.outcome)
  ) {
    if (!getMilestone(body.outcome.milestoneId)) {
      return NextResponse.json(
        {
          error: {
            code: "MILESTONE_NOT_FOUND",
            message: "没有找到这个小关。",
          },
        },
        { status: 404 },
      );
    }
    persistence.saveBattleOutcome(profileId, body.outcome);
  } else {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_PROGRESS_UPDATE",
          message: "进度更新格式不正确。",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    progress: persistence.getProgress(profileId),
  });
}

export async function DELETE(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  const persistence = getPersistence();
  persistence.resetProgress(profileId);
  return NextResponse.json({ progress: persistence.getProgress(profileId) });
}

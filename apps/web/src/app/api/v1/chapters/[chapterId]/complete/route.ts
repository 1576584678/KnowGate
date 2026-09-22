import { NextResponse } from "next/server";
import type { ChapterCompletionAnswer } from "@knowgate/domain";
import { completeChapter } from "@/lib/chapter-store";
import { getPersistence } from "@/lib/persistence";
import {
  getProfileIdFromRequest,
  profileUnauthorizedResponse,
} from "@/lib/profile";

export const runtime = "nodejs";

function isAnswer(value: unknown): value is ChapterCompletionAnswer {
  if (!value || typeof value !== "object") return false;
  const answer = value as Partial<ChapterCompletionAnswer>;
  return (
    typeof answer.itemId === "string" &&
    answer.itemId.length > 0 &&
    typeof answer.answer === "string"
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params;
  const profileId = getProfileIdFromRequest(request);
  if (!profileId) return profileUnauthorizedResponse();

  try {
    const body = (await request.json()) as {
      answers?: unknown;
      durationSec?: unknown;
      contentVersion?: unknown;
    };
    const answers = Array.isArray(body.answers)
      ? body.answers.filter(isAnswer)
      : [];

    if (
      answers.length !== (Array.isArray(body.answers) ? body.answers.length : 0)
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ANSWERS",
            message: "答题记录格式不正确。",
          },
        },
        { status: 400 },
      );
    }

    if (
      typeof body.durationSec !== "number" ||
      !Number.isFinite(body.durationSec) ||
      body.durationSec < 0
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_DURATION",
            message: "学习时长格式不正确。",
          },
        },
        { status: 400 },
      );
    }

    const result = completeChapter({
      profileId,
      chapterId,
      answers,
      durationSec: body.durationSec,
      contentVersion:
        typeof body.contentVersion === "string"
          ? body.contentVersion
          : undefined,
    });
    const progress = getPersistence().getProgress(profileId);

    return NextResponse.json({ result, progress });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      code === "CHAPTER_NOT_FOUND"
        ? 404
        : code === "CONTENT_VERSION_MISMATCH"
          ? 409
          : code === "CHAPTER_QUIZ_NOT_FOUND"
            ? 422
            : 400;
    const message =
      code === "CHAPTER_NOT_FOUND"
        ? "没有找到这个章节。"
        : code === "CONTENT_VERSION_MISMATCH"
          ? "章节内容已经更新，请刷新后重试。"
          : "无法完成这个章节。";

    return NextResponse.json({ error: { code, message } }, { status });
  }
}

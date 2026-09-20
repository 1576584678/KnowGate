import { NextResponse } from "next/server";
import { answerBattle } from "@/lib/battle-store";
import { getProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params;
  const profileId = getProfileIdFromRequest(request);

  try {
    const body = (await request.json()) as {
      questionId?: string;
      selectedIndex?: number;
    };

    if (!body.questionId || typeof body.selectedIndex !== "number") {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ANSWER",
            message: "答案格式不正确。",
          },
        },
        { status: 400 },
      );
    }

    const result = answerBattle({
      profileId,
      battleId,
      questionId: body.questionId,
      selectedIndex: body.selectedIndex,
    });

    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      code === "BATTLE_NOT_FOUND"
        ? 404
        : code === "INVALID_ANSWER"
          ? 400
          : 409;
    const message =
      code === "QUESTION_NOT_ACTIVE"
        ? "这道题已经不能再提交了。"
        : code === "INVALID_ANSWER"
          ? "答案格式不正确。"
          : "无法提交答案。";

    return NextResponse.json({ error: { code, message } }, { status });
  }
}

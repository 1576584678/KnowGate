import { NextResponse } from "next/server";
import {
  getProfileIdFromRequest,
  profileUnauthorizedResponse,
} from "@/lib/profile";
import { checkQuestion } from "@/lib/question-check";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const profileId = getProfileIdFromRequest(request);
  if (!profileId) return profileUnauthorizedResponse();

  const { questionId } = await params;

  try {
    const body = (await request.json()) as { selectedIndex?: unknown };
    if (typeof body.selectedIndex !== "number") {
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

    return NextResponse.json(
      checkQuestion({
        questionId,
        selectedIndex: body.selectedIndex,
      }),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      code === "QUESTION_NOT_FOUND"
        ? 404
        : code === "INVALID_ANSWER"
          ? 400
          : 500;
    const message =
      code === "QUESTION_NOT_FOUND"
        ? "没有找到这道题。"
        : "无法校验答案。";

    return NextResponse.json({ error: { code, message } }, { status });
  }
}

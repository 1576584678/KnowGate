import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import {
  generateBossQuestionSet,
  getParameterizedQuestionCapabilities,
} from "@/lib/question-generator";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json(getParameterizedQuestionCapabilities());
}

export async function POST(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      seed?: number;
      questionCount?: number;
      idPrefix?: string;
      nodeId?: string;
    };
    const seed =
      typeof body.seed === "number" && Number.isFinite(body.seed)
        ? Math.trunc(body.seed)
        : Date.now();
    const bossQuestions = buildRuntimeContentGraph().questions;
    const sourceQuestions = body.nodeId
      ? bossQuestions.filter((question) => question.nodeId === body.nodeId)
      : bossQuestions;

    if (sourceQuestions.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "QUESTION_SOURCE_NOT_FOUND",
            message: "没有找到可用于出题的知识节点题目。",
          },
        },
        { status: 404 },
      );
    }

    const questions = generateBossQuestionSet({
      sourceQuestions,
      seed,
      questionCount: body.questionCount,
      idPrefix: body.idPrefix || `question.admin.${seed}`,
    });

    return NextResponse.json({ seed, questions });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      { error: { code, message: "无法生成参数化题目。" } },
      { status: 400 },
    );
  }
}

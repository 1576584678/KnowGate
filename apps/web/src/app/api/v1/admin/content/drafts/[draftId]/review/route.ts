import { NextResponse } from "next/server";
import {
  getAdminOperatorId,
  requireAdminRequest,
} from "@/lib/admin-auth";
import {
  reviewContentDraft,
  type ContentReviewAction,
} from "@/lib/content-workflow";

export const runtime = "nodejs";

const reviewActions: ContentReviewAction[] = [
  "submit",
  "approve",
  "reject",
  "publish",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const { draftId } = await params;

  try {
    const body = (await request.json()) as {
      action?: ContentReviewAction;
      note?: string;
      operatorId?: string;
    };

    if (!body.action || !reviewActions.includes(body.action)) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REVIEW_ACTION",
            message: "审核动作不受支持。",
          },
        },
        { status: 400 },
      );
    }

    const draft = reviewContentDraft({
      draftId,
      action: body.action,
      note: body.note,
      operatorId: body.operatorId?.trim() || getAdminOperatorId(request),
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      code === "DRAFT_NOT_FOUND"
        ? 404
        : code === "CONTENT_GRAPH_INVALID"
          ? 422
          : 409;
    const message =
      code === "CONTENT_GRAPH_INVALID"
        ? "课程图谱仍有错误，不能发布。"
        : code === "INVALID_REVIEW_TRANSITION"
          ? "当前状态不能执行这个审核动作。"
          : "无法更新审核状态。";

    return NextResponse.json({ error: { code, message } }, { status });
  }
}

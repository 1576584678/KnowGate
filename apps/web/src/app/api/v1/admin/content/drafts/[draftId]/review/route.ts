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
  const { draftId } = await params;

  try {
    const body = (await request.json()) as {
      action?: ContentReviewAction;
      note?: string;
      rolloutPercent?: number;
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

    const requiredPermission =
      body.action === "submit"
        ? "content:write"
        : body.action === "publish"
          ? "content:publish"
          : "content:review";
    const unauthorized = requireAdminRequest(request, requiredPermission);
    if (unauthorized) return unauthorized;

    const draft = reviewContentDraft({
      draftId,
      action: body.action,
      note: body.note,
      operatorId: getAdminOperatorId(request),
      rolloutPercent: body.rolloutPercent,
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const isGraphError = code.startsWith("CONTENT_GRAPH_INVALID");
    const isPayloadError = code.startsWith("INVALID_DRAFT_PAYLOAD");

    let status = 409;
    let message = "无法更新审核状态。";

    if (code === "DRAFT_NOT_FOUND") {
      status = 404;
    } else if (isGraphError) {
      status = 422;
      message = "草稿内容会使课程图谱失效，不能发布。";
    } else if (isPayloadError) {
      status = 400;
      message = "草稿内容格式不正确，不能发布。";
    } else if (code === "INVALID_REVIEW_TRANSITION") {
      message = "当前状态不能执行这个审核动作。";
    }

    return NextResponse.json({ error: { code, message } }, { status });
  }
}

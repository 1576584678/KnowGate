import { NextResponse } from "next/server";
import {
  getAdminOperatorId,
  requireAdminRequest,
} from "@/lib/admin-auth";
import {
  listContentDrafts,
  updateContentDraft,
} from "@/lib/content-workflow";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const { draftId } = await params;
  const draft = listContentDrafts().find((item) => item.id === draftId);
  if (!draft) {
    return NextResponse.json(
      {
        error: { code: "DRAFT_NOT_FOUND", message: "没有找到这个内容草稿。" },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ draft });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const { draftId } = await params;

  try {
    const body = (await request.json()) as {
      title?: string;
      payload?: Record<string, unknown>;
      operatorId?: string;
    };
    const draft = updateContentDraft({
      draftId,
      title: typeof body.title === "string" ? body.title : undefined,
      payload:
        body.payload && typeof body.payload === "object"
          ? body.payload
          : undefined,
      operatorId: body.operatorId?.trim() || getAdminOperatorId(request),
    });

    return NextResponse.json({ draft });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      code === "DRAFT_NOT_FOUND"
        ? 404
        : code === "DRAFT_AUTHOR_REQUIRED"
          ? 403
          : 409;
    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === "DRAFT_READ_ONLY"
              ? "审核中和已发布草稿不能直接修改。"
              : code === "DRAFT_AUTHOR_REQUIRED"
                ? "只有草稿作者可以修改内容。"
                : "无法更新内容草稿。",
        },
      },
      { status },
    );
  }
}

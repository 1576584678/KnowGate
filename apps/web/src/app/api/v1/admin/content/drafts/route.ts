import { NextResponse } from "next/server";
import type { ContentDraftKind, ContentDraftStatus } from "@knowgate/domain";
import {
  getAdminOperatorId,
  requireAdminRequest,
} from "@/lib/admin-auth";
import {
  createContentDraft,
  listContentDrafts,
} from "@/lib/content-workflow";

export const runtime = "nodejs";

const statuses: ContentDraftStatus[] = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "published",
];

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const requestedStatus = new URL(request.url).searchParams.get("status");
  if (requestedStatus && !statuses.includes(requestedStatus as ContentDraftStatus)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_DRAFT_STATUS",
          message: "草稿状态筛选值不正确。",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    drafts: listContentDrafts(
      requestedStatus ? (requestedStatus as ContentDraftStatus) : undefined,
    ),
  });
}

export async function POST(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      kind?: ContentDraftKind;
      title?: string;
      payload?: Record<string, unknown>;
    };

    if (
      typeof body.kind !== "string" ||
      typeof body.title !== "string" ||
      !body.payload ||
      typeof body.payload !== "object"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_DRAFT",
            message: "草稿类型、标题和内容不能为空。",
          },
        },
        { status: 400 },
      );
    }

    const draft = createContentDraft({
      kind: body.kind,
      title: body.title,
      payload: body.payload,
      authorId: getAdminOperatorId(request),
    });

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === "INVALID_DRAFT_KIND"
              ? "草稿类型不受支持。"
              : code === "DRAFT_TITLE_REQUIRED"
                ? "草稿标题不能为空。"
                : "无法创建内容草稿。",
        },
      },
      { status: 400 },
    );
  }
}

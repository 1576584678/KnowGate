import { NextResponse } from "next/server";
import {
  getAdminOperatorId,
  requireAdminRequest,
} from "@/lib/admin-auth";
import {
  activateContentSnapshot,
  retireContentSnapshot,
} from "@/lib/content-workflow";
import { getPersistence } from "@/lib/persistence";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request, "content:read");
  if (unauthorized) return unauthorized;

  const persistence = getPersistence();
  const snapshots = persistence.getContentSnapshots();
  const activeSnapshots = snapshots.filter(
    (snapshot) => snapshot.status === "active",
  );

  return NextResponse.json({
    publications: persistence.getPublishedContent(),
    snapshots,
    audit: persistence.getPublicationAudit(),
    currentSnapshotId: activeSnapshots.at(-1)?.id,
  });
}

export async function POST(request: Request) {
  const unauthorized = requireAdminRequest(request, "content:publish");
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json()) as {
      action?: unknown;
      snapshotId?: string;
      rolloutPercent?: number;
      note?: string;
    };

    const action =
      body.action === "activate" ||
      body.action === "rollback" ||
      body.action === "retire"
        ? body.action
        : null;

    if (!body.snapshotId || !action) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_PUBLICATION_ACTION",
            message: "必须指定快照和发布动作。",
          },
        },
        { status: 400 },
      );
    }

    const operatorId = getAdminOperatorId(request);
    const snapshot =
      action === "retire"
        ? retireContentSnapshot(
            {
              snapshotId: body.snapshotId,
              operatorId,
              note: body.note,
            },
            getPersistence(),
          )
        : activateContentSnapshot(
            {
              snapshotId: body.snapshotId,
              operatorId,
              rolloutPercent: body.rolloutPercent,
              note: body.note,
              action: action === "rollback" ? "rollback" : "activated",
            },
            getPersistence(),
          );

    return NextResponse.json({ snapshot });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === "CONTENT_SNAPSHOT_NOT_FOUND"
              ? "没有找到这个内容快照。"
              : "无法更新内容发布状态。",
        },
      },
      { status: code === "CONTENT_SNAPSHOT_NOT_FOUND" ? 404 : 400 },
    );
  }
}

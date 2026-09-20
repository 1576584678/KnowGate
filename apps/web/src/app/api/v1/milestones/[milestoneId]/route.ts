import { NextResponse } from "next/server";
import { getMilestoneDetail } from "@/lib/content-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ milestoneId: string }> },
) {
  const { milestoneId } = await params;

  try {
    return NextResponse.json(getMilestoneDetail(milestoneId));
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        error: {
          code,
          message: "没有找到这个小关。",
        },
      },
      { status: code === "MILESTONE_NOT_FOUND" ? 404 : 400 },
    );
  }
}

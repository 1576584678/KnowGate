import { NextResponse } from "next/server";
import { getChapterDetail } from "@/lib/content-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chapterId: string }> },
) {
  const { chapterId } = await params;

  try {
    return NextResponse.json(getChapterDetail(chapterId));
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        error: {
          code,
          message: "没有找到这个章节。",
        },
      },
      { status: code === "CHAPTER_NOT_FOUND" ? 404 : 400 },
    );
  }
}

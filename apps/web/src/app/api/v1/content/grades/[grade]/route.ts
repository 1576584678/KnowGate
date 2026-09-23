import { NextResponse, type NextRequest } from "next/server";
import {
  getPublicRuntimeGradeGraph,
  getSupportedGrades,
} from "@/lib/content-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_CACHE_CONTROL =
  "public, max-age=60, s-maxage=600, stale-while-revalidate=86400";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ grade: string }> },
) {
  const { grade: rawGrade } = await params;
  const grade = Number(rawGrade);

  if (!Number.isInteger(grade) || !getSupportedGrades().includes(grade)) {
    return NextResponse.json(
      {
        error: {
          code: "GRADE_NOT_FOUND",
          message: "没有找到这个年级。",
        },
      },
      { status: 404 },
    );
  }

  const content = getPublicRuntimeGradeGraph(grade);
  const etag = `W/"${content.contentVersion}-g${grade}-${content.chapters.length}-${content.questions.length}"`;
  const headers = { ETag: etag, "Cache-Control": CONTENT_CACHE_CONTROL };

  const ifNoneMatch = request.headers.get("if-none-match");
  if (
    ifNoneMatch &&
    ifNoneMatch.split(",").some((candidate) => candidate.trim() === etag)
  ) {
    return new NextResponse(null, { status: 304, headers });
  }

  return NextResponse.json({ content }, { headers });
}

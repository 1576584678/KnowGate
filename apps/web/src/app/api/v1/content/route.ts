import { NextResponse, type NextRequest } from "next/server";
import { getPublicRuntimeContentGraph } from "@/lib/content-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_CACHE_CONTROL =
  "public, max-age=60, s-maxage=600, stale-while-revalidate=86400";

export async function GET(request: NextRequest) {
  const content = getPublicRuntimeContentGraph();
  const etag = `W/"${content.contentVersion}-${content.chapters.length}-${content.questions.length}-${content.bosses.length}"`;
  const headers = { ETag: etag, "Cache-Control": CONTENT_CACHE_CONTROL };

  const ifNoneMatch = request.headers.get("if-none-match");
  if (
    ifNoneMatch &&
    ifNoneMatch
      .split(",")
      .some((candidate) => candidate.trim() === etag)
  ) {
    return new NextResponse(null, { status: 304, headers });
  }

  return NextResponse.json({ content }, { headers });
}

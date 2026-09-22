import { NextResponse } from "next/server";
import { getGradeWorld } from "@/lib/content-api";
import { getPersistence } from "@/lib/persistence";
import {
  getProfileIdFromRequest,
  profileUnauthorizedResponse,
} from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gradeWorldId: string }> },
) {
  const { gradeWorldId } = await params;
  const profileId = getProfileIdFromRequest(request);
  if (!profileId) return profileUnauthorizedResponse();

  try {
    const progress = getPersistence().getProgress(profileId);
    return NextResponse.json(getGradeWorld(gradeWorldId, progress));
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        error: {
          code,
          message: "没有找到这个年级世界。",
        },
      },
      { status: code === "GRADE_WORLD_NOT_FOUND" ? 404 : 400 },
    );
  }
}

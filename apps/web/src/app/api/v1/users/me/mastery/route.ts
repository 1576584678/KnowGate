import { NextResponse } from "next/server";
import { getNodeMasteryReport } from "@/lib/learning-report";
import {
  getProfileIdFromRequest,
  profileUnauthorizedResponse,
} from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  if (!profileId) return profileUnauthorizedResponse();

  const searchParams = new URL(request.url).searchParams;
  const subject = searchParams.get("subject");
  const grade = searchParams.get("grade");

  if (
    (subject !== null && subject !== "math") ||
    (grade !== null && grade !== "4")
  ) {
    return NextResponse.json(
      {
        error: {
          code: "FILTER_NOT_SUPPORTED",
          message: "当前版本只支持四年级数学。",
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    nodes: getNodeMasteryReport(profileId),
  });
}

import { NextResponse } from "next/server";
import { getMathGradeContent } from "@/content/math-curriculum";
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
  const rawGrade = searchParams.get("grade");
  const grade = rawGrade === null ? 4 : Number(rawGrade);

  if (
    (subject !== null && subject !== "math") ||
    !Number.isInteger(grade) ||
    grade < 1 ||
    grade > 6
  ) {
    return NextResponse.json(
      {
        error: {
          code: "FILTER_NOT_SUPPORTED",
          message: "当前版本只支持小学一年级到六年级数学。",
        },
      },
      { status: 400 },
    );
  }

  const nodeIds = new Set(
    getMathGradeContent(grade).knowledgeNodes.map((node) => node.id),
  );

  return NextResponse.json({
    nodes: getNodeMasteryReport(profileId).filter((report) =>
      nodeIds.has(report.nodeId),
    ),
  });
}

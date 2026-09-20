import { NextResponse } from "next/server";
import {
  isValidProfileId,
  getProfileIdFromRequest,
} from "@/lib/profile";
import { getWeeklyStudentReport } from "@/lib/weekly-report";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;

  if (!isValidProfileId(studentId)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_STUDENT_ID",
          message: "学生档案 ID 格式不正确。",
        },
      },
      { status: 400 },
    );
  }

  const profileId = getProfileIdFromRequest(request);
  if (studentId !== profileId) {
    return NextResponse.json(
      {
        error: {
          code: "STUDENT_ACCESS_DENIED",
          message: "当前账号无权读取该学生周报。",
        },
      },
      { status: 403 },
    );
  }

  const weekStart = new URL(request.url).searchParams.get("weekStart");

  try {
    return NextResponse.json(
      getWeeklyStudentReport(profileId, { weekStart }),
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    return NextResponse.json(
      {
        error: {
          code,
          message:
            code === "INVALID_WEEK_START"
              ? "周报起始日期格式不正确。"
              : "无法生成学生周报。",
        },
      },
      { status: code === "INVALID_WEEK_START" ? 400 : 500 },
    );
  }
}

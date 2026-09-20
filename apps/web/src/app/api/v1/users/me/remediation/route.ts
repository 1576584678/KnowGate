import { NextResponse } from "next/server";
import { getRemediationPlan } from "@/lib/learning-report";
import { getProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  const nodeId = new URL(request.url).searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json(
      {
        error: {
          code: "NODE_REQUIRED",
          message: "缺少知识节点 ID。",
        },
      },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(getRemediationPlan(profileId, nodeId));
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json(
      {
        error: {
          code,
          message: "没有找到可用的补课路径。",
        },
      },
      { status: code === "NODE_NOT_FOUND" ? 404 : 400 },
    );
  }
}

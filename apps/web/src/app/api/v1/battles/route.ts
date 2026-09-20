import { NextResponse } from "next/server";
import { toPublicBattleState, type BattleMode } from "@knowgate/domain";
import { createMilestoneBattle } from "@/lib/battle-store";
import { getProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const profileId = getProfileIdFromRequest(request);
    const body = (await request.json()) as {
      milestoneId?: string;
      mode?: BattleMode;
      extendedTime?: boolean;
    };

    if (!body.milestoneId) {
      return NextResponse.json(
        { error: { code: "MILESTONE_REQUIRED", message: "缺少小关 ID。" } },
        { status: 400 },
      );
    }

    if (body.mode !== "standard" && body.mode !== "learning") {
      return NextResponse.json(
        { error: { code: "INVALID_MODE", message: "未知的战斗模式。" } },
        { status: 400 },
      );
    }

    const session = createMilestoneBattle({
      profileId,
      milestoneId: body.milestoneId,
      mode: body.mode,
      extendedTime: body.extendedTime === true,
    });

    return NextResponse.json(toPublicBattleState(session), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      code === "MILESTONE_NOT_FOUND"
        ? 404
        : code === "MILESTONE_LOCKED" || code === "PREVIOUS_MILESTONE_LOCKED"
          ? 403
          : 409;
    const message =
      code === "MILESTONE_LOCKED"
        ? "先完成本小关的全部学习章节。"
        : code === "PREVIOUS_MILESTONE_LOCKED"
          ? "先击败上一关的 Boss 才能继续。"
          : "无法创建这场挑战。";
    return NextResponse.json(
      { error: { code, message } },
      { status },
    );
  }
}

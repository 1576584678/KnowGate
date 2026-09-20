import { NextResponse } from "next/server";
import { toPublicBattleState, type BattleMode } from "@knowgate/domain";
import { createMilestoneBattle } from "@/lib/battle-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      milestoneId?: string;
      mode?: BattleMode;
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
      milestoneId: body.milestoneId,
      mode: body.mode,
    });

    return NextResponse.json(toPublicBattleState(session), { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = code === "MILESTONE_NOT_FOUND" ? 404 : 409;
    return NextResponse.json(
      { error: { code, message: "无法创建这场挑战。" } },
      { status },
    );
  }
}

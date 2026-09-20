import { NextResponse } from "next/server";
import { toPublicBattleState } from "@knowgate/domain";
import { getBattle } from "@/lib/battle-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params;
  const session = getBattle(battleId);

  if (!session) {
    return NextResponse.json(
      {
        error: {
          code: "BATTLE_NOT_FOUND",
          message: "没有找到这场挑战。",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json(toPublicBattleState(session));
}

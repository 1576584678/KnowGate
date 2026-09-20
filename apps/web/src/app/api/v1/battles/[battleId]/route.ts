import { NextResponse } from "next/server";
import { toPublicBattleState } from "@knowgate/domain";
import { getBattle } from "@/lib/battle-store";
import { getProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params;
  const profileId = getProfileIdFromRequest(request);
  const session = getBattle(profileId, battleId);

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

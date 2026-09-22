import { NextResponse } from "next/server";
import { abandonBattle } from "@/lib/battle-store";
import {
  getProfileIdFromRequest,
  profileUnauthorizedResponse,
} from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ battleId: string }> },
) {
  const { battleId } = await params;
  const profileId = getProfileIdFromRequest(request);
  if (!profileId) return profileUnauthorizedResponse();

  try {
    return NextResponse.json(abandonBattle(profileId, battleId));
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = code === "BATTLE_NOT_FOUND" ? 404 : 409;
    return NextResponse.json(
      { error: { code, message: "无法放弃这场挑战。" } },
      { status },
    );
  }
}

import { NextResponse } from "next/server";
import {
  PROFILE_COOKIE,
  createProfileSession,
  getProfileIdFromRequest,
  profileNotConfiguredResponse,
  profileSessionCookieOptions,
} from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const existingProfileId = getProfileIdFromRequest(request);
  if (existingProfileId) {
    return NextResponse.json({ profileId: existingProfileId });
  }

  try {
    const profileId = crypto.randomUUID();
    const session = createProfileSession(profileId);
    const response = NextResponse.json({ profileId });
    response.cookies.set({
      name: PROFILE_COOKIE,
      value: session.token,
      ...profileSessionCookieOptions(),
      maxAge: session.maxAge,
    });
    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROFILE_NOT_CONFIGURED"
    ) {
      return profileNotConfiguredResponse();
    }

    return NextResponse.json(
      {
        error: {
          code: "PROFILE_SESSION_FAILED",
          message: "无法初始化学习档案。",
        },
      },
      { status: 500 },
    );
  }
}

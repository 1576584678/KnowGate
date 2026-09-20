import { NextResponse } from "next/server";
import { getPersistence } from "@/lib/persistence";
import { getProfileIdFromRequest } from "@/lib/profile";

export const runtime = "nodejs";

// Progress is server-authoritative: chapters can only be completed through the
// graded chapter endpoint, and Boss outcomes can only be recorded by answering a
// battle session. This route intentionally exposes reads and an explicit reset
// for the current device profile, but never accepts direct progress writes.
export async function GET(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  const progress = getPersistence().getProgress(profileId);
  return NextResponse.json({ progress });
}

export async function DELETE(request: Request) {
  const profileId = getProfileIdFromRequest(request);
  const persistence = getPersistence();
  persistence.resetProgress(profileId);
  return NextResponse.json({ progress: persistence.getProgress(profileId) });
}

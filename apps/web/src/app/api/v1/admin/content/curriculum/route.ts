import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { getCurriculumPlan } from "@/lib/curriculum";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request, "content:read");
  if (unauthorized) return unauthorized;

  return NextResponse.json(getCurriculumPlan());
}

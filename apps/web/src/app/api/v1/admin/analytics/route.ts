import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { getProductMetrics } from "@/lib/analytics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  return NextResponse.json(getProductMetrics());
}

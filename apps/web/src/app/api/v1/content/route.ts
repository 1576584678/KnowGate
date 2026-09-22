import { NextResponse } from "next/server";
import { getPublicRuntimeContentGraph } from "@/lib/content-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { content: getPublicRuntimeContentGraph() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

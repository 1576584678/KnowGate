import { NextResponse } from "next/server";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The learning client needs the full runtime graph (including answer keys for
// instant in-step feedback), matching what the static content module used to
// bundle. Published drafts are therefore resolved here before they reach the UI.
export async function GET() {
  return NextResponse.json(
    { content: buildRuntimeContentGraph() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

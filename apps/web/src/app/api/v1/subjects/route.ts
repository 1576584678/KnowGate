import { NextResponse } from "next/server";
import { getSubjects } from "@/lib/content-api";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ subjects: getSubjects() });
}

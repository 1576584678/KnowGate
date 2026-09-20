import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/admin-auth";
import { validateContentGraph } from "@/lib/content-validation";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = requireAdminRequest(request);
  if (unauthorized) return unauthorized;

  const issues = validateContentGraph(buildRuntimeContentGraph());
  return NextResponse.json({
    valid: issues.every((issue) => issue.severity !== "error"),
    issueCount: issues.length,
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  });
}

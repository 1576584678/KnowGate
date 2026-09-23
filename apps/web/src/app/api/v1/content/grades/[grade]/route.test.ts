import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

function gradeRequest(grade: string, headers?: Record<string, string>) {
  return new Request(`http://localhost/api/v1/content/grades/${grade}`, {
    headers,
  }) as unknown as NextRequest;
}

function context(grade: string) {
  return { params: Promise.resolve({ grade }) };
}

describe("grade content route", () => {
  it("returns only the requested grade and stays cacheable", async () => {
    const response = await GET(gradeRequest("2"), context("2"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=600");

    const payload = (await response.json()) as {
      content: {
        milestones: { id: string }[];
        chapters: { id: string }[];
        questions: unknown[];
        worlds: unknown[];
      };
    };

    expect(payload.content.milestones.length).toBeGreaterThan(0);
    expect(
      payload.content.milestones.every((milestone) =>
        milestone.id.startsWith("math.g2."),
      ),
    ).toBe(true);
    expect(payload.content.chapters.length).toBeGreaterThan(0);
    expect(payload.content.questions.length).toBeGreaterThan(0);
    expect(payload.content.worlds).toHaveLength(6);
  });

  it("rejects unsupported grades", async () => {
    const response = await GET(gradeRequest("7"), context("7"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "GRADE_NOT_FOUND" },
    });
  });

  it("answers revalidation with 304 when the validator matches", async () => {
    const initial = await GET(gradeRequest("3"), context("3"));
    const etag = initial.headers.get("etag");
    expect(etag).toBeTruthy();

    const revalidated = await GET(
      gradeRequest("3", { "if-none-match": etag as string }),
      context("3"),
    );

    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get("etag")).toBe(etag);
  });
});

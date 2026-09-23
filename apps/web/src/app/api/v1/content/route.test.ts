import type { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "./route";

function contentRequest(headers?: Record<string, string>) {
  return new Request("http://localhost/api/v1/content", {
    headers,
  }) as unknown as NextRequest;
}

describe("content route", () => {
  it("serves cacheable content with a stable validator", async () => {
    const response = await GET(contentRequest());

    expect(response.status).toBe(200);
    const etag = response.headers.get("etag");
    expect(etag).toBeTruthy();
    expect(response.headers.get("cache-control")).toContain("s-maxage=600");

    await expect(response.json()).resolves.toMatchObject({
      content: { contentVersion: expect.any(String) },
    });
  });

  it("answers revalidation with 304 when the validator matches", async () => {
    const initial = await GET(contentRequest());
    const etag = initial.headers.get("etag");
    expect(etag).toBeTruthy();

    const revalidated = await GET(
      contentRequest({ "if-none-match": etag as string }),
    );

    expect(revalidated.status).toBe(304);
    expect(revalidated.headers.get("etag")).toBe(etag);
    expect(revalidated.headers.get("cache-control")).toContain("s-maxage=600");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("learning event route", () => {
  it("rejects malformed JSON with a client error", async () => {
    vi.stubEnv("KNOWGATE_ALLOW_UNSIGNED_PROFILE_HEADER", "1");
    const response = await POST(
      new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-knowgate-profile-id": "student.event.1",
        },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_EVENT" },
    });
  });

  it("rejects events without a signed profile session", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType: "page_viewed",
          entityType: "page",
          entityId: "home",
        }),
      }),
    );

    expect(response.status).toBe(401);
  });
});

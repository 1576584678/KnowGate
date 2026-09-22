import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/admin-auth", () => ({
  getAdminOperatorId: () => "publisher.test",
  requireAdminRequest: () => null,
}));

describe("content publications route", () => {
  it("rejects unknown publication actions", async () => {
    const response = await POST(
      new Request(
        "http://localhost/api/v1/admin/content/publications",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "delete_everything",
            snapshotId: "snapshot.test",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_PUBLICATION_ACTION" },
    });
  });
});

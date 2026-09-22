import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PROFILE_COOKIE,
  PROFILE_HEADER,
  createProfileSession,
  getProfileIdFromRequest,
  profileSessionCookieOptions,
} from "./profile";

function requestWithCookie(token: string) {
  return new Request("http://localhost/api/v1/progress", {
    headers: {
      cookie: `${PROFILE_COOKIE}=${encodeURIComponent(token)}`,
    },
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("profile sessions", () => {
  it("accepts a signed session cookie", () => {
    const profileId = "student.signed.1";
    const session = createProfileSession(profileId);
    const request = requestWithCookie(session.token);

    expect(getProfileIdFromRequest(request)).toBe(profileId);
    expect(profileSessionCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  });

  it("rejects forged or malformed session cookies", () => {
    const session = createProfileSession("student.signed.2");
    const forged = `${session.token.slice(0, -1)}${
      session.token.endsWith("a") ? "b" : "a"
    }`;
    const malformed = new Request("http://localhost/api/v1/progress", {
      headers: { cookie: `${PROFILE_COOKIE}=%E0%A4%A` },
    });

    expect(getProfileIdFromRequest(requestWithCookie(forged))).toBeNull();
    expect(getProfileIdFromRequest(malformed)).toBeNull();
  });

  it("does not trust the unsigned profile header by default", () => {
    vi.stubEnv("KNOWGATE_ALLOW_UNSIGNED_PROFILE_HEADER", "0");
    const request = new Request("http://localhost/api/v1/progress", {
      headers: { [PROFILE_HEADER]: "student.header.1" },
    });

    expect(getProfileIdFromRequest(request)).toBeNull();
  });

  it("supports the legacy header only in non-production with an explicit flag", () => {
    vi.stubEnv("KNOWGATE_ALLOW_UNSIGNED_PROFILE_HEADER", "1");
    const request = new Request("http://localhost/api/v1/progress", {
      headers: { [PROFILE_HEADER]: "student.header.2" },
    });

    expect(getProfileIdFromRequest(request)).toBe("student.header.2");

    vi.stubEnv("NODE_ENV", "production");
    expect(getProfileIdFromRequest(request)).toBeNull();
  });

  it("requires an explicit secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KNOWGATE_PROFILE_SESSION_SECRET", "");

    expect(() => createProfileSession("student.production")).toThrow(
      "PROFILE_NOT_CONFIGURED",
    );
  });
});

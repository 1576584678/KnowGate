import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_COOKIE,
  authenticateAdminUser,
  getAdminOperatorId,
  getAdminSession,
  hasAdminPermission,
  requireAdminRequest,
} from "./admin-auth";

const TOTP_SECRET = "JBSWY3DPEHPK3PXP";

const configuredUsers = [
  {
    userId: "user-author",
    email: "author@knowgate.local",
    displayName: "作者",
    roles: ["author"],
    passwordHash: "development:author-password",
    totpSecret: TOTP_SECRET,
  },
  {
    userId: "user-reviewer",
    email: "reviewer@knowgate.local",
    displayName: "审核",
    roles: ["reviewer"],
    passwordHash: "development:reviewer-password",
    totpSecret: TOTP_SECRET,
  },
  {
    userId: "user-publisher",
    email: "publisher@knowgate.local",
    displayName: "发布",
    roles: ["publisher"],
    passwordHash: "development:publisher-password",
    totpSecret: TOTP_SECRET,
  },
];

function base32Decode(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/=+$/u, "");
  let bits = "";

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("invalid base32");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(buffer)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    (((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff)) %
    1_000_000;
  return code.toString().padStart(6, "0");
}

function login(email: string, password: string) {
  return authenticateAdminUser({
    email,
    password,
    totp: currentTotp(TOTP_SECRET),
  });
}

function requestWithSession(token: string, extraHeaders: Record<string, string> = {}) {
  return new Request("http://localhost/api/v1/admin/content/drafts", {
    headers: {
      cookie: `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
      ...extraHeaders,
    },
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv(
    "KNOWGATE_ADMIN_USERS",
    JSON.stringify(configuredUsers),
  );
  vi.stubEnv(
    "KNOWGATE_ADMIN_SESSION_SECRET",
    "test-session-secret-please-change",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("admin session authentication", () => {
  it("maps roles to permissions without granting everything", () => {
    const author = login("author@knowgate.local", "author-password");
    const reviewer = login("reviewer@knowgate.local", "reviewer-password");
    const publisher = login(
      "publisher@knowgate.local",
      "publisher-password",
    );

    expect(hasAdminPermission(author.session, "content:write")).toBe(true);
    expect(hasAdminPermission(author.session, "content:publish")).toBe(false);
    expect(hasAdminPermission(author.session, "content:review")).toBe(false);

    expect(hasAdminPermission(reviewer.session, "content:review")).toBe(true);
    expect(hasAdminPermission(reviewer.session, "content:publish")).toBe(false);

    expect(hasAdminPermission(publisher.session, "content:publish")).toBe(
      true,
    );
    expect(hasAdminPermission(publisher.session, "content:review")).toBe(
      false,
    );
    expect(hasAdminPermission(publisher.session, "content:write")).toBe(false);
  });

  it("rejects an invalid password or dynamic code", () => {
    expect(() =>
      authenticateAdminUser({
        email: "author@knowgate.local",
        password: "wrong-password",
        totp: currentTotp(TOTP_SECRET),
      }),
    ).toThrow("ADMIN_INVALID_CREDENTIALS");
    expect(() =>
      authenticateAdminUser({
        email: "author@knowgate.local",
        password: "author-password",
        totp: "000000",
      }),
    ).toThrow("ADMIN_MFA_INVALID");
  });

  it("derives the operator identity from the session, not request headers", () => {
    const author = login("author@knowgate.local", "author-password");
    const request = requestWithSession(author.token, {
      "x-knowgate-operator-id": "attacker",
    });

    expect(getAdminOperatorId(request)).toBe("user-author");
    expect(getAdminSession(request)?.userId).toBe("user-author");
  });

  it("returns 401, 403, and 503 for the right situations", () => {
    expect(requireAdminRequest(new Request("http://localhost"))?.status).toBe(
      401,
    );

    const author = login("author@knowgate.local", "author-password");
    expect(
      requireAdminRequest(
        requestWithSession(author.token),
        "content:publish",
      )?.status,
    ).toBe(403);

    const publisher = login(
      "publisher@knowgate.local",
      "publisher-password",
    );
    expect(
      requireAdminRequest(
        requestWithSession(publisher.token),
        "content:publish",
      ),
    ).toBeNull();

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KNOWGATE_ADMIN_SESSION_SECRET", "");
    expect(requireAdminRequest(new Request("http://localhost"))?.status).toBe(
      503,
    );
  });
});

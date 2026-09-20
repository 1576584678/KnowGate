import {
  createHmac,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { NextResponse } from "next/server";

export const ADMIN_SESSION_COOKIE = "knowgate_admin_session";

export type AdminRole = "author" | "reviewer" | "publisher" | "admin";

export type AdminPermission =
  | "content:read"
  | "content:write"
  | "content:review"
  | "content:publish"
  | "analytics:read";

export type AdminSession = {
  userId: string;
  email: string;
  displayName: string;
  roles: AdminRole[];
  issuedAt: string;
  expiresAt: string;
};

type AdminUser = AdminSession & {
  passwordHash: string;
  totpSecret: string;
};

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  roles: AdminRole[];
  iat: number;
  exp: number;
};

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const DEVELOPMENT_SESSION_SECRET =
  "knowgate-development-session-secret-change-me";

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  author: ["content:read", "content:write"],
  reviewer: ["content:read", "content:review"],
  publisher: ["content:read", "content:publish"],
  admin: [
    "content:read",
    "content:write",
    "content:review",
    "content:publish",
    "analytics:read",
  ],
};

function developmentUsers(): AdminUser[] {
  if (process.env.NODE_ENV === "production") return [];

  return [
    {
      userId: "e2e-admin",
      email: "admin@knowgate.local",
      displayName: "课程管理员",
      roles: ["admin"],
      passwordHash: "development:local-admin",
      totpSecret: "JBSWY3DPEHPK3PXP",
      issuedAt: "",
      expiresAt: "",
    },
  ];
}

function configuredUsers(): AdminUser[] {
  const raw = process.env.KNOWGATE_ADMIN_USERS?.trim();
  if (!raw) return developmentUsers();

  const parsed = JSON.parse(raw) as Array<{
    id?: string;
    userId?: string;
    email?: string;
    displayName?: string;
    roles?: AdminRole[];
    passwordHash?: string;
    totpSecret?: string;
  }>;

  return parsed.map((user) => {
    const roles = (user.roles ?? []).filter((role) =>
      ["author", "reviewer", "publisher", "admin"].includes(role),
    );
    if (
      !user.email ||
      !user.passwordHash ||
      !user.totpSecret ||
      roles.length === 0
    ) {
      throw new Error("ADMIN_USER_CONFIGURATION_INVALID");
    }

    return {
      userId: user.userId ?? user.id ?? user.email,
      email: user.email.trim().toLowerCase(),
      displayName: user.displayName?.trim() || user.email,
      roles,
      passwordHash: user.passwordHash,
      totpSecret: user.totpSecret,
      issuedAt: "",
      expiresAt: "",
    };
  });
}

function sessionSecret() {
  const configured = process.env.KNOWGATE_ADMIN_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return DEVELOPMENT_SESSION_SECRET;
}

function encode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function verifyPassword(password: string, passwordHash: string) {
  if (passwordHash.startsWith("development:")) {
    return (
      process.env.NODE_ENV !== "production" &&
      safeEqual(password, passwordHash.slice("development:".length))
    );
  }

  const [algorithm, salt, expected] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return safeEqual(actual, expected);
}

function base32Decode(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const normalized = value.toUpperCase().replace(/=+$/u, "");
  let bits = "";

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("ADMIN_MFA_CONFIGURATION_INVALID");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(secret: string, counter: number) {
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

function verifyTotp(secret: string, code: string) {
  const normalized = code.trim();
  if (!/^\d{6}$/u.test(normalized)) return false;
  const counter = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((offset) =>
    safeEqual(totpCode(secret, counter + offset), normalized),
  );
}

function encodeSession(session: AdminSession, secret: string) {
  const payload: SessionPayload = {
    sub: session.userId,
    email: session.email,
    name: session.displayName,
    roles: session.roles,
    iat: Math.floor(new Date(session.issuedAt).getTime() / 1000),
    exp: Math.floor(new Date(session.expiresAt).getTime() / 1000),
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

function decodeSession(token: string, secret: string): AdminSession | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!safeEqual(signPayload(encodedPayload, secret), signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (
      !payload.sub ||
      !payload.email ||
      !Array.isArray(payload.roles) ||
      payload.exp * 1000 <= Date.now()
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      displayName: payload.name,
      roles: payload.roles,
      issuedAt: new Date(payload.iat * 1000).toISOString(),
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}

function cookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export function getAdminSession(request: Request): AdminSession | null {
  const secret = sessionSecret();
  const token = cookieValue(request);
  if (!secret || !token) return null;
  return decodeSession(token, secret);
}

export function hasAdminPermission(
  session: AdminSession,
  permission: AdminPermission,
) {
  return session.roles.some((role) =>
    ROLE_PERMISSIONS[role].includes(permission),
  );
}

export function requireAdminRequest(
  request: Request,
  permission: AdminPermission = "content:read",
) {
  if (!sessionSecret()) {
    return NextResponse.json(
      {
        error: {
          code: "ADMIN_NOT_CONFIGURED",
          message: "内容后台尚未配置会话密钥。",
        },
      },
      { status: 503 },
    );
  }

  const session = getAdminSession(request);
  if (!session) {
    return NextResponse.json(
      {
        error: {
          code: "ADMIN_UNAUTHORIZED",
          message: "管理端会话已失效，请重新登录。",
        },
      },
      { status: 401 },
    );
  }

  if (!hasAdminPermission(session, permission)) {
    return NextResponse.json(
      {
        error: {
          code: "ADMIN_FORBIDDEN",
          message: "当前账号没有执行这个操作的权限。",
        },
      },
      { status: 403 },
    );
  }

  return null;
}

export function getAdminOperatorId(request: Request) {
  const session = getAdminSession(request);
  if (!session) throw new Error("ADMIN_UNAUTHORIZED");
  return session.userId;
}

export function authenticateAdminUser(input: {
  email: string;
  password: string;
  totp: string;
}) {
  const email = input.email.trim().toLowerCase();
  const user = configuredUsers().find((item) => item.email === email);
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new Error("ADMIN_INVALID_CREDENTIALS");
  }
  if (!verifyTotp(user.totpSecret, input.totp)) {
    throw new Error("ADMIN_MFA_INVALID");
  }

  const issuedAt = new Date();
  const expiresAt = new Date(
    issuedAt.getTime() + SESSION_TTL_SECONDS * 1000,
  );
  const session: AdminSession = {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_NOT_CONFIGURED");

  return {
    session,
    token: encodeSession(session, secret),
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const DEFAULT_PROFILE_ID = "local-demo";
export const PROFILE_COOKIE = "knowgate_profile";
export const PROFILE_HEADER = "x-knowgate-profile-id";

const PROFILE_ID_PATTERN = /^[a-zA-Z0-9._:-]{1,128}$/;
const DEVELOPMENT_SESSION_SECRET =
  "knowgate-development-profile-session-secret-change-me";
const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60;

type ProfileSessionPayload = {
  sub: string;
  iat: number;
  exp: number;
};

export function isValidProfileId(value: string | null | undefined) {
  const candidate = value?.trim();
  return Boolean(candidate && PROFILE_ID_PATTERN.test(candidate));
}

export function normalizeProfileId(value: string | null | undefined) {
  const candidate = value?.trim();
  return isValidProfileId(candidate) ? candidate! : DEFAULT_PROFILE_ID;
}

function profileSessionSecret() {
  const configured = process.env.KNOWGATE_PROFILE_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return null;
  return DEVELOPMENT_SESSION_SECRET;
}

function allowUnsignedProfileHeader() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.KNOWGATE_ALLOW_UNSIGNED_PROFILE_HEADER === "1"
  );
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

function cookieValue(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === PROFILE_COOKIE) {
      try {
        return decodeURIComponent(rest.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function encodeProfileSession(profileId: string, secret: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: ProfileSessionPayload = {
    sub: profileId,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}

function decodeProfileSession(token: string, secret: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;
  if (!safeEqual(signPayload(encodedPayload, secret), signature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as ProfileSessionPayload;
    if (!isValidProfileId(payload.sub)) return null;
    if (
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload.sub;
  } catch {
    return null;
  }
}

export function createProfileSession(profileId: string) {
  const secret = profileSessionSecret();
  if (!secret) throw new Error("PROFILE_NOT_CONFIGURED");
  if (!isValidProfileId(profileId)) throw new Error("INVALID_PROFILE_ID");

  return {
    token: encodeProfileSession(profileId, secret),
    maxAge: SESSION_TTL_SECONDS,
  };
}

export function getProfileIdFromRequest(request: Request) {
  const secret = profileSessionSecret();
  const token = cookieValue(request);
  if (secret && token) {
    const profileId = decodeProfileSession(token, secret);
    if (profileId) return profileId;
  }

  if (allowUnsignedProfileHeader()) {
    return normalizeProfileId(request.headers.get(PROFILE_HEADER));
  }

  return null;
}

export function profileUnauthorizedResponse() {
  return NextResponse.json(
    {
      error: {
        code: "PROFILE_UNAUTHORIZED",
        message: "学习档案尚未初始化，请刷新页面后重试。",
      },
    },
    { status: 401 },
  );
}

export function profileNotConfiguredResponse() {
  return NextResponse.json(
    {
      error: {
        code: "PROFILE_NOT_CONFIGURED",
        message: "学习档案服务尚未配置。",
      },
    },
    { status: 503 },
  );
}

export function profileSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

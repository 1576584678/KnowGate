import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  authenticateAdminUser,
  getAdminSession,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
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

  return NextResponse.json({ session });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      totp?: string;
    };

    if (
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      typeof body.totp !== "string"
    ) {
      return NextResponse.json(
        {
          error: {
            code: "ADMIN_LOGIN_INVALID",
            message: "邮箱、密码和动态验证码不能为空。",
          },
        },
        { status: 400 },
      );
    }

    const authenticated = authenticateAdminUser({
      email: body.email,
      password: body.password,
      totp: body.totp,
    });
    const response = NextResponse.json({
      session: authenticated.session,
    });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: authenticated.token,
      ...adminSessionCookieOptions(),
      maxAge: authenticated.maxAge,
    });
    return response;
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      code === "ADMIN_NOT_CONFIGURED"
        ? 503
        : code === "ADMIN_MFA_CONFIGURATION_INVALID"
          ? 500
          : 401;
    const message =
      code === "ADMIN_MFA_INVALID"
        ? "动态验证码不正确。"
        : code === "ADMIN_NOT_CONFIGURED"
          ? "管理端认证尚未配置。"
          : "邮箱、密码或动态验证码不正确。";

    return NextResponse.json({ error: { code, message } }, { status });
  }
}

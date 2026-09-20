import { NextResponse } from "next/server";

export const ADMIN_TOKEN_HEADER = "x-knowgate-admin-token";
export const OPERATOR_HEADER = "x-knowgate-operator-id";

function configuredAdminToken() {
  return process.env.KNOWGATE_ADMIN_TOKEN?.trim() || null;
}

function developmentAdminToken() {
  return process.env.NODE_ENV === "production" ? null : "local-admin";
}

export function getAdminOperatorId(request: Request) {
  const operatorId = request.headers.get(OPERATOR_HEADER)?.trim();
  return operatorId && operatorId.length <= 128 ? operatorId : "content-admin";
}

export function requireAdminRequest(request: Request) {
  const expected = configuredAdminToken() ?? developmentAdminToken();

  if (!expected) {
    return NextResponse.json(
      {
        error: {
          code: "ADMIN_NOT_CONFIGURED",
          message: "内容后台尚未配置管理员令牌。",
        },
      },
      { status: 503 },
    );
  }

  const provided = request.headers.get(ADMIN_TOKEN_HEADER)?.trim();
  if (provided !== expected) {
    return NextResponse.json(
      {
        error: {
          code: "ADMIN_UNAUTHORIZED",
          message: "当前请求无权访问内容后台。",
        },
      },
      { status: 401 },
    );
  }

  return null;
}

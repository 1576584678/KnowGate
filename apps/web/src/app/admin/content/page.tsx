"use client";

import {
  Activity,
  AlertTriangle,
  Check,
  ClipboardCheck,
  FilePlus2,
  FlaskConical,
  GitBranch,
  LogOut,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  ContentDraft,
  ContentDraftKind,
  ContentDraftStatus,
  ContentReviewRecord,
} from "@knowgate/domain";
import { PageIntro, StatusPill } from "@/components/ui";

type DraftWithReviews = ContentDraft & { reviews: ContentReviewRecord[] };

type ValidationIssue = {
  severity: "error" | "warning";
  code: string;
  entityType: string;
  entityId: string;
  message: string;
};

type CurriculumPlan = {
  contentVersion: string;
  totalStages: number;
  stages: Array<{
    stageNo: number;
    name: string;
    theme: string;
    chapters: Array<{ id: string; title: string }>;
    boss: { id: string; questionCount: number } | null;
  }>;
  validation: {
    valid: boolean;
    issueCount: number;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  };
};

type Metrics = {
  profiles: { active: number; withProgress: number };
  acquisition: { pageViews: number };
  chapters: {
    started: number;
    completed: number;
    completionRate: number;
    averageDurationSec: number;
    answerAccuracy: number;
  };
  bosses: {
    started: number;
    won: number;
    lost: number;
    winRate: number;
    questionAccuracy: number;
  };
  remediation: { started: number; completed: number; completionRate: number };
  reports: { viewed: number };
};

type AdminSession = {
  userId: string;
  email: string;
  displayName: string;
  roles: string[];
};

const draftKinds: ContentDraftKind[] = [
  "knowledge_node",
  "chapter",
  "boss",
  "question_template",
  "curriculum",
];

async function readPayload(response: Response) {
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined;
    const requestError = new Error(error?.message ?? "请求失败。") as Error & {
      status?: number;
    };
    requestError.status = response.status;
    throw requestError;
  }
  return payload;
}

export default function AdminContentPage() {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loginEmail, setLoginEmail] = useState("admin@knowgate.local");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginTotp, setLoginTotp] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState<DraftWithReviews[]>([]);
  const [curriculum, setCurriculum] = useState<CurriculumPlan | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [kind, setKind] = useState<ContentDraftKind>("chapter");
  const [title, setTitle] = useState("");
  const [payloadText, setPayloadText] = useState("{}");
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/v1/admin/auth/login", {
          credentials: "same-origin",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          session: AdminSession;
        };
        if (!cancelled) setSession(payload.session);
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    setNotice("");

    try {
      const [draftsResponse, curriculumResponse, metricsResponse] =
        await Promise.all([
          fetch("/api/v1/admin/content/drafts", {
            credentials: "same-origin",
          }),
          fetch("/api/v1/admin/content/curriculum", {
            credentials: "same-origin",
          }),
          fetch("/api/v1/admin/analytics", {
            credentials: "same-origin",
          }),
        ]);
      const [draftsPayload, curriculumPayload, metricsPayload] =
        await Promise.all([
          readPayload(draftsResponse),
          readPayload(curriculumResponse),
          readPayload(metricsResponse),
        ]);

      setDrafts((draftsPayload.drafts as DraftWithReviews[]) ?? []);
      setCurriculum(curriculumPayload as unknown as CurriculumPlan);
      setMetrics(metricsPayload as unknown as Metrics);
      setNotice("后台数据已刷新。");
    } catch (caught) {
      if (
        caught instanceof Error &&
        (caught as Error & { status?: number }).status === 401
      ) {
        setSession(null);
        return;
      }
      setError(caught instanceof Error ? caught.message : "无法读取后台数据。");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) void loadAdminData();
  }, [session, loadAdminData]);

  async function login() {
    setError("");
    setNotice("");
    setLoggingIn(true);

    try {
      const response = await fetch("/api/v1/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          totp: loginTotp,
        }),
      });
      const payload = await readPayload(response);
      setSession(payload.session as AdminSession);
      setLoginPassword("");
      setLoginTotp("");
      setNotice("管理端登录成功。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法登录管理端。");
    } finally {
      setLoggingIn(false);
    }
  }

  async function logout() {
    setError("");
    setNotice("");

    try {
      await fetch("/api/v1/admin/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      setSession(null);
      setDrafts([]);
      setCurriculum(null);
      setMetrics(null);
    }
  }

  async function createDraft() {
    setError("");
    setNotice("");

    try {
      const payload = JSON.parse(payloadText) as Record<string, unknown>;
      const response = await fetch("/api/v1/admin/content/drafts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          payload,
        }),
      });
      await readPayload(response);
      setTitle("");
      setPayloadText("{}");
      setNotice("草稿已创建。");
      await loadAdminData();
    } catch (caught) {
      setError(
        caught instanceof SyntaxError
          ? "草稿 JSON 格式不正确。"
          : caught instanceof Error
            ? caught.message
            : "无法创建草稿。",
      );
    }
  }

  async function reviewDraft(
    draftId: string,
    action: "submit" | "approve" | "reject" | "publish",
  ) {
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `/api/v1/admin/content/drafts/${draftId}/review`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            note: notes[draftId] || undefined,
          }),
        },
      );
      await readPayload(response);
      setNotice(`草稿已执行 ${action}。`);
      await loadAdminData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "审核操作失败。");
    }
  }

  async function generateQuestions() {
    setError("");
    setNotice("");

    try {
      const response = await fetch(
        "/api/v1/admin/content/questions/generate",
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seed: 20260920,
            questionCount: 10,
            idPrefix: `question.preview.${Date.now()}`,
          }),
        },
      );
      const payload = await readPayload(response);
      const questions = Array.isArray(payload.questions) ? payload.questions : [];
      setNotice(`已确定性生成 ${questions.length} 道题。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "出题失败。");
    }
  }

  if (checkingSession) {
    return (
      <div className="page-shell admin-page">
        <PageIntro
          eyebrow="内容运营"
          title="课程内容后台"
          description="正在验证管理端会话。"
        />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="page-shell admin-page">
        <PageIntro
          eyebrow="内容运营"
          title="课程内容后台"
          description="使用已授权账号和动态验证码进入内容管理。"
        />
        <section className="admin-auth-card" aria-label="管理端登录">
          <div className="section-heading">
            <div>
              <span className="eyebrow">受控访问</span>
              <h2>管理员登录</h2>
            </div>
            <ShieldCheck size={24} aria-hidden="true" />
          </div>
          <div className="draft-form">
            <label>
              <span>邮箱</span>
              <input
                autoComplete="username"
                onChange={(event) => setLoginEmail(event.target.value)}
                type="email"
                value={loginEmail}
              />
            </label>
            <label>
              <span>密码</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
                value={loginPassword}
              />
            </label>
            <label>
              <span>动态验证码</span>
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setLoginTotp(event.target.value)}
                value={loginTotp}
              />
            </label>
            <button
              className="button button--primary button--wide"
              disabled={
                loggingIn ||
                !loginEmail.trim() ||
                !loginPassword ||
                !/^\d{6}$/u.test(loginTotp)
              }
              onClick={() => void login()}
              type="button"
            >
              <ShieldCheck size={17} aria-hidden="true" />
              {loggingIn ? "验证中" : "登录"}
            </button>
          </div>
        </section>
        {error ? (
          <div className="feedback" data-tone="error" role="alert">
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>登录没有完成</strong>
              <p>{error}</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page-shell admin-page">
      <PageIntro
        eyebrow="内容运营"
        title="课程内容后台"
        description="管理内容草稿、课程编排、图谱校验、参数化出题与人工审核。"
        aside={
          <StatusPill
            tone={curriculum?.validation.valid ? "success" : "warning"}
          >
            {curriculum?.validation.valid ? "图谱可发布" : "图谱待修复"}
          </StatusPill>
        }
      />

      <section className="admin-toolbar">
        <div className="admin-operator">
          <UserRound size={20} aria-hidden="true" />
          <div>
            <strong>{session.displayName}</strong>
            <span>
              {session.email} · {session.roles.join(" / ")}
            </span>
          </div>
        </div>
        <button
          className="button button--primary"
          disabled={loading}
          onClick={() => void loadAdminData()}
          type="button"
        >
          <RefreshCw
            className={loading ? "spin" : undefined}
            size={18}
            aria-hidden="true"
          />
          刷新
        </button>
        <button
          className="button button--secondary"
          onClick={() => void generateQuestions()}
          type="button"
        >
          <FlaskConical size={18} aria-hidden="true" />
          生成题组
        </button>
        <button
          className="button button--quiet"
          onClick={() => void logout()}
          type="button"
        >
          <LogOut size={18} aria-hidden="true" />
          退出
        </button>
      </section>

      {error ? (
        <div className="feedback" data-tone="error" role="alert">
          <AlertTriangle size={20} aria-hidden="true" />
          <div>
            <strong>操作没有完成</strong>
            <p>{error}</p>
          </div>
        </div>
      ) : null}
      {notice ? (
        <div className="feedback" data-tone="success" role="status">
          <Check size={20} aria-hidden="true" />
          <div>
            <strong>已更新</strong>
            <p>{notice}</p>
          </div>
        </div>
      ) : null}

      <section className="admin-metrics" aria-label="关键指标">
        <Metric
          icon={<Activity size={19} aria-hidden="true" />}
          label="活跃档案"
          value={metrics?.profiles.active ?? 0}
        />
        <Metric
          icon={<ClipboardCheck size={19} aria-hidden="true" />}
          label="章节完成率"
          value={`${metrics?.chapters.completionRate ?? 0}%`}
        />
        <Metric
          icon={<ShieldCheck size={19} aria-hidden="true" />}
          label="Boss 胜率"
          value={`${metrics?.bosses.winRate ?? 0}%`}
        />
        <Metric
          icon={<GitBranch size={19} aria-hidden="true" />}
          label="页面访问"
          value={metrics?.acquisition.pageViews ?? 0}
        />
      </section>

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">课程编排</span>
              <h2>10 个阶段</h2>
            </div>
            <span className="section-count">
              {curriculum?.contentVersion ?? "未加载"}
            </span>
          </div>
          <ol className="curriculum-list">
            {curriculum?.stages.map((stage) => (
              <li key={stage.stageNo}>
                <span>{String(stage.stageNo).padStart(2, "0")}</span>
                <div>
                  <strong>{stage.name}</strong>
                  <small>
                    {stage.chapters.length} 章 · Boss{" "}
                    {stage.boss?.questionCount ?? 0} 题
                  </small>
                </div>
                <StatusPill tone={stage.boss ? "success" : "warning"}>
                  {stage.boss ? "已编排" : "待编排"}
                </StatusPill>
              </li>
            ))}
          </ol>
        </section>

        <section className="admin-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">图谱校验</span>
              <h2>发布门禁</h2>
            </div>
            <StatusPill
              tone={curriculum?.validation.valid ? "success" : "warning"}
            >
              {curriculum?.validation.issueCount ?? 0} 条
            </StatusPill>
          </div>
          <div className="issue-list">
            {[...(curriculum?.validation.errors ?? []), ...(curriculum?.validation.warnings ?? [])]
              .slice(0, 8)
              .map((issue, index) => (
                <div data-severity={issue.severity} key={`${issue.code}-${index}`}>
                  {issue.severity === "error" ? (
                    <X size={17} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={17} aria-hidden="true" />
                  )}
                  <div>
                    <strong>{issue.code}</strong>
                    <span>{issue.message}</span>
                  </div>
                </div>
              ))}
            {curriculum?.validation.issueCount === 0 ? (
              <div className="clean-result">
                <Check size={20} aria-hidden="true" />
                课程图谱没有错误或警告。
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="admin-grid admin-grid--wide">
        <section className="admin-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">人工审核</span>
              <h2>内容草稿</h2>
            </div>
            <span className="section-count">{drafts.length} 份</span>
          </div>
          <div className="draft-list">
            {drafts.map((draft) => (
              <article className="draft-card" key={draft.id}>
                <div className="draft-card__head">
                  <div>
                    <strong>{draft.title}</strong>
                    <span>
                      {draft.kind} · {draft.authorId}
                    </span>
                  </div>
                  <StatusPill tone={draftTone(draft.status)}>
                    {draft.status}
                  </StatusPill>
                </div>
                <div className="draft-card__history">
                  {draft.reviews.length
                    ? draft.reviews
                        .slice(-3)
                        .map((review) => (
                          <span key={review.id}>
                            {review.action} · {review.operatorId}
                          </span>
                        ))
                    : "暂无审核记录"}
                </div>
                <div className="draft-card__actions">
                  <input
                    aria-label={`${draft.title} 审核备注`}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [draft.id]: event.target.value,
                      }))
                    }
                    placeholder="审核备注"
                    value={notes[draft.id] ?? ""}
                  />
                  {draft.status === "draft" || draft.status === "rejected" ? (
                    <button
                      className="button button--quiet"
                      onClick={() => void reviewDraft(draft.id, "submit")}
                      type="button"
                    >
                      <Send size={16} aria-hidden="true" />
                      提交审核
                    </button>
                  ) : null}
                  {draft.status === "in_review" ? (
                    <>
                      <button
                        className="button button--success"
                        onClick={() => void reviewDraft(draft.id, "approve")}
                        type="button"
                      >
                        <Check size={16} aria-hidden="true" />
                        通过
                      </button>
                      <button
                        className="button button--secondary"
                        onClick={() => void reviewDraft(draft.id, "reject")}
                        type="button"
                      >
                        <X size={16} aria-hidden="true" />
                        驳回
                      </button>
                    </>
                  ) : null}
                  {draft.status === "approved" ? (
                    <button
                      className="button button--primary"
                      onClick={() => void reviewDraft(draft.id, "publish")}
                      type="button"
                    >
                      <ShieldCheck size={16} aria-hidden="true" />
                      发布
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
            {!drafts.length ? (
              <div className="empty-state empty-state--soft">
                <ClipboardCheck size={28} aria-hidden="true" />
                <h3>还没有内容草稿</h3>
              </div>
            ) : null}
          </div>
        </section>

        <section className="admin-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">新建草稿</span>
              <h2>内容入审</h2>
            </div>
            <FilePlus2 size={22} aria-hidden="true" />
          </div>
          <div className="draft-form">
            <label>
              <span>内容类型</span>
              <select
                onChange={(event) =>
                  setKind(event.target.value as ContentDraftKind)
                }
                value={kind}
              >
                {draftKinds.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>标题</span>
              <input
                onChange={(event) => setTitle(event.target.value)}
                value={title}
              />
            </label>
            <label>
              <span>内容 JSON</span>
              <textarea
                onChange={(event) => setPayloadText(event.target.value)}
                rows={12}
                spellCheck={false}
                value={payloadText}
              />
            </label>
            <button
              className="button button--primary button--wide"
              disabled={!title.trim()}
              onClick={() => void createDraft()}
              type="button"
            >
              <FilePlus2 size={17} aria-hidden="true" />
              创建草稿
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="admin-metric">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function draftTone(
  status: ContentDraftStatus,
): "neutral" | "success" | "warning" | "info" {
  if (status === "approved" || status === "published") return "success";
  if (status === "in_review") return "info";
  if (status === "rejected") return "warning";
  return "neutral";
}

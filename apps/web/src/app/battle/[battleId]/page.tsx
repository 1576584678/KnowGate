"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleX,
  Clock3,
  Heart,
  LoaderCircle,
  RotateCcw,
  Shield,
  Star,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import {
  calculateMasteryBreakdown,
  type PublicBattleQuestion,
  type PublicBattleState,
  type ResolveAnswerResult,
} from "@knowgate/domain";
import { useContent } from "@/components/content-provider";
import { FractionVisual } from "@/components/fraction-visual";
import { useProgress } from "@/components/progress-provider";
import { MasteryMeter, StatusPill } from "@/components/ui";
import { profileHeaders } from "@/lib/profile";

export default function BattlePage() {
  const params = useParams<{ battleId: string }>();
  const router = useRouter();
  const { recordBattle } = useProgress();
  const { getNode } = useContent();
  const [battle, setBattle] = useState<PublicBattleState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<
    (ResolveAnswerResult & { question: PublicBattleQuestion }) | null
  >(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const recordedBattleRef = useRef("");
  const timeoutSentRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    async function loadBattle() {
      try {
        const response = await fetch(`/api/v1/battles/${params.battleId}`, {
          headers: profileHeaders(),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error?.message ?? "无法读取战斗。");
        }
        if (!cancelled) setBattle(payload);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "无法读取战斗。");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBattle();
    return () => {
      cancelled = true;
    };
  }, [params.battleId]);

  const submitAnswer = useCallback(
    async (index: number) => {
      const current = battle?.currentQuestion;
      if (!battle || !current || feedback || submitting) return;

      setSubmitting(true);
      setError("");

      try {
        const response = await fetch(`/api/v1/battles/${battle.id}/answers`, {
          method: "POST",
          headers: profileHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            questionId: current.id,
            selectedIndex: index,
          }),
        });
        const payload = (await response.json()) as
          | ResolveAnswerResult
          | { error?: { message?: string } };

        if (!response.ok || !("state" in payload)) {
          throw new Error(
            "error" in payload
              ? payload.error?.message ?? "答案提交失败。"
              : "答案提交失败。",
          );
        }

        setBattle(payload.state);
        setFeedback({ ...payload, question: current });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "答案提交失败。");
      } finally {
        setSubmitting(false);
      }
    },
    [battle, feedback, submitting],
  );

  useEffect(() => {
    const current = battle?.currentQuestion;
    if (!current || feedback || submitting) return;

    function updateTimer() {
      const milliseconds = Date.parse(current!.deadlineAt) - Date.now();
      setRemaining(Math.max(0, Math.ceil(milliseconds / 1000)));

      if (
        milliseconds <= 0 &&
        timeoutSentRef.current !== current!.id
      ) {
        timeoutSentRef.current = current!.id;
        void submitAnswer(-1);
      }
    }

    updateTimer();
    const timer = window.setInterval(updateTimer, 250);
    return () => window.clearInterval(timer);
  }, [battle?.currentQuestion, feedback, submitAnswer, submitting]);

  useEffect(() => {
    if (
      !battle ||
      (battle.status !== "won" && battle.status !== "lost") ||
      recordedBattleRef.current === battle.id
    ) {
      return;
    }

    recordedBattleRef.current = battle.id;
    recordBattle({
      milestoneId: battle.milestoneId,
      status: battle.status,
      accuracy:
        battle.answeredCount === 0
          ? 0
          : Math.round((battle.correctCount / battle.answeredCount) * 100),
      maxCombo: battle.maxCombo,
      mistakes: battle.mistakes,
      completedAt: new Date().toISOString(),
    });
  }, [battle, recordBattle]);

  if (loading) {
    return (
      <div className="page-shell narrow-shell">
        <div className="empty-state">
          <LoaderCircle className="spin" size={32} aria-hidden="true" />
          <h1>正在恢复战斗</h1>
          <p>题目版本会在这一局中保持不变。</p>
        </div>
      </div>
    );
  }

  if (!battle || error) {
    return (
      <div className="page-shell narrow-shell">
        <div className="empty-state">
          <X size={30} aria-hidden="true" />
          <h1>战斗无法继续</h1>
          <p>{error || "战斗状态已失效。"}</p>
          <Link className="button button--primary" href="/">
            返回世界地图
          </Link>
        </div>
      </div>
    );
  }

  if (battle.status !== "active") {
    return (
      <BattleResult
        battle={battle}
        onRetry={() => router.push(`/boss/${battle.milestoneId}`)}
      />
    );
  }

  const current = battle.currentQuestion;
  if (!current) {
    return null;
  }

  const displayQuestion = feedback?.question ?? current;
  const accuracy =
    battle.answeredCount === 0
      ? 0
      : Math.round((battle.correctCount / battle.answeredCount) * 100);
  const timerDanger = remaining <= Math.ceil(displayQuestion.timeLimitSec * 0.25);

  return (
    <div className="battle-page">
      <div className="battle-topbar">
        <Link
          className="icon-button"
          href={`/milestones/${battle.milestoneId}`}
          aria-label="退出战斗并返回小关"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <div>
          <span>{battle.boss.name}</span>
          <strong>
            第 {battle.questionIndex + 1} / {battle.questionCount} 题
          </strong>
        </div>
        <StatusPill tone={battle.mode === "learning" ? "success" : "info"}>
          {battle.mode === "learning" ? "学习模式" : "标准模式"}
        </StatusPill>
      </div>

      <section className="boss-hud" aria-label="Boss 状态">
        <div className="boss-hud__name">
          <div className="boss-hud__avatar">
            <Shield size={28} strokeWidth={2.1} aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">{battle.boss.epithet}</span>
            <strong>{battle.boss.name}</strong>
          </div>
        </div>
        <div className="boss-health">
          <div className="boss-health__labels">
            <span>
              <Heart size={16} aria-hidden="true" />
              生命
            </span>
            <strong>
              {battle.boss.hp} / {battle.boss.maxHp}
            </strong>
          </div>
          <div
            className="boss-health__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={battle.boss.maxHp}
            aria-valuenow={battle.boss.hp}
          >
            <span
              style={{
                width: `${(battle.boss.hp / battle.boss.maxHp) * 100}%`,
              }}
            />
          </div>
        </div>
        <div className="boss-distance">
          <Swords size={21} aria-hidden="true" />
          <div>
            <span>逼近轨道</span>
            <strong>
              {battle.mode === "learning" && feedback?.timedOut
                ? `学习模式：Boss 保持 ${battle.boss.distance} 步`
                : `Boss 还有 ${battle.boss.distance} 步碰到你`}
            </strong>
          </div>
        </div>
        <div className="distance-track" aria-hidden="true">
          {Array.from({ length: battle.boss.initialDistance + 1 }, (_, index) => (
            <span
              data-danger={index < battle.boss.distance}
              key={index}
            />
          ))}
          <Shield
            className="distance-track__boss"
            size={25}
            style={{
              right: `${Math.max(
                0,
                (battle.boss.distance / battle.boss.initialDistance) * 100 - 8,
              )}%`,
            }}
          />
        </div>
        <div className="boss-hud__stats">
          <span>
            连击 <strong>{battle.combo}</strong>
          </span>
          <span>
            正确率 <strong>{accuracy}%</strong>
          </span>
        </div>
      </section>

      <section className="question-panel">
        <div className="question-meta">
          <StatusPill
            tone={
              displayQuestion.damage >= 3
                ? "warning"
                : displayQuestion.damage >= 2
                  ? "info"
                  : "neutral"
            }
          >
            伤害 {displayQuestion.damage}
          </StatusPill>
          <div className="timer" data-danger={timerDanger}>
            <Clock3 size={18} aria-hidden="true" />
            <span>{feedback ? "已提交" : `${remaining}s`}</span>
          </div>
        </div>

        <h1>{displayQuestion.prompt}</h1>
        <FractionVisual visual={displayQuestion.visual} />

        <div className="answer-grid">
          {displayQuestion.options.map((option, index) => {
            let result: "correct" | "wrong" | undefined;
            if (feedback && index === feedback.correctIndex) {
              result = "correct";
            } else if (feedback && index === selectedIndex) {
              result = "wrong";
            }

            return (
              <button
                className="answer-option answer-option--large"
                data-result={result}
                data-selected={!feedback && selectedIndex === index}
                disabled={Boolean(feedback) || submitting}
                key={`${displayQuestion.id}-${option}`}
                onClick={() => {
                  setSelectedIndex(index);
                  void submitAnswer(index);
                }}
                type="button"
              >
                <span className="answer-option__key">
                  {String.fromCharCode(65 + index)}
                </span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        {feedback ? (
          <div
            className="feedback feedback--battle"
            data-tone={feedback.correct ? "success" : "error"}
            role="status"
          >
            {feedback.correct ? (
              <CheckCircle2 size={24} aria-hidden="true" />
            ) : (
              <CircleX size={24} aria-hidden="true" />
            )}
            <div>
              <strong>
                {feedback.correct
                  ? `命中，Boss 受到 ${feedback.damage} 点伤害`
                  : feedback.timedOut
                    ? "时间到了"
                    : "这次没有推进 Boss 血量"}
              </strong>
              <p>{feedback.explanation}</p>
              <small>
                知识节点：
                {getNode(feedback.question.nodeId)?.name ?? feedback.question.nodeId}
              </small>
            </div>
            <button
              className="button button--primary"
              onClick={() => {
                setFeedback(null);
                setSelectedIndex(null);
              }}
              type="button"
            >
              下一题
              <ArrowRight size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {submitting ? (
          <div className="submitting-row" role="status">
            <LoaderCircle className="spin" size={18} aria-hidden="true" />
            正在由服务端裁决
          </div>
        ) : null}
      </section>
    </div>
  );
}

function BattleResult({
  battle,
  onRetry,
}: {
  battle: PublicBattleState;
  onRetry: () => void;
}) {
  const { passedChapterIds } = useProgress();
  const { getMilestone, getNode } = useContent();
  const won = battle.status === "won";
  const accuracy =
    battle.answeredCount === 0
      ? 0
      : Math.round((battle.correctCount / battle.answeredCount) * 100);
  const milestone = getMilestone(battle.milestoneId);
  const milestoneChapterIds = milestone?.chapterIds ?? [];
  const completedChapters = milestoneChapterIds.filter((chapterId) =>
    passedChapterIds.includes(chapterId),
  ).length;
  const mastery = calculateMasteryBreakdown({
    completedChapters,
    totalChapters: milestoneChapterIds.length,
    bossOutcome: {
      milestoneId: battle.milestoneId,
      status: won ? "won" : "lost",
      accuracy,
      maxCombo: battle.maxCombo,
      mistakes: battle.mistakes,
      completedAt: new Date().toISOString(),
    },
  });
  const stars = accuracy >= 90 ? 3 : accuracy >= 70 ? 2 : 1;
  const nextMilestoneNumber = Math.min(10, Number(battle.milestoneId.slice(-2)) + 1);
  const nextMilestoneId = `math.g4.milestone.${String(nextMilestoneNumber).padStart(
    2,
    "0",
  )}`;

  return (
    <div className="page-shell result-page">
      <section className="result-hero">
        <div className="result-badge" data-tone={won ? "success" : "warning"}>
          {won ? (
            <Trophy size={42} strokeWidth={2.1} aria-hidden="true" />
          ) : (
            <RotateCcw size={40} strokeWidth={2.2} aria-hidden="true" />
          )}
        </div>
        <StatusPill tone={won ? "success" : "warning"}>
          {won ? "Boss 已击败" : "需要补强"}
        </StatusPill>
        <h1>{won ? "小关突破" : "先补强这个节点"}</h1>
        <p>
          {won
            ? `${battle.boss.name} 已经退开。你的章节进度和掌握度已经记录。`
            : "章节进度会保留。系统把错误定位到知识节点，不需要重学整关。"}
        </p>
        <div className="result-stars" aria-label={`${stars} 星结果`}>
          {Array.from({ length: 3 }, (_, index) => (
            <Star
              data-filled={index < stars}
              key={index}
              size={28}
              strokeWidth={2}
              aria-hidden="true"
            />
          ))}
        </div>
      </section>

      <div className="result-layout">
        <section className="result-panel">
          <span className="eyebrow">本局数据</span>
          <div className="result-stats">
            <div>
              <span>正确率</span>
              <strong>{accuracy}%</strong>
            </div>
            <div>
              <span>最高连击</span>
              <strong>{battle.maxCombo}</strong>
            </div>
            <div>
              <span>答题数</span>
              <strong>{battle.answeredCount}</strong>
            </div>
          </div>
          <MasteryMeter
            label={milestone?.theme ?? "当前里程碑掌握度"}
            value={mastery.score}
          />
        </section>

        <section className="result-panel">
          <span className="eyebrow">错题与节点</span>
          <h2>{battle.mistakes.length ? "这些地方需要再看一眼" : "本局没有错题"}</h2>
          {battle.mistakes.length ? (
            <ul className="mistake-list">
              {battle.mistakes.slice(0, 3).map((mistake) => (
                <li key={mistake.questionId}>
                  <CircleX size={18} aria-hidden="true" />
                  <div>
                    <strong>{getNode(mistake.nodeId)?.name}</strong>
                    <span>{mistake.explanation}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="clean-result">
              <CheckCircle2 size={24} aria-hidden="true" />
              所有题目都通过了服务端裁决。
            </div>
          )}
        </section>
      </div>

      <div className="result-actions">
        {won ? (
          <Link className="button button--primary" href="/">
            进入下一关
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
        ) : (
          <Link
            className="button button--primary"
            href={`/remediation/${battle.milestoneId}`}
          >
            开始补课
            <ArrowRight size={19} aria-hidden="true" />
          </Link>
        )}
        <button className="button button--secondary" onClick={onRetry} type="button">
          重新挑战
        </button>
        <Link className="button button--quiet" href="/growth">
          查看成长
        </Link>
      </div>
    </div>
  );
}

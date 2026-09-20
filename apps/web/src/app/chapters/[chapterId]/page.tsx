"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  CircleX,
  Lightbulb,
  LoaderCircle,
  PenTool,
  RotateCcw,
  Sparkles,
  Target,
} from "lucide-react";
import { getChapter, gradeWorld } from "@/content/math-grade4";
import { FractionVisual } from "@/components/fraction-visual";
import { useProgress } from "@/components/progress-provider";
import { StatusPill } from "@/components/ui";
import { trackLearningEvent } from "@/lib/tracking";

const phaseMeta = {
  hook: { label: "钩子", icon: Sparkles },
  concept: { label: "概念", icon: Lightbulb },
  example: { label: "范例", icon: BookOpen },
  guided: { label: "跟做", icon: PenTool },
  practice: { label: "独立练习", icon: Target },
  quiz: { label: "章节短测", icon: CheckCircle2 },
} as const;

export default function ChapterPage() {
  const params = useParams<{ chapterId: string }>();
  const router = useRouter();
  const { completeChapter } = useProgress();
  const chapter = getChapter(params.chapterId);
  const storageKey = `knowgate.chapter.${params.chapterId}`;
  const answersStorageKey = `${storageKey}.answers`;
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [restored, setRestored] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());
  const trackedStart = useRef(false);

  useEffect(() => {
    if (!chapter || trackedStart.current) return;
    trackedStart.current = true;
    trackLearningEvent({
      eventType: "chapter_started",
      entityType: "chapter",
      entityId: chapter.id,
      payload: { milestoneId: chapter.milestoneId },
    });
  }, [chapter]);

  useEffect(() => {
    if (!chapter) return;
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      if (Number.isInteger(saved) && saved > 0 && saved < chapter.steps.length) {
        setStepIndex(saved);
      }

      const savedAnswers = window.localStorage.getItem(answersStorageKey);
      if (savedAnswers) {
        const parsed = JSON.parse(savedAnswers) as Record<string, unknown>;
        setAnswers(
          Object.fromEntries(
            Object.entries(parsed).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          ),
        );
      }
    } finally {
      setRestored(true);
    }
  }, [answersStorageKey, chapter, storageKey]);

  useEffect(() => {
    if (!chapter || !restored) return;
    window.localStorage.setItem(storageKey, String(stepIndex));
  }, [chapter, restored, stepIndex, storageKey]);

  useEffect(() => {
    if (!chapter || !restored) return;
    window.localStorage.setItem(answersStorageKey, JSON.stringify(answers));
  }, [answers, answersStorageKey, chapter, restored]);

  const step = chapter?.steps[stepIndex];
  const phase = step ? phaseMeta[step.phase] : null;
  const PhaseIcon = phase?.icon;
  const progress = chapter
    ? Math.round(((stepIndex + 1) / chapter.steps.length) * 100)
    : 0;
  const correct = useMemo(
    () =>
      Boolean(
        step?.question &&
          answered &&
          selectedIndex === step.question.answerIndex,
      ),
    [answered, selectedIndex, step],
  );

  if (!chapter || !step || !phase || !PhaseIcon) {
    return (
      <div className="page-shell narrow-shell">
        <div className="empty-state">
          <BookOpen size={30} aria-hidden="true" />
          <h1>没有找到这个章节</h1>
          <Link className="button button--primary" href="/">
            返回世界地图
          </Link>
        </div>
      </div>
    );
  }

  async function handlePrimaryAction() {
    if (!chapter || !step) return;
    if (step.question && !answered) return;
    if (step.question && !correct) {
      setAnswered(false);
      setSelectedIndex(null);
      return;
    }

    if (stepIndex === chapter.steps.length - 1) {
      setIsCompleting(true);
      setCompletionError(null);
      const chapterAnswers = chapter.steps
        .flatMap((lessonStep) => {
          const question = lessonStep.question;
          const answer = question ? answers[question.id] : undefined;
          return question && answer
            ? [{ itemId: question.id, answer }]
            : [];
        });
      const durationSec = Math.max(
        1,
        Math.round((Date.now() - startedAt.current) / 1000),
      );
      const result = await completeChapter({
        chapterId: chapter.id,
        answers: chapterAnswers,
        durationSec,
        contentVersion: gradeWorld.contentVersion,
      });
      setIsCompleting(false);

      if (result && !result.passed) {
        setCompletionError("答题记录未通过校验，请再检查一次。");
        setAnswered(false);
        setSelectedIndex(null);
        return;
      }

      router.push(`/milestones/${chapter.milestoneId}?completed=1`);
      return;
    }

    setStepIndex((current) => current + 1);
    setAnswered(false);
    setSelectedIndex(null);
  }

  return (
    <div className="page-shell lesson-page">
      <Link className="back-link" href={`/milestones/${chapter.milestoneId}`}>
        <ArrowLeft size={18} aria-hidden="true" />
        返回小关
      </Link>

      <div className="lesson-header">
        <div>
          <span className="eyebrow">
            第 {chapter.stageNo} 章 · 约 {chapter.estimatedMinutes} 分钟
          </span>
          <h1>{chapter.title}</h1>
          <p>{chapter.summary}</p>
        </div>
        <StatusPill tone={step.phase === "quiz" ? "warning" : "info"}>
          <PhaseIcon size={16} aria-hidden="true" />
          {phase.label}
        </StatusPill>
      </div>

      <div className="lesson-layout">
        <aside className="lesson-steps" aria-label="章节阶段">
          <div className="lesson-progress">
            <span>章节进度</span>
            <strong>{progress}%</strong>
            <div
              className="lesson-progress__track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
          <ol>
            {chapter.steps.map((item, index) => {
              const itemPhase = phaseMeta[item.phase];
              const ItemIcon = itemPhase.icon;
              const state =
                index < stepIndex
                  ? "done"
                  : index === stepIndex
                    ? "current"
                    : "waiting";

              return (
                <li className="lesson-step" data-state={state} key={item.id}>
                  <span className="lesson-step__marker">
                    {state === "done" ? (
                      <Check size={16} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <ItemIcon size={16} strokeWidth={2.3} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <strong>{itemPhase.label}</strong>
                    <span>{item.title}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="lesson-card" aria-live="polite">
          <span className="eyebrow">{phase.label}</span>
          <h2>{step.title}</h2>
          <p className="lesson-copy">{step.body}</p>
          <FractionVisual visual={step.visual} />

          {step.question ? (
            <div className="answer-grid" aria-label="答案选项">
              {step.question.options.map((option, index) => {
                let result: "correct" | "wrong" | undefined;
                if (answered && index === step.question?.answerIndex) {
                  result = "correct";
                } else if (answered && index === selectedIndex) {
                  result = "wrong";
                }

                return (
                  <button
                    className="answer-option"
                    data-result={result}
                    data-selected={selectedIndex === index}
                    disabled={answered}
                    key={`${step.id}-${option}`}
                    onClick={() => {
                      setSelectedIndex(index);
                      setAnswered(true);
                      setAnswers((current) => ({
                        ...current,
                        [step.question!.id]: String.fromCharCode(65 + index),
                      }));
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
          ) : null}

          {answered && step.question ? (
            <div
              className="feedback"
              data-tone={correct ? "success" : "error"}
              role="status"
            >
              {correct ? (
                <CheckCircle2 size={21} aria-hidden="true" />
              ) : (
                <CircleX size={21} aria-hidden="true" />
              )}
              <div>
                <strong>{correct ? "答对了" : "再想一步"}</strong>
                <p>{step.question.explanation}</p>
              </div>
            </div>
          ) : null}

          {completionError ? (
            <div className="feedback" data-tone="error" role="alert">
              <CircleX size={21} aria-hidden="true" />
              <div>
                <strong>还没有记录完成</strong>
                <p>{completionError}</p>
              </div>
            </div>
          ) : null}

          <div className="lesson-actions">
            <button
              className="button button--primary"
              disabled={
                isCompleting || Boolean(step.question && !answered)
              }
              onClick={handlePrimaryAction}
              type="button"
            >
              {isCompleting ? (
                <>
                  <LoaderCircle
                    className="spin"
                    size={18}
                    aria-hidden="true"
                  />
                  正在保存
                </>
              ) : step.question && answered && !correct ? (
                <>
                  <RotateCcw size={18} aria-hidden="true" />
                  再试一次
                </>
              ) : stepIndex === chapter.steps.length - 1 ? (
                <>
                  完成本章
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              ) : (
                <>
                  继续
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>
            <span className="lesson-actions__hint">
              {step.question && !answered
                ? "选择答案后才能继续"
                : isCompleting
                  ? "正在记录本章学习证据"
                  : "章节进度会自动保存"}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

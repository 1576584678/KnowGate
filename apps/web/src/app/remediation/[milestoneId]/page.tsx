"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CircleX,
  RotateCcw,
  Target,
} from "lucide-react";
import { calculateMasteryBreakdown } from "@knowgate/domain";
import {
  bossQuestions,
  bosses,
  getMilestone,
  getNode,
} from "@/content/math-grade4";
import { FractionVisual } from "@/components/fraction-visual";
import { useProgress } from "@/components/progress-provider";
import { MasteryMeter, PageIntro, StatusPill } from "@/components/ui";
import { trackLearningEvent } from "@/lib/tracking";

export default function RemediationPage() {
  const params = useParams<{ milestoneId: string }>();
  const { battleOutcomes, passedChapterIds } = useProgress();
  const outcome = battleOutcomes[params.milestoneId];
  const milestone = getMilestone(params.milestoneId);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const trackedStart = useRef(false);
  const trackedCompletion = useRef(false);

  const exercises = useMemo(() => {
    const missed = outcome?.mistakes ?? [];
    const boss = bosses.find((item) => item.id === milestone?.bossId);
    const milestoneQuestionIds = new Set(boss?.questionIds ?? []);
    const candidateQuestions = bossQuestions.filter((question) =>
      milestoneQuestionIds.has(question.id),
    );
    const missedQuestions = missed
      .map((mistake) =>
        bossQuestions.find((question) => question.id === mistake.questionId),
      )
      .filter((question) => question !== undefined);
    const fallback = candidateQuestions.filter((question) =>
      missed.every((mistake) => mistake.questionId !== question.id),
    );
    const items =
      missedQuestions.length >= 3
        ? missedQuestions.slice(0, 3)
        : [...missedQuestions, ...fallback].slice(0, 3);

    return items.map((question) => ({
      id: question.id,
      nodeId: question.nodeId,
      prompt: question.prompt,
      options: question.options,
      answerIndex: question.answerIndex,
      explanation: question.explanation,
      visual: question.visual,
    }));
  }, [milestone?.bossId, outcome]);

  const exercise = exercises[exerciseIndex];
  const answered = selectedIndex !== null;
  const correct = answered && selectedIndex === exercise?.answerIndex;
  const milestoneChapterIds = milestone?.chapterIds ?? [];
  const mastery = calculateMasteryBreakdown({
    completedChapters: milestoneChapterIds.filter((chapterId) =>
      passedChapterIds.includes(chapterId),
    ).length,
    totalChapters: milestoneChapterIds.length,
    bossOutcome: outcome,
  });
  const currentNode = getNode(exercise?.nodeId);

  useEffect(() => {
    if (!milestone || trackedStart.current) return;
    trackedStart.current = true;
    trackLearningEvent({
      eventType: "remediation_started",
      entityType: "milestone",
      entityId: milestone.id,
      payload: {
        bossId: milestone.bossId,
        mistakeCount: outcome?.mistakes.length ?? 0,
        exerciseCount: exercises.length,
      },
    });
  }, [exercises.length, milestone, outcome?.mistakes.length]);

  useEffect(() => {
    const finished =
      correct &&
      exercises.length > 0 &&
      exerciseIndex === exercises.length - 1;
    if (!milestone || !finished || trackedCompletion.current) return;
    trackedCompletion.current = true;
    trackLearningEvent({
      eventType: "remediation_completed",
      entityType: "milestone",
      entityId: milestone.id,
      payload: {
        bossId: milestone.bossId,
        exerciseCount: exercises.length,
      },
    });
  }, [correct, exerciseIndex, exercises.length, milestone]);

  return (
    <div className="page-shell">
      <Link className="back-link" href={`/milestones/${params.milestoneId}`}>
        <ArrowLeft size={18} aria-hidden="true" />
        返回小关
      </Link>
      <PageIntro
        eyebrow="定向补强"
        title="只修复薄弱节点"
        description="章节进度保持不变。完成 3 道针对性练习后，可以直接重打 Boss。"
        aside={<StatusPill tone="warning">再练 3 题即可重打</StatusPill>}
      />

      <div className="remediation-layout">
        <aside className="remediation-sidebar">
          <Target size={24} aria-hidden="true" />
          <span className="eyebrow">当前节点</span>
          <h2>
            {currentNode?.name ?? "当前薄弱节点"}
          </h2>
          <MasteryMeter
            label="补强前掌握度"
            value={mastery.score}
          />
          <ul>
            {(currentNode?.mastery ?? ["先完成针对性练习，再回到 Boss 验证。"]).map(
              (item) => (
                <li key={item}>{item}</li>
              ),
            )}
          </ul>
        </aside>

        <section className="practice-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">针对性练习</span>
              <h2>
                第 {exerciseIndex + 1} / {exercises.length} 题
              </h2>
            </div>
            <div className="practice-dots" aria-label="练习进度">
              {exercises.map((item, index) => (
                <span data-active={index <= exerciseIndex} key={item.id} />
              ))}
            </div>
          </div>

          {exercise ? (
            <>
              <h3>{exercise.prompt}</h3>
              <FractionVisual visual={exercise.visual} />
              <div className="answer-grid">
                {exercise.options.map((option, index) => {
                  let result: "correct" | "wrong" | undefined;
                  if (answered && index === exercise.answerIndex) {
                    result = "correct";
                  } else if (answered && index === selectedIndex) {
                    result = "wrong";
                  }
                  return (
                    <button
                      className="answer-option"
                      data-result={result}
                      disabled={answered}
                      key={`${exercise.id}-${option}`}
                      onClick={() => setSelectedIndex(index)}
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

              {answered ? (
                <div
                  className="feedback"
                  data-tone={correct ? "success" : "error"}
                  role="status"
                >
                  {correct ? (
                    <CheckCircle2 size={22} aria-hidden="true" />
                  ) : (
                    <CircleX size={22} aria-hidden="true" />
                  )}
                  <div>
                    <strong>{correct ? "这一步掌握了" : "再看一次提示"}</strong>
                    <p>{exercise.explanation}</p>
                  </div>
                </div>
              ) : null}

              <div className="lesson-actions">
                {answered && !correct ? (
                  <button
                    className="button button--secondary"
                    onClick={() => setSelectedIndex(null)}
                    type="button"
                  >
                    <RotateCcw size={18} aria-hidden="true" />
                    再练一次
                  </button>
                ) : (
                  <button
                    className="button button--primary"
                    disabled={!correct}
                    onClick={() => {
                      if (exerciseIndex < exercises.length - 1) {
                        setExerciseIndex((current) => current + 1);
                        setSelectedIndex(null);
                      }
                    }}
                    type="button"
                  >
                    下一题
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                )}

                {exerciseIndex === exercises.length - 1 && correct ? (
                  <Link
                    className="button button--success"
                    href={`/boss/${params.milestoneId}`}
                  >
                    补强完成，返回 Boss
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarCheck,
  Target,
  Trophy,
} from "lucide-react";
import {
  calculateMasteryBreakdown,
  getMasteryStatus,
} from "@knowgate/domain";
import { useContent } from "@/components/content-provider";
import { useProgress } from "@/components/progress-provider";
import { MasteryMeter, PageIntro, StatusPill } from "@/components/ui";
import { trackLearningEvent } from "@/lib/tracking";

export default function GrowthPage() {
  const { passedChapterIds, battleOutcomes } = useProgress();
  const { chapters, getNode, milestones } = useContent();
  const trackedReport = useRef(false);
  const currentMilestone =
    milestones.find(
      (milestone) => battleOutcomes[milestone.id]?.status !== "won",
    ) ?? milestones[milestones.length - 1];
  const currentOutcome = battleOutcomes[currentMilestone.id];
  const currentMilestoneChapters = chapters.filter((chapter) =>
    currentMilestone.chapterIds.includes(chapter.id),
  );
  const passedCount = currentMilestoneChapters.filter((chapter) =>
    passedChapterIds.includes(chapter.id),
  ).length;
  const mastery = calculateMasteryBreakdown({
    completedChapters: passedCount,
    totalChapters: currentMilestoneChapters.length,
    bossOutcome: currentOutcome,
  });
  const completedMilestones = milestones.filter(
    (milestone) => battleOutcomes[milestone.id]?.status === "won",
  ).length;
  const currentNode = getNode(currentMilestone.nodeIds[0]);
  const nextMilestone = milestones.find(
    (milestone) => milestone.stageNo === currentMilestone.stageNo + 1,
  );
  const nextNode = nextMilestone
    ? getNode(nextMilestone.nodeIds[0])
    : undefined;
  const weakNodeNames = Array.from(
    new Set(
      (currentOutcome?.mistakes ?? [])
        .map((mistake) => getNode(mistake.nodeId)?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  );

  useEffect(() => {
    if (trackedReport.current) return;
    trackedReport.current = true;
    trackLearningEvent({
      eventType: "report_viewed",
      entityType: "milestone",
      entityId: currentMilestone.id,
      payload: {
        completedMilestones,
        masteryScore: mastery.score,
      },
    });
  }, [completedMilestones, currentMilestone.id, mastery.score]);

  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="学习成长"
        title="掌握度地图"
        description="这里记录章节证据、Boss 验证和下一步复习建议，不展示公开排名。"
        aside={
          <StatusPill
            tone={currentOutcome?.status === "won" ? "success" : "info"}
          >
            {completedMilestones} 个小关已通过
          </StatusPill>
        }
      />

      <div className="growth-grid">
        <section className="growth-card growth-card--main">
          <div className="section-heading">
            <div>
              <span className="eyebrow">当前节点</span>
              <h2>{currentNode?.name ?? currentMilestone.theme}</h2>
            </div>
            <Target size={25} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <MasteryMeter label="综合掌握度" value={mastery.score} />
          <div className="mastery-breakdown">
            <div>
              <BookOpenCheck size={20} aria-hidden="true" />
              <span>章节完成</span>
              <strong>{mastery.chapterScore} / 20</strong>
            </div>
            <div>
              <Trophy size={20} aria-hidden="true" />
              <span>Boss 验证</span>
              <strong>{mastery.bossScore} / 40</strong>
            </div>
            <div>
              <BarChart3 size={20} aria-hidden="true" />
              <span>练习证据</span>
              <strong>{mastery.practiceScore} / 30</strong>
            </div>
            <div>
              <CalendarCheck size={20} aria-hidden="true" />
              <span>延迟复习</span>
              <strong>{mastery.delayedReviewScore} / 10</strong>
            </div>
          </div>
        </section>

        <section className="growth-card">
          <span className="eyebrow">待补强</span>
          {currentOutcome?.status === "lost" &&
          currentOutcome.mistakes.length ? (
            <>
              <h2>{weakNodeNames.slice(0, 2).join("、") || currentNode?.name}</h2>
              <p>本局记录了 {currentOutcome.mistakes.length} 个薄弱点。</p>
              <Link
                className="button button--primary button--wide"
                href={`/remediation/${currentMilestone.id}`}
              >
                开始补课
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          ) : currentOutcome?.status === "won" ? (
            <>
              <h2>本节点已掌握</h2>
              <p>建议在 7 天后做一次短复习，保留长期记忆。</p>
              <StatusPill tone="success">下次复习：7 天后</StatusPill>
            </>
          ) : (
            <>
              <h2>还没有战斗证据</h2>
              <p>
                完成 {currentMilestoneChapters.length} 个章节并挑战 Boss
                后，这里会给出补强建议。
              </p>
              <Link className="button button--secondary button--wide" href="/">
                继续闯关
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          )}
        </section>
      </div>

      <section className="growth-list-panel">
        <div className="section-heading">
          <div>
            <span className="eyebrow">节点记录</span>
            <h2>能力证据</h2>
          </div>
        </div>
        <div className="mastery-list">
          <div className="mastery-row">
            <span
              className="mastery-row__dot"
              data-done={mastery.score >= 60}
            />
            <div>
              <strong>{currentNode?.name ?? currentMilestone.theme}</strong>
              <span>{masteryStatusLabel(getMasteryStatus(mastery.score))}</span>
            </div>
            <strong>{mastery.score}%</strong>
          </div>
          <div className="mastery-row">
            <span className="mastery-row__dot" />
            <div>
              <strong>{nextNode?.name ?? "全部里程碑已完成"}</strong>
              <span>
                {nextNode ? "等待前置节点掌握" : "可以进入综合复习"}
              </span>
            </div>
            <strong>0%</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

function masteryStatusLabel(status: ReturnType<typeof getMasteryStatus>) {
  if (status === "mastered") return "已掌握";
  if (status === "developing") return "初步掌握";
  return "学习中";
}

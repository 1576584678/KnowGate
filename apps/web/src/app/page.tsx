"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CirclePlay,
  LockKeyhole,
  Shield,
  Target,
} from "lucide-react";
import { calculateMasteryBreakdown } from "@knowgate/domain";
import type { CSSProperties } from "react";
import { chapters, getBoss, milestones } from "@/content/math-grade4";
import { useProgress } from "@/components/progress-provider";
import { MasteryMeter, PageIntro, StateIcon, StatusPill } from "@/components/ui";

const stagePositions = [
  { x: 17, y: 84 },
  { x: 36, y: 72 },
  { x: 57, y: 78 },
  { x: 80, y: 62 },
  { x: 47, y: 46 },
  { x: 20, y: 35 },
  { x: 34, y: 18 },
  { x: 62, y: 29 },
  { x: 84, y: 17 },
  { x: 72, y: 6 },
];

type MilestoneState = "done" | "current" | "available" | "locked";

export default function WorldMapPage() {
  const { passedChapterIds, battleOutcomes, ready } = useProgress();
  const currentMilestone =
    milestones.find(
      (milestone) => battleOutcomes[milestone.id]?.status !== "won",
    ) ?? milestones[milestones.length - 1];
  const currentMilestoneChapters = chapters.filter((chapter) =>
    currentMilestone.chapterIds.includes(chapter.id),
  );
  const currentMilestonePassedCount = currentMilestoneChapters.filter(
    (chapter) => passedChapterIds.includes(chapter.id),
  ).length;
  const currentMilestoneReady =
    currentMilestoneChapters.length > 0 &&
    currentMilestonePassedCount === currentMilestoneChapters.length;
  const currentBoss = getBoss(currentMilestone.bossId);
  const completedMilestones = milestones.filter(
    (milestone) => battleOutcomes[milestone.id]?.status === "won",
  ).length;
  const mastery = calculateMasteryBreakdown({
    completedChapters: currentMilestonePassedCount,
    totalChapters: currentMilestoneChapters.length,
    bossOutcome: battleOutcomes[currentMilestone.id],
  });
  const masteryValue = mastery.score;

  function stateFor(milestoneId: string): MilestoneState {
    if (battleOutcomes[milestoneId]?.status === "won") return "done";
    const index = milestones.findIndex(
      (milestone) => milestone.id === milestoneId,
    );
    const milestone = milestones[index];
    if (!milestone) return "locked";
    const previous = milestones[index - 1];
    const unlocked =
      index === 0 ||
      (previous && battleOutcomes[previous.id]?.status === "won");
    if (!unlocked) return "locked";

    const milestoneChapters = chapters.filter((chapter) =>
      milestone.chapterIds.includes(chapter.id),
    );
    const milestoneReady =
      milestoneChapters.length > 0 &&
      milestoneChapters.every((chapter) =>
        passedChapterIds.includes(chapter.id),
      );

    return milestoneReady ? "available" : "current";
  }

  return (
    <div className={`page-shell${ready ? "" : " page-shell--loading"}`}>
      <PageIntro
        eyebrow="四年级数学"
        title="分数群岛"
        description="从分数意义出发，穿过等值、小数、图形、数据与问题解决阶段，完成 10 个能力里程碑。"
        aside={
          <div className="world-summary">
            <div>
              <span>已完成</span>
              <strong>
                {completedMilestones}/{milestones.length}
              </strong>
            </div>
            <div>
              <span>当前掌握</span>
              <strong>{masteryValue}%</strong>
            </div>
          </div>
        }
      />

      <div className="map-layout">
        <section className="map-panel" aria-labelledby="map-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">能力路线</span>
              <h2 id="map-title">10 个里程碑</h2>
            </div>
            <StatusPill
              tone={completedMilestones === milestones.length ? "success" : "info"}
            >
              {completedMilestones === milestones.length
                ? "全部关卡已完成"
                : `第 ${currentMilestone.stageNo} 关已开放`}
            </StatusPill>
          </div>

          <div className="map-board">
            <svg
              className="map-thread"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M17 84 C24 76 30 73 36 72 S51 82 57 78 S74 66 80 62 S54 49 47 46 S28 38 20 35 S27 22 34 18 S56 32 62 29 S78 20 84 17 S76 8 72 6" />
            </svg>
            <div className="map-node-layer">
              {milestones.map((milestone, index) => {
                const state = stateFor(milestone.id);
                const position = stagePositions[index];
                const available = state !== "locked";
                const content = (
                  <>
                    <span className="map-node__core">
                      {state === "done" ? (
                        <Check size={24} strokeWidth={3} aria-hidden="true" />
                      ) : state === "locked" ? (
                        <LockKeyhole
                          size={20}
                          strokeWidth={2.5}
                          aria-hidden="true"
                        />
                      ) : (
                        milestone.stageNo
                      )}
                    </span>
                    <span className="map-node__label">{milestone.name}</span>
                    <span className="map-node__meta">
                      {state === "done"
                        ? "三星通关"
                        : state === "current"
                          ? "当前小关"
                          : state === "available"
                            ? "可以挑战"
                            : "完成前置"}
                    </span>
                  </>
                );

                return available ? (
                  <Link
                    className="map-node"
                    data-state={state}
                    href={`/milestones/${milestone.id}`}
                    key={milestone.id}
                    style={
                      {
                        "--node-x": `${position.x}%`,
                        "--node-y": `${position.y}%`,
                      } as CSSProperties
                    }
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    className="map-node"
                    data-state={state}
                    disabled
                    key={milestone.id}
                    style={
                      {
                        "--node-x": `${position.x}%`,
                        "--node-y": `${position.y}%`,
                      } as CSSProperties
                    }
                    type="button"
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="milestone-panel" aria-labelledby="current-stage-title">
          <div className="milestone-panel__top">
            <StatusPill
              tone={
                battleOutcomes[currentMilestone.id]?.status === "won"
                  ? "success"
                  : "warning"
              }
            >
              {battleOutcomes[currentMilestone.id]?.status === "won"
                ? "世界已全部贯通"
                : "当前小关"}
            </StatusPill>
            <span className="stage-number">
              {String(currentMilestone.stageNo).padStart(2, "0")}
            </span>
          </div>
          <h2 id="current-stage-title">{currentMilestone.name}</h2>
          <p>{currentMilestone.summary}</p>

          <div className="node-brief">
            <Target size={19} strokeWidth={2.3} aria-hidden="true" />
            <div>
              <span>核心能力</span>
              <strong>{currentMilestone.theme}</strong>
            </div>
          </div>

          <MasteryMeter label="当前里程碑掌握度" value={masteryValue} />

          <ol className="chapter-mini-list">
            {currentMilestoneChapters.map((chapter) => {
              const done =
                battleOutcomes[currentMilestone.id]?.status === "won" ||
                passedChapterIds.includes(chapter.id);
              return (
                <li data-done={done} key={chapter.id}>
                  <StateIcon state={done ? "done" : "current"} />
                  <span>{chapter.title}</span>
                </li>
              );
            })}
          </ol>

          {currentMilestone.chapterIds.length > 0 ? (
            <Link
              className="button button--primary button--wide"
              href={`/milestones/${currentMilestone.id}`}
            >
              {currentMilestoneReady ? "发起挑战" : "继续闯关"}
              <ArrowRight size={19} aria-hidden="true" />
            </Link>
          ) : (
            <div className="coming-soon">
              <CirclePlay size={20} aria-hidden="true" />
              <div>
                <strong>下一阶段正在制作</strong>
                <span>首版先验证第一个小关的完整闭环。</span>
              </div>
            </div>
          )}

          <div className="boss-preview">
            <Shield size={21} strokeWidth={2.3} aria-hidden="true" />
            <span>Boss：{currentBoss?.name ?? "等待编排"}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </div>
        </aside>
      </div>
    </div>
  );
}

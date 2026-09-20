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
import { chapters, firstMilestone, milestones } from "@/content/math-grade4";
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
  const firstBossWon = battleOutcomes[firstMilestone.id]?.status === "won";
  const firstMilestoneReady = firstMilestone.chapterIds.every((chapterId) =>
    passedChapterIds.includes(chapterId),
  );
  const currentMilestone = firstBossWon ? milestones[1] : firstMilestone;
  const completedMilestones = milestones.filter(
    (milestone) => battleOutcomes[milestone.id]?.status === "won",
  ).length;
  const firstMilestonePassedCount = passedChapterIds.filter((chapterId) =>
    firstMilestone.chapterIds.includes(chapterId),
  ).length;
  const mastery = calculateMasteryBreakdown({
    completedChapters: firstMilestonePassedCount,
    totalChapters: firstMilestone.chapterIds.length,
    bossOutcome: battleOutcomes[firstMilestone.id],
  });
  const masteryValue = mastery.score;

  function stateFor(milestoneId: string): MilestoneState {
    if (battleOutcomes[milestoneId]?.status === "won") return "done";
    if (milestoneId === firstMilestone.id) {
      return firstMilestoneReady ? "available" : "current";
    }
    if (milestoneId === milestones[1].id && firstBossWon) return "current";
    return "locked";
  }

  return (
    <div className={`page-shell${ready ? "" : " page-shell--loading"}`}>
      <PageIntro
        eyebrow="四年级数学"
        title="分数群岛"
        description="先把整体与部分看清楚，再穿过分数裂谷，挑战第一个 Boss。"
        aside={
          <div className="world-summary">
            <div>
              <span>已完成</span>
              <strong>{completedMilestones}/10</strong>
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
            <StatusPill tone="info">第 1 关已开放</StatusPill>
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
            <StatusPill tone={firstBossWon ? "success" : "warning"}>
              {firstBossWon ? "世界继续前进" : "当前小关"}
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
            {chapters.map((chapter) => {
              const done =
                firstBossWon || passedChapterIds.includes(chapter.id);
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
              {firstBossWon ? "继续下一关" : firstMilestoneReady ? "发起挑战" : "继续闯关"}
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
            <span>Boss：分数守卫</span>
            <ChevronRight size={18} aria-hidden="true" />
          </div>
        </aside>
      </div>
    </div>
  );
}

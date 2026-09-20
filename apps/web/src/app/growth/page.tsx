"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, BookOpenCheck, Target, Trophy } from "lucide-react";
import { chapters, firstMilestone, getNode, milestones } from "@/content/math-grade4";
import { useProgress } from "@/components/progress-provider";
import { MasteryMeter, PageIntro, StatusPill } from "@/components/ui";

export default function GrowthPage() {
  const { passedChapterIds, battleOutcomes } = useProgress();
  const firstOutcome = battleOutcomes[firstMilestone.id];
  const passedCount = chapters.filter((chapter) =>
    passedChapterIds.includes(chapter.id),
  ).length;
  const mastery = firstOutcome?.status === "won" ? 88 : passedCount * 20;
  const completedMilestones = milestones.filter(
    (milestone) => battleOutcomes[milestone.id]?.status === "won",
  ).length;

  return (
    <div className="page-shell">
      <PageIntro
        eyebrow="学习成长"
        title="掌握度地图"
        description="这里记录章节证据、Boss 验证和下一步复习建议，不展示公开排名。"
        aside={
          <StatusPill tone={firstOutcome?.status === "won" ? "success" : "info"}>
            {completedMilestones} 个小关已通过
          </StatusPill>
        }
      />

      <div className="growth-grid">
        <section className="growth-card growth-card--main">
          <div className="section-heading">
            <div>
              <span className="eyebrow">当前节点</span>
              <h2>{getNode("math.fractions_decimals.fraction_meaning")?.name}</h2>
            </div>
            <Target size={25} strokeWidth={2.2} aria-hidden="true" />
          </div>
          <MasteryMeter label="综合掌握度" value={mastery} />
          <div className="mastery-breakdown">
            <div>
              <BookOpenCheck size={20} aria-hidden="true" />
              <span>章节完成</span>
              <strong>{Math.min(20, passedCount * 7)} / 20</strong>
            </div>
            <div>
              <Trophy size={20} aria-hidden="true" />
              <span>Boss 验证</span>
              <strong>{firstOutcome?.status === "won" ? 40 : 0} / 40</strong>
            </div>
            <div>
              <BarChart3 size={20} aria-hidden="true" />
              <span>练习证据</span>
              <strong>{Math.min(30, passedCount * 10)} / 30</strong>
            </div>
          </div>
        </section>

        <section className="growth-card">
          <span className="eyebrow">待补强</span>
          {firstOutcome?.status === "lost" && firstOutcome.mistakes.length ? (
            <>
              <h2>分数意义与等值分数</h2>
              <p>本局记录了 {firstOutcome.mistakes.length} 个薄弱点。</p>
              <Link
                className="button button--primary button--wide"
                href={`/remediation/${firstMilestone.id}`}
              >
                开始补课
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </>
          ) : firstOutcome?.status === "won" ? (
            <>
              <h2>本节点已掌握</h2>
              <p>建议在 7 天后做一次短复习，保留长期记忆。</p>
              <StatusPill tone="success">下次复习：7 天后</StatusPill>
            </>
          ) : (
            <>
              <h2>还没有战斗证据</h2>
              <p>完成 3 个章节并挑战 Boss 后，这里会给出补强建议。</p>
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
            <span className="mastery-row__dot" data-done={mastery >= 60} />
            <div>
              <strong>分数意义与等值分数</strong>
              <span>{mastery >= 80 ? "已掌握" : mastery >= 60 ? "初步掌握" : "学习中"}</span>
            </div>
            <strong>{mastery}%</strong>
          </div>
          <div className="mastery-row">
            <span className="mastery-row__dot" />
            <div>
              <strong>分数比较与四则运算</strong>
              <span>等待前置节点掌握</span>
            </div>
            <strong>0%</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

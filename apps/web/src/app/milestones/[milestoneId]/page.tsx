"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Construction,
  Shield,
  Target,
} from "lucide-react";
import { chapters, getMilestone, getNode } from "@/content/math-grade4";
import { useProgress } from "@/components/progress-provider";
import { MasteryMeter, PageIntro, StatusPill } from "@/components/ui";

export default function MilestonePage() {
  const params = useParams<{ milestoneId: string }>();
  const searchParams = useSearchParams();
  const { passedChapterIds, battleOutcomes } = useProgress();
  const milestone = getMilestone(params.milestoneId);

  if (!milestone) {
    return (
      <div className="page-shell narrow-shell">
        <div className="empty-state">
          <Construction size={30} aria-hidden="true" />
          <h1>没有找到这个小关</h1>
          <p>返回世界地图，选择已经开放的能力路线。</p>
          <Link className="button button--primary" href="/">
            返回地图
          </Link>
        </div>
      </div>
    );
  }

  const milestoneChapters = chapters.filter((chapter) =>
    milestone.chapterIds.includes(chapter.id),
  );
  const outcome = battleOutcomes[milestone.id];
  const passedCount = milestoneChapters.filter((chapter) =>
    passedChapterIds.includes(chapter.id),
  ).length;
  const ready =
    milestoneChapters.length > 0 && passedCount === milestoneChapters.length;
  const mastery = outcome?.status === "won"
    ? 88
    : Math.round((passedCount / Math.max(1, milestoneChapters.length)) * 72);
  const primaryChapter =
    milestoneChapters.find(
      (chapter) => !passedChapterIds.includes(chapter.id),
    ) ?? milestoneChapters[0];

  if (milestone.chapterIds.length === 0) {
    return (
      <div className="page-shell narrow-shell">
        <div className="empty-state empty-state--soft">
          <Construction size={30} aria-hidden="true" />
          <StatusPill>内容制作中</StatusPill>
          <h1>{milestone.name}</h1>
          <p>
            第一版只完成第一个小关的垂直切片。这里保留完整路线位置，不用占位题冒充可用内容。
          </p>
          <Link className="button button--secondary" href="/">
            <ArrowLeft size={18} aria-hidden="true" />
            返回世界地图
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <Link className="back-link" href="/">
        <ArrowLeft size={18} aria-hidden="true" />
        返回世界地图
      </Link>

      <PageIntro
        eyebrow={`第 ${milestone.stageNo} 个小关`}
        title={milestone.name}
        description={milestone.summary}
        aside={
          <StatusPill
            tone={
              outcome?.status === "won"
                ? "success"
                : ready
                  ? "info"
                  : "warning"
            }
          >
            {outcome?.status === "won"
              ? "已通关"
              : ready
                ? "Boss 已解锁"
                : "先完成章节"}
          </StatusPill>
        }
      />

      {searchParams.get("remediation") ? (
        <div className="notice-banner">
          <Shield size={20} aria-hidden="true" />
          <div>
            <strong>先补强薄弱节点，再回到 Boss</strong>
            <span>
              {outcome?.mistakes.length
                ? `本局有 ${outcome.mistakes.length} 道题需要复盘。`
                : "章节进度已经保留。"}
            </span>
          </div>
          <Link className="button button--quiet" href={`/remediation/${milestone.id}`}>
            开始补课
          </Link>
        </div>
      ) : null}

      <div className="milestone-detail-layout">
        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">学习章节</span>
              <h2>先学 3 个短章节</h2>
            </div>
            <span className="section-count">
              {passedCount}/{milestoneChapters.length} 完成
            </span>
          </div>

          <ol className="chapter-list">
            {milestoneChapters.map((chapter, index) => {
              const done = passedChapterIds.includes(chapter.id);
              const current = !done && chapter.id === primaryChapter?.id;
              const state = done ? "done" : current ? "current" : "locked";

              return (
                <li className="chapter-row" data-state={state} key={chapter.id}>
                  <span className="chapter-row__index">
                    {done ? (
                      <Check size={19} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <div className="chapter-row__body">
                    <strong>{chapter.title}</strong>
                    <span>{chapter.summary}</span>
                    <small>
                      <Clock3 size={14} aria-hidden="true" />
                      约 {chapter.estimatedMinutes} 分钟
                    </small>
                  </div>
                  <Link
                    className="button button--quiet"
                    href={`/chapters/${chapter.id}`}
                  >
                    {done ? "复习" : current ? "开始" : "查看"}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="detail-sidebar">
          <section className="target-panel">
            <Target size={21} strokeWidth={2.4} aria-hidden="true" />
            <span className="eyebrow">目标节点</span>
            <h2>{getNode(milestone.nodeIds[0])?.name}</h2>
            <ul>
              {getNode(milestone.nodeIds[0])?.mastery.map((item) => (
                <li key={item}>
                  <Check size={17} strokeWidth={2.6} aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className="boss-card">
            <div className="boss-card__icon">
              <Shield size={27} strokeWidth={2.2} aria-hidden="true" />
            </div>
            <span className="eyebrow">Boss 验证</span>
            <h2>分数守卫</h2>
            <p>9 点生命，Boss 前进 5 步会碰到你。连续答对会触发额外伤害。</p>
            <MasteryMeter label="当前掌握度" value={mastery} />
            {ready || outcome?.status === "won" ? (
              <Link
                className="button button--primary button--wide"
                href={`/boss/${milestone.id}`}
              >
                {outcome?.status === "won" ? "重新挑战" : "发起挑战"}
                <ArrowRight size={19} aria-hidden="true" />
              </Link>
            ) : (
              <button className="button button--primary button--wide" disabled>
                <BookOpen size={18} aria-hidden="true" />
                完成章节后解锁
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  GraduationCap,
  Heart,
  LoaderCircle,
  Shield,
  Timer,
  Zap,
} from "lucide-react";
import type { BattleMode } from "@knowgate/domain";
import { chapters, getBoss, getMilestone } from "@/content/math-grade4";
import { useProgress } from "@/components/progress-provider";
import { StatusPill } from "@/components/ui";
import { profileHeaders } from "@/lib/profile";
import { defaultSettings, readSettings, type LearningSettings } from "@/lib/settings";

export default function BossBriefPage() {
  const params = useParams<{ milestoneId: string }>();
  const router = useRouter();
  const { passedChapterIds } = useProgress();
  const milestone = getMilestone(params.milestoneId);
  const [settings, setSettings] = useState<LearningSettings>(defaultSettings);
  const [mode, setMode] = useState<BattleMode>("standard");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedSettings = readSettings();
    setSettings(savedSettings);
    setMode(savedSettings.learningMode ? "learning" : "standard");
  }, []);

  const boss = milestone ? getBoss(milestone.bossId) : undefined;

  if (!milestone || !boss) {
    return (
      <div className="page-shell narrow-shell">
        <div className="empty-state">
          <Shield size={30} aria-hidden="true" />
          <h1>没有找到这个挑战</h1>
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
  const ready =
    milestoneChapters.length > 0 &&
    milestoneChapters.every((chapter) => passedChapterIds.includes(chapter.id));

  async function startBattle() {
    if (!milestone || !ready || starting) return;
    setStarting(true);
    setError("");

    try {
      const response = await fetch("/api/v1/battles", {
        method: "POST",
        headers: profileHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          milestoneId: milestone.id,
          mode,
          extendedTime: settings.extendedTime,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "无法创建挑战。");
      }
      router.push(`/battle/${payload.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建挑战。");
      setStarting(false);
    }
  }

  return (
    <div className="page-shell boss-brief-page">
      <Link className="back-link" href={`/milestones/${milestone.id}`}>
        <ArrowLeft size={18} aria-hidden="true" />
        返回小关
      </Link>

      <div className="boss-brief-layout">
        <section className="boss-hero-panel">
          <div className="boss-emblem" aria-hidden="true">
            <Shield size={54} strokeWidth={1.9} />
            <span>{boss.hp}</span>
          </div>
          <StatusPill tone="warning">Boss 挑战</StatusPill>
          <h1>{boss.name}</h1>
          <p>
            {boss.epithet}。答对会削减生命；答错或超时会让它前进一步。
          </p>
          <div className="boss-rules">
            <div>
              <Heart size={19} aria-hidden="true" />
              <span>生命</span>
              <strong>{boss.hp}</strong>
            </div>
            <div>
              <Zap size={19} aria-hidden="true" />
              <span>逼近</span>
              <strong>{boss.initialDistance} 步</strong>
            </div>
            <div>
              <Timer size={19} aria-hidden="true" />
              <span>题目</span>
              <strong>{boss.questionIds.length} 题</strong>
            </div>
          </div>
        </section>

        <section className="mode-panel">
          <span className="eyebrow">选择答题模式</span>
          <h2>倒计时要参与胜负吗？</h2>
          <div className="mode-options">
            <label className="mode-option" data-selected={mode === "standard"}>
              <input
                checked={mode === "standard"}
                name="battle-mode"
                onChange={() => setMode("standard")}
                type="radio"
              />
              <Timer size={22} aria-hidden="true" />
              <span>
                <strong>标准模式</strong>
                <small>超时视为答错，Boss 前进一步。</small>
              </span>
            </label>
            <label className="mode-option" data-selected={mode === "learning"}>
              <input
                checked={mode === "learning"}
                name="battle-mode"
                onChange={() => setMode("learning")}
                type="radio"
              />
              <GraduationCap size={22} aria-hidden="true" />
              <span>
                <strong>学习模式</strong>
                <small>超时只影响星级，不推进 Boss。</small>
              </span>
            </label>
          </div>

          <div className="boss-tip">
            <BookOpenCheck size={20} aria-hidden="true" />
            <span>连续答对第 3 题和第 5 题，会额外造成 1 点伤害。</span>
          </div>

          {!ready ? (
            <div className="notice-banner notice-banner--warning">
              先完成 {milestoneChapters.length} 个学习章节，才能开始挑战。
            </div>
          ) : null}
          {error ? <div className="inline-error">{error}</div> : null}

          <button
            className="button button--primary button--wide"
            disabled={!ready || starting}
            onClick={startBattle}
            type="button"
          >
            {starting ? (
              <>
                <LoaderCircle className="spin" size={19} aria-hidden="true" />
                正在准备题目
              </>
            ) : (
              <>
                开始挑战
                <ArrowRight size={19} aria-hidden="true" />
              </>
            )}
          </button>
          <Link
            className="button button--quiet button--wide"
            href={`/milestones/${milestone.id}`}
          >
            返回复习
          </Link>
        </section>
      </div>
    </div>
  );
}

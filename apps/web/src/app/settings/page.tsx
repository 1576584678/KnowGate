"use client";

import { useEffect, useState } from "react";
import { Clock3, RotateCcw, Settings2, Sparkles, Volume2 } from "lucide-react";
import { useProgress } from "@/components/progress-provider";
import { PageIntro, StatusPill } from "@/components/ui";

type SettingsState = {
  learningMode: boolean;
  extendedTime: boolean;
  reducedMotion: boolean;
  sound: boolean;
};

const defaultSettings: SettingsState = {
  learningMode: false,
  extendedTime: false,
  reducedMotion: false,
  sound: true,
};

export default function SettingsPage() {
  const { resetProgress } = useProgress();
  const [settings, setSettings] = useState(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("knowgate.settings.v1");
      if (raw) setSettings({ ...defaultSettings, ...JSON.parse(raw) });
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("knowgate.settings.v1", JSON.stringify(settings));
    document.documentElement.dataset.reducedMotion = settings.reducedMotion
      ? "true"
      : "false";
  }, [settings]);

  function update<Key extends keyof SettingsState>(
    key: Key,
    value: SettingsState[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }

  return (
    <div className="page-shell narrow-shell">
      <PageIntro
        eyebrow="使用设置"
        title="让节奏适合学习者"
        description="学习模式和倒计时设置会应用到后续 Boss 挑战。"
        aside={saved ? <StatusPill tone="success">已保存</StatusPill> : null}
      />

      <section className="settings-panel">
        <div className="settings-panel__heading">
          <Settings2 size={24} strokeWidth={2.2} aria-hidden="true" />
          <div>
            <h2>学习体验</h2>
            <p>首次学习建议打开学习模式和延长倒计时。</p>
          </div>
        </div>

        <SettingRow
          checked={settings.learningMode}
          description="超时不推进 Boss，但仍会记录错题节点。"
          icon={Sparkles}
          label="优先使用学习模式"
          onChange={(checked) => update("learningMode", checked)}
        />
        <SettingRow
          checked={settings.extendedTime}
          description="为阅读较慢的学习者提供额外时间缓冲。"
          icon={Clock3}
          label="延长倒计时"
          onChange={(checked) => update("extendedTime", checked)}
        />
        <SettingRow
          checked={settings.reducedMotion}
          description="关闭抖动、伤害数字和大幅位移动画。"
          icon={RotateCcw}
          label="减少动态效果"
          onChange={(checked) => update("reducedMotion", checked)}
        />
        <SettingRow
          checked={settings.sound}
          description="保留答题和战斗反馈音效。"
          icon={Volume2}
          label="音效与触感"
          onChange={(checked) => update("sound", checked)}
        />
      </section>

      <section className="settings-panel danger-panel">
        <h2>本地数据</h2>
        <p>当前 MVP 把学习进度保存在这个浏览器中。重置后无法恢复。</p>
        <button
          className="button button--danger"
          onClick={() => {
            resetProgress();
            setSaved(true);
            window.setTimeout(() => setSaved(false), 1200);
          }}
          type="button"
        >
          重置学习进度
        </button>
      </section>
    </div>
  );
}

function SettingRow({
  checked,
  description,
  icon: Icon,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  icon: typeof Sparkles;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="setting-row">
      <span className="setting-row__icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="setting-row__copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="toggle" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

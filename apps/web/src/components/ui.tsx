import type { ReactNode } from "react";
import { CheckCircle2, Circle, LockKeyhole } from "lucide-react";

export function PageIntro({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside ? <div className="page-intro__aside">{aside}</div> : null}
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "info";
  children: ReactNode;
}) {
  return (
    <span className="status-pill" data-tone={tone}>
      {children}
    </span>
  );
}

export function StateIcon({
  state,
}: {
  state: "done" | "current" | "available" | "locked";
}) {
  if (state === "done") {
    return <CheckCircle2 size={18} strokeWidth={2.4} aria-hidden="true" />;
  }
  if (state === "locked") {
    return <LockKeyhole size={17} strokeWidth={2.4} aria-hidden="true" />;
  }
  return <Circle size={17} strokeWidth={2.4} aria-hidden="true" />;
}

export function MasteryMeter({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="mastery-meter">
      <div className="mastery-meter__labels">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div
        className="mastery-meter__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

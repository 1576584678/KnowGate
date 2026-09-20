"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BattleMistake } from "@knowgate/domain";

export type BattleOutcome = {
  milestoneId: string;
  status: "won" | "lost";
  accuracy: number;
  maxCombo: number;
  mistakes: BattleMistake[];
  completedAt: string;
};

type ProgressState = {
  passedChapterIds: string[];
  battleOutcomes: Record<string, BattleOutcome>;
};

type ProgressContextValue = ProgressState & {
  ready: boolean;
  completeChapter: (chapterId: string) => void;
  recordBattle: (outcome: BattleOutcome) => void;
  resetProgress: () => void;
};

const STORAGE_KEY = "knowgate.progress.v1";

const emptyProgress: ProgressState = {
  passedChapterIds: [],
  battleOutcomes: {},
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

function readProgress(): ProgressState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyProgress;
    const parsed = JSON.parse(saved) as Partial<ProgressState>;
    return {
      passedChapterIds: Array.isArray(parsed.passedChapterIds)
        ? parsed.passedChapterIds.filter(
            (chapterId): chapterId is string => typeof chapterId === "string",
          )
        : [],
      battleOutcomes:
        parsed.battleOutcomes && typeof parsed.battleOutcomes === "object"
          ? (parsed.battleOutcomes as Record<string, BattleOutcome>)
          : {},
    };
  } catch {
    return emptyProgress;
  }
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(emptyProgress);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProgress(readProgress());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, ready]);

  const value = useMemo<ProgressContextValue>(
    () => ({
      ...progress,
      ready,
      completeChapter(chapterId) {
        setProgress((current) => ({
          ...current,
          passedChapterIds: current.passedChapterIds.includes(chapterId)
            ? current.passedChapterIds
            : [...current.passedChapterIds, chapterId],
        }));
      },
      recordBattle(outcome) {
        setProgress((current) => ({
          ...current,
          battleOutcomes: {
            ...current.battleOutcomes,
            [outcome.milestoneId]: outcome,
          },
        }));
      },
      resetProgress() {
        setProgress(emptyProgress);
      },
    }),
    [progress, ready],
  );

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const value = useContext(ProgressContext);
  if (!value) {
    throw new Error("useProgress must be used inside ProgressProvider.");
  }
  return value;
}

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  BattleOutcome,
  ProgressSnapshot,
} from "@knowgate/domain";
import { profileHeaders } from "@/lib/profile";

type ProgressContextValue = ProgressSnapshot & {
  ready: boolean;
  completeChapter: (chapterId: string) => void;
  recordBattle: (outcome: BattleOutcome) => void;
  resetProgress: () => void;
};

const STORAGE_KEY = "knowgate.progress.v1";

const emptyProgress: ProgressSnapshot = {
  passedChapterIds: [],
  battleOutcomes: {},
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

function normalizeProgress(value: unknown): ProgressSnapshot {
  if (!value || typeof value !== "object") return emptyProgress;
  const parsed = value as Partial<ProgressSnapshot>;
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
}

function readLocalProgress(): ProgressSnapshot {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeProgress(JSON.parse(saved)) : emptyProgress;
  } catch {
    return emptyProgress;
  }
}

function mergeProgress(
  server: ProgressSnapshot,
  local: ProgressSnapshot,
): ProgressSnapshot {
  const passedChapterIds = Array.from(
    new Set([...server.passedChapterIds, ...local.passedChapterIds]),
  );
  const battleOutcomes = { ...server.battleOutcomes };

  for (const [milestoneId, localOutcome] of Object.entries(
    local.battleOutcomes,
  )) {
    const serverOutcome = battleOutcomes[milestoneId];
    if (
      !serverOutcome ||
      Date.parse(localOutcome.completedAt) >
        Date.parse(serverOutcome.completedAt)
    ) {
      battleOutcomes[milestoneId] = localOutcome;
    }
  }

  return { passedChapterIds, battleOutcomes };
}

async function requestProgress(
  method: "POST" | "DELETE",
  body?: unknown,
): Promise<ProgressSnapshot | null> {
  try {
    const response = await fetch("/api/v1/progress", {
      method,
      headers:
        body === undefined
          ? profileHeaders()
          : profileHeaders({ "Content-Type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { progress?: unknown };
    return payload.progress ? normalizeProgress(payload.progress) : null;
  } catch {
    return null;
  }
}

async function migrateLocalProgress(
  serverProgress: ProgressSnapshot,
  localProgress: ProgressSnapshot,
) {
  const serverChapters = new Set(serverProgress.passedChapterIds);
  const chapterUpdates = localProgress.passedChapterIds
    .filter((chapterId) => !serverChapters.has(chapterId))
    .map((chapterId) =>
      requestProgress("POST", {
        type: "chapter_completed",
        chapterId,
      }),
    );

  const outcomeUpdates = Object.entries(localProgress.battleOutcomes)
    .filter(([milestoneId, localOutcome]) => {
      const serverOutcome = serverProgress.battleOutcomes[milestoneId];
      return (
        !serverOutcome ||
        Date.parse(localOutcome.completedAt) >
          Date.parse(serverOutcome.completedAt)
      );
    })
    .map(([, outcome]) =>
      requestProgress("POST", {
        type: "battle_recorded",
        outcome,
      }),
    );

  await Promise.allSettled([...chapterUpdates, ...outcomeUpdates]);
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressSnapshot>(emptyProgress);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const localProgress = readLocalProgress();
    setProgress(localProgress);
    setReady(true);

    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const response = await fetch("/api/v1/progress", {
          headers: profileHeaders(),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { progress?: unknown };
        const serverProgress = normalizeProgress(payload.progress);
        const merged = mergeProgress(serverProgress, localProgress);

        if (!cancelled) setProgress(merged);
        await migrateLocalProgress(serverProgress, localProgress);
      } catch {
        // Local progress remains available when the API is offline.
      }
    }

    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
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
        void requestProgress("POST", {
          type: "chapter_completed",
          chapterId,
        });
      },
      recordBattle(outcome) {
        setProgress((current) => ({
          ...current,
          battleOutcomes: {
            ...current.battleOutcomes,
            [outcome.milestoneId]: outcome,
          },
        }));
        void requestProgress("POST", {
          type: "battle_recorded",
          outcome,
        });
      },
      resetProgress() {
        setProgress(emptyProgress);
        void requestProgress("DELETE");
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

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
  ChapterCompletionAnswer,
  ChapterCompletionResult,
  ProgressSnapshot,
} from "@knowgate/domain";
import { profileHeaders } from "@/lib/profile";

export type ChapterCompletionOutcome =
  | {
      status: "recorded";
      result: ChapterCompletionResult;
      progress: ProgressSnapshot;
    }
  | { status: "rejected"; code: string; message: string }
  | { status: "offline" };

type ProgressContextValue = ProgressSnapshot & {
  ready: boolean;
  completeChapter: (input: {
    chapterId: string;
    answers: ChapterCompletionAnswer[];
    durationSec: number;
    contentVersion: string;
  }) => Promise<ChapterCompletionOutcome>;
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

async function requestServerProgress(
  method: "GET" | "DELETE",
): Promise<ProgressSnapshot | null> {
  try {
    const response = await fetch("/api/v1/progress", {
      method,
      headers: profileHeaders(),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { progress?: unknown };
    return payload.progress ? normalizeProgress(payload.progress) : null;
  } catch {
    return null;
  }
}

async function requestChapterCompletion(input: {
  chapterId: string;
  answers: ChapterCompletionAnswer[];
  durationSec: number;
  contentVersion: string;
}): Promise<ChapterCompletionOutcome> {
  let response: Response;

  try {
    response = await fetch(
      `/api/v1/chapters/${encodeURIComponent(input.chapterId)}/complete`,
      {
        method: "POST",
        headers: profileHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          answers: input.answers,
          durationSec: input.durationSec,
          contentVersion: input.contentVersion,
        }),
      },
    );
  } catch {
    return { status: "offline" };
  }

  if (!response.ok) {
    let code = "CHAPTER_COMPLETION_REJECTED";
    let message = "服务器没有保存这次章节完成，请稍后重试。";

    try {
      const errorPayload = (await response.json()) as {
        error?: { code?: unknown; message?: unknown };
      };
      if (typeof errorPayload.error?.code === "string") {
        code = errorPayload.error.code;
      }
      if (typeof errorPayload.error?.message === "string") {
        message = errorPayload.error.message;
      }
    } catch {
      // Keep the generic rejection message when the body is not JSON.
    }

    return { status: "rejected", code, message };
  }

  try {
    const payload = (await response.json()) as {
      result?: ChapterCompletionResult;
      progress?: unknown;
    };
    if (!payload.result) {
      return {
        status: "rejected",
        code: "INVALID_COMPLETION_RESPONSE",
        message: "服务器返回的判题结果不完整。",
      };
    }

    return {
      status: "recorded",
      result: payload.result,
      progress: normalizeProgress(payload.progress),
    };
  } catch {
    return {
      status: "rejected",
      code: "INVALID_COMPLETION_RESPONSE",
      message: "服务器返回的判题结果无法解析。",
    };
  }
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
      const serverProgress = await requestServerProgress("GET");
      if (!cancelled && serverProgress) {
        // The server is the source of truth. Once it answers, stale local
        // progress from older clients is replaced instead of merged forward.
        setProgress(serverProgress);
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
      async completeChapter(input) {
        const outcome = await requestChapterCompletion(input);
        if (outcome.status === "recorded") {
          setProgress(outcome.progress);
        }
        return outcome;
      },
      recordBattle(outcome) {
        setProgress((current) => ({
          ...current,
          battleOutcomes: {
            ...current.battleOutcomes,
            [outcome.milestoneId]: outcome,
          },
        }));
        void requestServerProgress("GET").then((serverProgress) => {
          if (serverProgress) setProgress(serverProgress);
        });
      },
      resetProgress() {
        setProgress(emptyProgress);
        void requestServerProgress("DELETE");
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

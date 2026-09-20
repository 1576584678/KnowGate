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
  Boss,
  Chapter,
  ContentQuestion,
  KnowledgeNode,
  Milestone,
} from "@knowgate/domain";
import {
  bossQuestions as baseBossQuestions,
  bosses as baseBosses,
  chapters as baseChapters,
  gradeWorld as baseGradeWorld,
  knowledgeNodes as baseKnowledgeNodes,
  milestones as baseMilestones,
} from "@/content/math-grade4";

type RuntimeGraph = {
  contentVersion: string;
  nodes: KnowledgeNode[];
  chapters: Chapter[];
  milestones: Milestone[];
  bosses: Boss[];
  questions: ContentQuestion[];
};

type ContentContextValue = {
  ready: boolean;
  gradeWorld: typeof baseGradeWorld;
  chapters: Chapter[];
  milestones: Milestone[];
  bosses: Boss[];
  knowledgeNodes: KnowledgeNode[];
  bossQuestions: ContentQuestion[];
  getChapter: (chapterId: string) => Chapter | undefined;
  getMilestone: (milestoneId: string) => Milestone | undefined;
  getBoss: (bossId: string) => Boss | undefined;
  getNode: (nodeId: string) => KnowledgeNode | undefined;
};

const staticGraph: RuntimeGraph = {
  contentVersion: baseGradeWorld.contentVersion,
  nodes: baseKnowledgeNodes,
  chapters: baseChapters,
  milestones: baseMilestones,
  bosses: baseBosses,
  questions: baseBossQuestions,
};

const ContentContext = createContext<ContentContextValue | null>(null);

function isRuntimeGraph(value: unknown): value is RuntimeGraph {
  if (!value || typeof value !== "object") return false;
  const graph = value as Partial<RuntimeGraph>;
  return (
    typeof graph.contentVersion === "string" &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.chapters) &&
    Array.isArray(graph.milestones) &&
    Array.isArray(graph.bosses) &&
    Array.isArray(graph.questions)
  );
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [graph, setGraph] = useState<RuntimeGraph>(staticGraph);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const response = await fetch("/api/v1/content");
        if (!response.ok) return;
        const payload = (await response.json()) as { content?: unknown };
        if (!cancelled && isRuntimeGraph(payload.content)) {
          setGraph(payload.content);
          setReady(true);
        }
      } catch {
        // Static seed content stays available when the content API is offline.
      }
    }

    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ContentContextValue>(() => {
    const chaptersById = new Map(
      graph.chapters.map((chapter) => [chapter.id, chapter]),
    );
    const milestonesById = new Map(
      graph.milestones.map((milestone) => [milestone.id, milestone]),
    );
    const bossesById = new Map(graph.bosses.map((boss) => [boss.id, boss]));
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

    return {
      ready,
      gradeWorld: { ...baseGradeWorld, contentVersion: graph.contentVersion },
      chapters: graph.chapters,
      milestones: graph.milestones,
      bosses: graph.bosses,
      knowledgeNodes: graph.nodes,
      bossQuestions: graph.questions,
      getChapter: (chapterId) => chaptersById.get(chapterId),
      getMilestone: (milestoneId) => milestonesById.get(milestoneId),
      getBoss: (bossId) => bossesById.get(bossId),
      getNode: (nodeId) => nodesById.get(nodeId),
    };
  }, [graph, ready]);

  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}

export function useContent() {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error("useContent must be used within ContentProvider");
  }
  return context;
}

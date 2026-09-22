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
  KnowledgeNode,
  Milestone,
  PublicChapter,
  PublicContentQuestion,
} from "@knowgate/domain";
import { profileFetch } from "@/lib/profile-client";

type RuntimeGraph = {
  contentVersion: string;
  nodes: KnowledgeNode[];
  chapters: PublicChapter[];
  milestones: Milestone[];
  bosses: Boss[];
  questions: PublicContentQuestion[];
};

type GradeWorldSummary = {
  id: string;
  subjectId: string;
  grade: number;
  name: string;
  contentVersion: string;
  totalStages: number;
};

type ContentContextValue = {
  ready: boolean;
  gradeWorld: GradeWorldSummary;
  chapters: PublicChapter[];
  milestones: Milestone[];
  bosses: Boss[];
  knowledgeNodes: KnowledgeNode[];
  bossQuestions: PublicContentQuestion[];
  getChapter: (chapterId: string) => PublicChapter | undefined;
  getMilestone: (milestoneId: string) => Milestone | undefined;
  getBoss: (bossId: string) => Boss | undefined;
  getNode: (nodeId: string) => KnowledgeNode | undefined;
};

const fallbackGradeWorld: GradeWorldSummary = {
  id: "math.g4",
  subjectId: "math",
  grade: 4,
  name: "四年级 · 分数群岛",
  contentVersion: "2026.09.20.6",
  totalStages: 10,
};

const emptyGraph: RuntimeGraph = {
  contentVersion: fallbackGradeWorld.contentVersion,
  nodes: [],
  chapters: [],
  milestones: [],
  bosses: [],
  questions: [],
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
  const [graph, setGraph] = useState<RuntimeGraph>(emptyGraph);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromServer() {
      try {
        const response = await profileFetch("/api/v1/content");
        if (!response.ok) throw new Error("CONTENT_LOAD_FAILED");
        const payload = (await response.json()) as { content?: unknown };
        if (!cancelled && isRuntimeGraph(payload.content)) {
          setGraph(payload.content);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setError("课程内容加载失败，请刷新页面后重试。");
        }
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
      gradeWorld: {
        ...fallbackGradeWorld,
        contentVersion: graph.contentVersion,
      },
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

  if (!ready) {
    return (
      <div className="page-shell">
        <div className="empty-state">
          <h1>{error || "正在加载课程内容"}</h1>
        </div>
      </div>
    );
  }

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

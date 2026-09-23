"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
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
  worlds: GradeWorldSummary[];
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
  gradeWorlds: GradeWorldSummary[];
  gradeWorld: GradeWorldSummary;
  chapters: PublicChapter[];
  milestones: Milestone[];
  bosses: Boss[];
  knowledgeNodes: KnowledgeNode[];
  bossQuestions: PublicContentQuestion[];
  setGradeWorld: (gradeWorldId: string) => void;
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
  contentVersion: "2026.09.23.1",
  totalStages: 10,
};

const fallbackGradeWorlds: GradeWorldSummary[] = [
  {
    id: "math.g1",
    subjectId: "math",
    grade: 1,
    name: "一年级 · 数字启蒙岛",
    contentVersion: fallbackGradeWorld.contentVersion,
    totalStages: 10,
  },
  {
    id: "math.g2",
    subjectId: "math",
    grade: 2,
    name: "二年级 · 运算森林",
    contentVersion: fallbackGradeWorld.contentVersion,
    totalStages: 10,
  },
  {
    id: "math.g3",
    subjectId: "math",
    grade: 3,
    name: "三年级 · 算术高原",
    contentVersion: fallbackGradeWorld.contentVersion,
    totalStages: 10,
  },
  fallbackGradeWorld,
  {
    id: "math.g5",
    subjectId: "math",
    grade: 5,
    name: "五年级 · 比例峡谷",
    contentVersion: fallbackGradeWorld.contentVersion,
    totalStages: 10,
  },
  {
    id: "math.g6",
    subjectId: "math",
    grade: 6,
    name: "六年级 · 比例星环",
    contentVersion: fallbackGradeWorld.contentVersion,
    totalStages: 10,
  },
];

const emptyGraph: RuntimeGraph = {
  contentVersion: fallbackGradeWorld.contentVersion,
  worlds: fallbackGradeWorlds,
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
    Array.isArray(graph.worlds) &&
    Array.isArray(graph.nodes) &&
    Array.isArray(graph.chapters) &&
    Array.isArray(graph.milestones) &&
    Array.isArray(graph.bosses) &&
    Array.isArray(graph.questions)
  );
}

function gradeWorldIdFromPath(pathname: string) {
  const match = /(?:math|chapter)\.g(\d+)\./u.exec(pathname);
  return match ? `math.g${match[1]}` : undefined;
}

function sortGradeWorlds(worlds: GradeWorldSummary[]) {
  return [...worlds].sort(
    (left, right) =>
      left.grade - right.grade || left.id.localeCompare(right.id),
  );
}

const contentCacheKey = "knowgate.contentCache.v1";

function readCachedGraph(): RuntimeGraph | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(contentCacheKey);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    return isRuntimeGraph(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedGraph(graph: RuntimeGraph) {
  try {
    window.localStorage.setItem(contentCacheKey, JSON.stringify(graph));
  } catch {
    // Storage may be unavailable or full; the server response still applies.
  }
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [graph, setGraph] = useState<RuntimeGraph>(emptyGraph);
  const [selectedGradeWorldId, setSelectedGradeWorldId] = useState(
    fallbackGradeWorld.id,
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedGraph();

    // Render from the previous visit immediately, then revalidate quietly.
    if (cached) {
      setGraph(cached);
      setReady(true);
    }

    async function hydrateFromServer() {
      try {
        const response = await profileFetch("/api/v1/content", {
          cache: "default",
        });
        if (!response.ok) throw new Error("CONTENT_LOAD_FAILED");
        const payload = (await response.json()) as { content?: unknown };
        if (cancelled) return;
        if (isRuntimeGraph(payload.content)) {
          setGraph(payload.content);
          setReady(true);
          setError("");
          writeCachedGraph(payload.content);
        } else if (!cached) {
          setError("课程内容加载失败，请刷新页面后重试。");
        }
      } catch {
        if (!cancelled && !cached) {
          setError("课程内容加载失败，请刷新页面后重试。");
        }
      }
    }

    void hydrateFromServer();
    return () => {
      cancelled = true;
    };
  }, []);

  const pathGradeWorldId = gradeWorldIdFromPath(pathname);

  useEffect(() => {
    if (!ready) return;

    const worldIds = new Set(graph.worlds.map((world) => world.id));
    if (pathGradeWorldId && worldIds.has(pathGradeWorldId)) {
      setSelectedGradeWorldId(pathGradeWorldId);
      window.localStorage.setItem("knowgate.gradeWorld", pathGradeWorldId);
      return;
    }

    const savedGradeWorldId = window.localStorage.getItem("knowgate.gradeWorld");
    if (savedGradeWorldId && worldIds.has(savedGradeWorldId)) {
      setSelectedGradeWorldId(savedGradeWorldId);
    }
  }, [graph.worlds, pathGradeWorldId, ready]);

  const value = useMemo<ContentContextValue>(() => {
    const gradeWorlds = sortGradeWorlds(graph.worlds);
    const gradeWorld =
      gradeWorlds.find((world) => world.id === selectedGradeWorldId) ??
      gradeWorlds.find((world) => world.id === fallbackGradeWorld.id) ??
      fallbackGradeWorld;
    const gradePrefix = `math.g${gradeWorld.grade}.`;
    const milestones = graph.milestones
      .filter((milestone) => milestone.id.startsWith(gradePrefix))
      .sort(
        (left, right) =>
          left.stageNo - right.stageNo || left.id.localeCompare(right.id),
      );
    const milestoneIds = new Set(milestones.map((milestone) => milestone.id));
    const chapters = graph.chapters
      .filter((chapter) => milestoneIds.has(chapter.milestoneId))
      .sort(
        (left, right) =>
          left.stageNo - right.stageNo || left.id.localeCompare(right.id),
      );
    const bossIds = new Set(milestones.map((milestone) => milestone.bossId));
    const bosses = graph.bosses.filter((boss) => bossIds.has(boss.id));
    const nodeIds = new Set([
      ...milestones.flatMap((milestone) => milestone.nodeIds),
      ...chapters.flatMap((chapter) => chapter.nodeIds),
    ]);
    const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
    const questions = graph.questions.filter((question) =>
      nodeIds.has(question.nodeId),
    );
    const chaptersById = new Map(
      chapters.map((chapter) => [chapter.id, chapter]),
    );
    const milestonesById = new Map(
      milestones.map((milestone) => [milestone.id, milestone]),
    );
    const bossesById = new Map(bosses.map((boss) => [boss.id, boss]));
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    return {
      ready,
      gradeWorlds,
      gradeWorld: {
        ...gradeWorld,
        contentVersion: graph.contentVersion,
        totalStages: milestones.length,
      },
      chapters,
      milestones,
      bosses,
      knowledgeNodes: nodes,
      bossQuestions: questions,
      setGradeWorld: (gradeWorldId) => {
        if (!gradeWorlds.some((world) => world.id === gradeWorldId)) return;
        setSelectedGradeWorldId(gradeWorldId);
        window.localStorage.setItem("knowgate.gradeWorld", gradeWorldId);
      },
      getChapter: (chapterId) => chaptersById.get(chapterId),
      getMilestone: (milestoneId) => milestonesById.get(milestoneId),
      getBoss: (bossId) => bossesById.get(bossId),
      getNode: (nodeId) => nodesById.get(nodeId),
    };
  }, [graph, ready, selectedGradeWorldId]);

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

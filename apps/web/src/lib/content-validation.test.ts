import { describe, expect, it } from "vitest";
import type { ContentQuestion } from "@knowgate/domain";
import {
  bossQuestions,
  bosses,
  chapters,
  gradeWorld,
  knowledgeNodes,
  milestones,
} from "@/content/math-grade4";
import {
  assertContentGraph,
  type ContentGraph,
  validateContentGraph,
} from "./content-validation";

describe("content graph validation", () => {
  it("accepts the complete grade-four content graph", () => {
    const issues = validateContentGraph();

    expect(issues.filter((issue) => issue.severity === "error")).toEqual([]);
    expect(() => assertContentGraph()).not.toThrow();
  });

  it("keeps equivalent-fraction practice aligned with its prompt", () => {
    const chapter = chapters.find(
      (candidate) => candidate.id === "chapter.fraction.equivalent",
    );
    const guided = chapter?.steps.find(
      (step) => step.id === "equivalent.guided",
    );
    const practice = chapter?.steps.find(
      (step) => step.id === "equivalent.practice",
    );

    expect(guided?.visual).toMatchObject({
      kind: "fraction-bar",
      total: 4,
      active: 1,
      compareTo: 3,
      compareTotal: 12,
      labels: ["1/4", "3/12"],
    });
    expect(practice?.visual).toMatchObject({
      kind: "fraction-bar",
      total: 4,
      active: 1,
      compareTo: undefined,
      compareTotal: undefined,
    });
    expect(practice?.question?.prompt).toContain("1/4");
  });

  it("uses distinct fractions for every comparison visual", () => {
    const comparisonSteps = chapters.flatMap((chapter) =>
      chapter.steps
        .filter(
          (step) =>
            step.visual?.kind === "fraction-bar" &&
            step.visual.compareTo !== undefined,
        )
        .map((step) => ({ chapterId: chapter.id, step })),
    );

    expect(comparisonSteps.length).toBeGreaterThan(0);
    for (const { chapterId, step } of comparisonSteps) {
      const visual = step.visual;
      if (!visual || visual.kind !== "fraction-bar") continue;
      const compareTo = visual.compareTo;
      if (compareTo === undefined) continue;
      const compareTotal = visual.compareTotal ?? visual.total;

      expect(
        [visual.active, visual.total],
        `${chapterId}/${step.id} should compare two different fractions`,
      ).not.toEqual([compareTo, compareTotal]);
    }
  });

  it("rejects a fraction comparison that repeats the main bar", () => {
    const graph: ContentGraph = {
      contentVersion: gradeWorld.contentVersion,
      nodes: knowledgeNodes,
      chapters: chapters.map((chapter) =>
        chapter.id === "chapter.fraction.units"
          ? {
              ...chapter,
              steps: chapter.steps.map((step) =>
                step.id === "units.hook"
                  ? {
                      ...step,
                      visual: {
                        kind: "fraction-bar",
                        total: 3,
                        active: 1,
                        compareTo: 1,
                      },
                    }
                  : step,
              ),
            }
          : chapter,
      ),
      milestones,
      bosses,
      questions: bossQuestions,
    };

    const codes = validateContentGraph(graph).map((issue) => issue.code);

    expect(codes).toContain("REPEATED_FRACTION_COMPARISON");
  });

  it("rejects a milestone that points at another milestone's boss", () => {
    const graph: ContentGraph = {
      contentVersion: gradeWorld.contentVersion,
      nodes: knowledgeNodes,
      chapters,
      milestones,
      bosses: bosses.map((boss, index) =>
        index === 0 ? { ...boss, milestoneId: milestones[1].id } : boss,
      ),
      questions: bossQuestions,
    };

    const codes = validateContentGraph(graph).map((issue) => issue.code);

    expect(codes).toContain("MILESTONE_BOSS_MISMATCH");
  });

  it("reports broken references, duplicate stages, and missing quizzes", () => {
    const graph: ContentGraph = {
      contentVersion: "test.1",
      nodes: [
        {
          id: "node.1",
          name: "Node",
          domain: "Math",
          stage: "g4",
          mastery: [],
          prerequisites: ["node.missing"],
        },
      ],
      chapters: [
        {
          id: "chapter.1",
          milestoneId: "milestone.1",
          stageNo: 1,
          title: "Chapter",
          summary: "Summary",
          estimatedMinutes: 5,
          nodeIds: ["node.missing"],
          steps: [
            {
              id: "step.1",
              phase: "concept",
              title: "Concept",
              body: "Body",
            },
          ],
        },
      ],
      milestones: [
        {
          id: "milestone.1",
          stageNo: 2,
          name: "Milestone",
          theme: "Theme",
          summary: "Summary",
          nodeIds: ["node.1"],
          chapterIds: ["chapter.1"],
          bossId: "boss.missing",
        },
        {
          id: "milestone.2",
          stageNo: 2,
          name: "Duplicate stage",
          theme: "Theme",
          summary: "Summary",
          nodeIds: ["node.1"],
          chapterIds: [],
          bossId: "boss.1",
        },
      ],
      bosses: [
        {
          id: "boss.1",
          milestoneId: "milestone.2",
          name: "Boss",
          epithet: "Test",
          hp: 1,
          initialDistance: 1,
          questionIds: [],
        },
      ],
      questions: [],
    };

    const codes = validateContentGraph(graph).map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "MISSING_PREREQUISITE",
        "CHAPTER_NODE_MISSING",
        "CHAPTER_WITHOUT_QUIZ",
        "DUPLICATE_STAGE",
        "MILESTONE_WITHOUT_CHAPTER",
        "MILESTONE_BOSS_MISSING",
        "MISSING_STAGE",
        "INSUFFICIENT_BOSS_QUESTIONS",
      ]),
    );
    expect(() => assertContentGraph(graph)).toThrow(
      /CONTENT_GRAPH_INVALID/,
    );
  });

  it("reports question quality gaps and thin chapter coverage", () => {
    const makeQuestion = (
      id: string,
      overrides: Partial<ContentQuestion> = {},
    ): ContentQuestion => ({
      id,
      nodeId: "node.1",
      kind: "apply",
      prompt: `题干 ${id}`,
      options: ["A", "B"],
      answerIndex: 0,
      explanation: "解析",
      timeLimitSec: 30,
      damage: 1,
      ...overrides,
    });

    const graph: ContentGraph = {
      contentVersion: "test.quality",
      nodes: [
        {
          id: "node.1",
          name: "节点",
          domain: "数学",
          stage: "g4",
          mastery: [],
          prerequisites: [],
        },
      ],
      chapters: [
        {
          id: "chapter.1",
          milestoneId: "milestone.1",
          stageNo: 1,
          title: "章节一",
          summary: "",
          estimatedMinutes: 5,
          nodeIds: ["node.1"],
          steps: [
            {
              id: "chapter.1.concept",
              phase: "concept",
              title: "概念",
              body: "说明",
            },
            {
              id: "chapter.1.quiz",
              phase: "quiz",
              title: "短测",
              body: "作答",
              question: makeQuestion("q.duplicate-a", {
                prompt: "重复的题干",
                options: ["", ""],
                explanation: "",
              }),
            },
          ],
        },
        {
          id: "chapter.2",
          milestoneId: "milestone.1",
          stageNo: 2,
          title: "章节二",
          summary: "",
          estimatedMinutes: 5,
          nodeIds: ["node.1"],
          steps: [
            {
              id: "chapter.2.concept",
              phase: "concept",
              title: "概念",
              body: "说明",
            },
            {
              id: "chapter.2.quiz",
              phase: "quiz",
              title: "短测",
              body: "作答",
              question: makeQuestion("q.duplicate-b", {
                prompt: "重复的题干",
              }),
            },
          ],
        },
        {
          id: "chapter.3",
          milestoneId: "milestone.2",
          stageNo: 3,
          title: "章节三",
          summary: "",
          estimatedMinutes: 5,
          nodeIds: ["node.1"],
          steps: [
            {
              id: "chapter.3.concept",
              phase: "concept",
              title: "概念",
              body: "说明",
            },
            {
              id: "chapter.3.quiz",
              phase: "quiz",
              title: "短测",
              body: "作答",
              question: makeQuestion("q.empty-option", {
                options: ["", "B"],
              }),
            },
          ],
        },
      ],
      milestones: [
        {
          id: "milestone.1",
          stageNo: 1,
          name: "阶段一",
          theme: "主题",
          summary: "",
          nodeIds: ["node.1"],
          chapterIds: ["chapter.1", "chapter.2"],
          bossId: "boss.1",
        },
        {
          id: "milestone.2",
          stageNo: 2,
          name: "阶段二",
          theme: "主题",
          summary: "",
          nodeIds: ["node.1"],
          chapterIds: ["chapter.3"],
          bossId: "boss.2",
        },
      ],
      bosses: [
        {
          id: "boss.1",
          milestoneId: "milestone.1",
          name: "Boss1",
          epithet: "守卫",
          hp: 1,
          initialDistance: 1,
          questionIds: ["q.duplicate-a"],
        },
        {
          id: "boss.2",
          milestoneId: "milestone.2",
          name: "Boss2",
          epithet: "守卫",
          hp: 1,
          initialDistance: 1,
          questionIds: ["q.empty-option"],
        },
      ],
      questions: [],
    };

    const codes = validateContentGraph(graph).map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        "EMPTY_OPTION",
        "DUPLICATE_OPTION",
        "MISSING_EXPLANATION",
        "DUPLICATE_PROMPT",
        "LOW_QUESTION_DENSITY",
        "STAGE_CONTENT_THIN",
      ]),
    );
  });
});

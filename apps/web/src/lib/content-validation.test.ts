import { describe, expect, it } from "vitest";
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
});

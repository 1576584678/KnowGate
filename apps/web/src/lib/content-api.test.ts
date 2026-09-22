import { describe, expect, it } from "vitest";
import type { ProgressSnapshot } from "@knowgate/domain";
import {
  getChapterDetail,
  getGradeWorld,
  getMilestoneDetail,
  getSubjects,
} from "./content-api";

const emptyProgress: ProgressSnapshot = {
  passedChapterIds: [],
  battleOutcomes: {},
};

describe("content API", () => {
  it("exposes the subject and grade world hierarchy", () => {
    expect(getSubjects()[0]).toMatchObject({
      id: "math",
      gradeWorlds: [{ id: "math.g4", grade: 4 }],
    });

    const world = getGradeWorld("math.g4", emptyProgress);
    expect(world.milestones[0].unlocked).toBe(true);
    expect(world.milestones[1].unlocked).toBe(false);
  });

  it("returns milestone content without private answer keys", () => {
    const milestone = getMilestoneDetail("math.g4.milestone.01");
    const chapter = getChapterDetail("chapter.fraction.parts");
    const question = chapter.steps.find((step) => step.question)?.question;

    expect(milestone.chapters).toHaveLength(3);
    expect(milestone.boss?.id).toBe("boss.math.fraction_warden");
    expect(question).toBeDefined();
    expect(Object.hasOwn(question!, "answerIndex")).toBe(false);
    expect(Object.hasOwn(question!, "explanation")).toBe(false);
  });
});

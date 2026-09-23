import { describe, expect, it } from "vitest";
import { getCurriculumPlan } from "./curriculum";

describe("curriculum plan", () => {
  it("publishes all ten ordered playable stages", () => {
    const plan = getCurriculumPlan();

    expect(plan.contentVersion).toBe("2026.09.23.1");
    expect(plan.totalStages).toBe(10);
    expect(plan.stages).toHaveLength(10);
    expect(plan.stages.map((stage) => stage.stageNo)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(plan.validation.valid).toBe(true);
    expect(plan.validation.errors).toEqual([]);
  });

  it("orders chapters and gates each stage on the previous milestone", () => {
    const plan = getCurriculumPlan();
    const secondStage = plan.stages[1];
    const tenthStage = plan.stages[9];

    expect(plan.stages[0].prerequisiteMilestoneId).toBeNull();
    expect(secondStage.prerequisiteMilestoneId).toBe(
      plan.stages[0].milestoneId,
    );
    expect(secondStage.chapters).toHaveLength(3);
    expect(secondStage.boss?.questionCount).toBe(10);
    expect(tenthStage.chapters).toHaveLength(3);
    expect(tenthStage.boss?.questionCount).toBe(10);
    expect(plan.counts).toMatchObject({
      nodes: 12,
      chapters: 30,
      milestones: 10,
      bosses: 10,
    });
  });
});

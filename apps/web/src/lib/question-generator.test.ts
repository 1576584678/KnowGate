import { describe, expect, it } from "vitest";
import type { ContentQuestion } from "@knowgate/domain";
import {
  generateBossQuestionSet,
  generateQuestionVariant,
  getParameterizedQuestionCapabilities,
} from "./question-generator";

const source: ContentQuestion = {
  id: "question.source",
  nodeId: "node.math",
  kind: "apply",
  prompt: "1 + 1 = ?",
  options: ["1", "2", "3"],
  answerIndex: 1,
  explanation: "1 + 1 equals 2.",
  timeLimitSec: 45,
  damage: 2,
};

describe("parameterized question generation", () => {
  it("keeps the correct answer through option shuffling", () => {
    const variant = generateQuestionVariant(source, 42);

    expect(variant.id).toBe("question.source.v42");
    expect(variant.options[variant.answerIndex]).toBe("2");
    expect(variant.options).not.toEqual(source.options);
  });

  it("generates reproducible boss sets with a decisive final question", () => {
    const first = generateBossQuestionSet({
      sourceQuestions: [source],
      seed: 20260920,
      questionCount: 10,
      idPrefix: "question.test",
    });
    const second = generateBossQuestionSet({
      sourceQuestions: [source],
      seed: 20260920,
      questionCount: 10,
      idPrefix: "question.test",
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(10);
    expect(first.at(-1)?.kind).toBe("decisive");
    expect(first.at(-1)?.damage).toBe(3);
    expect(new Set(first.map((question) => question.id)).size).toBe(10);
    expect(
      first.every(
        (question) => question.options[question.answerIndex] === "2",
      ),
    ).toBe(true);
    expect(getParameterizedQuestionCapabilities().deterministic).toBe(true);
  });
});

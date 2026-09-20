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
    const sources = Array.from({ length: 10 }, (_, index) => ({
      ...source,
      id: `question.source.${index + 1}`,
      prompt: `第 ${index + 1} 道题：1 + 1 = ?`,
      kind: index % 3 === 0 ? ("judge" as const) : source.kind,
      options: index % 3 === 0 ? ["正确", "错误"] : source.options,
      answerIndex: index % 3 === 0 ? 1 : source.answerIndex,
    }));
    const first = generateBossQuestionSet({
      sourceQuestions: sources,
      seed: 20260920,
      questionCount: 10,
      idPrefix: "question.test",
    });
    const second = generateBossQuestionSet({
      sourceQuestions: sources,
      seed: 20260920,
      questionCount: 10,
      idPrefix: "question.test",
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(10);
    expect(new Set(first.map((question) => question.prompt)).size).toBe(10);
    expect(first.at(-1)?.kind).toBe("decisive");
    expect(first.at(-1)?.damage).toBe(3);
    expect(new Set(first.map((question) => question.id)).size).toBe(10);
    expect(
      first.every(
        (question) =>
          question.options.length !== 2 || question.kind === "judge",
      ),
    ).toBe(true);
    expect(first.slice(0, 2).every((question) => question.timeLimitSec >= 20)).toBe(
      true,
    );
    expect(
      first.every((question) => {
        const matched = sources.find(
          (candidate) => candidate.prompt === question.prompt,
        );
        return (
          matched !== undefined &&
          question.options[question.answerIndex] ===
            matched.options[matched.answerIndex]
        );
      }),
    ).toBe(true);
    expect(getParameterizedQuestionCapabilities().deterministic).toBe(true);
    expect(getParameterizedQuestionCapabilities().supportedKinds).toContain(
      "decisive",
    );
  });

  it("rejects source sets that cannot fill a boss without repeating prompts", () => {
    expect(() =>
      generateBossQuestionSet({
        sourceQuestions: [source],
        seed: 20260920,
        questionCount: 10,
      }),
    ).toThrow("QUESTION_SOURCE_INSUFFICIENT:1:10");
  });
});

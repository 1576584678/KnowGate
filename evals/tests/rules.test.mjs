import assert from "node:assert/strict";
import { test } from "node:test";

import * as duplicates from "../assertions/duplicates.mjs";
import * as graph from "../assertions/graph.mjs";
import * as options from "../assertions/options.mjs";
import * as steps from "../assertions/steps.mjs";
import * as structure from "../assertions/structure.mjs";
import * as wording from "../assertions/wording.mjs";
import { buildDuplicateIndex, numericValue, diceSimilarity } from "../assertions/lib.mjs";

function question(overrides = {}) {
  return {
    id: "item.test.1",
    nodeId: "math.test.node",
    kind: "apply",
    origin: "chapter",
    prompt: "3+4×2 等于多少？",
    options: ["11", "14", "10"],
    answerIndex: 0,
    answer: "11",
    explanation: "先算 4×2=8，再算 3+8=11。",
    timeLimitSec: 45,
    damage: 1,
    stepPhase: "practice",
    stepTitle: "独立练习",
    stepBody: "先算乘法，再算加法。",
    ...overrides,
  };
}

function codes(findings) {
  return findings.map((finding) => finding.code);
}

test("numericValue parses numbers with known units only", () => {
  assert.equal(numericValue("12 人"), 12);
  assert.equal(numericValue("9/10 米"), 0.9);
  assert.equal(numericValue("约 12"), 12);
  assert.equal(numericValue("50%"), 0.5);
  assert.equal(numericValue("0.5"), 0.5);
  assert.equal(numericValue("1200"), 1200);

  // Trailing text that changes the value must not be treated as a unit.
  assert.equal(numericValue("6/8 的一半"), null);
  assert.equal(numericValue("0.45+0.3=0.75"), null);
  assert.equal(numericValue("4/10 和 2/5"), null);
  assert.equal(numericValue("正确"), null);
});

test("diceSimilarity scores near-duplicate prompts high and unrelated prompts low", () => {
  const near = diceSimilarity(
    "1/3 的分子分母同时乘 2，得到哪个分数？",
    "1/3 的分子和分母同时乘 2，得到哪个分数？",
  );
  assert.ok(near > 0.85, `expected near-duplicate, got ${near}`);

  const far = diceSimilarity("3+4×2 等于多少？", "下面哪个分数最大？");
  assert.ok(far < 0.3, `expected unrelated, got ${far}`);
});

test("structure flags judge questions with multiple options", () => {
  const findings = structure.check(
    question({
      kind: "judge",
      options: ["10/15 和 9/15", "5/15 和 3/15", "2/15 和 3/15"],
      answerIndex: 0,
      prompt: "2/3 和 3/5 通分后分别是多少？",
    }),
  );
  assert.ok(codes(findings).includes("JUDGE_KIND_WITH_MULTIPLE_OPTIONS"));
  assert.ok(codes(findings).includes("JUDGE_OPTIONS_NOT_TRUE_FALSE"));
});

test("structure flags two-option questions that are not judge", () => {
  const findings = structure.check(
    question({ kind: "identify", options: ["正确", "错误"], answerIndex: 0 }),
  );
  assert.ok(codes(findings).includes("TWO_OPTION_NOT_JUDGE"));
});

test("structure flags unplayable time limits", () => {
  const findings = structure.check(question({ timeLimitSec: 5 }));
  assert.ok(codes(findings).includes("INVALID_TIME_LIMIT"));
});

test("structure accepts a well-formed question", () => {
  assert.deepEqual(structure.check(question()), []);
});

test("options flags numerically equivalent distractors", () => {
  const findings = options.check(
    question({ options: ["1/2", "0.5", "2/3"], answerIndex: 0 }),
  );
  assert.ok(codes(findings).includes("NUMERICALLY_EQUIVALENT_OPTIONS"));
});

test("options flags duplicate and empty options", () => {
  assert.ok(
    codes(options.check(question({ options: ["11", "11", "10"] }))).includes(
      "DUPLICATE_OPTION",
    ),
  );
  assert.ok(
    codes(options.check(question({ options: ["11", "  ", "10"] }))).includes(
      "EMPTY_OPTION",
    ),
  );
});

test("wording flags placeholders and answer leaks", () => {
  assert.ok(
    codes(wording.check(question({ prompt: "TODO 计算 3+4" }))).includes(
      "PLACEHOLDER_IN_PROMPT",
    ),
  );
  assert.ok(
    codes(wording.check(question({ prompt: "正确答案是 11，请选择。" }))).includes(
      "ANSWER_LEAK_IN_PROMPT",
    ),
  );
});

test("duplicates reports exact and near duplicates from the index", () => {
  const similar = question({
    id: "item.test.2",
    prompt: "1/3 的分子分母同时乘 2，得到哪个分数？",
  });
  const near = question({
    id: "item.test.3",
    prompt: "1/3 的分子和分母同时乘 2，得到哪个分数？",
  });
  const dataset = { duplicateIndex: buildDuplicateIndex([similar, near]) };

  assert.ok(codes(duplicates.check(similar, dataset)).includes("NEAR_DUPLICATE_PROMPT"));
});

test("graph flags unknown nodes and out-of-range boss sizes", () => {
  const findings = graph.check(
    question({ nodeId: "math.missing", origin: "boss", bossId: "boss.1" }),
    {
      nodeIds: new Set(["math.test.node"]),
      bossSizes: new Map([["boss.1", 5]]),
    },
  );
  assert.ok(codes(findings).includes("UNKNOWN_NODE"));
  assert.ok(codes(findings).includes("BOSS_QUESTION_COUNT"));
});

test("steps flags missing copy and copy that repeats the prompt", () => {
  assert.ok(
    codes(steps.check(question({ stepBody: "" }))).includes(
      "MISSING_STEP_BODY",
    ),
  );
  assert.ok(
    codes(
      steps.check(
        question({
          prompt: "3+4×2 等于多少？",
          stepBody: "3+4×2 等于多少？",
        }),
      ),
    ).includes("STEP_BODY_EQUALS_PROMPT"),
  );
  // Boss questions have no standalone step copy and must not be flagged.
  assert.deepEqual(
    codes(steps.check(question({ origin: "boss", stepBody: "" }))),
    [],
  );
});

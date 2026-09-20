import { assertionFromCheck } from "./lib.mjs";

/**
 * 结构完整性：题目字段、选项数量与 kind 语义、时间档、伤害值。
 *
 * 对应 docs/engineering/content-pipeline.md §4 题目 / docs/product/content-strategy.md §8
 * 的「答案和解析完整」「时间档合法」「难度合法」。
 */

const ALLOWED_TIME_LIMITS = new Set([15, 20, 25, 30, 35, 40, 45, 50, 60, 90, 120]);
const TRUE_FALSE_OPTIONS = new Set([
  "正确|错误",
  "错误|正确",
  "对|错",
  "错|对",
  "正确|不正确",
  "不正确|正确",
  "对|不对",
  "不对|对",
]);

function optionPairKey(options) {
  return options.map((option) => String(option).trim()).join("|");
}

export function check(question) {
  const findings = [];
  const push = (code, message) => findings.push({ code, message, severity: "error" });

  if (!question.id) push("MISSING_ID", "题目缺少 id。");
  if (!question.nodeId) push("MISSING_NODE_ID", "题目未绑定知识节点。");

  if (typeof question.prompt !== "string" || question.prompt.trim().length < 5) {
    push("PROMPT_TOO_SHORT", `题干过短或缺失：${JSON.stringify(question.prompt)}`);
  }

  const options = Array.isArray(question.options) ? question.options : null;
  if (!options || options.length < 2) {
    push("INSUFFICIENT_OPTIONS", "题目至少需要两个选项。");
  } else {
    const isTwoOption = options.length === 2;
    const isJudge = question.kind === "judge";

    if (isJudge && !isTwoOption) {
      push(
        "JUDGE_KIND_WITH_MULTIPLE_OPTIONS",
        `kind=judge 的判断应只有「正确/错误」两个选项，实际有 ${options.length} 个：` +
          options.join(" / "),
      );
    }

    if (!isJudge && isTwoOption) {
      push(
        "TWO_OPTION_NOT_JUDGE",
        `只有两个选项的题应标记为 kind=judge，实际为 kind=${question.kind}。`,
      );
    }

    if (isJudge && !TRUE_FALSE_OPTIONS.has(optionPairKey(options))) {
      push(
        "JUDGE_OPTIONS_NOT_TRUE_FALSE",
        `判断题的选项应为「正确/错误」，实际为：${options.join(" / ")}`,
      );
    }
  }

  if (
    !Number.isInteger(question.answerIndex) ||
    !options ||
    question.answerIndex < 0 ||
    question.answerIndex >= options.length
  ) {
    push("INVALID_ANSWER_INDEX", `答案索引越界：${question.answerIndex}`);
  }

  if (typeof question.explanation !== "string" || question.explanation.trim().length < 6) {
    push("MISSING_EXPLANATION", "题目缺少足够的答案解析。");
  }

  if (!ALLOWED_TIME_LIMITS.has(question.timeLimitSec)) {
    push(
      "INVALID_TIME_LIMIT",
      `时间档不在允许集合内：${question.timeLimitSec}s（四年级题目不应低于 15s）。`,
    );
  }

  if (!Number.isFinite(question.damage) || question.damage <= 0) {
    push("INVALID_DAMAGE", `伤害值必须大于 0，实际为 ${question.damage}。`);
  }

  return findings;
}

export default assertionFromCheck(check);

import { normalize, numericValue, assertionFromCheck } from "./lib.mjs";

/**
 * 选项质量硬规则：空选项、重复选项、数值等价选项、答案泄露。
 *
 * 对应 docs/engineering/content-pipeline.md §4「答案和解析完整」与
 * docs/product/content-strategy.md §8「歧义和双重答案检查」。
 */

const MAX_OPTION_LENGTH = 40;

export function check(question) {
  const findings = [];
  const push = (code, message, severity = "error") =>
    findings.push({ code, message, severity });

  const options = Array.isArray(question.options) ? question.options : [];
  if (options.length === 0) return findings;

  const normalized = options.map((option) => normalize(option));

  normalized.forEach((option, index) => {
    if (!option) {
      push("EMPTY_OPTION", `第 ${index + 1} 个选项为空。`);
    }
  });

  const seen = new Map();
  normalized.forEach((option, index) => {
    if (!option) return;
    if (seen.has(option)) {
      push(
        "DUPLICATE_OPTION",
        `第 ${index + 1} 个选项与第 ${seen.get(option) + 1} 个选项重复：${options[index]}`,
      );
    } else {
      seen.set(option, index);
    }
  });

  // Two options that are the same value written differently (1/2 vs 0.5,
  // 0.6 vs 60%) make a single-answer question ambiguous for the learner.
  const numeric = options.map(numericValue);
  for (let i = 0; i < options.length; i += 1) {
    if (numeric[i] === null) continue;
    for (let j = i + 1; j < options.length; j += 1) {
      if (numeric[j] === null) continue;
      if (Math.abs(numeric[i] - numeric[j]) < 1e-9) {
        push(
          "NUMERICALLY_EQUIVALENT_OPTIONS",
          `第 ${i + 1} 个选项「${options[i]}」与第 ${j + 1} 个选项「${options[j]}」数值等价（都等于 ${numeric[i]}），存在双答案风险。`,
        );
      }
    }
  }

  options.forEach((option, index) => {
    if (String(option).trim().length > MAX_OPTION_LENGTH) {
      push(
        "OPTION_TOO_LONG",
        `第 ${index + 1} 个选项过长（${String(option).trim().length} 字），不适合四年级快速作答。`,
        "warning",
      );
    }
  });

  const prompt = normalize(question.prompt);
  options.forEach((option, index) => {
    if (normalize(option) && normalize(option) === prompt) {
      push(
        "OPTION_EQUALS_PROMPT",
        `第 ${index + 1} 个选项与题干完全相同。`,
      );
    }
  });

  return findings;
}

export default assertionFromCheck(check);

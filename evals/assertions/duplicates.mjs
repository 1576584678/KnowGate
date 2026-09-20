import { assertionFromCheck } from "./lib.mjs";

/**
 * 重复与近似重复题目。
 *
 * 对应 docs/engineering/content-pipeline.md §4「没有重复或近似重复题」。
 * 章节题两两比较；Boss 变体按设计复用章节题干，因此只在同一个 Boss 内部比较。
 */

export function check(question, dataset = {}) {
  const findings = [];
  const push = (code, message) => findings.push({ code, message, severity: "error" });

  const exact = dataset.duplicateIndex?.exact;
  const near = dataset.duplicateIndex?.near;
  const bossExact = dataset.duplicateIndex?.bossExact;

  const exactMatches = exact?.get(question.id);
  if (exactMatches?.length) {
    push(
      "DUPLICATE_PROMPT",
      `题干与其他章节题完全相同：${exactMatches.join(", ")}`,
    );
  }

  const nearMatches = near?.get(question.id);
  if (nearMatches?.length) {
    push(
      "NEAR_DUPLICATE_PROMPT",
      `题干与 ${nearMatches.join(", ")} 高度相似（近似重复题）。`,
    );
  }

  const bossMatch = bossExact?.get(question.id);
  if (bossMatch) {
    push(
      "DUPLICATE_WITHIN_BOSS",
      `同一个 Boss 内重复出现相同题干，与 ${bossMatch} 冲突。`,
    );
  }

  return findings;
}

export default assertionFromCheck(check);

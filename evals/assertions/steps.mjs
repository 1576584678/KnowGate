import { assertionFromCheck, normalize } from "./lib.mjs";

/**
 * 步骤呈现完整性。
 *
 * 一道题在章节里不仅要有题干和选项，还要有承载它的步骤讲解。学习者看到的
 * 是「阶段 → 讲解 → 题干 → 选项」四段，如果讲解缺失、或讲解只是把题干又抄了一遍，
 * 学员就会看到信息不完整或重复的卡片。
 *
 * 对应 docs/engineering/content-pipeline.md §4「题干、解析与讲解完整」。
 */

export function check(question) {
  const findings = [];
  const push = (code, message, severity) =>
    findings.push({ code, message, severity });

  // Boss 题目没有独立的步骤文案，这里只约束可玩章节里的步骤。
  if (question.origin !== "chapter") return findings;

  const title = String(question.stepTitle ?? "").trim();
  const body = String(question.stepBody ?? "").trim();
  const prompt = normalize(question.prompt);

  if (!body) {
    push(
      "MISSING_STEP_BODY",
      `步骤「${title || question.stepPhase}」缺少讲解文案，学习者只能看到题干和选项。`,
      "error",
    );
  }

  if (body && prompt && normalize(body) === prompt) {
    push(
      "STEP_BODY_EQUALS_PROMPT",
      "步骤讲解与题干完全相同，卡片上会出现重复信息。",
      "error",
    );
  }

  return findings;
}

export default assertionFromCheck(check);

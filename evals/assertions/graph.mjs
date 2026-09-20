import { assertionFromCheck } from "./lib.mjs";

/**
 * 图谱与课程编排一致性。
 *
 * 对应 docs/engineering/content-pipeline.md §4「关联节点存在」「Boss 题量符合 8 到 12 题」
 * 与 docs/product/content-strategy.md §8「知识点绑定检查」。
 */

const BOSS_MIN_QUESTIONS = 8;
const BOSS_MAX_QUESTIONS = 12;

export function check(question, dataset = {}) {
  const findings = [];
  const push = (code, message, severity = "error") =>
    findings.push({ code, message, severity });

  const nodeIds = dataset.nodeIds;
  if (nodeIds && question.nodeId && !nodeIds.has(question.nodeId)) {
    push("UNKNOWN_NODE", `题目绑定的知识节点不存在：${question.nodeId}`);
  }

  if (question.origin === "chapter" && question.chapterId) {
    const chapterNodeIds = dataset.chapterNodeIds?.get(question.chapterId);
    if (chapterNodeIds && question.nodeId && !chapterNodeIds.includes(question.nodeId)) {
      push(
        "NODE_OUTSIDE_CHAPTER",
        `题目节点 ${question.nodeId} 不属于章节 ${question.chapterId} 的节点列表。`,
      );
    }
  }

  if (question.origin === "boss" && question.bossId) {
    const size = dataset.bossSizes?.get(question.bossId);
    if (typeof size === "number") {
      if (size < BOSS_MIN_QUESTIONS || size > BOSS_MAX_QUESTIONS) {
        push(
          "BOSS_QUESTION_COUNT",
          `Boss ${question.bossId} 题量为 ${size}，应在 ${BOSS_MIN_QUESTIONS}-${BOSS_MAX_QUESTIONS} 之间。`,
        );
      }
    }
  }

  return findings;
}

export default assertionFromCheck(check);

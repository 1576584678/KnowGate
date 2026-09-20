import { assertionFromCheck } from "./lib.mjs";

/**
 * 「不能出现什么」：模板残留、答案泄露、不适合未成年人的措辞。
 *
 * 对应 docs/engineering/content-pipeline.md §9 内容安全 与
 * docs/product/content-strategy.md §8「敏感内容检查」。
 *
 * 这个清单是刻意做成可读、可扩展的常量，新增禁用词只需在这里加一行。
 */

// 模板 / 占位符：说明题目还没有被真正写完。
const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/iu,
  /\bTBD\b/iu,
  /\bXXX+\b/iu,
  /待补/u,
  /待定/u,
  /\bLorem\b/iu,
  /\{\{?.+\}?\}/u,
  /_{2,}/u,
  /\[\s*\]/u,
  /（略）/u,
  /\(略\)/u,
];

// 题干里直接写出答案，等同于泄题。
const ANSWER_LEAK_PATTERNS = [
  /正确答案/u,
  /答案是/u,
  /答案为/u,
  /标准答案/u,
];

// 面向未成年人的内容安全底线。
const UNSAFE_PATTERNS = [
  /自杀/u,
  /自残/u,
  /赌博/u,
  /毒品/u,
  /色情/u,
  /暴力/u,
  /恐怖/u,
  /枪支/u,
];

function scan(field, text, patterns, code, message) {
  const findings = [];
  const value = String(text ?? "");
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    findings.push({
      code,
      severity: "error",
      message: `${field}${message}：命中「${match[0]}」（${pattern}）`,
    });
  }
  return findings;
}

export function check(question) {
  const findings = [];

  findings.push(
    ...scan("题干", question.prompt, PLACEHOLDER_PATTERNS, "PLACEHOLDER_IN_PROMPT", "含模板残留"),
    ...scan("解析", question.explanation, PLACEHOLDER_PATTERNS, "PLACEHOLDER_IN_EXPLANATION", "含模板残留"),
    ...scan("题干", question.prompt, ANSWER_LEAK_PATTERNS, "ANSWER_LEAK_IN_PROMPT", "泄露答案"),
    ...scan("题干", question.prompt, UNSAFE_PATTERNS, "UNSAFE_PROMPT", "含不适合未成年人的措辞"),
  );

  (question.options ?? []).forEach((option, index) => {
    findings.push(
      ...scan(
        `选项 ${index + 1}`,
        option,
        PLACEHOLDER_PATTERNS,
        "PLACEHOLDER_IN_OPTION",
        "含模板残留",
      ),
      ...scan(
        `选项 ${index + 1}`,
        option,
        UNSAFE_PATTERNS,
        "UNSAFE_OPTION",
        "含不适合未成年人的措辞",
      ),
    );
  });

  return findings;
}

export default assertionFromCheck(check);

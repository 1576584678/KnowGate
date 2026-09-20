/**
 * Shared helpers for the hard-rule pipeline.
 *
 * Every rule module exports:
 *   check(question, dataset) -> Finding[]      // used by the standalone report
 *   default(output, context) -> AssertionResult // used by promptfoo
 *
 * Keeping both entry points on one implementation means the promptfoo run and
 * the CI report can never drift apart.
 */

/** @typedef {{ code: string, message: string, severity: "error" | "warning" }} Finding */

export function normalize(text) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLowerCase();
}

/** Prompt text stripped of punctuation/spacing, for duplicate comparison. */
export function promptSignature(text) {
  return normalize(text).replace(/[\s，,。．.！!？?：:；;“”"'【】\[\]]+/gu, "");
}

/**
 * Parse an option that is *entirely* a number into its value.
 *
 * Returns null for anything that is not purely numeric, so option text such as
 * "0.45+0.3=0.75", "4/10 和 2/5" or "6/8 的一半" is never mistaken for a
 * numeric answer. Only a known measurement unit ("12 人", "9/10 米") may follow
 * the number, because arbitrary trailing text can change the value.
 */
const KNOWN_UNITS = [
  "平方厘米",
  "平方分米",
  "平方米",
  "千米",
  "厘米",
  "分米",
  "毫米",
  "千克",
  "毫升",
  "分钟",
  "小时",
  "个人",
  "元",
  "角",
  "人",
  "个",
  "支",
  "本",
  "瓶",
  "岁",
  "米",
  "棵",
  "只",
  "张",
  "页",
  "秒",
  "时",
  "天",
  "次",
  "组",
  "队",
  "盒",
  "袋",
  "克",
  "升",
  "吨",
  "度",
];

const UNITS_BY_LENGTH = [...KNOWN_UNITS].sort((a, b) => b.length - a.length);

export function numericValue(raw) {
  let text = normalize(raw).replace(/\s+/gu, "");
  if (!text) return null;
  text = text.replace(/^约/u, "");

  let percent = false;
  if (text.endsWith("%") || text.endsWith("％")) {
    percent = true;
    text = text.slice(0, -1);
  } else {
    for (const unit of UNITS_BY_LENGTH) {
      if (text.endsWith(unit)) {
        text = text.slice(0, -unit.length);
        break;
      }
    }
  }

  const match = text.match(/^(-?\d+(?:\.\d+)?)(?:\/(-?\d+(?:\.\d+)?))?$/u);
  if (!match) return null;

  const numerator = Number(match[1]);
  const denominator = match[2] === undefined ? 1 : Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;

  const value = numerator / denominator;
  return percent ? value / 100 : value;
}

export function charBigrams(text) {
  const compact = promptSignature(text);
  const grams = new Set();
  if (compact.length < 2) {
    if (compact) grams.add(compact);
    return grams;
  }
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.add(compact.slice(index, index + 2));
  }
  return grams;
}

/** Sørensen-Dice coefficient over character bigrams (0..1). */
export function diceSimilarity(a, b) {
  const left = charBigrams(a);
  const right = charBigrams(b);
  if (left.size === 0 || right.size === 0) return 0;

  let overlap = 0;
  for (const gram of left) {
    if (right.has(gram)) overlap += 1;
  }
  return (2 * overlap) / (left.size + right.size);
}

/**
 * Chapters repeat a prompt across a guided/practice/quiz trio on purpose, so
 * duplicate detection compares *distinct* questions. Boss variants copy the
 * chapter prompt verbatim with shuffled options, so they are excluded from the
 * cross-question comparison and only checked within their own boss.
 */
export function duplicateGroups(questions, { threshold = 0.85 } = {}) {
  const exact = new Map();
  const near = [];

  for (let i = 0; i < questions.length; i += 1) {
    for (let j = i + 1; j < questions.length; j += 1) {
      const left = questions[i];
      const right = questions[j];
      const leftSig = promptSignature(left.prompt);
      const rightSig = promptSignature(right.prompt);
      if (!leftSig || !rightSig) continue;

      if (leftSig === rightSig) {
        exact.set(leftSig, [
          ...(exact.get(leftSig) ?? []),
          left.id,
          right.id,
        ]);
        continue;
      }

      const similarity = diceSimilarity(left.prompt, right.prompt);
      if (similarity >= threshold) {
        near.push({
          ids: [left.id, right.id],
          prompts: [left.prompt, right.prompt],
          similarity: Number(similarity.toFixed(2)),
        });
      }
    }
  }

  return {
    exact: [...exact.entries()].map(([signature, ids]) => ({
      signature,
      ids: [...new Set(ids)],
    })),
    near,
  };
}

/** Build duplicate lookup tables once per run, keyed by question id. */
export function buildDuplicateIndex(records) {
  const chapterQuestions = records.filter((record) => record.origin === "chapter");

  const { exact, near } = duplicateGroups(chapterQuestions);

  const exactIds = new Map();
  for (const group of exact) {
    for (const id of group.ids) {
      exactIds.set(id, group.ids.filter((other) => other !== id));
    }
  }

  const nearIds = new Map();
  for (const pair of near) {
    const [left, right] = pair.ids;
    nearIds.set(left, [...(nearIds.get(left) ?? []), right]);
    nearIds.set(right, [...(nearIds.get(right) ?? []), left]);
  }

  // Within a single boss, repeated prompts are a real defect (the shuffle is
  // meant to resurface *different* questions, not the same one twice).
  const bossExactIds = new Map();
  const bossIds = new Set(
    records.filter((record) => record.origin === "boss").map((r) => r.bossId),
  );
  for (const bossId of bossIds) {
    const bossQuestions = records.filter((record) => record.bossId === bossId);
    const seen = new Map();
    for (const question of bossQuestions) {
      const signature = promptSignature(question.prompt);
      if (!signature) continue;
      if (seen.has(signature)) {
        bossExactIds.set(question.id, seen.get(signature));
      } else {
        seen.set(signature, question.id);
      }
    }
  }

  return { exact: exactIds, near: nearIds, bossExact: bossExactIds };
}

export function renderOptions(question) {
  return (question.options ?? [])
    .map((option, index) => (index === question.answerIndex ? `*${option}` : option))
    .join(" | ");
}

/** Text form handed to promptfoo's built-in string assertions. */
export function renderQuestionText(question) {
  return [
    `prompt: ${question.prompt}`,
    `options: ${renderOptions(question)}`,
    `explanation: ${question.explanation}`,
  ].join("\n");
}

export function formatFindings(findings) {
  return findings.map((finding) => `${finding.code}: ${finding.message}`).join("; ");
}

/**
 * Wrap a rule's `check` into promptfoo's javascript-assertion contract.
 * Warnings are reported for visibility but never fail the hard-rule gate.
 */
export function assertionFromCheck(check, severityFilter = "error") {
  return function assertion(output, context) {
    const question = context?.vars?.question;
    if (!question) {
      return { pass: false, score: 0, reason: "missing vars.question" };
    }

    const findings = check(question, context?.vars?.dataset ?? {});
    const failing = findings.filter(
      (finding) => finding.severity === severityFilter,
    );
    const reported = failing.length > 0 ? failing : findings;

    return {
      pass: failing.length === 0,
      score: failing.length === 0 ? 1 : 0,
      reason: formatFindings(reported) || "OK",
    };
  };
}

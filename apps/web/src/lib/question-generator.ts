import type { ContentQuestion, QuestionKind } from "@knowgate/domain";

const VARIANT_KINDS: QuestionKind[] = ["identify", "apply", "transfer"];
const SUPPORTED_KINDS: QuestionKind[] = [
  "identify",
  "judge",
  "apply",
  "transfer",
  "decisive",
];

function seededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function shuffled<Value>(values: Value[], random: () => number) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function normalizedPrompt(prompt: string) {
  return prompt.trim().replace(/\s+/gu, " ").toLowerCase();
}

function uniqueByPrompt(questions: ContentQuestion[]) {
  const seen = new Set<string>();

  return questions.filter((question) => {
    const prompt = normalizedPrompt(question.prompt);
    if (seen.has(prompt)) return false;
    seen.add(prompt);
    return true;
  });
}

export function generateQuestionVariant(
  source: ContentQuestion,
  seed: number,
): ContentQuestion {
  const random = seededRandom(seed);
  const indexedOptions = source.options.map((option, answerIndex) => ({
    option,
    answerIndex,
  }));
  const options = shuffled(indexedOptions, random);
  const answerIndex = options.findIndex(
    (option) => option.answerIndex === source.answerIndex,
  );

  return {
    ...source,
    id: `${source.id}.v${seed}`,
    options: options.map((option) => option.option),
    answerIndex,
  };
}

export function generateBossQuestionSet(input: {
  sourceQuestions: ContentQuestion[];
  seed: number;
  questionCount?: number;
  idPrefix?: string;
}) {
  if (input.sourceQuestions.length === 0) {
    throw new Error("QUESTION_SOURCE_REQUIRED");
  }

  const questionCount = Math.max(8, input.questionCount ?? 10);
  const random = seededRandom(input.seed);
  const sourceQuestions = shuffled(uniqueByPrompt(input.sourceQuestions), random);
  if (sourceQuestions.length < questionCount) {
    throw new Error(
      `QUESTION_SOURCE_INSUFFICIENT:${sourceQuestions.length}:${questionCount}`,
    );
  }
  const decisiveSources = sourceQuestions.filter(
    (question) => question.options.length >= 3,
  );
  if (decisiveSources.length === 0) {
    throw new Error("QUESTION_DECISIVE_SOURCE_REQUIRED");
  }
  const decisiveSource = decisiveSources[0];
  const regularSources = sourceQuestions.filter(
    (question) => question !== decisiveSource,
  );
  if (regularSources.length < questionCount - 1) {
    throw new Error(
      `QUESTION_SOURCE_INSUFFICIENT:${sourceQuestions.length}:${questionCount}`,
    );
  }

  return Array.from({ length: questionCount }, (_, index) => {
    const isLast = index === questionCount - 1;
    const source = isLast ? decisiveSource : regularSources[index];
    const variant = generateQuestionVariant(source, input.seed + index + 1);
    const kind = isLast
      ? "decisive"
      : variant.options.length === 2
        ? "judge"
        : VARIANT_KINDS[index % VARIANT_KINDS.length];

    return {
      ...variant,
      id: `${input.idPrefix ?? "question.generated"}.${index + 1}`,
      kind,
      damage: isLast ? 3 : index < 2 ? 1 : 2,
      timeLimitSec: isLast ? 120 : index < 2 ? 20 : 45,
    } satisfies ContentQuestion;
  });
}

export function getParameterizedQuestionCapabilities() {
  return {
    supportedKinds: SUPPORTED_KINDS,
    deterministic: true,
    features: [
      "按固定种子重排选项并保持答案索引正确",
      "复用知识点与解析生成 Boss 题组",
      "支持题量、ID 前缀和决胜题生成",
      "同一内容版本和种子可重复复现",
    ],
  };
}

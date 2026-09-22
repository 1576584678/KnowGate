import type { ContentQuestion } from "@knowgate/domain";
import {
  getPersistence,
  type PersistenceStore,
} from "@/lib/persistence";
import { buildRuntimeContentGraph } from "@/lib/runtime-content";

export type QuestionCheckResult = {
  questionId: string;
  correct: boolean;
  correctIndex: number;
  explanation: string;
};

function findQuestion(
  questionId: string,
  persistence: PersistenceStore,
): ContentQuestion | undefined {
  const graph = buildRuntimeContentGraph(persistence);
  const graphQuestion = graph.questions.find(
    (question) => question.id === questionId,
  );
  if (graphQuestion) return graphQuestion;

  for (const chapter of graph.chapters) {
    const stepQuestion = chapter.steps.find(
      (step) => step.question?.id === questionId,
    )?.question;
    if (stepQuestion) return stepQuestion;
  }

  return undefined;
}

export function checkQuestion(
  input: {
    questionId: string;
    selectedIndex: number;
  },
  persistence: PersistenceStore = getPersistence(),
): QuestionCheckResult {
  const question = findQuestion(input.questionId, persistence);
  if (!question) throw new Error("QUESTION_NOT_FOUND");

  if (
    !Number.isInteger(input.selectedIndex) ||
    input.selectedIndex < 0 ||
    input.selectedIndex >= question.options.length
  ) {
    throw new Error("INVALID_ANSWER");
  }

  return {
    questionId: question.id,
    correct: input.selectedIndex === question.answerIndex,
    correctIndex: question.answerIndex,
    explanation: question.explanation,
  };
}

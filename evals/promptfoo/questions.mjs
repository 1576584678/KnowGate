import {
  buildDatasetContext,
  loadGraph,
  loadQuestions,
} from "../scripts/dataset.mjs";

/**
 * Promptfoo reads test cases from this generator. Each case exposes both the
 * current question and the graph/duplicate context required by the hard rules.
 */
export default function generateQuestionTests() {
  const records = loadQuestions();
  const graph = loadGraph();
  const dataset = buildDatasetContext(records, graph);

  return records.map((question) => ({
    description: `${question.id} | ${question.prompt}`,
    vars: { question, dataset },
    metadata: {
      questionId: question.id,
      contentVersion: graph.contentVersion,
      origin: question.origin,
      chapterId: question.chapterId,
      bossId: question.bossId,
    },
  }));
}

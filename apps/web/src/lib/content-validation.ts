import type {
  Boss,
  Chapter,
  ContentQuestion,
  KnowledgeNode,
  Milestone,
} from "@knowgate/domain";
import {
  bossQuestions,
  bosses,
  chapters,
  gradeWorld,
  knowledgeNodes,
  milestones,
} from "@/content/math-grade4";

export type ContentValidationIssue = {
  severity: "error" | "warning";
  code: string;
  entityType: "world" | "node" | "chapter" | "milestone" | "boss" | "question";
  entityId: string;
  message: string;
};

export type ContentGraph = {
  contentVersion: string;
  nodes: KnowledgeNode[];
  chapters: Chapter[];
  milestones: Milestone[];
  bosses: Boss[];
  questions: ContentQuestion[];
};

function duplicateIssues<Entity extends { id: string }>(
  entityType: ContentValidationIssue["entityType"],
  entities: Entity[],
) {
  const seen = new Set<string>();
  const issues: ContentValidationIssue[] = [];

  for (const entity of entities) {
    if (seen.has(entity.id)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_ID",
        entityType,
        entityId: entity.id,
        message: `${entityType} ID 重复：${entity.id}`,
      });
    }
    seen.add(entity.id);
  }

  return issues;
}

function validateQuestion(question: ContentQuestion) {
  const issues: ContentValidationIssue[] = [];
  const entityId = question.id;

  if (!question.prompt.trim()) {
    issues.push({
      severity: "error",
      code: "EMPTY_PROMPT",
      entityType: "question",
      entityId,
      message: "题目题干不能为空。",
    });
  }

  if (question.options.length < 2) {
    issues.push({
      severity: "error",
      code: "INSUFFICIENT_OPTIONS",
      entityType: "question",
      entityId,
      message: "题目至少需要两个选项。",
    });
  }

  if (
    !Number.isInteger(question.answerIndex) ||
    question.answerIndex < 0 ||
    question.answerIndex >= question.options.length
  ) {
    issues.push({
      severity: "error",
      code: "INVALID_ANSWER_INDEX",
      entityType: "question",
      entityId,
      message: "正确答案索引越界。",
    });
  }

  if (question.timeLimitSec <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_TIME_LIMIT",
      entityType: "question",
      entityId,
      message: "题目限时必须大于 0 秒。",
    });
  }

  if (question.damage <= 0) {
    issues.push({
      severity: "error",
      code: "INVALID_DAMAGE",
      entityType: "question",
      entityId,
      message: "题目伤害必须大于 0。",
    });
  }

  return issues;
}

export function validateContentGraph(
  graph: ContentGraph = {
    contentVersion: gradeWorld.contentVersion,
    nodes: knowledgeNodes,
    chapters,
    milestones,
    bosses,
    questions: bossQuestions,
  },
): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const chapterIds = new Set(graph.chapters.map((chapter) => chapter.id));
  const milestoneIds = new Set(graph.milestones.map((milestone) => milestone.id));
  const bossIds = new Set(graph.bosses.map((boss) => boss.id));
  const questionsById = new Map(
    graph.questions.map((question) => [question.id, question]),
  );

  if (!graph.contentVersion.trim()) {
    issues.push({
      severity: "error",
      code: "MISSING_CONTENT_VERSION",
      entityType: "world",
      entityId: gradeWorld.id,
      message: "缺少内容版本号。",
    });
  }

  issues.push(
    ...duplicateIssues("node", graph.nodes),
    ...duplicateIssues("chapter", graph.chapters),
    ...duplicateIssues("milestone", graph.milestones),
    ...duplicateIssues("boss", graph.bosses),
    ...duplicateIssues("question", graph.questions),
  );

  for (const node of graph.nodes) {
    for (const prerequisiteId of node.prerequisites) {
      if (!nodeIds.has(prerequisiteId)) {
        issues.push({
          severity: "error",
          code: "MISSING_PREREQUISITE",
          entityType: "node",
          entityId: node.id,
          message: `前置节点不存在：${prerequisiteId}`,
        });
      }

      if (prerequisiteId === node.id) {
        issues.push({
          severity: "error",
          code: "SELF_PREREQUISITE",
          entityType: "node",
          entityId: node.id,
          message: "节点不能把自己声明为前置节点。",
        });
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visitNode(nodeId: string, path: string[]) {
    if (visited.has(nodeId)) return;
    if (visiting.has(nodeId)) {
      issues.push({
        severity: "error",
        code: "PREREQUISITE_CYCLE",
        entityType: "node",
        entityId: nodeId,
        message: `前置关系存在环：${[...path, nodeId].join(" -> ")}`,
      });
      return;
    }

    visiting.add(nodeId);
    const node = graph.nodes.find((item) => item.id === nodeId);
    for (const prerequisiteId of node?.prerequisites ?? []) {
      if (nodeIds.has(prerequisiteId)) {
        visitNode(prerequisiteId, [...path, nodeId]);
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of graph.nodes) {
    visitNode(node.id, []);
  }

  for (const chapter of graph.chapters) {
    if (!milestoneIds.has(chapter.milestoneId)) {
      issues.push({
        severity: "error",
        code: "CHAPTER_MILESTONE_MISSING",
        entityType: "chapter",
        entityId: chapter.id,
        message: `章节所属里程碑不存在：${chapter.milestoneId}`,
      });
    }

    if (chapter.nodeIds.length === 0) {
      issues.push({
        severity: "error",
        code: "CHAPTER_WITHOUT_NODE",
        entityType: "chapter",
        entityId: chapter.id,
        message: "章节至少需要绑定一个知识节点。",
      });
    }

    for (const nodeId of chapter.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        issues.push({
          severity: "error",
          code: "CHAPTER_NODE_MISSING",
          entityType: "chapter",
          entityId: chapter.id,
          message: `章节引用的知识节点不存在：${nodeId}`,
        });
      }
    }

    const stepIds = new Set<string>();
    const questionIds = new Set<string>();
    for (const step of chapter.steps) {
      if (stepIds.has(step.id)) {
        issues.push({
          severity: "error",
          code: "DUPLICATE_STEP_ID",
          entityType: "chapter",
          entityId: chapter.id,
          message: `章节内步骤 ID 重复：${step.id}`,
        });
      }
      stepIds.add(step.id);

      if (!step.question) continue;

      issues.push(...validateQuestion(step.question));
      if (questionIds.has(step.question.id)) {
        issues.push({
          severity: "error",
          code: "DUPLICATE_CHAPTER_QUESTION",
          entityType: "chapter",
          entityId: chapter.id,
          message: `章节内题目 ID 重复：${step.question.id}`,
        });
      }
      questionIds.add(step.question.id);

      if (!chapter.nodeIds.includes(step.question.nodeId)) {
        issues.push({
          severity: "warning",
          code: "QUESTION_NODE_OUTSIDE_CHAPTER",
          entityType: "question",
          entityId: step.question.id,
          message: "题目知识节点未包含在所属章节的节点列表中。",
        });
      }
    }

    if (!chapter.steps.some((step) => step.phase === "quiz" && step.question)) {
      issues.push({
        severity: "error",
        code: "CHAPTER_WITHOUT_QUIZ",
        entityType: "chapter",
        entityId: chapter.id,
        message: "章节缺少带题目的短测步骤。",
      });
    }
  }

  const stageNumbers = new Set<number>();
  for (const milestone of graph.milestones) {
    if (stageNumbers.has(milestone.stageNo)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_STAGE",
        entityType: "milestone",
        entityId: milestone.id,
        message: `关卡阶段号重复：${milestone.stageNo}`,
      });
    }
    stageNumbers.add(milestone.stageNo);

    if (milestone.chapterIds.length === 0) {
      issues.push({
        severity: "error",
        code: "MILESTONE_WITHOUT_CHAPTER",
        entityType: "milestone",
        entityId: milestone.id,
        message: "里程碑缺少可玩章节。",
      });
    }

    for (const chapterId of milestone.chapterIds) {
      const chapter = graph.chapters.find((item) => item.id === chapterId);
      if (!chapter) {
        issues.push({
          severity: "error",
          code: "MILESTONE_CHAPTER_MISSING",
          entityType: "milestone",
          entityId: milestone.id,
          message: `里程碑引用的章节不存在：${chapterId}`,
        });
      } else if (chapter.milestoneId !== milestone.id) {
        issues.push({
          severity: "error",
          code: "CHAPTER_MILESTONE_MISMATCH",
          entityType: "milestone",
          entityId: milestone.id,
          message: `章节 ${chapterId} 归属于其他里程碑。`,
        });
      }
    }

    for (const nodeId of milestone.nodeIds) {
      if (!nodeIds.has(nodeId)) {
        issues.push({
          severity: "error",
          code: "MILESTONE_NODE_MISSING",
          entityType: "milestone",
          entityId: milestone.id,
          message: `里程碑引用的知识节点不存在：${nodeId}`,
        });
      }
    }

    if (!bossIds.has(milestone.bossId)) {
      issues.push({
        severity: "error",
        code: "MILESTONE_BOSS_MISSING",
        entityType: "milestone",
        entityId: milestone.id,
        message: `里程碑引用的 Boss 不存在：${milestone.bossId}`,
      });
    }

    const milestoneBoss = graph.bosses.find(
      (boss) => boss.id === milestone.bossId,
    );
    if (milestoneBoss && milestoneBoss.milestoneId !== milestone.id) {
      issues.push({
        severity: "error",
        code: "MILESTONE_BOSS_MISMATCH",
        entityType: "milestone",
        entityId: milestone.id,
        message: `Boss ${milestone.bossId} 归属于其他里程碑。`,
      });
    }
  }

  for (let stageNo = 1; stageNo <= graph.milestones.length; stageNo += 1) {
    if (!stageNumbers.has(stageNo)) {
      issues.push({
        severity: "error",
        code: "MISSING_STAGE",
        entityType: "milestone",
        entityId: String(stageNo),
        message: `课程阶段号不连续，缺少第 ${stageNo} 阶段。`,
      });
    }
  }

  for (const boss of graph.bosses) {
    if (!milestoneIds.has(boss.milestoneId)) {
      issues.push({
        severity: "error",
        code: "BOSS_MILESTONE_MISSING",
        entityType: "boss",
        entityId: boss.id,
        message: `Boss 所属里程碑不存在：${boss.milestoneId}`,
      });
    }

    if (boss.hp <= 0 || boss.initialDistance <= 0) {
      issues.push({
        severity: "error",
        code: "INVALID_BOSS_HEALTH",
        entityType: "boss",
        entityId: boss.id,
        message: "Boss 血量或追击距离必须大于 0。",
      });
    }

    if (boss.questionIds.length < 8) {
      issues.push({
        severity: "error",
        code: "INSUFFICIENT_BOSS_QUESTIONS",
        entityType: "boss",
        entityId: boss.id,
        message: "Boss 至少需要 8 道题。",
      });
    }

    for (const questionId of boss.questionIds) {
      if (!questionsById.has(questionId)) {
        issues.push({
          severity: "error",
          code: "BOSS_QUESTION_MISSING",
          entityType: "boss",
          entityId: boss.id,
          message: `Boss 引用的题目不存在：${questionId}`,
        });
      }
    }

    const lastQuestion = questionsById.get(
      boss.questionIds[boss.questionIds.length - 1] ?? "",
    );
    if (lastQuestion && lastQuestion.kind !== "decisive") {
      issues.push({
        severity: "warning",
        code: "BOSS_WITHOUT_DECISIVE_FINISH",
        entityType: "boss",
        entityId: boss.id,
        message: "Boss 最后一题建议设置为决胜题。",
      });
    }
  }

  for (const chapterId of chapterIds) {
    if (
      !graph.milestones.some((milestone) =>
        milestone.chapterIds.includes(chapterId),
      )
    ) {
      issues.push({
        severity: "warning",
        code: "ORPHAN_CHAPTER",
        entityType: "chapter",
        entityId: chapterId,
        message: "章节没有被任何里程碑编排引用。",
      });
    }
  }

  return issues;
}

export function assertContentGraph(graph?: ContentGraph) {
  const issues = validateContentGraph(graph);
  const errors = issues.filter((issue) => issue.severity === "error");

  if (errors.length > 0) {
    throw new Error(
      `CONTENT_GRAPH_INVALID:${errors.map((issue) => issue.code).join(",")}`,
    );
  }

  return issues;
}

export type BattleMode = "standard" | "learning";

export type QuestionKind =
  | "identify"
  | "judge"
  | "apply"
  | "transfer"
  | "decisive";

export type FractionVisual = {
  kind: "fraction-bar";
  total: number;
  active: number;
  compareTo?: number;
  labels?: string[];
};

export type ContentQuestion = {
  id: string;
  nodeId: string;
  kind: QuestionKind;
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
  timeLimitSec: number;
  damage: number;
  visual?: FractionVisual;
};

export type LessonPhase =
  | "hook"
  | "concept"
  | "example"
  | "guided"
  | "practice"
  | "quiz";

export type LessonStep = {
  id: string;
  phase: LessonPhase;
  title: string;
  body: string;
  question?: ContentQuestion;
  visual?: FractionVisual;
};

export type Chapter = {
  id: string;
  milestoneId: string;
  stageNo: number;
  title: string;
  summary: string;
  estimatedMinutes: number;
  nodeIds: string[];
  steps: LessonStep[];
};

export type KnowledgeNode = {
  id: string;
  name: string;
  domain: string;
  stage: string;
  mastery: string[];
  prerequisites: string[];
};

export type Milestone = {
  id: string;
  stageNo: number;
  name: string;
  theme: string;
  summary: string;
  nodeIds: string[];
  chapterIds: string[];
  bossId: string;
};

export type Boss = {
  id: string;
  milestoneId: string;
  name: string;
  epithet: string;
  hp: number;
  initialDistance: number;
  questionIds: string[];
};

export type BattleQuestion = ContentQuestion;

export type BattleAnswer = {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  timedOut: boolean;
  submittedAt: string;
  damage: number;
  bossAdvance: number;
};

export type BattleMistake = {
  questionId: string;
  nodeId: string;
  prompt: string;
  explanation: string;
  selectedIndex: number;
  correctIndex: number;
  timedOut: boolean;
};

export type BattleStatus = "active" | "won" | "lost" | "abandoned";

export type BattleOutcome = {
  milestoneId: string;
  status: "won" | "lost";
  accuracy: number;
  maxCombo: number;
  mistakes: BattleMistake[];
  completedAt: string;
};

export type ProgressSnapshot = {
  passedChapterIds: string[];
  battleOutcomes: Record<string, BattleOutcome>;
};

export type MasteryStatus = "learning" | "developing" | "mastered";

export type MasteryEvidence = {
  completedChapters: number;
  totalChapters: number;
  bossOutcome?: BattleOutcome;
  delayedReviewScore?: number;
};

export type MasteryBreakdown = {
  score: number;
  status: MasteryStatus;
  chapterScore: number;
  practiceScore: number;
  bossScore: number;
  delayedReviewScore: number;
};

export type ChapterCompletionAnswer = {
  itemId: string;
  answer: string;
};

export type ChapterCompletionResult = {
  chapterId: string;
  milestoneId: string;
  passed: boolean;
  score: number;
  correctCount: number;
  questionCount: number;
  masteryDelta: Record<string, number>;
  nextAction: "next_chapter" | "boss_available";
  contentVersion: string;
  completedAt: string;
};

export const learningEventTypes = [
  "page_viewed",
  "chapter_started",
  "chapter_step_viewed",
  "chapter_answer_submitted",
  "chapter_completed",
  "chapter_quiz_failed",
  "chapter_migrated",
  "practice_answered",
  "boss_started",
  "boss_question_served",
  "boss_answer_submitted",
  "boss_answer_resolved",
  "boss_won",
  "boss_lost",
  "remediation_started",
  "remediation_completed",
  "report_viewed",
] as const;

export type LearningEventType = (typeof learningEventTypes)[number];

export type LearningEvent = {
  id: string;
  profileId: string;
  eventType: LearningEventType;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  contentVersion?: string;
};

export type ContentDraftKind =
  | "knowledge_node"
  | "chapter"
  | "boss"
  | "question_template"
  | "curriculum";

export type ContentDraftStatus =
  | "draft"
  | "in_review"
  | "approved"
  | "rejected"
  | "published";

export type ContentDraft = {
  id: string;
  kind: ContentDraftKind;
  title: string;
  payload: Record<string, unknown>;
  status: ContentDraftStatus;
  authorId: string;
  reviewerId?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  publishedAt?: string;
};

export type ContentReviewRecord = {
  id: string;
  draftId: string;
  action: "submitted" | "approved" | "rejected" | "published";
  operatorId: string;
  note?: string;
  occurredAt: string;
};

export type BattleSession = {
  id: string;
  milestoneId: string;
  contentVersion: string;
  boss: Boss;
  mode: BattleMode;
  status: BattleStatus;
  bossHp: number;
  bossDistance: number;
  combo: number;
  maxCombo: number;
  correctCount: number;
  questionIndex: number;
  questionServedAt: string;
  questions: BattleQuestion[];
  answers: BattleAnswer[];
  mistakes: BattleMistake[];
  startedAt: string;
};

export type PublicBattleQuestion = Omit<ContentQuestion, "answerIndex"> & {
  servedAt: string;
  deadlineAt: string;
};

export type PublicBattleState = {
  id: string;
  milestoneId: string;
  contentVersion: string;
  mode: BattleMode;
  status: BattleStatus;
  boss: {
    id: string;
    name: string;
    epithet: string;
    hp: number;
    maxHp: number;
    distance: number;
    initialDistance: number;
  };
  combo: number;
  maxCombo: number;
  correctCount: number;
  answeredCount: number;
  questionIndex: number;
  questionCount: number;
  currentQuestion: PublicBattleQuestion | null;
  mistakes: BattleMistake[];
  startedAt: string;
};

export type ResolveAnswerResult = {
  state: PublicBattleState;
  accepted: boolean;
  correct: boolean;
  correctIndex: number;
  timedOut: boolean;
  damage: number;
  bossAdvance: number;
  explanation: string;
};

const COMBO_BONUS_STEPS = new Set([3, 5]);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function toIso(date: Date) {
  return date.toISOString();
}

export function calculateMasteryBreakdown(
  evidence: MasteryEvidence,
): MasteryBreakdown {
  const totalChapters = Math.max(0, evidence.totalChapters);
  const completedChapters = clamp(
    evidence.completedChapters,
    0,
    totalChapters,
  );
  const chapterRatio =
    totalChapters === 0 ? 0 : completedChapters / totalChapters;
  const chapterScore = chapterRatio * 20;
  const practiceScore = Math.min(30, completedChapters * 10);
  const bossScore =
    evidence.bossOutcome?.status === "won"
      ? 40
      : clamp((evidence.bossOutcome?.accuracy ?? 0) * 0.4, 0, 40);
  const delayedReviewScore = clamp(evidence.delayedReviewScore ?? 0, 0, 10);
  const score = Math.round(
    clamp(chapterScore + practiceScore + bossScore + delayedReviewScore, 0, 100),
  );

  return {
    score,
    status: getMasteryStatus(score),
    chapterScore: Math.round(chapterScore),
    practiceScore,
    bossScore: Math.round(bossScore),
    delayedReviewScore,
  };
}

export function calculateMastery(evidence: MasteryEvidence) {
  return calculateMasteryBreakdown(evidence).score;
}

export function getMasteryStatus(mastery: number): MasteryStatus {
  if (mastery >= 80) return "mastered";
  if (mastery >= 60) return "developing";
  return "learning";
}

export function publicQuestion(
  question: BattleQuestion,
  servedAt = new Date(),
): PublicBattleQuestion {
  const { answerIndex: _answerIndex, ...safeQuestion } = question;
  const deadlineAt = new Date(
    servedAt.getTime() + question.timeLimitSec * 1000,
  );

  return {
    ...safeQuestion,
    servedAt: toIso(servedAt),
    deadlineAt: toIso(deadlineAt),
  };
}

export function toPublicBattleState(
  session: BattleSession,
  servedAt = new Date(session.questionServedAt),
): PublicBattleState {
  const current = session.questions[session.questionIndex];
  const finished = session.status !== "active";

  return {
    id: session.id,
    milestoneId: session.milestoneId,
    contentVersion: session.contentVersion,
    mode: session.mode,
    status: session.status,
    boss: {
      id: session.boss.id,
      name: session.boss.name,
      epithet: session.boss.epithet,
      hp: session.bossHp,
      maxHp: session.boss.hp,
      distance: session.bossDistance,
      initialDistance: session.boss.initialDistance,
    },
    combo: session.combo,
    maxCombo: session.maxCombo,
    correctCount: session.correctCount,
    answeredCount: session.answers.length,
    questionIndex: session.questionIndex,
    questionCount: session.questions.length,
    currentQuestion:
      current && !finished ? publicQuestion(current, servedAt) : null,
    mistakes: session.mistakes,
    startedAt: session.startedAt,
  };
}

export function createBattleSession(input: {
  id: string;
  milestoneId: string;
  contentVersion?: string;
  boss: Boss;
  mode: BattleMode;
  questions: BattleQuestion[];
  now?: Date;
}): BattleSession {
  if (input.questions.length === 0) {
    throw new Error("A battle requires at least one question.");
  }

  return {
    id: input.id,
    milestoneId: input.milestoneId,
    contentVersion: input.contentVersion ?? "local",
    boss: input.boss,
    mode: input.mode,
    status: "active",
    bossHp: input.boss.hp,
    bossDistance: input.boss.initialDistance,
    combo: 0,
    maxCombo: 0,
    correctCount: 0,
    questionIndex: 0,
    questionServedAt: toIso(input.now ?? new Date()),
    questions: input.questions,
    answers: [],
    mistakes: [],
    startedAt: toIso(input.now ?? new Date()),
  };
}

export function resolveBattleAnswer(input: {
  session: BattleSession;
  questionId: string;
  selectedIndex: number;
  submittedAt?: Date;
}): ResolveAnswerResult {
  const { session, questionId, selectedIndex } = input;
  const question = session.questions.find((item) => item.id === questionId);

  if (!question) {
    throw new Error("QUESTION_NOT_FOUND");
  }

  const servedAnswer = session.answers.find(
    (answer) => answer.questionId === questionId,
  );

  if (servedAnswer) {
    return {
      state: toPublicBattleState(session),
      accepted: false,
      correct: servedAnswer.correct,
      correctIndex: question.answerIndex,
      timedOut: servedAnswer.timedOut,
      damage: servedAnswer.damage,
      bossAdvance: servedAnswer.bossAdvance,
      explanation: question.explanation,
    };
  }

  if (
    session.status !== "active" ||
    session.questions[session.questionIndex]?.id !== questionId
  ) {
    throw new Error("QUESTION_NOT_ACTIVE");
  }

  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < -1 ||
    selectedIndex >= question.options.length
  ) {
    throw new Error("INVALID_ANSWER");
  }

  const submittedAt = input.submittedAt ?? new Date();
  const servedAt = new Date(session.questionServedAt);
  const timedOut =
    submittedAt.getTime() >
    servedAt.getTime() + question.timeLimitSec * 1000 + 500;
  const correct = !timedOut && selectedIndex === question.answerIndex;
  const bossAdvance = correct
    ? 0
    : session.mode === "learning" && timedOut
      ? 0
      : 1;

  if (correct) {
    session.combo += 1;
    session.maxCombo = Math.max(session.maxCombo, session.combo);
    session.correctCount += 1;
  } else {
    session.combo = 0;
  }

  const comboBonus = correct && COMBO_BONUS_STEPS.has(session.combo) ? 1 : 0;
  const damage = correct ? question.damage + comboBonus : 0;

  session.bossHp = Math.max(0, session.bossHp - damage);
  session.bossDistance = Math.max(0, session.bossDistance - bossAdvance);
  session.answers.push({
    questionId,
    selectedIndex,
    correct,
    timedOut,
    submittedAt: toIso(submittedAt),
    damage,
    bossAdvance,
  });

  if (!correct) {
    session.mistakes.push({
      questionId,
      nodeId: question.nodeId,
      prompt: question.prompt,
      explanation: question.explanation,
      selectedIndex,
      correctIndex: question.answerIndex,
      timedOut,
    });
  }

  if (question.kind === "decisive" && correct) {
    session.bossHp = 0;
  }

  if (session.bossHp <= 0) {
    session.status = "won";
  } else if (session.bossDistance <= 0) {
    session.status = "lost";
  } else if (question.kind === "decisive") {
    session.status = "lost";
  } else if (session.questionIndex < session.questions.length - 1) {
    session.questionIndex += 1;
    session.questionServedAt = toIso(submittedAt);
  } else {
    session.status = "lost";
  }

  return {
    state: toPublicBattleState(session),
    accepted: true,
    correct,
    correctIndex: question.answerIndex,
    timedOut,
    damage,
    bossAdvance,
    explanation: question.explanation,
  };
}

export function abandonBattleSession(session: BattleSession) {
  if (session.status === "active") {
    session.status = "abandoned";
  }

  return toPublicBattleState(session);
}

export function battleAccuracy(session: BattleSession) {
  const answered = session.answers.length;
  return answered === 0
    ? 0
    : Math.round((session.correctCount / answered) * 100);
}

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

export type BattleStatus = "active" | "won" | "lost";

export type BattleSession = {
  id: string;
  milestoneId: string;
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

function toIso(date: Date) {
  return date.toISOString();
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
  const question = session.questions[session.questionIndex];

  if (!question || question.id !== questionId || session.status !== "active") {
    throw new Error("QUESTION_NOT_ACTIVE");
  }

  const submittedAt = input.submittedAt ?? new Date();
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

  if (session.bossHp <= 0) {
    session.status = "won";
  } else if (session.bossDistance <= 0) {
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

export function battleAccuracy(session: BattleSession) {
  const answered = session.answers.length;
  return answered === 0
    ? 0
    : Math.round((session.correctCount / answered) * 100);
}

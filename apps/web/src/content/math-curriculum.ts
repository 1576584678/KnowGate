import type {
  Boss,
  Chapter,
  ContentQuestion,
  KnowledgeNode,
  LessonStep,
  Milestone,
  QuestionKind,
} from "@knowgate/domain";
import {
  bossQuestions as grade4BossQuestions,
  bosses as grade4Bosses,
  chapters as grade4Chapters,
  gradeWorld as grade4World,
  knowledgeNodes as grade4Nodes,
  milestones as grade4Milestones,
} from "@/content/math-grade4";
import { generateBossQuestionSet } from "@/lib/question-generator";

export const mathContentVersion = "2026.09.23.1";

type QuestionSeed = Omit<ContentQuestion, "id" | "nodeId">;

type ChapterBlueprint = {
  title: string;
  summary: string;
};

type MilestoneBlueprint = {
  name: string;
  theme: string;
  summary: string;
  domain: string;
  mastery: string[];
  chapters: [ChapterBlueprint, ChapterBlueprint, ChapterBlueprint];
  questions: QuestionSeed[];
};

type GradeBlueprint = {
  id: string;
  grade: number;
  name: string;
  milestones: MilestoneBlueprint[];
};

export type MathGradeContent = {
  gradeWorld: {
    id: string;
    contentVersion: string;
    subjectId: string;
    grade: number;
    name: string;
    totalStages: number;
  };
  knowledgeNodes: KnowledgeNode[];
  chapters: Chapter[];
  milestones: Milestone[];
  bosses: Boss[];
  bossQuestions: ContentQuestion[];
};

export type MathGradeWorldSummary = {
  id: string;
  subjectId: string;
  grade: number;
  name: string;
  contentVersion: string;
  totalStages: number;
};

function q(
  kind: QuestionKind,
  prompt: string,
  options: string[],
  answerIndex: number,
  explanation: string,
  damage = 1,
): QuestionSeed {
  return {
    kind,
    prompt,
    options,
    answerIndex,
    explanation,
    timeLimitSec: 45,
    damage,
  };
}

function padStage(stageNo: number) {
  return String(stageNo).padStart(2, "0");
}

function chapterId(grade: number, stageNo: number, chapterNo: number) {
  return `chapter.g${grade}.${padStage(stageNo)}.${padStage(chapterNo)}`;
}

function milestoneId(grade: number, stageNo: number) {
  return `math.g${grade}.milestone.${padStage(stageNo)}`;
}

function nodeId(grade: number, stageNo: number) {
  return `math.g${grade}.node.${padStage(stageNo)}`;
}

function bossId(grade: number, stageNo: number) {
  return `boss.g${grade}.stage.${padStage(stageNo)}`;
}

function answerText(source: QuestionSeed) {
  return source.options[source.answerIndex] ?? source.options[0] ?? "";
}

function contextualQuestion(
  source: QuestionSeed,
  chapter: ChapterBlueprint,
): QuestionSeed {
  return {
    ...source,
    prompt: `在“${chapter.title}”的课堂练习中，请完成：${source.prompt}`,
  };
}

function feedbackQuestion(
  source: QuestionSeed,
  chapter: ChapterBlueprint,
): QuestionSeed {
  const answer = answerText(source);

  return {
    ...source,
    kind: "judge",
    prompt: `小虎在“${chapter.title}”练习中把“${answer}”填了进去。对于题目“${source.prompt}”，他填对了吗？`,
    options: ["正确", "错误"],
    answerIndex: 0,
    explanation: `${source.explanation} 因此“${answer}”是正确的。`,
  };
}

function decisionQuestion(
  source: QuestionSeed,
  chapter: ChapterBlueprint,
): QuestionSeed {
  return {
    ...source,
    prompt: `结合“${chapter.summary}”这一学习重点，回答：${source.prompt}`,
  };
}

function createChapter(input: {
  id: string;
  milestoneId: string;
  stageNo: number;
  chapterNo: number;
  nodeId: string;
  blueprint: ChapterBlueprint;
  milestone: MilestoneBlueprint;
}): Chapter {
  const sourceQuestions = input.milestone.questions;
  const primary = contextualQuestion(
    sourceQuestions[input.chapterNo % sourceQuestions.length],
    input.blueprint,
  );
  const practice = feedbackQuestion(
    sourceQuestions[(input.chapterNo + 1) % sourceQuestions.length],
    input.blueprint,
  );
  const quiz = decisionQuestion(
    sourceQuestions[(input.chapterNo + 2) % sourceQuestions.length],
    input.blueprint,
  );
  const questions: QuestionSeed[] = [
    primary,
    practice,
    quiz,
  ];
  const phases = ["guided", "practice", "quiz"] as const;
  const steps: LessonStep[] = [
    {
      id: `${input.id}.hook`,
      phase: "hook",
      title: input.blueprint.title,
      body: `从“${input.milestone.theme}”里的一个具体例子开始：${input.blueprint.summary}`,
    },
    {
      id: `${input.id}.concept`,
      phase: "concept",
      title: `抓住关键：${input.blueprint.title}`,
      body: `${input.blueprint.summary} 先看清条件，再选择合适的运算或判断方法。`,
    },
    ...questions.map((question, index) => ({
      id: `${input.id}.${phases[index]}`,
      phase: phases[index],
      title:
        index === 0
          ? "跟着完成一步"
          : index === 1
            ? "独立判断"
            : "章节短测",
      body:
        index === 2
          ? "答对后，本章的学习证据会由服务端记录。"
          : "先说明理由，再选择答案。",
      question: {
        ...question,
        id: `${input.id}.${phases[index]}.item`,
        nodeId: input.nodeId,
      },
    })),
  ];

  return {
    id: input.id,
    milestoneId: input.milestoneId,
    stageNo: input.chapterNo + 1,
    title: input.blueprint.title,
    summary: input.blueprint.summary,
    estimatedMinutes: input.chapterNo === 2 ? 7 : 6,
    nodeIds: [input.nodeId],
    steps,
  };
}

function buildGradeContent(blueprint: GradeBlueprint): MathGradeContent {
  if (blueprint.milestones.length !== 10) {
    throw new Error(`GRADE_MILESTONE_COUNT_INVALID:${blueprint.id}`);
  }

  const knowledgeNodes: KnowledgeNode[] = blueprint.milestones.map(
    (milestone, index) => ({
      id: nodeId(blueprint.grade, index + 1),
      name: milestone.name,
      domain: milestone.domain,
      stage: `g${blueprint.grade}`,
      prerequisites:
        index === 0 ? [] : [nodeId(blueprint.grade, index)],
      mastery: milestone.mastery,
    }),
  );

  const chapters: Chapter[] = blueprint.milestones.flatMap(
    (milestone, milestoneIndex) => {
      const stageNo = milestoneIndex + 1;
      return milestone.chapters.map((chapter, chapterIndex) =>
        createChapter({
          id: chapterId(blueprint.grade, stageNo, chapterIndex + 1),
          milestoneId: milestoneId(blueprint.grade, stageNo),
          stageNo,
          chapterNo: chapterIndex,
          nodeId: nodeId(blueprint.grade, stageNo),
          blueprint: chapter,
          milestone,
        }),
      );
    },
  );

  const extraSeeds: ContentQuestion[] = blueprint.milestones.flatMap(
    (milestone, milestoneIndex) =>
      milestone.questions.slice(0, 3).map((seed, seedIndex) => ({
        ...seed,
        id: `item.g${blueprint.grade}.${padStage(
          milestoneIndex + 1,
        )}.seed.${seedIndex + 1}`,
        nodeId: nodeId(blueprint.grade, milestoneIndex + 1),
        prompt: `综合应用：${seed.prompt}`,
      })),
  );

  const bossQuestionsByMilestone = blueprint.milestones.map(
    (milestone, milestoneIndex) => {
      const stageNo = milestoneIndex + 1;
      const chapterQuestions = chapters
        .filter(
          (chapter) =>
            chapter.milestoneId === milestoneId(blueprint.grade, stageNo),
        )
        .flatMap((chapter) =>
          chapter.steps.flatMap((step) =>
            step.question ? [step.question] : [],
          ),
        );
      const seedQuestions = extraSeeds.filter((question) =>
        question.id.startsWith(
          `item.g${blueprint.grade}.${padStage(stageNo)}.seed.`,
        ),
      );

      return generateBossQuestionSet({
        sourceQuestions: [...chapterQuestions, ...seedQuestions],
        seed: 20260900 + blueprint.grade * 100 + stageNo,
        questionCount: 10,
        idPrefix: `item.g${blueprint.grade}.boss.${padStage(stageNo)}`,
      });
    },
  );

  const milestones: Milestone[] = blueprint.milestones.map(
    (milestone, milestoneIndex) => {
      const stageNo = milestoneIndex + 1;
      return {
        id: milestoneId(blueprint.grade, stageNo),
        stageNo,
        name: milestone.name,
        theme: milestone.theme,
        summary: milestone.summary,
        nodeIds: [nodeId(blueprint.grade, stageNo)],
        chapterIds: chapters
          .filter(
            (chapter) =>
              chapter.milestoneId === milestoneId(blueprint.grade, stageNo),
          )
          .map((chapter) => chapter.id),
        bossId: bossId(blueprint.grade, stageNo),
      };
    },
  );

  const bosses: Boss[] = blueprint.milestones.map((milestone, index) => ({
    id: bossId(blueprint.grade, index + 1),
    milestoneId: milestoneId(blueprint.grade, index + 1),
    name: `${milestone.name}守护者`,
    epithet: milestone.theme,
    hp: 10,
    initialDistance: 5,
    questionIds: bossQuestionsByMilestone[index].map(
      (question) => question.id,
    ),
  }));

  return {
    gradeWorld: {
      id: blueprint.id,
      contentVersion: mathContentVersion,
      subjectId: "math",
      grade: blueprint.grade,
      name: blueprint.name,
      totalStages: blueprint.milestones.length,
    },
    knowledgeNodes,
    chapters,
    milestones,
    bosses,
    bossQuestions: bossQuestionsByMilestone.flat(),
  };
}

const gradeOne: GradeBlueprint = {
  id: "math.g1",
  grade: 1,
  name: "一年级 · 数字启蒙岛",
  milestones: [
    {
      name: "数字初醒",
      theme: "0 到 10 的数感",
      summary: "认识 0 到 10，会比较大小并排出顺序。",
      domain: "数与运算",
      mastery: ["能读写 0 到 10", "能比较两个数的大小", "能按顺序排列数"],
      chapters: [
        { title: "数一数有几个", summary: "用一一对应数出物体的数量。" },
        { title: "比多少和大小", summary: "用更多、更少和大小符号比较数量。" },
        { title: "按顺序排队", summary: "从 0 到 10 顺着数、倒着数。" },
      ],
      questions: [
        q("identify", "5 和 7 相比，哪个数更大？", ["7", "5", "一样大"], 0, "7 在数轴上排在 5 的后面，所以 7 更大。"),
        q("apply", "从 3 接着往后数一个数，是哪一个？", ["4", "2", "5"], 0, "3 的下一个数是 4。"),
        q("judge", "0 表示一个也没有。", ["正确", "错误"], 0, "0 可以表示一个物体也没有。"),
        q("transfer", "一队小朋友排成 1、2、3、4、5，最前面的是谁？", ["1", "5", "3"], 0, "从小到大的顺序里，1 在最前面。", 2),
      ],
    },
    {
      name: "十以内加减",
      theme: "加法与减法的含义",
      summary: "用合起来和去掉理解十以内加减。",
      domain: "数与运算",
      mastery: ["能理解加法表示合起来", "能理解减法表示去掉", "能计算十以内加减"],
      chapters: [
        { title: "合起来用加法", summary: "把两个数量合并，用加法求总数。" },
        { title: "去掉用减法", summary: "从总数里去掉一部分，用减法求剩下。" },
        { title: "加减互相检查", summary: "用总数和一部分检查另一部分。" },
      ],
      questions: [
        q("apply", "2+3 等于多少？", ["5", "4", "6"], 0, "2 和 3 合起来是 5。"),
        q("apply", "7-4 等于多少？", ["3", "2", "4"], 0, "7 去掉 4 还剩 3。"),
        q("judge", "5+0 的结果还是 5。", ["正确", "错误"], 0, "加上 0 表示没有增加。"),
        q("transfer", "盘里有 4 个苹果，又放来 2 个，现在有多少个？", ["6 个", "2 个", "5 个"], 0, "4 和 2 合起来是 6。", 2),
      ],
    },
    {
      name: "认识十一到二十",
      theme: "11 到 20 的组成",
      summary: "理解十几由一个十和几个一组成。",
      domain: "数与运算",
      mastery: ["能读 11 到 20", "能说出十和几", "能比较 20 以内数"],
      chapters: [
        { title: "十和几", summary: "把十几拆成一个十和几个一。" },
        { title: "二十以内排队", summary: "按从小到大或从大到小排列。" },
        { title: "紧挨着的数", summary: "找前一个数、后一个数和相邻数。" },
      ],
      questions: [
        q("identify", "14 里面有几个十和几个一？", ["1 个十和 4 个一", "4 个十和 1 个一", "14 个十"], 0, "14 的十位是 1，个位是 4。"),
        q("apply", "16 后面一个数是多少？", ["17", "15", "18"], 0, "16 往后数一个是 17。"),
        q("judge", "19 比 20 小。", ["正确", "错误"], 0, "19 在 20 前面。"),
        q("transfer", "10 个一再加上 6 个一，一共是多少？", ["16", "106", "6"], 0, "10 和 6 合起来是 16。", 2),
      ],
    },
    {
      name: "二十以内进位加",
      theme: "凑十法加法",
      summary: "用凑十法完成 20 以内进位加法。",
      domain: "数与运算",
      mastery: ["能用凑十法计算", "能说出进位过程", "能解决简单加法应用"],
      chapters: [
        { title: "先凑成十", summary: "把其中一个数拆开，先凑满十。" },
        { title: "十再加几", summary: "凑成十后，再加上剩下的数。" },
        { title: "生活中的进位加", summary: "用进位加法解决买东西和排队问题。" },
      ],
      questions: [
        q("apply", "8+5 等于多少？", ["13", "12", "14"], 0, "8 先加 2 得 10，再加 3 得 13。"),
        q("apply", "9+7 等于多少？", ["16", "15", "17"], 0, "9 先加 1 得 10，再加 6 得 16。"),
        q("judge", "计算 8+5 时，可以把 5 分成 2 和 3。", ["正确", "错误"], 0, "8 加 2 凑十，再加 3。"),
        q("transfer", "小明有 6 张卡，又得到 8 张，一共有多少张？", ["14 张", "13 张", "2 张"], 0, "6+8=14。", 2),
      ],
    },
    {
      name: "二十以内退位减",
      theme: "破十法减法",
      summary: "用破十和想加算减完成退位减法。",
      domain: "数与运算",
      mastery: ["能用破十法计算", "能用加法验算减法", "能解决简单减法应用"],
      chapters: [
        { title: "从十里去掉", summary: "个位不够减时，先从十里面减。" },
        { title: "想加算减", summary: "想哪个数加减数得到总数。" },
        { title: "生活中的退位减", summary: "用减法解决剩下多少的问题。" },
      ],
      questions: [
        q("apply", "13-5 等于多少？", ["8", "7", "9"], 0, "10-5=5，5+3=8。"),
        q("apply", "15-8 等于多少？", ["7", "6", "8"], 0, "10-8=2，2+5=7。"),
        q("judge", "12-4 可以用 4+8=12 来验算。", ["正确", "错误"], 0, "减法和加法可以互相检查。"),
        q("transfer", "树上有 14 只鸟，飞走 6 只，还剩多少只？", ["8 只", "9 只", "6 只"], 0, "14-6=8。", 2),
      ],
    },
    {
      name: "图形与位置",
      theme: "认识常见图形和位置",
      summary: "辨认平面图形，描述上下左右和前后。",
      domain: "图形与几何",
      mastery: ["能辨认常见平面图形", "能描述物体位置", "能按位置找物体"],
      chapters: [
        { title: "图形朋友", summary: "认识圆、三角形、正方形和长方形。" },
        { title: "上下左右", summary: "用方位词说清物体在哪里。" },
        { title: "前后和排队", summary: "根据前后顺序描述位置。" },
      ],
      questions: [
        q("identify", "有 3 条边的图形叫什么？", ["三角形", "正方形", "圆"], 0, "三角形有 3 条边。"),
        q("apply", "苹果在桌子的上面，说明苹果的位置在哪里？", ["桌子上方", "桌子下面", "桌子里面"], 0, "上面表示在物体的上方。"),
        q("judge", "圆没有直直的边。", ["正确", "错误"], 0, "圆是由一条曲线围成的。"),
        q("transfer", "小明在小红前面，小红在小刚前面，谁排最后？", ["小刚", "小明", "小红"], 0, "前面依次是小明、小红，小刚在最后。", 2),
      ],
    },
    {
      name: "分类与规律",
      theme: "按标准分类和找规律",
      summary: "按照颜色、形状等标准分类，并发现简单规律。",
      domain: "综合与实践",
      mastery: ["能按一个标准分类", "能发现重复规律", "能补出下一个图形"],
      chapters: [
        { title: "按一个标准分组", summary: "选择颜色、大小或形状作为分类标准。" },
        { title: "发现重复规律", summary: "观察一组图形怎样重复出现。" },
        { title: "补上接下来的", summary: "根据规律判断下一个是什么。" },
      ],
      questions: [
        q("apply", "红球、红球、蓝球、红球、红球、蓝球，下一个是什么？", ["红球", "蓝球", "黄球"], 0, "规律是红、红、蓝重复。"),
        q("judge", "按颜色分类时，同一组的物体颜色相同。", ["正确", "错误"], 0, "颜色是这组分类的标准。"),
        q("identify", "把圆形放一起、三角形放一起，这是按什么分类？", ["形状", "时间", "味道"], 0, "这里使用的标准是形状。"),
        q("transfer", "1、2、1、2、1、2，下一个数是什么？", ["1", "2", "3"], 0, "1 和 2 交替出现，下一个是 1。", 2),
      ],
    },
    {
      name: "长度与时间",
      theme: "初步测量和整时",
      summary: "用厘米估测长度，认识整时和半时。",
      domain: "量与测量",
      mastery: ["能用厘米测量", "能认识整时", "能比较长短和早晚"],
      chapters: [
        { title: "谁更长", summary: "把物体一端对齐，另一端比较长短。" },
        { title: "厘米小尺子", summary: "用厘米作单位量出物体长度。" },
        { title: "认识整时", summary: "看钟面时针和分针读整时。" },
      ],
      questions: [
        q("apply", "铅笔一端对着 0，另一端对着 8，铅笔长多少厘米？", ["8 厘米", "7 厘米", "9 厘米"], 0, "从 0 到 8 是 8 厘米。"),
        q("identify", "钟面时针指向 3，分针指向 12，是几时？", ["3 时", "12 时", "6 时"], 0, "分针指向 12，时针指向 3，就是 3 时。"),
        q("judge", "比较两根绳子长短时，要先把一端对齐。", ["正确", "错误"], 0, "一端对齐后才能公平比较另一端。"),
        q("transfer", "上午 8 时比上午 9 时早还是晚？", ["早", "晚", "一样"], 0, "8 时在 9 时之前。", 2),
      ],
    },
    {
      name: "数据小站",
      theme: "看图数数和比较",
      summary: "从简单图片和表格中数出数量并比较。",
      domain: "数据与概率",
      mastery: ["能看懂图片数据", "能数出数量", "能比较多少"],
      chapters: [
        { title: "数一数表格", summary: "从表格里找到每类物品的数量。" },
        { title: "图片里的数据", summary: "用画圈或小方块表示数量。" },
        { title: "谁最多谁最少", summary: "比较几类数据的多少。" },
      ],
      questions: [
        q("apply", "统计图里苹果有 5 个，梨有 3 个，苹果比梨多几个？", ["2 个", "8 个", "3 个"], 0, "5-3=2。"),
        q("identify", "画了 4 个圆表示 4 本书，这表示什么？", ["书的数量", "书的颜色", "书的价格"], 0, "4 个圆对应 4 本书。"),
        q("judge", "数量最多的那一类，画出的图形通常最多。", ["正确", "错误"], 0, "图形数量对应数据多少。"),
        q("transfer", "小猫 6 只，小狗 4 只，小兔 2 只，最多的是哪一类？", ["小猫", "小狗", "小兔"], 0, "6 最大，所以小猫最多。", 2),
      ],
    },
    {
      name: "生活问题岛",
      theme: "用加减法解决问题",
      summary: "从生活情境中选择加法或减法并说明理由。",
      domain: "问题解决",
      mastery: ["能找出一共或剩下", "能选择合适运算", "能口头检验答案"],
      chapters: [
        { title: "一共是多少", summary: "把几部分合起来用加法。" },
        { title: "还剩多少", summary: "从总数中去掉一部分用减法。" },
        { title: "两步小问题", summary: "先求中间量，再解决最终问题。" },
      ],
      questions: [
        q("apply", "车上有 9 人，到站下去 3 人，还剩多少人？", ["6 人", "12 人", "3 人"], 0, "9-3=6。"),
        q("apply", "小明有 5 支笔，小红有 4 支笔，一共多少支？", ["9 支", "1 支", "8 支"], 0, "5+4=9。"),
        q("judge", "求“一共”通常把几部分合起来。", ["正确", "错误"], 0, "合起来用加法。"),
        q("transfer", "卷笔刀 4 元，橡皮 2 元，买两样付 10 元，应找回多少元？", ["4 元", "6 元", "2 元"], 0, "先算 4+2=6，再算 10-6=4。", 2),
      ],
    },
  ],
};

const gradeTwo: GradeBlueprint = {
  id: "math.g2",
  grade: 2,
  name: "二年级 · 运算森林",
  milestones: [
    {
      name: "百以内加减",
      theme: "两位数加减法",
      summary: "理解数位对齐，掌握百以内加减法。",
      domain: "数与运算",
      mastery: ["能计算两位数加减法", "能处理进位和退位", "能用估算检查结果"],
      chapters: [
        { title: "数位要对齐", summary: "把个位和个位、十位和十位对齐。" },
        { title: "满十要进位", summary: "个位相加满十，向十位进一。" },
        { title: "不够减就退位", summary: "个位不够减时，从十位退一当十。" },
      ],
      questions: [
        q("apply", "34+25 等于多少？", ["59", "49", "69"], 0, "34+20=54，54+5=59。"),
        q("apply", "63-28 等于多少？", ["35", "45", "31"], 0, "63-20=43，43-8=35。"),
        q("judge", "计算 47+35 时，个位 7+5=12，要向十位进 1。", ["正确", "错误"], 0, "个位满十需要进位。"),
        q("transfer", "书架上有 56 本书，借出 19 本，还剩多少本？", ["37 本", "75 本", "27 本"], 0, "56-19=37。", 2),
      ],
    },
    {
      name: "乘法初识",
      theme: "几个几相加",
      summary: "从相同加数出发理解乘法，并熟记乘法口诀。",
      domain: "数与运算",
      mastery: ["能把同数连加改写成乘法", "能读乘法算式", "能熟记 2 到 9 的乘法口诀"],
      chapters: [
        { title: "几个几", summary: "相同加数相加可以写成乘法。" },
        { title: "口诀二到五", summary: "借助点子图熟记二到五的乘法口诀。" },
        { title: "口诀六到九", summary: "用规律和交换律记住六到九的口诀。" },
      ],
      questions: [
        q("identify", "3+3+3+3 可以写成哪个乘法算式？", ["3×4", "4×4", "3+4"], 0, "4 个 3 相加写成 3×4。"),
        q("apply", "6×7 等于多少？", ["42", "36", "48"], 0, "六七四十二。"),
        q("judge", "4×5 和 5×4 的结果相同。", ["正确", "错误"], 0, "乘法交换后结果不变。"),
        q("transfer", "每排 8 人，共 3 排，一共有多少人？", ["24 人", "11 人", "18 人"], 0, "8×3=24。", 2),
      ],
    },
    {
      name: "表内除法",
      theme: "平均分与除法",
      summary: "用平均分理解除法，并建立乘除互逆关系。",
      domain: "数与运算",
      mastery: ["能按份数平均分", "能按每份数平均分", "能用乘法检查除法"],
      chapters: [
        { title: "平均分成几份", summary: "把总数平均分成若干份，求每份多少。" },
        { title: "每份有几个", summary: "按每份数量分一分，求能分成几份。" },
        { title: "乘除互逆", summary: "用乘法口诀找到除法答案。" },
      ],
      questions: [
        q("apply", "12÷3 等于多少？", ["4", "3", "6"], 0, "三四十二，所以 12÷3=4。"),
        q("apply", "18÷6 等于多少？", ["3", "4", "2"], 0, "三六十八，所以 18÷6=3。"),
        q("judge", "可以用 5×7=35 检查 35÷5=7。", ["正确", "错误"], 0, "除法可以用乘法验算。"),
        q("transfer", "24 个桃子平均放进 4 个篮子，每篮几个？", ["6 个", "20 个", "8 个"], 0, "24÷4=6。", 2),
      ],
    },
    {
      name: "乘除混合",
      theme: "乘除关系和两步问题",
      summary: "用乘除法解决两步生活问题。",
      domain: "问题解决",
      mastery: ["能选择乘法或除法", "能解决两步问题", "能说明中间问题"],
      chapters: [
        { title: "先求一份", summary: "先求出每份数量，再解决最终问题。" },
        { title: "先求总数", summary: "先求总数，再平均分或比较。" },
        { title: "乘除小应用", summary: "在买东西和分组情境中使用乘除法。" },
      ],
      questions: [
        q("apply", "每盒有 6 支笔，4 盒一共多少支？", ["24 支", "10 支", "18 支"], 0, "6×4=24。"),
        q("apply", "36 本书平均分给 9 人，每人几本？", ["4 本", "6 本", "9 本"], 0, "36÷9=4。"),
        q("judge", "求几个相同加数的和，可以用乘法。", ["正确", "错误"], 0, "乘法表示相同加数求和。"),
        q("transfer", "3 盒糖每盒 8 颗，平均分给 6 人，每人几颗？", ["4 颗", "8 颗", "6 颗"], 0, "先算 3×8=24，再算 24÷6=4。", 2),
      ],
    },
    {
      name: "长度单位",
      theme: "厘米和米",
      summary: "认识厘米和米，能测量并估测常见物体长度。",
      domain: "量与测量",
      mastery: ["能认识厘米和米", "能进行简单单位换算", "能合理估测长度"],
      chapters: [
        { title: "认识厘米", summary: "用厘米尺测量较短物体。" },
        { title: "认识米", summary: "用米尺测量较长距离。" },
        { title: "选择合适的单位", summary: "根据物体长短选择厘米或米。" },
      ],
      questions: [
        q("apply", "1 米等于多少厘米？", ["100 厘米", "10 厘米", "1000 厘米"], 0, "1 米=100 厘米。"),
        q("identify", "教室门的高度更适合用什么单位？", ["米", "厘米", "千米"], 0, "教室门比课桌高很多，用米更合适。"),
        q("judge", "量铅笔长度通常用厘米作单位。", ["正确", "错误"], 0, "铅笔较短，适合用厘米。"),
        q("transfer", "一根绳子长 2 米，剪下 60 厘米，还剩多少厘米？", ["140 厘米", "40 厘米", "260 厘米"], 0, "2 米=200 厘米，200-60=140。", 2),
      ],
    },
    {
      name: "角的初步认识",
      theme: "角、直角、锐角和钝角",
      summary: "认识角的组成，并辨认直角、锐角和钝角。",
      domain: "图形与几何",
      mastery: ["能说出角的顶点和边", "能辨认直角", "能比较角的大小"],
      chapters: [
        { title: "角有一个顶点", summary: "角由一个顶点和两条边组成。" },
        { title: "找到直角", summary: "借助三角尺判断直角。" },
        { title: "锐角和钝角", summary: "比直角小是锐角，比直角大是钝角。" },
      ],
      questions: [
        q("identify", "角由什么组成？", ["一个顶点和两条边", "三个顶点", "四条边"], 0, "角有一个顶点和两条边。"),
        q("judge", "钝角比直角大。", ["正确", "错误"], 0, "钝角大于直角。"),
        q("apply", "用三角尺上的直角比一比，比直角小的角叫什么？", ["锐角", "钝角", "平角"], 0, "比直角小的角是锐角。"),
        q("transfer", "长方形有几个直角？", ["4 个", "2 个", "1 个"], 0, "长方形的四个角都是直角。", 2),
      ],
    },
    {
      name: "图形与拼组",
      theme: "认识平行四边形和拼组图形",
      summary: "认识平行四边形，能用常见图形拼出新图形。",
      domain: "图形与几何",
      mastery: ["能辨认平行四边形", "能描述图形拼组", "能按边和角分类"],
      chapters: [
        { title: "认识平行四边形", summary: "观察平行四边形的边和角。" },
        { title: "图形拼一拼", summary: "用三角形、正方形等拼出新图形。" },
        { title: "图形分类", summary: "按边数、角和是否直角分类。" },
      ],
      questions: [
        q("identify", "哪一组对边分别平行？", ["平行四边形", "圆", "三角形"], 0, "平行四边形有两组对边分别平行。"),
        q("judge", "两个完全一样的三角形可以拼成平行四边形。", ["正确", "错误"], 0, "沿对应边拼接可以拼成平行四边形。"),
        q("apply", "正方形有几条边？", ["4 条", "3 条", "5 条"], 0, "正方形有四条边。"),
        q("transfer", "长方体和正方体都是立体图形吗？", ["是", "不是", "只在纸上"], 0, "长方体和正方体都有长、宽、高，是立体图形。", 2),
      ],
    },
    {
      name: "数据整理",
      theme: "统计表和象形统计图",
      summary: "用画正字、统计表和象形图整理数据。",
      domain: "数据与概率",
      mastery: ["能读懂统计表", "能用图形表示数据", "能比较各类数据"],
      chapters: [
        { title: "用正字记录", summary: "用画正字的方法记录数量。" },
        { title: "看统计表", summary: "从统计表中读取每一类的数据。" },
        { title: "象形统计图", summary: "用相同图形表示相同数量。" },
      ],
      questions: [
        q("apply", "一个正字表示 5，两个正字表示多少？", ["10", "2", "7"], 0, "每个正字 5，两个就是 10。"),
        q("identify", "统计表中哪一列表示数量？", ["数字最多的一列", "标题", "颜色"], 0, "数量列用数字记录每类有多少。"),
        q("judge", "象形统计图中每个小图形表示的数量应统一。", ["正确", "错误"], 0, "统一标准才能正确比较。"),
        q("transfer", "苹果 12 个，梨 8 个，香蕉 5 个，最多的是哪一类？", ["苹果", "梨", "香蕉"], 0, "12 最大，所以苹果最多。", 2),
      ],
    },
    {
      name: "观察与推理",
      theme: "规律、分类与搭配",
      summary: "观察图形和数字的变化规律，解决简单搭配问题。",
      domain: "综合与实践",
      mastery: ["能发现简单规律", "能按多个标准分类", "能列举简单搭配"],
      chapters: [
        { title: "找规律", summary: "观察重复或递增的变化。" },
        { title: "分类再整理", summary: "按多个标准分类并记录结果。" },
        { title: "搭配有几种", summary: "用连线或列表不重不漏地找搭配。" },
      ],
      questions: [
        q("apply", "2、4、6、8、□，下一个是多少？", ["10", "9", "12"], 0, "每次增加 2，下一项是 10。"),
        q("judge", "分类时可以先按颜色，再按形状继续分。", ["正确", "错误"], 0, "分类可以包含多个标准。"),
        q("apply", "2 件上衣和 3 条裤子，一共有几种搭配？", ["6 种", "5 种", "3 种"], 0, "2×3=6。"),
        q("transfer", "△○△○△○，下一个图形是什么？", ["△", "○", "□"], 0, "△ 和 ○ 交替出现，下一个是 △。", 2),
      ],
    },
    {
      name: "两步应用题",
      theme: "加减乘除混合应用",
      summary: "从情境中找数量关系，完成两步计算。",
      domain: "问题解决",
      mastery: ["能找中间问题", "能选择两步运算", "能检验答案"],
      chapters: [
        { title: "先求一共", summary: "先用加法或乘法求出一共。" },
        { title: "再求剩下", summary: "从总数里减去一部分求剩下。" },
        { title: "乘加和乘减", summary: "先算乘法，再算加减法。" },
      ],
      questions: [
        q("apply", "每袋 5 个苹果，买了 3 袋，吃了 4 个，还剩几个？", ["11 个", "15 个", "9 个"], 0, "5×3=15，15-4=11。"),
        q("apply", "小明有 20 元，买书用 12 元，又买笔用 5 元，还剩多少元？", ["3 元", "7 元", "13 元"], 0, "20-12-5=3。"),
        q("judge", "两步问题可以先找中间问题。", ["正确", "错误"], 0, "先求中间量有助于列式。"),
        q("transfer", "4 排座位，每排 6 个，坐满 18 人后还剩几个空位？", ["6 个", "12 个", "4 个"], 0, "4×6=24，24-18=6。", 2),
      ],
    },
  ],
};

const gradeThree: GradeBlueprint = {
  id: "math.g3",
  grade: 3,
  name: "三年级 · 算术高原",
  milestones: [
    {
      name: "万以内数的认识",
      theme: "数位与近似数",
      summary: "理解千位和万位，正确读写、比较并估算万以内的数。",
      domain: "数与运算",
      mastery: ["能读写万以内的数", "能比较数的大小", "能用近似数估算"],
      chapters: [
        { title: "数位与组成", summary: "分辨千位、百位、十位和个位。" },
        { title: "读写与比较", summary: "按数位顺序读写和比较大小。" },
        { title: "近似数估算", summary: "把数看作接近的整百或整千数。" },
      ],
      questions: [
        q("identify", "4308 中数字 3 在什么数位上？", ["百位", "十位", "千位"], 0, "从右往左依次是个位、十位、百位、千位，3 在百位。"),
        q("apply", "由 5 个千、2 个百和 6 个一组成的数是多少？", ["5206", "5260", "5026"], 0, "千位 5、百位 2、十位 0、个位 6，合起来是 5206。"),
        q("judge", "比较 3980 和 4010 时，4010 更大。", ["正确", "错误"], 0, "千位 4 大于 3，因此 4010 更大。"),
        q("transfer", "一台电视 2998 元，最接近的整千元是多少？", ["3000 元", "2000 元", "2900 元"], 0, "2998 离 3000 最近。", 2),
      ],
    },
    {
      name: "多位数加减",
      theme: "万以内加减法",
      summary: "掌握多位数加减法的数位对齐、进位退位和验算。",
      domain: "数与运算",
      mastery: ["能完成多位数加减", "能处理连续进位退位", "能选择合适的方法验算"],
      chapters: [
        { title: "对齐数位再相加", summary: "相同数位相加，满十向前一位进一。" },
        { title: "连续退位减法", summary: "不够减时逐位退一，保持数位关系。" },
        { title: "验算与估算", summary: "用逆运算或估算判断结果是否合理。" },
      ],
      questions: [
        q("apply", "1568+2745 等于多少？", ["4313", "4213", "4323"], 0, "1568+2745=4313。"),
        q("apply", "5002-1876 等于多少？", ["3126", "3226", "3136"], 0, "5002-1876=3126。"),
        q("judge", "计算 786+235 时，个位 6+5 满十，要向十位进一。", ["正确", "错误"], 0, "个位相加满十必须进位。"),
        q("transfer", "学校有 1200 本故事书和 850 本科普书，两种书一共多少本？", ["2050 本", "1950 本", "2150 本"], 0, "1200+850=2050。", 2),
      ],
    },
    {
      name: "乘除法进阶",
      theme: "多位数乘一位数与有余数除法",
      summary: "会用竖式计算多位数乘一位数和有余数的除法。",
      domain: "数与运算",
      mastery: ["能计算多位数乘一位数", "能理解余数小于除数", "能解决有余数的实际问题"],
      chapters: [
        { title: "多位数乘一位数", summary: "从个位起依次相乘，并处理进位。" },
        { title: "有余数的除法", summary: "试商、相乘、相减，余数要比除数小。" },
        { title: "乘除综合应用", summary: "根据已知条件选择乘法或除法。" },
      ],
      questions: [
        q("apply", "236×4 等于多少？", ["944", "844", "934"], 0, "236×4=944。"),
        q("apply", "47÷5 的商和余数分别是多少？", ["商 9 余 2", "商 8 余 7", "商 9 余 5"], 0, "5×9=45，47-45=2。"),
        q("judge", "有余数的除法中，余数可以等于除数。", ["错误", "正确"], 0, "余数必须小于除数。"),
        q("transfer", "每盒装 6 个鸡蛋，38 个鸡蛋能装满几盒，还剩几个？", ["6 盒余 2 个", "7 盒余 2 个", "6 盒余 6 个"], 0, "38÷6=6 余 2。", 2),
      ],
    },
    {
      name: "时间与日期",
      theme: "时分秒和年月日",
      summary: "换算时间单位，计算经过时间并了解年月日。",
      domain: "量与计量",
      mastery: ["能换算时分秒", "能计算经过时间", "能判断平年闰年"],
      chapters: [
        { title: "时分秒换算", summary: "掌握 1 时=60 分，1 分=60 秒。" },
        { title: "经过时间", summary: "用结束时刻减开始时刻求经过时间。" },
        { title: "年月日", summary: "认识月份天数和平年、闰年。" },
      ],
      questions: [
        q("apply", "2 时 15 分等于多少分？", ["135 分", "215 分", "125 分"], 0, "2 时=120 分，再加 15 分是 135 分。"),
        q("apply", "从 8:40 到 9:25 经过了多长时间？", ["45 分", "35 分", "55 分"], 0, "9:25-8:40=45 分。"),
        q("judge", "平年的二月有 28 天。", ["正确", "错误"], 0, "平年二月 28 天，闰年二月 29 天。"),
        q("transfer", "一部电影 19:30 开始，21:05 结束，共放映多长时间？", ["1 时 35 分", "1 时 25 分", "2 时 35 分"], 0, "21:05-19:30=1 时 35 分。", 2),
      ],
    },
    {
      name: "测量与单位",
      theme: "长度、质量和容量单位",
      summary: "根据物体特点选择合适单位，并进行常见单位换算。",
      domain: "量与计量",
      mastery: ["能辨认常见测量单位", "能完成单位换算", "能选择合理单位描述物体"],
      chapters: [
        { title: "长度单位", summary: "认识毫米、分米、千米及其关系。" },
        { title: "质量单位", summary: "认识克、千克、吨并合理选择。" },
        { title: "容量与换算", summary: "认识升和毫升，完成简单换算。" },
      ],
      questions: [
        q("identify", "测量一枚硬币的厚度，用哪个单位更合适？", ["毫米", "米", "千米"], 0, "硬币很薄，用毫米更合适。"),
        q("apply", "3 千米 500 米等于多少米？", ["3500 米", "3050 米", "350 米"], 0, "3 千米=3000 米，再加 500 米是 3500 米。"),
        q("judge", "1 吨等于 1000 千克。", ["正确", "错误"], 0, "吨和千克的进率是 1000。"),
        q("transfer", "一瓶饮料有 500 毫升，4 瓶一共有多少升？", ["2 升", "4 升", "2000 升"], 0, "500×4=2000 毫升，也就是 2 升。", 2),
      ],
    },
    {
      name: "长方形与正方形周长",
      theme: "图形的周长",
      summary: "理解周长含义，能计算长方形和正方形的周长。",
      domain: "图形与几何",
      mastery: ["能理解周长含义", "能计算长方形周长", "能计算正方形周长"],
      chapters: [
        { title: "周长的意义", summary: "封闭图形一周的长度就是周长。" },
        { title: "长方形周长", summary: "长方形周长=（长+宽）×2。" },
        { title: "正方形周长", summary: "正方形周长=边长×4。" },
      ],
      questions: [
        q("identify", "围成图形一周的长度叫什么？", ["周长", "面积", "体积"], 0, "图形一周的长度叫周长。"),
        q("apply", "长 8 厘米、宽 5 厘米的长方形周长是多少？", ["26 厘米", "13 厘米", "40 厘米"], 0, "(8+5)×2=26 厘米。"),
        q("judge", "正方形边长为 6 米，周长是 24 米。", ["正确", "错误"], 0, "6×4=24 米。"),
        q("transfer", "一根 36 厘米长的铁丝正好围成一个正方形，边长是多少？", ["9 厘米", "6 厘米", "12 厘米"], 0, "36÷4=9 厘米。", 2),
      ],
    },
    {
      name: "面积初步",
      theme: "面积与面积单位",
      summary: "认识面积，理解平方厘米等单位并计算长方形面积。",
      domain: "图形与几何",
      mastery: ["能区分周长和面积", "能估计图形面积", "能计算长方形和正方形面积"],
      chapters: [
        { title: "认识面积", summary: "物体表面或封闭图形的大小叫面积。" },
        { title: "面积单位", summary: "认识平方厘米、平方分米和平方米。" },
        { title: "长方形面积", summary: "用长乘宽计算长方形的面积。" },
      ],
      questions: [
        q("identify", "计算教室地面的大小，应该求什么？", ["面积", "周长", "时间"], 0, "地面的大小是面积。"),
        q("apply", "长 7 厘米、宽 4 厘米的长方形面积是多少？", ["28 平方厘米", "22 厘米", "11 平方厘米"], 0, "7×4=28 平方厘米。"),
        q("judge", "面积单位和长度单位可以随意互换使用。", ["错误", "正确"], 0, "面积表示面的大小，长度表示线段长短。"),
        q("transfer", "正方形桌面边长 9 分米，面积是多少？", ["81 平方分米", "36 分米", "18 平方分米"], 0, "9×9=81 平方分米。", 2),
      ],
    },
    {
      name: "分数初步",
      theme: "认识分数与同分母比较",
      summary: "理解几分之一和几分之几，比较同分母分数。",
      domain: "分数、小数与比例",
      mastery: ["能理解分数含义", "能比较同分母分数", "能解决简单分数问题"],
      chapters: [
        { title: "几分之一", summary: "把一个整体平均分成若干份，取其中一份。" },
        { title: "几分之几", summary: "数出平均分后的若干份。" },
        { title: "同分母比较", summary: "分母相同时，分子大的分数大。" },
      ],
      questions: [
        q("identify", "把一个蛋糕平均分成 8 份，其中 3 份用哪个分数表示？", ["3/8", "8/3", "1/8"], 0, "取 8 份中的 3 份，是 3/8。"),
        q("apply", "同分母分数 2/7 和 5/7，哪个更大？", ["5/7", "2/7", "一样大"], 0, "分母相同，分子 5 大于 2。"),
        q("judge", "1/4 表示把一个整体平均分成 4 份。", ["正确", "错误"], 0, "分母表示平均分成的份数。"),
        q("transfer", "一根绳子平均分成 6 段，用去 2 段，还剩几分之几？", ["4/6", "2/6", "6/4"], 0, "6 段中去掉 2 段，还剩 4 段，即 4/6。", 2),
      ],
    },
    {
      name: "小数初步",
      theme: "一位小数与元角分",
      summary: "结合元角分理解一位小数，会读、写和比较小数。",
      domain: "分数、小数与比例",
      mastery: ["能读写一位小数", "能联系元角分理解小数", "能比较一位小数"],
      chapters: [
        { title: "认识一位小数", summary: "十分之几可以写成一位小数。" },
        { title: "元角分中的小数", summary: "用元作单位表示几元几角。" },
        { title: "小数比较", summary: "先比较整数部分，再比较小数部分。" },
      ],
      questions: [
        q("identify", "十分之三写成小数是多少？", ["0.3", "3.0", "0.03"], 0, "十分之三写成 0.3。"),
        q("apply", "5 元 6 角写成用元作单位的小数是多少？", ["5.6 元", "56 元", "0.56 元"], 0, "6 角是 0.6 元，合起来是 5.6 元。"),
        q("judge", "0.8 比 0.5 大。", ["正确", "错误"], 0, "整数部分相同，十分位 8 大于 5。"),
        q("transfer", "一支笔 3.5 元，一块橡皮 2.8 元，一共多少元？", ["6.3 元", "5.3 元", "6.13 元"], 0, "3.5+2.8=6.3 元。", 2),
      ],
    },
    {
      name: "统计与搭配",
      theme: "条形统计图与简单排列组合",
      summary: "从统计图中读取信息，并有序列举简单搭配。",
      domain: "数据与概率",
      mastery: ["能读懂条形统计图", "能比较统计数据", "能有序列举搭配方案"],
      chapters: [
        { title: "看懂条形图", summary: "根据直条高低读取数量并比较。" },
        { title: "数据里的问题", summary: "用最多、最少和相差数回答统计问题。" },
        { title: "有序搭配", summary: "按固定顺序列举，做到不重不漏。" },
      ],
      questions: [
        q("identify", "条形统计图中直条越高，通常表示什么？", ["数量越多", "数量越少", "时间越长"], 0, "直条高度对应数量多少。"),
        q("apply", "统计图中周一借书 35 本，周二借书 28 本，相差多少本？", ["7 本", "63 本", "8 本"], 0, "35-28=7 本。"),
        q("judge", "列举搭配时按固定顺序可以避免重复和遗漏。", ["正确", "错误"], 0, "有序列举是常用的计数方法。"),
        q("transfer", "3 种主食和 2 种饮料各选一种，共有多少种搭配？", ["6 种", "5 种", "9 种"], 0, "3×2=6 种。", 2),
      ],
    },
  ],
};

const gradeFive: GradeBlueprint = {
  id: "math.g5",
  grade: 5,
  name: "五年级 · 比例峡谷",
  milestones: [
    {
      name: "小数乘除",
      theme: "小数乘法与除法",
      summary: "理解小数点移动规律，正确计算小数乘除并估算结果。",
      domain: "分数、小数与比例",
      mastery: ["能计算小数乘法", "能计算小数除法", "能用估算检查小数点位置"],
      chapters: [
        { title: "小数点移动", summary: "乘除 10、100、1000 时观察小数点移动。" },
        { title: "小数乘法", summary: "先按整数乘法计算，再确定小数点位置。" },
        { title: "小数除法", summary: "把除数转化为整数，再按小数除法计算。" },
      ],
      questions: [
        q("apply", "2.4×3 等于多少？", ["7.2", "0.72", "72"], 0, "2.4×3=7.2。"),
        q("apply", "4.8÷0.6 等于多少？", ["8", "0.8", "80"], 0, "4.8÷0.6=48÷6=8。"),
        q("judge", "一个数乘 0.5，积一定比原数小（原数大于 0）。", ["正确", "错误"], 0, "乘小于 1 的数，积会变小。"),
        q("transfer", "每千克苹果 6.5 元，买 2.4 千克需要多少元？", ["15.6 元", "13 元", "1.56 元"], 0, "6.5×2.4=15.6 元。", 2),
      ],
    },
    {
      name: "因数与倍数",
      theme: "数的整除特征",
      summary: "掌握因数、倍数、奇偶数、质数与合数的基本判断。",
      domain: "数与运算",
      mastery: ["能找因数和倍数", "能判断奇数和偶数", "能辨认质数和合数"],
      chapters: [
        { title: "因数与倍数", summary: "在整数乘法关系中理解因数和倍数。" },
        { title: "奇偶与整除", summary: "用整除特征判断 2、3、5 的倍数。" },
        { title: "质数与合数", summary: "按因数个数给大于 1 的自然数分类。" },
      ],
      questions: [
        q("identify", "18 的因数有几个？", ["6 个", "5 个", "8 个"], 0, "18 的因数是 1、2、3、6、9、18，共 6 个。"),
        q("apply", "下面哪个数既是 2 的倍数，又是 5 的倍数？", ["30", "25", "12"], 0, "末尾是 0 的数同时是 2 和 5 的倍数。"),
        q("judge", "1 是质数。", ["错误", "正确"], 0, "质数有且只有两个因数，1 只有一个因数。"),
        q("transfer", "把 24 个苹果平均分成若干组，每组 6 个，可以分成几组？", ["4 组", "6 组", "8 组"], 0, "24÷6=4 组。", 2),
      ],
    },
    {
      name: "分数意义与互化",
      theme: "真分数、假分数与带分数",
      summary: "理解分数意义，完成假分数、带分数和整数之间的互化。",
      domain: "分数、小数与比例",
      mastery: ["能区分真分数和假分数", "能互化假分数与带分数", "能判断等值分数"],
      chapters: [
        { title: "真分数与假分数", summary: "比较分子和分母的大小关系。" },
        { title: "假分数与带分数", summary: "用除法把假分数化成整数或带分数。" },
        { title: "分数与除法", summary: "理解分数与除法之间的联系。" },
      ],
      questions: [
        q("identify", "7/5 是什么分数？", ["假分数", "真分数", "带分数"], 0, "分子大于分母，是假分数。"),
        q("apply", "9/4 化成带分数是多少？", ["2 1/4", "1 4/9", "2 4/1"], 0, "9÷4=2 余 1，所以是 2 1/4。"),
        q("judge", "3÷7 的商用分数表示是 3/7。", ["正确", "错误"], 0, "被除数作分子，除数作分母。"),
        q("transfer", "5 个 1/6 合起来是多少？", ["5/6", "6/5", "1/30"], 0, "5 个 1/6 是 5/6。", 2),
      ],
    },
    {
      name: "分数加减",
      theme: "异分母分数加减法",
      summary: "先通分再计算异分母分数加减，并化成最简结果。",
      domain: "分数、小数与比例",
      mastery: ["能通分", "能计算异分母分数加减", "能把结果化成最简分数"],
      chapters: [
        { title: "通分再相加", summary: "找到公分母后保持分数大小不变。" },
        { title: "通分再相减", summary: "统一分数单位后再计算差。" },
        { title: "结果化最简", summary: "分子分母同时除以最大公因数。" },
      ],
      questions: [
        q("apply", "1/2+1/3 等于多少？", ["5/6", "2/5", "1/6"], 0, "通分得 3/6+2/6=5/6。"),
        q("apply", "3/4-1/2 等于多少？", ["1/4", "2/2", "1/2"], 0, "3/4-2/4=1/4。"),
        q("judge", "异分母分数相加减，要先通分。", ["正确", "错误"], 0, "分母不同，分数单位不同，需要先统一。"),
        q("transfer", "一块布用去 2/5，又用去 1/5，一共用去几分之几？", ["3/5", "1/5", "3/25"], 0, "2/5+1/5=3/5。", 2),
      ],
    },
    {
      name: "长方体与正方体",
      theme: "表面积与应用",
      summary: "认识长、宽、高，计算长方体和正方体表面积。",
      domain: "图形与几何",
      mastery: ["能识别长宽高", "能认识面的特征", "能计算表面积"],
      chapters: [
        { title: "认识立体图形", summary: "观察顶点、棱和面的数量。" },
        { title: "展开图", summary: "把立体图形的表面展开成平面图形。" },
        { title: "表面积计算", summary: "求所有面的面积总和。" },
      ],
      questions: [
        q("identify", "长方体有几个面？", ["6 个", "8 个", "12 个"], 0, "长方体有 6 个面。"),
        q("apply", "棱长 3 厘米的正方体表面积是多少？", ["54 平方厘米", "27 平方厘米", "36 平方厘米"], 0, "每个面 9 平方厘米，共 6 个面，9×6=54。"),
        q("judge", "长方体中相对的面完全相同。", ["正确", "错误"], 0, "长方体相对的两个面大小和形状相同。"),
        q("transfer", "一个长方体长 5 厘米、宽 4 厘米、高 3 厘米，表面积是多少？", ["94 平方厘米", "60 平方厘米", "47 平方厘米"], 0, "2×(5×4+5×3+4×3)=94 平方厘米。", 2),
      ],
    },
    {
      name: "体积与容积",
      theme: "体积单位和计算",
      summary: "认识体积与容积，计算长方体和正方体体积。",
      domain: "图形与几何",
      mastery: ["能理解体积含义", "能换算体积单位", "能计算长方体体积"],
      chapters: [
        { title: "体积的意义", summary: "物体所占空间的大小叫体积。" },
        { title: "体积单位", summary: "认识立方厘米、立方分米和立方米。" },
        { title: "长方体体积", summary: "长方体体积=长×宽×高。" },
      ],
      questions: [
        q("identify", "物体所占空间的大小叫什么？", ["体积", "周长", "面积"], 0, "物体所占空间的大小叫体积。"),
        q("apply", "1 立方分米等于多少立方厘米？", ["1000 立方厘米", "100 立方厘米", "10 立方厘米"], 0, "棱长 1 分米的正方体体积是 1000 立方厘米。"),
        q("judge", "底面积相同的长方体，高越大体积越大。", ["正确", "错误"], 0, "体积=底面积×高。"),
        q("transfer", "长 8 米、宽 2 米、高 3 米的水池能装多少立方米水？", ["48 立方米", "26 立方米", "13 立方米"], 0, "8×2×3=48 立方米。", 2),
      ],
    },
    {
      name: "方程与字母表示",
      theme: "简易方程",
      summary: "用字母表示数，理解等式性质并解简易方程。",
      domain: "数与代数",
      mastery: ["能用字母表示数量", "能理解等式性质", "能解一步方程"],
      chapters: [
        { title: "字母表示数", summary: "用字母概括数量关系和运算规律。" },
        { title: "认识方程", summary: "含有未知数的等式叫方程。" },
        { title: "解简易方程", summary: "利用等式性质求未知数的值。" },
      ],
      questions: [
        q("identify", "下面哪个式子是方程？", ["x+3=8", "x+3", "5>2"], 0, "方程必须含有未知数并且是等式。"),
        q("apply", "解方程 x+7=15，x 等于多少？", ["8", "22", "7"], 0, "15-7=8。"),
        q("judge", "等式两边同时加同一个数，等式仍成立。", ["正确", "错误"], 0, "这是等式的基本性质。"),
        q("transfer", "每盒铅笔有 x 支，4 盒共有 48 支，x 是多少？", ["12", "44", "52"], 0, "4x=48，所以 x=12。", 2),
      ],
    },
    {
      name: "多边形面积",
      theme: "平行四边形、三角形和梯形",
      summary: "利用转化思想推导并计算常见多边形面积。",
      domain: "图形与几何",
      mastery: ["能计算平行四边形面积", "能计算三角形面积", "能计算梯形面积"],
      chapters: [
        { title: "平行四边形面积", summary: "沿高剪拼成长方形，面积=底×高。" },
        { title: "三角形面积", summary: "两个完全一样的三角形可拼成平行四边形。" },
        { title: "梯形面积", summary: "梯形面积=（上底+下底）×高÷2。" },
      ],
      questions: [
        q("apply", "底 8 厘米、高 5 厘米的平行四边形面积是多少？", ["40 平方厘米", "26 平方厘米", "20 平方厘米"], 0, "8×5=40 平方厘米。"),
        q("apply", "底 6 米、高 4 米的三角形面积是多少？", ["12 平方米", "24 平方米", "10 平方米"], 0, "6×4÷2=12 平方米。"),
        q("judge", "三角形面积公式中要除以 2。", ["正确", "错误"], 0, "两个一样的三角形拼成平行四边形，所以三角形面积要除以 2。"),
        q("transfer", "上底 4 厘米、下底 6 厘米、高 5 厘米的梯形面积是多少？", ["25 平方厘米", "50 平方厘米", "15 平方厘米"], 0, "(4+6)×5÷2=25 平方厘米。", 2),
      ],
    },
    {
      name: "统计与平均数",
      theme: "平均数与数据比较",
      summary: "理解平均数代表整体水平，能读取复式统计图。",
      domain: "数据与概率",
      mastery: ["能求一组数据的平均数", "能比较不同数据组", "能读懂复式统计图"],
      chapters: [
        { title: "认识平均数", summary: "平均数=总数÷份数。" },
        { title: "用平均数比较", summary: "在总量和份数不同时比较整体水平。" },
        { title: "复式统计图", summary: "同时比较两组数据的变化。" },
      ],
      questions: [
        q("apply", "4 次测验成绩分别是 80、90、85、85，平均分是多少？", ["85", "84", "86"], 0, "(80+90+85+85)÷4=85。"),
        q("identify", "平均数反映一组数据的什么特征？", ["整体水平", "最大值", "最小值"], 0, "平均数表示一组数据的整体水平。"),
        q("judge", "一组数据的平均数一定等于其中的某个数据。", ["错误", "正确"], 0, "平均数可能不在原始数据中。"),
        q("transfer", "小明三天共读书 120 页，平均每天读多少页？", ["40 页", "30 页", "60 页"], 0, "120÷3=40 页。", 2),
      ],
    },
    {
      name: "可能性与解决问题",
      theme: "事件发生的可能性",
      summary: "判断事件发生的可能性大小，并解决多步实际问题。",
      domain: "数据与概率",
      mastery: ["能判断确定和不确定事件", "能比较可能性大小", "能解决多步实际问题"],
      chapters: [
        { title: "一定、可能、不可能", summary: "用生活经验判断事件发生情况。" },
        { title: "可能性大小", summary: "数量多的结果通常更容易出现。" },
        { title: "综合问题", summary: "分析条件，分步解决实际问题。" },
      ],
      questions: [
        q("identify", "太阳从东方升起属于哪种事件？", ["一定发生", "可能发生", "不可能发生"], 0, "这是确定会发生的自然现象。"),
        q("apply", "盒中 5 个红球、1 个蓝球，摸出一个球，哪种颜色更可能？", ["红球", "蓝球", "一样可能"], 0, "红球数量更多，摸到红球的可能性更大。"),
        q("judge", "袋子里全是白球，摸出黑球是不可能事件。", ["正确", "错误"], 0, "没有黑球，不可能摸到黑球。"),
        q("transfer", "3 支队伍每队 12 人，平均分成 4 组，每组多少人？", ["9 人", "12 人", "6 人"], 0, "总人数 3×12=36，36÷4=9 人。", 2),
      ],
    },
  ],
};

const gradeSix: GradeBlueprint = {
  id: "math.g6",
  grade: 6,
  name: "六年级 · 比例星环",
  milestones: [
    {
      name: "分数乘除",
      theme: "分数乘法与除法",
      summary: "理解分数乘除的意义，熟练计算并解决实际问题。",
      domain: "分数、小数与比例",
      mastery: ["能计算分数乘法", "能计算分数除法", "能用分数乘除解决问题"],
      chapters: [
        { title: "分数乘法", summary: "分子相乘、分母相乘，能约分先约分。" },
        { title: "倒数与分数除法", summary: "除以一个不为 0 的数等于乘它的倒数。" },
        { title: "分数乘除应用", summary: "根据单位“1”和分率选择乘除。" },
      ],
      questions: [
        q("apply", "2/3×3/4 等于多少？", ["1/2", "5/7", "6/7"], 0, "约分后 2/3×3/4=1/2。"),
        q("apply", "3/4÷1/2 等于多少？", ["3/2", "3/8", "2/3"], 0, "3/4÷1/2=3/4×2=3/2。"),
        q("judge", "0 没有倒数。", ["正确", "错误"], 0, "0 与任何数相乘都不等于 1，所以 0 没有倒数。"),
        q("transfer", "一本书 180 页，已经读了 2/5，读了多少页？", ["72 页", "90 页", "45 页"], 0, "180×2/5=72 页。", 2),
      ],
    },
    {
      name: "比和比例",
      theme: "比的意义与化简",
      summary: "理解比、比值和比例，会化简比并解决按比分配问题。",
      domain: "分数、小数与比例",
      mastery: ["能求比值和化简比", "能判断比例", "能按比分配"],
      chapters: [
        { title: "认识比", summary: "两个数相除又叫两个数的比。" },
        { title: "化简比与求比值", summary: "利用比的基本性质化简，比值是一个数。" },
        { title: "按比分配", summary: "把总量按给定份数分配。" },
      ],
      questions: [
        q("apply", "12:18 化成最简整数比是多少？", ["2:3", "3:2", "6:9"], 0, "前项和后项同时除以 6，得到 2:3。"),
        q("identify", "3:4 的比值是多少？", ["3/4", "4/3", "7"], 0, "比值等于前项除以后项，即 3/4。"),
        q("judge", "比的前项和后项同时乘一个不为 0 的数，比值不变。", ["正确", "错误"], 0, "这是比的基本性质。"),
        q("transfer", "600 元按 2:3 分给两人，较多的一份是多少元？", ["360 元", "240 元", "300 元"], 0, "总份数 5，一份 120 元，3 份是 360 元。", 2),
      ],
    },
    {
      name: "百分数",
      theme: "百分数与生活应用",
      summary: "理解百分数意义，完成分数、小数和百分数互化并解决实际问题。",
      domain: "分数、小数与比例",
      mastery: ["能互化百分数", "能求一个数的百分之几", "能解决折扣和增减问题"],
      chapters: [
        { title: "百分数的意义", summary: "表示一个数是另一个数的百分之几。" },
        { title: "百分数与分数小数", summary: "在三种表示之间正确互化。" },
        { title: "折扣与增减", summary: "用百分数解决折扣、涨价和降价问题。" },
      ],
      questions: [
        q("identify", "25% 化成最简分数是多少？", ["1/4", "1/5", "4/1"], 0, "25%=25/100=1/4。"),
        q("apply", "80 的 25% 是多少？", ["20", "25", "40"], 0, "80×25%=20。"),
        q("judge", "一件商品打八折，就是按原价的 80% 出售。", ["正确", "错误"], 0, "八折表示原价的 80%。"),
        q("transfer", "原价 200 元的衣服打七折，现价是多少元？", ["140 元", "170 元", "130 元"], 0, "200×70%=140 元。", 2),
      ],
    },
    {
      name: "圆",
      theme: "圆的周长与面积",
      summary: "认识半径、直径和圆周率，会计算圆的周长与面积。",
      domain: "图形与几何",
      mastery: ["能理解半径直径关系", "能计算圆的周长", "能计算圆的面积"],
      chapters: [
        { title: "圆的基本特征", summary: "同圆中直径是半径的 2 倍。" },
        { title: "圆的周长", summary: "圆的周长=圆周率×直径。" },
        { title: "圆的面积", summary: "圆的面积=圆周率×半径的平方。" },
      ],
      questions: [
        q("identify", "在同一个圆中，直径与半径的关系是什么？", ["直径是半径的 2 倍", "半径是直径的 2 倍", "二者相等"], 0, "同圆中直径等于半径的 2 倍。"),
        q("apply", "半径 3 厘米的圆，周长是多少？取 π=3.14。", ["18.84 厘米", "9.42 厘米", "28.26 厘米"], 0, "C=2×3.14×3=18.84 厘米。"),
        q("judge", "圆的面积公式是 πr²。", ["正确", "错误"], 0, "圆的面积等于圆周率乘半径的平方。"),
        q("transfer", "半径 2 米的圆形花坛面积是多少？取 π=3.14。", ["12.56 平方米", "6.28 平方米", "25.12 平方米"], 0, "3.14×2×2=12.56 平方米。", 2),
      ],
    },
    {
      name: "圆柱与圆锥",
      theme: "立体图形的体积",
      summary: "计算圆柱表面积、圆柱体积，并理解圆锥体积关系。",
      domain: "图形与几何",
      mastery: ["能认识圆柱和圆锥", "能计算圆柱体积", "能计算圆锥体积"],
      chapters: [
        { title: "圆柱的特征", summary: "认识底面、侧面和高。" },
        { title: "圆柱的体积", summary: "圆柱体积=底面积×高。" },
        { title: "圆锥的体积", summary: "等底等高时，圆锥体积是圆柱体积的 1/3。" },
      ],
      questions: [
        q("identify", "等底等高时，圆锥体积是圆柱体积的几分之几？", ["1/3", "1/2", "3 倍"], 0, "等底等高时，圆锥体积是圆柱体积的 1/3。"),
        q("apply", "底面积 10 平方厘米、高 6 厘米的圆柱体积是多少？", ["60 立方厘米", "30 立方厘米", "16 立方厘米"], 0, "10×6=60 立方厘米。"),
        q("judge", "圆柱侧面展开后可能是长方形。", ["正确", "错误"], 0, "沿高剪开圆柱侧面，通常展开成长方形。"),
        q("transfer", "底面积 9 平方厘米、高 4 厘米的圆锥体积是多少？", ["12 立方厘米", "36 立方厘米", "18 立方厘米"], 0, "9×4÷3=12 立方厘米。", 2),
      ],
    },
    {
      name: "正比例与反比例",
      theme: "变化的量",
      summary: "判断两种相关联的量成正比例还是反比例。",
      domain: "数与代数",
      mastery: ["能识别相关联的量", "能判断正比例关系", "能判断反比例关系"],
      chapters: [
        { title: "变化的量", summary: "观察一个量变化时另一个量如何变化。" },
        { title: "正比例", summary: "比值一定时，两种量成正比例。" },
        { title: "反比例", summary: "乘积一定时，两种量成反比例。" },
      ],
      questions: [
        q("identify", "单价一定时，总价和数量成什么比例？", ["正比例", "反比例", "不成比例"], 0, "总价÷数量=单价，比值一定，成正比例。"),
        q("apply", "路程一定时，速度和时间成什么比例？", ["反比例", "正比例", "无关系"], 0, "速度×时间=路程，乘积一定，成反比例。"),
        q("judge", "圆的周长和直径成正比例。", ["正确", "错误"], 0, "周长÷直径=π，比值一定。"),
        q("transfer", "若 y=3x，x 和 y 成什么比例？", ["正比例", "反比例", "不确定"], 0, "y 与 x 的比值恒为 3。", 2),
      ],
    },
    {
      name: "负数",
      theme: "负数的意义与大小",
      summary: "结合温度、收支等情境理解负数，比较正负数大小。",
      domain: "数与代数",
      mastery: ["能读写正负数", "能在数轴上表示数", "能比较正负数大小"],
      chapters: [
        { title: "认识负数", summary: "用负数表示相反意义的量。" },
        { title: "数轴上的数", summary: "0 左边是负数，右边是正数。" },
        { title: "比较大小", summary: "数轴上右边的数总比左边的数大。" },
      ],
      questions: [
        q("identify", "零下 5 摄氏度记作多少？", ["-5℃", "5℃", "0℃"], 0, "低于 0℃ 的温度用负数表示。"),
        q("apply", "-3 和 -7 相比，哪个数更大？", ["-3", "-7", "一样大"], 0, "数轴上 -3 在 -7 右边。"),
        q("judge", "0 既不是正数，也不是负数。", ["正确", "错误"], 0, "0 是正负数的分界，不是正数也不是负数。"),
        q("transfer", "存入 200 元记作 +200 元，取出 150 元应记作多少？", ["-150 元", "+150 元", "50 元"], 0, "取出与存入意义相反，记作 -150 元。", 2),
      ],
    },
    {
      name: "统计与概率",
      theme: "统计图和可能性",
      summary: "分析扇形统计图，计算简单事件发生的可能性。",
      domain: "数据与概率",
      mastery: ["能读懂扇形统计图", "能计算百分比", "能比较事件可能性"],
      chapters: [
        { title: "扇形统计图", summary: "扇形大小表示各部分占总量的百分比。" },
        { title: "数据分析", summary: "结合总量计算某一部分的具体数量。" },
        { title: "可能性", summary: "用分数表示简单事件发生的可能性。" },
      ],
      questions: [
        q("identify", "扇形统计图中各部分百分比之和应等于多少？", ["100%", "50%", "360%"], 0, "所有部分合起来是整体，即 100%。"),
        q("apply", "全班 40 人，喜欢篮球的占 25%，有多少人？", ["10 人", "8 人", "16 人"], 0, "40×25%=10 人。"),
        q("judge", "袋中有 1 红 3 蓝，随机摸一球，摸到红球的可能性是 1/4。", ["正确", "错误"], 0, "红球 1 个，总球数 4 个，可能性是 1/4。"),
        q("transfer", "转盘平均分成 6 份，其中 2 份中奖，中奖可能性是多少？", ["1/3", "1/6", "1/2"], 0, "2÷6=1/3。", 2),
      ],
    },
    {
      name: "比例尺与图形变换",
      theme: "比例尺和放大缩小",
      summary: "理解比例尺含义，能求图上距离或实际距离。",
      domain: "图形与几何",
      mastery: ["能读懂比例尺", "能求实际距离", "能按比例放大或缩小图形"],
      chapters: [
        { title: "认识比例尺", summary: "图上距离与实际距离的比叫比例尺。" },
        { title: "求实际距离", summary: "根据比例尺把图上距离转换成实际距离。" },
        { title: "放大与缩小", summary: "按相同比改变图形大小，形状不变。" },
      ],
      questions: [
        q("identify", "比例尺 1:100 表示图上 1 厘米相当于实际多少厘米？", ["100 厘米", "1 厘米", "10 厘米"], 0, "比例尺前项 1 对应后项 100。"),
        q("apply", "比例尺 1:2000，图上 3 厘米表示实际多少米？", ["60 米", "600 米", "6 米"], 0, "3×2000=6000 厘米=60 米。"),
        q("judge", "把图形按 2:1 放大后，形状保持不变。", ["正确", "错误"], 0, "按比例放大只改变大小，不改变形状。"),
        q("transfer", "实际距离 5 千米，比例尺 1:100000，图上距离是多少厘米？", ["5 厘米", "50 厘米", "0.5 厘米"], 0, "5 千米=500000 厘米，500000÷100000=5 厘米。", 2),
      ],
    },
    {
      name: "综合解决问题",
      theme: "多知识点综合应用",
      summary: "综合运用分数、百分数、比例和几何知识解决实际问题。",
      domain: "问题解决",
      mastery: ["能提取关键数量关系", "能选择合适模型", "能检验结果合理性"],
      chapters: [
        { title: "找单位“1”", summary: "从分率和百分数问题中确定比较标准。" },
        { title: "比例与分配", summary: "用比和比例解决总量分配问题。" },
        { title: "综合模型检验", summary: "分步列式并用估算或逆运算检查。" },
      ],
      questions: [
        q("apply", "一件商品先涨价 10%，再降价 10%，最后价格与原价相比如何？", ["比原价低", "与原价相同", "比原价高"], 0, "两次变化的单位“1”不同，最后价格是原价的 99%。"),
        q("apply", "甲、乙人数比是 3:2，总人数 50 人，甲有多少人？", ["30 人", "20 人", "25 人"], 0, "总份数 5，甲占 3 份，50÷5×3=30 人。"),
        q("judge", "解决百分数问题前，先确定单位“1”有助于选择运算。", ["正确", "错误"], 0, "单位“1”决定谁和谁比较。"),
        q("transfer", "一条路已修 60%，还剩 800 米，这条路全长多少米？", ["2000 米", "1333 米", "1600 米"], 0, "剩下 40% 对应 800 米，800÷40%=2000 米。", 2),
      ],
    },
  ],
};

function gradeFourContent(): MathGradeContent {
  return {
    gradeWorld: {
      ...grade4World,
      contentVersion: mathContentVersion,
      totalStages: grade4Milestones.length,
    },
    knowledgeNodes: grade4Nodes,
    chapters: grade4Chapters,
    milestones: grade4Milestones,
    bosses: grade4Bosses,
    bossQuestions: grade4BossQuestions,
  };
}

const generatedGradeContent = new Map<number, MathGradeContent>(
  [gradeOne, gradeTwo, gradeThree, gradeFive, gradeSix].map((blueprint) => [
    blueprint.grade,
    buildGradeContent(blueprint),
  ]),
);

export function getMathGradeContent(grade: number): MathGradeContent {
  if (grade === 4) return gradeFourContent();

  const content = generatedGradeContent.get(grade);
  if (!content) {
    throw new Error(`MATH_GRADE_NOT_FOUND:${grade}`);
  }
  return content;
}

export const mathGradeWorlds: MathGradeWorldSummary[] = [1, 2, 3, 4, 5, 6].map(
  (grade) => {
    const { gradeWorld } = getMathGradeContent(grade);
    return {
      id: gradeWorld.id,
      subjectId: gradeWorld.subjectId,
      grade: gradeWorld.grade,
      name: gradeWorld.name,
      contentVersion: gradeWorld.contentVersion,
      totalStages: gradeWorld.totalStages,
    };
  },
);

const gradeContents = mathGradeWorlds.map((world) =>
  getMathGradeContent(world.grade),
);

export const fullMathContentGraph = {
  contentVersion: mathContentVersion,
  nodes: gradeContents.flatMap((content) => content.knowledgeNodes),
  chapters: gradeContents.flatMap((content) => content.chapters),
  milestones: gradeContents.flatMap((content) => content.milestones),
  bosses: gradeContents.flatMap((content) => content.bosses),
  questions: gradeContents.flatMap((content) => content.bossQuestions),
};

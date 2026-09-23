import type {
  Boss,
  Chapter,
  ContentQuestion,
  KnowledgeNode,
  LessonStep,
  Milestone,
  QuestionKind,
} from "@knowgate/domain";
import { generateBossQuestionSet } from "@/lib/question-generator";

export const gradeWorld = {
  id: "math.g4",
  contentVersion: "2026.09.23.2",
  subjectId: "math",
  grade: 4,
  name: "四年级 · 分数群岛",
  totalStages: 10,
};

export const knowledgeNodes: KnowledgeNode[] = [
  {
    id: "math.arithmetic.multiplication_table",
    name: "乘法口诀与倍数关系",
    domain: "四则运算",
    stage: "g2-g3",
    prerequisites: [],
    mastery: ["能熟练运用乘法口诀", "能识别一个数的倍数"],
  },
  {
    id: "math.fractions_decimals.fraction_meaning",
    name: "分数意义与等值分数",
    domain: "分数、小数与比例",
    stage: "g3-g4",
    prerequisites: ["math.arithmetic.division_inverse"],
    mastery: [
      "能从整体和部分理解分数",
      "能识别分数单位",
      "能判断并找出等值分数",
    ],
  },
  {
    id: "math.arithmetic.division_inverse",
    name: "除法、余数与乘除互逆",
    domain: "四则运算",
    stage: "g3",
    prerequisites: ["math.arithmetic.multiplication_table"],
    mastery: ["能用乘法验算除法", "能理解余数意义"],
  },
  {
    id: "math.fractions_decimals.fraction_operations",
    name: "分数比较与四则运算",
    domain: "分数、小数与比例",
    stage: "g4-g5",
    prerequisites: ["math.fractions_decimals.fraction_meaning"],
    mastery: ["能比较分数大小", "能完成分数基本运算"],
  },
  {
    id: "math.fractions_decimals.fraction_equivalence",
    name: "等值分数与通分",
    domain: "分数、小数与比例",
    stage: "g4",
    prerequisites: ["math.fractions_decimals.fraction_meaning"],
    mastery: ["能通过乘除同一个数找到等值分数", "能为分母不同的分数通分"],
  },
  {
    id: "math.fractions_decimals.decimal_meaning",
    name: "小数位值与读写",
    domain: "分数、小数与比例",
    stage: "g4",
    prerequisites: ["math.fractions_decimals.fraction_equivalence"],
    mastery: ["能理解十分位和百分位", "能在分数、小数之间转换"],
  },
  {
    id: "math.fractions_decimals.decimal_operations",
    name: "小数加减与估算",
    domain: "分数、小数与比例",
    stage: "g4-g5",
    prerequisites: ["math.fractions_decimals.decimal_meaning"],
    mastery: ["能对齐小数点完成加减", "能用估算检查结果"],
  },
  {
    id: "math.geometry.shapes_relations",
    name: "图形的平行、垂直与分类",
    domain: "图形与几何",
    stage: "g4",
    prerequisites: ["math.arithmetic.multiplication_table"],
    mastery: ["能识别平行与垂直关系", "能按边和角分类常见图形"],
  },
  {
    id: "math.data_probability.charts",
    name: "统计表与条形统计图",
    domain: "数据与概率",
    stage: "g4",
    prerequisites: ["math.arithmetic.multiplication_table"],
    mastery: ["能读取统计表与条形统计图", "能根据数据回答比较问题"],
  },
  {
    id: "math.arithmetic.mixed_operations",
    name: "含括号的混合运算",
    domain: "四则运算",
    stage: "g4",
    prerequisites: ["math.arithmetic.division_inverse"],
    mastery: ["能确定运算顺序", "能正确使用括号改变计算顺序"],
  },
  {
    id: "math.modeling.word_problem_models",
    name: "数量关系与问题建模",
    domain: "问题解决",
    stage: "g4",
    prerequisites: [
      "math.arithmetic.mixed_operations",
      "math.fractions_decimals.decimal_operations",
    ],
    mastery: ["能从情境中提取数量关系", "能选择合适运算建立算式"],
  },
  {
    id: "math.modeling.multi_step_problems",
    name: "多步骤问题的计划与检验",
    domain: "问题解决",
    stage: "g4-g5",
    prerequisites: ["math.modeling.word_problem_models"],
    mastery: ["能拆分多步骤问题", "能用估算或逆运算检验答案"],
  },
];

const fractionBar = (
  total: number,
  active: number,
  compareTo?: number,
  compareTotal?: number,
  labels?: [string, string],
): ContentQuestion["visual"] => ({
  kind: "fraction-bar",
  total,
  active,
  compareTo,
  compareTotal,
  labels: labels ? [...labels] : undefined,
});

const foundationChapters: Chapter[] = [
  {
    id: "chapter.fraction.parts",
    milestoneId: "math.g4.milestone.01",
    stageNo: 1,
    title: "整体被分成几份",
    summary: "从公平分物出发，认识分母和分子表示什么。",
    estimatedMinutes: 5,
    nodeIds: ["math.fractions_decimals.fraction_meaning"],
    steps: [
      {
        id: "parts.hook",
        phase: "hook",
        title: "四块一样大的巧克力",
        body: "小满拿走其中一块。要准确说清她拿了多少，不能只说“一块”，还要说明全部被分成了几块。",
        visual: fractionBar(4, 1),
      },
      {
        id: "parts.concept",
        phase: "concept",
        title: "分母看总数，分子看取走数",
        body: "整体被平均分成 4 份，取走 1 份，就写作 1/4。分母 4 表示平均分成的份数，分子 1 表示取走的份数。",
        visual: fractionBar(4, 1),
      },
      {
        id: "parts.example",
        phase: "example",
        title: "先看整体，再数部分",
        body: "同一条长条平均分成 4 份，涂色 2 份就是 2/4。先确认“平均分成几份”，再数“涂了几份”。",
        visual: fractionBar(4, 2),
      },
      {
        id: "parts.guided",
        phase: "guided",
        title: "跟着数一数",
        body: "先看总共有几份，再看涂色有几份。",
        visual: fractionBar(6, 3),
        question: {
          id: "item.fraction.parts.guided",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "identify",
          prompt: "图中涂色部分表示哪个分数？",
          options: ["3/6", "6/3", "3/3"],
          answerIndex: 0,
          explanation: "整体平均分成 6 份，涂色 3 份，所以是 3/6。",
          timeLimitSec: 30,
          damage: 1,
          visual: fractionBar(6, 3),
        },
      },
      {
        id: "parts.practice",
        phase: "practice",
        title: "独立判断",
        body: "注意分母与分子的顺序。",
        visual: fractionBar(5, 2),
        question: {
          id: "item.fraction.parts.practice",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "judge",
          prompt: "一个整体平均分成 5 份，取走 2 份，可以写成 2/5。",
          options: ["正确", "错误"],
          answerIndex: 0,
          explanation: "分母表示平均分成 5 份，分子表示取走 2 份。",
          timeLimitSec: 30,
          damage: 1,
          visual: fractionBar(5, 2),
        },
      },
      {
        id: "parts.quiz",
        phase: "quiz",
        title: "章节短测",
        body: "答对这一题，本章的学习证据就记录完成。",
        visual: fractionBar(8, 5),
        question: {
          id: "item.fraction.parts.quiz",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "apply",
          prompt: "一条长条平均分成 8 份，涂色 5 份。涂色部分占整体的几分之几？",
          options: ["5/8", "8/5", "3/8"],
          answerIndex: 0,
          explanation: "总共有 8 份，涂色 5 份，因此是 5/8。",
          timeLimitSec: 45,
          damage: 2,
          visual: fractionBar(8, 5),
        },
      },
    ],
  },
  {
    id: "chapter.fraction.units",
    milestoneId: "math.g4.milestone.01",
    stageNo: 2,
    title: "分数单位与大小",
    summary: "理解同样大小的整体中，分母越大，每一份越小。",
    estimatedMinutes: 6,
    nodeIds: ["math.fractions_decimals.fraction_meaning"],
    steps: [
      {
        id: "units.hook",
        phase: "hook",
        title: "谁分到的更大",
        body: "两个同样大的披萨，一个平均切成 3 份，一个平均切成 6 份。都拿 1 份，哪一份更大？",
        visual: fractionBar(3, 1, 1, 6, ["1/3", "1/6"]),
      },
      {
        id: "units.concept",
        phase: "concept",
        title: "分母越大，每份越小",
        body: "1/3 表示从 3 份中拿 1 份，1/6 表示从 6 份中拿 1 份。整体相同且每份同样大时，1/3 大于 1/6。",
        visual: fractionBar(3, 1, 1, 6, ["1/3", "1/6"]),
      },
      {
        id: "units.example",
        phase: "example",
        title: "用同一条长条比较",
        body: "同一条长条分成 4 份时，每份较长；分成 8 份时，每份较短。所以分子都为 1 时，分母小的分数更大。",
        visual: fractionBar(4, 1, 1, 8, ["1/4", "1/8"]),
      },
      {
        id: "units.guided",
        phase: "guided",
        title: "选择更大的一份",
        body: "两个分数的整体大小相同。",
        visual: fractionBar(5, 1, 1, 8, ["1/5", "1/8"]),
        question: {
          id: "item.fraction.units.guided",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "judge",
          prompt: "在同样大的整体中，1/5 比 1/8 大。",
          options: ["正确", "错误"],
          answerIndex: 0,
          explanation: "平均分成 5 份时，每份比平均分成 8 份时更大。",
          timeLimitSec: 30,
          damage: 1,
        },
      },
      {
        id: "units.practice",
        phase: "practice",
        title: "独立比较",
        body: "先确认整体一样大，再比较每一份的大小。",
        visual: fractionBar(3, 1, 1, 10, ["1/3", "1/10"]),
        question: {
          id: "item.fraction.units.practice",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "apply",
          prompt: "分子都是 1 时，1/10、1/6、1/3 中哪个分数最大？",
          options: ["1/10", "1/6", "1/3"],
          answerIndex: 2,
          explanation: "分子都为 1 时，分母越小，分数越大。",
          timeLimitSec: 40,
          damage: 2,
        },
      },
      {
        id: "units.quiz",
        phase: "quiz",
        title: "章节短测",
        body: "用“每份大小”解释你的判断。",
        question: {
          id: "item.fraction.units.quiz",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "apply",
          prompt: "同样大的两个蛋糕，小红吃 1/4，小刚吃 1/7。谁吃得更多？",
          options: ["小红", "小刚", "一样多"],
          answerIndex: 0,
          explanation: "整体相同时，1/4 的每一份大于 1/7 的每一份。",
          timeLimitSec: 45,
          damage: 2,
        },
      },
    ],
  },
  {
    id: "chapter.fraction.equivalent",
    milestoneId: "math.g4.milestone.01",
    stageNo: 3,
    title: "找出等值分数",
    summary: "通过继续平均分，理解不同分数可以表示同样的大小。",
    estimatedMinutes: 6,
    nodeIds: ["math.fractions_decimals.fraction_meaning"],
    steps: [
      {
        id: "equivalent.hook",
        phase: "hook",
        title: "半个饼，也能写成两份四分之一",
        body: "把一个饼平均分成 2 份，取 1 份是 1/2。如果把每一份再平均切成 2 份，就得到 2 个 1/4。",
        visual: fractionBar(2, 1, 2, 4, ["1/2", "2/4"]),
      },
      {
        id: "equivalent.concept",
        phase: "concept",
        title: "大小相同，写法可以不同",
        body: "1/2 和 2/4 覆盖同样大的区域，所以它们相等。找等值分数时，分子和分母要同时乘或除以同一个非零数。",
        visual: fractionBar(2, 1, 2, 4, ["1/2", "2/4"]),
      },
      {
        id: "equivalent.example",
        phase: "example",
        title: "把每一份继续平均分",
        body: "1/2 的分子分母都乘 3，得到 3/6。图中 3/6 与 1/2 覆盖的区域一样大，因此 1/2 = 3/6。",
        visual: fractionBar(2, 1, 3, 6, ["1/2", "3/6"]),
      },
      {
        id: "equivalent.guided",
        phase: "guided",
        title: "把 1/4 继续平均分",
        body: "把 1/4 的分子和分母同时乘 3：1×3=3，4×3=12。图中 1/4 和 3/12 覆盖的面积一样大。",
        visual: fractionBar(4, 1, 3, 12, ["1/4", "3/12"]),
        question: {
          id: "item.fraction.equivalent.guided",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "apply",
          prompt: "1/4 的分子分母同时乘 3，得到哪个分数？",
          options: ["3/12", "3/4", "4/12"],
          answerIndex: 0,
          explanation: "1×3=3，4×3=12，所以得到 3/12。",
          timeLimitSec: 35,
          damage: 1,
        },
      },
      {
        id: "equivalent.practice",
        phase: "practice",
        title: "独立找等值分数",
        body: "要找与 1/4 相等的分数，就把 1/4 的分子和分母同时乘同一个非零数。",
        visual: fractionBar(4, 1),
        question: {
          id: "item.fraction.equivalent.practice",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "apply",
          prompt: "在 2/4、2/8、4/4 中，与 1/4 相等的分数是哪一个？",
          options: ["2/4", "2/8", "4/4"],
          answerIndex: 1,
          explanation: "1/4 的分子分母同时乘 2，得到 2/8。",
          timeLimitSec: 40,
          damage: 2,
        },
      },
      {
        id: "equivalent.quiz",
        phase: "quiz",
        title: "章节短测",
        body: "用图中覆盖区域验证你的答案。",
        visual: fractionBar(6, 2, 1, 3, ["2/6", "1/3"]),
        question: {
          id: "item.fraction.equivalent.quiz",
          nodeId: "math.fractions_decimals.fraction_meaning",
          kind: "transfer",
          prompt: "与 2/6 相等的分数是哪一个？",
          options: ["1/3", "2/3", "1/6"],
          answerIndex: 0,
          explanation: "2/6 的分子分母同时除以 2，得到 1/3。",
          timeLimitSec: 45,
          damage: 2,
          visual: fractionBar(6, 2, 1, 3, ["2/6", "1/3"]),
        },
      },
    ],
  },
];

type QuestionSeed = Omit<ContentQuestion, "id" | "nodeId">;

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

function createChapter(input: {
  id: string;
  milestoneId: string;
  stageNo: number;
  title: string;
  summary: string;
  estimatedMinutes: number;
  nodeId: string;
  hookTitle: string;
  hookBody: string;
  conceptTitle: string;
  conceptBody: string;
  questions: [QuestionSeed, QuestionSeed, QuestionSeed];
}): Chapter {
  const phases = ["guided", "practice", "quiz"] as const;
  const steps: LessonStep[] = [
    {
      id: `${input.id}.hook`,
      phase: "hook",
      title: input.hookTitle,
      body: input.hookBody,
    },
    {
      id: `${input.id}.concept`,
      phase: "concept",
      title: input.conceptTitle,
      body: input.conceptBody,
    },
    ...input.questions.map((question, index) => ({
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
    stageNo: input.stageNo,
    title: input.title,
    summary: input.summary,
    estimatedMinutes: input.estimatedMinutes,
    nodeIds: [input.nodeId],
    steps,
  };
}

function g4MilestoneId(stageNo: number) {
  return `math.g4.milestone.${String(stageNo).padStart(2, "0")}`;
}

const additionalChapters: Chapter[] = [
  createChapter({
    id: "chapter.equivalence.expand",
    milestoneId: g4MilestoneId(2),
    stageNo: 1,
    title: "把分数继续平均分",
    summary: "通过同时乘同一个数，找到大小不变的分数。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.fraction_equivalence",
    hookTitle: "半张纸还能怎样说",
    hookBody: "同一张纸取 1/2，把每份再平均分成 3 份，就得到 3/6。",
    conceptTitle: "分子分母同时乘",
    conceptBody: "1/2 的分子和分母都乘 3，得到 3/6，覆盖的区域仍然一样大。",
    questions: [
      q("apply", "1/3 的分子和分母同时乘 2，得到哪个分数？", ["2/6", "3/6", "2/3"], 0, "1×2=2，3×2=6，所以得到 2/6。"),
      q("apply", "在 6/15、5/10、2/10 中，与 2/5 相等的分数是哪一个？", ["6/15", "5/10", "2/10"], 0, "2/5 的分子和分母都乘 3，得到 6/15。"),
      q("transfer", "把一个分数的分子和分母同时乘 4，分数大小怎样变化？", ["不变", "变成 4 倍", "变成 1/4"], 0, "同时乘同一个非零数，表示的大小不变。", 2),
    ],
  }),
  createChapter({
    id: "chapter.equivalence.simplify",
    milestoneId: g4MilestoneId(2),
    stageNo: 2,
    title: "把分数化到更简洁",
    summary: "通过同时除以公因数，判断两个分数是否相等。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.fraction_equivalence",
    hookTitle: "找出共同因数",
    hookBody: "8/12 的分子和分母都能被 4 整除，可以同时除以 4。",
    conceptTitle: "等值分数也能反向化简",
    conceptBody: "分子和分母同时除以同一个非零数，分数大小不变，所以 8/12=2/3。",
    questions: [
      q("apply", "6/8 的分子和分母同时除以 2，得到哪个分数？", ["3/4", "2/4", "4/3"], 0, "6÷2=3，8÷2=4，所以得到 3/4。"),
      q("judge", "3/9 和 1/3 相等。", ["正确", "错误"], 0, "3/9 的分子和分母同时除以 3，得到 1/3。"),
      q("transfer", "哪一组分数相等？", ["4/10 和 2/5", "4/10 和 1/5", "2/5 和 2/10"], 0, "4/10 的分子和分母同时除以 2，得到 2/5。", 2),
    ],
  }),
  createChapter({
    id: "chapter.compare.fractions",
    milestoneId: g4MilestoneId(3),
    stageNo: 1,
    title: "比较不同的分数",
    summary: "根据分母与分子的关系判断分数大小。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.fraction_operations",
    hookTitle: "同一块蛋糕的两种分法",
    hookBody: "比较 3/4 和 5/8 时，可以先化成同分母分数，也可以借助一半作为参照。",
    conceptTitle: "先找共同标准",
    conceptBody: "分母相同看分子；分子相同看分母。分母不同时，可以通分后再比较。",
    questions: [
      q("judge", "分子相同时，分母越大，分数越小。", ["正确", "错误"], 0, "整体相同时，分成更多份，每一份更小。"),
      q("apply", "三个分数中，数值最大的是哪一个？", ["1/2", "3/4", "2/3"], 1, "3/4=0.75，大于 1/2 和 2/3。"),
      q("transfer", "3/5 和 4/7 比较，哪个更大？", ["3/5", "4/7", "一样大"], 0, "通分后分别为 21/35 和 20/35，所以 3/5 更大。", 2),
    ],
  }),
  createChapter({
    id: "chapter.fraction-operations.same-denominator",
    milestoneId: g4MilestoneId(3),
    stageNo: 2,
    title: "同分母分数加减",
    summary: "保持分母不变，只计算分子的加减。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.fraction_operations",
    hookTitle: "分母表示每一份的大小",
    hookBody: "2/7 和 3/7 都表示七分之一份，合起来就是 5 个 1/7。",
    conceptTitle: "单位相同才能直接加减",
    conceptBody: "同分母分数相加或相减时，分母不变，只把分子相加或相减。",
    questions: [
      q("apply", "2/9 + 4/9 等于多少？", ["6/9", "6/18", "2/9"], 0, "分母不变，分子 2+4=6，得到 6/9。"),
      q("apply", "7/10 - 3/10 等于多少？", ["4/10", "4/0", "10/10"], 0, "分母不变，分子 7-3=4，得到 4/10。"),
      q("transfer", "一根绳子用去 2/8 米，还剩 5/8 米，原长是多少米？", ["7/8 米", "3/8 米", "7/16 米"], 0, "求原长应把用去和剩下的部分相加。", 2),
    ],
  }),
  createChapter({
    id: "chapter.decimals.meaning",
    milestoneId: g4MilestoneId(4),
    stageNo: 1,
    title: "十分位与百分位",
    summary: "从小数的数位理解它表示多少分之一。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.decimal_meaning",
    hookTitle: "一块钱里的十份",
    hookBody: "1 元平均分成 10 角，3 角就是 0.3 元，也就是 3/10 元。",
    conceptTitle: "小数点右边第一位是十分位",
    conceptBody: "小数点后第一位表示十分之几，第二位表示百分之几。",
    questions: [
      q("identify", "0.7 化成最简分数后是哪一个？", ["7/10", "7/100", "1/7"], 0, "十分位上的 7 表示 7 个 1/10。"),
      q("apply", "25/100 写成小数是多少？", ["0.25", "2.5", "0.025"], 0, "百分之二十五写成小数是 0.25。"),
      q("transfer", "3.06 中的 6 在什么数位上？", ["百分位", "十分位", "个位"], 0, "小数点后第二位是百分位。", 2),
    ],
  }),
  createChapter({
    id: "chapter.decimals.compare",
    milestoneId: g4MilestoneId(4),
    stageNo: 2,
    title: "小数与分数互换",
    summary: "借助数位和分数意义比较、转换小数。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.decimal_meaning",
    hookTitle: "从分数走到小数",
    hookBody: "9/10=0.9，40/100=0.4，分母是 10 或 100 时可以对应到小数位。",
    conceptTitle: "数位对齐后比较",
    conceptBody: "比较小数先看整数部分，再看十分位、百分位，某一位没有数时补 0。",
    questions: [
      q("judge", "0.8 和 8/10 表示同样的大小。", ["正确", "错误"], 0, "0.8 就是 8 个 1/10。"),
      q("apply", "0.6、0.58、0.5 中，最大的数是哪一个？", ["0.6", "0.58", "0.5"], 0, "0.60 的十分位是 6，大于 0.58 和 0.50。"),
      q("transfer", "把 1/4 写成小数是多少？", ["0.25", "0.4", "1.4"], 0, "1/4 等于 25/100，所以是 0.25。", 2),
    ],
  }),
  createChapter({
    id: "chapter.decimal-operations.add-subtract",
    milestoneId: g4MilestoneId(5),
    stageNo: 1,
    title: "小数加减要对齐",
    summary: "把小数点对齐后完成进退位计算。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.decimal_operations",
    hookTitle: "购物小票上的两位小数",
    hookBody: "2.40 元和 1.35 元相加，需要让相同数位对齐。",
    conceptTitle: "小数点对齐就是数位对齐",
    conceptBody: "列竖式时小数点对齐，再按整数加减法计算，所得结果点上小数点。",
    questions: [
      q("apply", "2.4 + 1.35 等于多少？", ["3.75", "3.39", "1.59"], 0, "2.40+1.35=3.75。"),
      q("apply", "5.2 - 1.75 等于多少？", ["3.45", "3.55", "4.45"], 0, "5.20-1.75=3.45。"),
      q("transfer", "估算 9.8+2.1，最接近哪个结果？", ["约 12", "约 7", "约 20"], 0, "9.8 接近 10，2.1 接近 2，所以结果约 12。", 2),
    ],
  }),
  createChapter({
    id: "chapter.decimal-operations.estimate",
    milestoneId: g4MilestoneId(5),
    stageNo: 2,
    title: "用估算检查小数结果",
    summary: "先估计数量级，再完成准确计算。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.decimal_operations",
    hookTitle: "答案是否合理",
    hookBody: "计算前先估计结果大约是多少，能及时发现小数点位置错误。",
    conceptTitle: "四舍五入到整数再估算",
    conceptBody: "把小数估计成接近的整数，可以快速判断加减结果的合理范围。",
    questions: [
      q("judge", "4.9+3.05 的结果一定小于 8。", ["正确", "错误"], 0, "4.9+3.05=7.95，结果确实小于 8。"),
      q("apply", "8.02-3.9 最接近哪个数？", ["4", "5", "12"], 0, "8.02 接近 8，3.9 接近 4，差接近 4。"),
      q("transfer", "哪一项计算最需要检查小数点位置？", ["0.45+0.3=0.75", "0.45+0.3=4.5", "0.45+0.3=0.48"], 1, "0.45 与 0.30 相加应得到 0.75，不是 4.5。", 2),
    ],
  }),
  createChapter({
    id: "chapter.geometry.parallel-perpendicular",
    milestoneId: g4MilestoneId(6),
    stageNo: 1,
    title: "平行与垂直",
    summary: "从方向和交点判断两条直线的位置关系。",
    estimatedMinutes: 6,
    nodeId: "math.geometry.shapes_relations",
    hookTitle: "铁轨与窗框",
    hookBody: "铁轨保持同样距离，窗框相邻两边相交成直角。",
    conceptTitle: "同一平面内看关系",
    conceptBody: "永不相交的两条直线互相平行；相交成直角的两条直线互相垂直。",
    questions: [
      q("identify", "两条直线相交成直角，它们是什么关系？", ["互相垂直", "互相平行", "完全重合"], 0, "相交成直角是垂直关系。"),
      q("judge", "长方形的相邻两条边互相垂直。", ["正确", "错误"], 0, "长方形四个角都是直角。"),
      q("transfer", "在同一平面内，两条直线都垂直于同一条直线，它们互相怎样？", ["平行", "垂直", "相交成锐角"], 0, "都与同一条直线成直角，它们方向相同，互相平行。", 2),
    ],
  }),
  createChapter({
    id: "chapter.geometry.quadrilaterals",
    milestoneId: g4MilestoneId(6),
    stageNo: 2,
    title: "按边和角认识四边形",
    summary: "用边、角特征区分平行四边形和梯形。",
    estimatedMinutes: 6,
    nodeId: "math.geometry.shapes_relations",
    hookTitle: "四边形分类柜",
    hookBody: "先观察有几组对边平行，再看角是不是直角。",
    conceptTitle: "特征决定名称",
    conceptBody: "两组对边分别平行的四边形是平行四边形；只有一组对边平行的四边形是梯形。",
    questions: [
      q("identify", "只有一组对边平行的四边形是什么？", ["梯形", "平行四边形", "长方形"], 0, "只有一组对边平行的四边形是梯形。"),
      q("judge", "正方形也是特殊的平行四边形。", ["正确", "错误"], 0, "正方形的两组对边分别平行。"),
      q("transfer", "一个四边形四边相等，但四个角不是直角，它仍一定是正方形吗？", ["不一定", "一定", "一定不是平行四边形"], 0, "菱形也四边相等；若角不是直角，就不是正方形。", 2),
    ],
  }),
  createChapter({
    id: "chapter.charts.read",
    milestoneId: g4MilestoneId(7),
    stageNo: 1,
    title: "读懂条形统计图",
    summary: "根据横轴、纵轴和直条高度读取数量。",
    estimatedMinutes: 6,
    nodeId: "math.data_probability.charts",
    hookTitle: "一周阅读量",
    hookBody: "统计图中每根直条代表一个类别，高度对应数量。",
    conceptTitle: "先看单位，再读数据",
    conceptBody: "读图时先确认一格代表多少，再比较各直条的高度。",
    questions: [
      q("identify", "在阅读量条形统计图中，某天直条明显更高，说明什么？", ["这一天阅读量更多", "分类名称更长", "记录时间更短"], 0, "直条高度表示对应类别的数量，直条越高数量越多。"),
      q("apply", "周一 8 本，周二 5 本，周二比周一少几本？", ["3 本", "13 本", "5 本"], 0, "8-5=3。"),
      q("transfer", "统计图一格表示 4 人，某直条高 3 格，对应多少人？", ["12 人", "7 人", "3 人"], 0, "3×4=12。", 2),
    ],
  }),
  createChapter({
    id: "chapter.charts.compare",
    milestoneId: g4MilestoneId(7),
    stageNo: 2,
    title: "从统计表回答比较问题",
    summary: "从多行数据中找最大、最小和总量。",
    estimatedMinutes: 6,
    nodeId: "math.data_probability.charts",
    hookTitle: "数据表里的重点",
    hookBody: "先定位项目和数量，再根据问题做加减或排序。",
    conceptTitle: "按问题选择信息",
    conceptBody: "求总数用加法，求相差用减法，比较大小需先找到对应数据。",
    questions: [
      q("apply", "四个班种树分别为 12、15、9、14 棵，最多的是哪个数？", ["15", "12", "9"], 0, "15 是四个数中最大的。"),
      q("apply", "12+15+9+14 的总数是？", ["50", "40", "45"], 0, "12+15+9+14=50。"),
      q("transfer", "甲组 18 人，乙组比甲组少 6 人，两组一共多少人？", ["30 人", "24 人", "36 人"], 0, "乙组 18-6=12 人，合计 18+12=30 人。", 2),
    ],
  }),
  createChapter({
    id: "chapter.mixed-order.basic",
    milestoneId: g4MilestoneId(8),
    stageNo: 1,
    title: "先乘除，后加减",
    summary: "在同一算式中按标准顺序确定计算步骤。",
    estimatedMinutes: 6,
    nodeId: "math.arithmetic.mixed_operations",
    hookTitle: "不能只从左到右",
    hookBody: "3+4×2 要先算 4×2，再与 3 相加。",
    conceptTitle: "运算顺序决定结果",
    conceptBody: "没有括号时先算乘除，再算加减；同级运算从左到右。",
    questions: [
      q("apply", "3+4×2 等于多少？", ["11", "14", "10"], 0, "先算 4×2=8，再算 3+8=11。"),
      q("apply", "20-12÷4 等于多少？", ["17", "2", "8"], 0, "先算 12÷4=3，再算 20-3=17。"),
      q("transfer", "计算 8+15÷3×2 时，应该先算哪一步？", ["15÷3", "8+15", "3×2 先于除法"], 0, "乘除同级，按从左到右先算 15÷3。", 2),
    ],
  }),
  createChapter({
    id: "chapter.mixed-order.parentheses",
    milestoneId: g4MilestoneId(8),
    stageNo: 2,
    title: "括号改变顺序",
    summary: "先算括号内，再按规则完成其余运算。",
    estimatedMinutes: 6,
    nodeId: "math.arithmetic.mixed_operations",
    hookTitle: "先合并再乘",
    hookBody: "(3+4)×2 先算括号里的 7，再乘 2。",
    conceptTitle: "括号优先",
    conceptBody: "算式中有括号时，先算括号内的部分，再继续计算括号外。",
    questions: [
      q("apply", "(3+4)×2 等于多少？", ["14", "11", "9"], 0, "先算 3+4=7，再算 7×2=14。"),
      q("apply", "36÷(2+4) 等于多少？", ["6", "20", "12"], 0, "先算 2+4=6，再算 36÷6=6。"),
      q("transfer", "要让 2+3×5 先算加法，应该怎样改？", ["(2+3)×5", "2+(3×5)", "2+3×(5+1)"], 0, "给 2+3 加括号，可以优先计算。", 2),
    ],
  }),
  createChapter({
    id: "chapter.modeling.quantity",
    milestoneId: g4MilestoneId(9),
    stageNo: 1,
    title: "找到数量关系",
    summary: "从情境中区分总量、份数和每份数。",
    estimatedMinutes: 6,
    nodeId: "math.modeling.word_problem_models",
    hookTitle: "一句话里的关系",
    hookBody: "每盒 6 支，共 4 盒，求总数就是求 4 个 6 是多少。",
    conceptTitle: "先找每份数和份数",
    conceptBody: "每份数×份数=总数；知道总数和一份数，也可以用除法求份数。",
    questions: [
      q("apply", "每盒 6 支，4 盒一共多少支？", ["24 支", "10 支", "18 支"], 0, "6×4=24。"),
      q("apply", "24 支铅笔平均放进 4 盒，每盒多少支？", ["6 支", "8 支", "20 支"], 0, "24÷4=6。"),
      q("transfer", "每本书 18 元，买 3 本付 100 元，应找回多少元？", ["46 元", "54 元", "82 元"], 0, "3 本书 54 元，100-54=46 元。", 2),
    ],
  }),
  createChapter({
    id: "chapter.modeling.compare",
    milestoneId: g4MilestoneId(9),
    stageNo: 2,
    title: "比较数量差与倍数",
    summary: "根据“多多少”“是几倍”选择加减或乘除。",
    estimatedMinutes: 6,
    nodeId: "math.modeling.word_problem_models",
    hookTitle: "关键词背后的关系",
    hookBody: "“比……多”通常求差，“是……的几倍”通常求倍数关系。",
    conceptTitle: "先说关系，再列式",
    conceptBody: "画一条短线和长线，可以帮助看清谁多谁少以及相差多少。",
    questions: [
      q("apply", "小明 12 岁，小红 9 岁，小明比小红大几岁？", ["3 岁", "21 岁", "12 岁"], 0, "12-9=3。"),
      q("apply", "一箱有 8 瓶，另一箱是它的 3 倍，另一箱有多少瓶？", ["24 瓶", "11 瓶", "16 瓶"], 0, "8×3=24。"),
      q("transfer", "36 人分成 4 队，每队人数相同；每队再分 3 组，每组几人？", ["3 人", "12 人", "9 人"], 0, "每队 36÷4=9 人，每组 9÷3=3 人。", 2),
    ],
  }),
  createChapter({
    id: "chapter.multi-step.plan",
    milestoneId: g4MilestoneId(10),
    stageNo: 1,
    title: "把多步骤问题拆开",
    summary: "先找中间量，再解决最终问题。",
    estimatedMinutes: 7,
    nodeId: "math.modeling.multi_step_problems",
    hookTitle: "先解决中间问题",
    hookBody: "想知道还剩多少，往往要先求出已经用了多少。",
    conceptTitle: "画计划再计算",
    conceptBody: "把问题拆成两步：先求中间量，再把中间量带入下一步。",
    questions: [
      q("apply", "买 3 盒每盒 8 支，共多少支？", ["24 支", "11 支", "16 支"], 0, "3×8=24。"),
      q("apply", "24 支用去 9 支，还剩多少支？", ["15 支", "33 支", "16 支"], 0, "24-9=15。"),
      q("transfer", "买 3 盒每盒 8 支，用去 9 支，还剩多少支？", ["15 支", "24 支", "18 支"], 0, "先求 3×8=24，再算 24-9=15。", 2),
    ],
  }),
  createChapter({
    id: "chapter.multi-step.verify",
    milestoneId: g4MilestoneId(10),
    stageNo: 2,
    title: "用逆运算检验答案",
    summary: "从结果倒推条件，检查多步骤计算是否合理。",
    estimatedMinutes: 7,
    nodeId: "math.modeling.multi_step_problems",
    hookTitle: "算完还要回头检查",
    hookBody: "如果总价减找回的钱等于应付金额，计算就更可信。",
    conceptTitle: "逆运算和估算一起用",
    conceptBody: "加法用减法检验，乘法用除法检验，同时看结果是否在合理范围内。",
    questions: [
      q("judge", "乘法结果可以用除法检验。", ["正确", "错误"], 0, "积除以一个因数应得到另一个因数。"),
      q("apply", "6×7=42，用哪道除法可以直接检验？", ["42÷6=7", "42+6=48", "7-6=1"], 0, "42÷6 应等于 7。"),
      q("transfer", "一辆车每时行 60 千米，行 3 时后还剩 40 千米，全程多少千米？", ["220 千米", "180 千米", "100 千米"], 0, "先求已行 60×3=180，再加剩余 40，得到 220 千米。", 2),
    ],
  }),
  createChapter({
    id: "chapter.equivalence.common-denominator",
    milestoneId: g4MilestoneId(2),
    stageNo: 3,
    title: "为分数找到共同分母",
    summary: "把分母不同的分数化成同分母等值分数，为比较和计算做准备。",
    estimatedMinutes: 7,
    nodeId: "math.fractions_decimals.fraction_equivalence",
    hookTitle: "分母不同先统一",
    hookBody: "1/2 和 1/3 的每一份大小不同，直接比较不公平，需要先换成相同的份。",
    conceptTitle: "通分就是换成等值分数",
    conceptBody: "通分时，通常取两个分母的最小公倍数作公分母，再把每个分数化成同分母的等值分数。",
    questions: [
      q("apply", "1/2 和 1/3 通分后分别是多少？", ["3/6 和 2/6", "2/3 和 3/2", "1/6 和 1/6"], 0, "2 和 3 的最小公倍数是 6，1/2=3/6，1/3=2/6。"),
      q("apply", "把 3/4 和 5/6 通分，最小公分母是多少？", ["12", "24", "10"], 0, "4 和 6 的最小公倍数是 12。"),
      q("transfer", "2/3 和 3/5 通分后分别是多少？", ["10/15 和 9/15", "5/15 和 3/15", "2/15 和 3/15"], 0, "15 是 3 和 5 的最小公倍数，2/3=10/15，3/5=9/15。", 2),
    ],
  }),
  createChapter({
    id: "chapter.fraction-operations.unlike-denominator",
    milestoneId: g4MilestoneId(3),
    stageNo: 3,
    title: "异分母分数加减",
    summary: "先通分再加减，理解为什么不能直接把分母相加。",
    estimatedMinutes: 7,
    nodeId: "math.fractions_decimals.fraction_operations",
    hookTitle: "份的大小不同不能直接数",
    hookBody: "1/2 和 1/4 的每一份不一样大，先把它们都换成四分之一份才好相加。",
    conceptTitle: "先通分，再按同分母计算",
    conceptBody: "异分母分数加减时，先通分变成同分母分数，保持分母不变，只把分子相加减。",
    questions: [
      q("apply", "1/2 + 1/4 等于多少？", ["3/4", "2/6", "2/4"], 0, "1/2=2/4，2/4+1/4=3/4。"),
      q("apply", "2/3 - 1/6 等于多少？", ["1/2", "1/3", "3/3"], 0, "2/3=4/6，4/6-1/6=3/6=1/2。"),
      q("transfer", "一根绳子长 1/2 米，另一根长 2/5 米，两根一共长多少米？", ["9/10 米", "3/7 米", "3/10 米"], 0, "通分后 5/10+4/10=9/10 米。", 2),
    ],
  }),
  createChapter({
    id: "chapter.decimals.number-line",
    milestoneId: g4MilestoneId(4),
    stageNo: 3,
    title: "在数轴上定位小数",
    summary: "把小数看成数轴上的点，借助数轴比较和估计大小。",
    estimatedMinutes: 6,
    nodeId: "math.fractions_decimals.decimal_meaning",
    hookTitle: "0 到 1 之间的格子",
    hookBody: "把 0 到 1 平均分成 10 格，每向前一格就增加 0.1。",
    conceptTitle: "十分位决定落在哪一格",
    conceptBody: "数轴上的小数位置由整数部分和十分位、百分位共同决定，越靠右的数越大。",
    questions: [
      q("identify", "0 到 1 平均分成 10 份，第 6 个分点表示哪个数？", ["0.6", "6", "0.06"], 0, "6 个十分之一就是 0.6。"),
      q("apply", "0.35 在数轴上位于哪两个十分位之间？", ["0.3 和 0.4", "0.2 和 0.3", "0.35 和 0.36"], 0, "0.35 比 0.3 大、比 0.4 小，落在它们之间。"),
      q("transfer", "0.98、0.9、0.89 中，最接近 1 的数是哪一个？", ["0.98", "0.9", "0.89"], 0, "0.98 与 1 相差 0.02，是三者中最近的。", 2),
    ],
  }),
  createChapter({
    id: "chapter.decimal-operations.point-shift",
    milestoneId: g4MilestoneId(5),
    stageNo: 3,
    title: "小数点移动的规律",
    summary: "通过小数点位置的变化，理解乘除 10、100 与数的大小关系。",
    estimatedMinutes: 7,
    nodeId: "math.fractions_decimals.decimal_operations",
    hookTitle: "小数点挪一挪",
    hookBody: "0.45 的小数点向右移一位变成 4.5，数值扩大到原来的 10 倍。",
    conceptTitle: "右移扩大，左移缩小",
    conceptBody: "小数点向右移动一位、两位，数分别扩大到 10 倍、100 倍；向左移动则缩小到原来的十分之一、百分之一。",
    questions: [
      q("apply", "0.45 的小数点向右移动一位，得到哪个数？", ["4.5", "0.045", "45"], 0, "小数点右移一位，0.45 扩大 10 倍得 4.5。"),
      q("apply", "3.6 除以 10，结果是多少？", ["0.36", "36", "0.036"], 0, "除以 10 相当于小数点向左移动一位。"),
      q("transfer", "1.2 扩大到原来的 100 倍是多少？", ["120", "12", "1200"], 0, "小数点向右移动两位，得到 120。", 2),
    ],
  }),
  createChapter({
    id: "chapter.geometry.heights",
    milestoneId: g4MilestoneId(6),
    stageNo: 3,
    title: "平行四边形和梯形的高",
    summary: "认识高是两条平行边之间的垂直距离，进一步理解图形特征。",
    estimatedMinutes: 7,
    nodeId: "math.geometry.shapes_relations",
    hookTitle: "从一条边垂直量到对边",
    hookBody: "想知道平行四边形有多高，要从一条边垂直地量到对边，不能斜着量。",
    conceptTitle: "高必须垂直于底",
    conceptBody: "从平行四边形一条边上的一点向对边作垂线，这条垂直线段就是高；梯形的高是两底之间的垂直距离。",
    questions: [
      q("identify", "从平行四边形一条边向对边作的垂直线段叫做什么？", ["高", "对角线", "中线"], 0, "垂直于底的线段是平行四边形的高。"),
      q("judge", "梯形的两条底边互相平行。", ["正确", "错误"], 0, "梯形只有一组对边平行，这组对边就是两条底。"),
      q("transfer", "一个梯形只有一组对边平行，它的另一组对边一定相等吗？", ["不一定", "一定", "一定互相平行"], 0, "只有等腰梯形的两条腰相等，普通梯形不一定。", 2),
    ],
  }),
  createChapter({
    id: "chapter.charts.inference",
    milestoneId: g4MilestoneId(7),
    stageNo: 3,
    title: "从统计图做出推断",
    summary: "在读取数据的基础上，比较变化并做出合理判断。",
    estimatedMinutes: 7,
    nodeId: "math.data_probability.charts",
    hookTitle: "数据会说话",
    hookBody: "比较两周的阅读人数，能看出阅读习惯是在变好还是变差。",
    conceptTitle: "先比较，再推断",
    conceptBody: "读统计图时，先确认每个数据，再通过加减或排序发现变化趋势，最后做出有依据的推断。",
    questions: [
      q("identify", "想比较两个类别相差多少，最适合用哪种运算？", ["减法", "加法", "乘法"], 0, "求相差多少用减法。"),
      q("apply", "第一周 20 人，第二周 26 人，第二周比第一周增加了多少人？", ["6 人", "46 人", "4 人"], 0, "26-20=6。"),
      q("transfer", "统计图一格表示 5 人，连续三格分别高 2 格、3 格、4 格，总数是多少人？", ["45 人", "9 人", "30 人"], 0, "合计 9 格，9×5=45 人。", 2),
    ],
  }),
  createChapter({
    id: "chapter.mixed-order.check",
    milestoneId: g4MilestoneId(8),
    stageNo: 3,
    title: "用运算顺序检查错题",
    summary: "标出第一步计算，按括号、乘除、加减的顺序排查错误。",
    estimatedMinutes: 7,
    nodeId: "math.arithmetic.mixed_operations",
    hookTitle: "错在第一步",
    hookBody: "18-2×5 如果先算减法就会出错，正确顺序要先算乘法。",
    conceptTitle: "每一步都先确定优先级",
    conceptBody: "检查混合运算时，先看有没有括号，再找乘除，最后算加减；同级运算从左到右。",
    questions: [
      q("apply", "18-2×5 的正确结果是多少？", ["8", "80", "20"], 0, "先算 2×5=10，再算 18-10=8。"),
      q("apply", "(12+8)÷4 等于多少？", ["5", "11", "2"], 0, "先算括号里 12+8=20，再算 20÷4=5。"),
      q("transfer", "在 (6+4)×3、6+4×3、6×4+3 中，哪道算式会先算加法？", ["(6+4)×3", "6+4×3", "6×4+3"], 0, "只有 (6+4)×3 把加法放在括号里优先计算。", 2),
    ],
  }),
  createChapter({
    id: "chapter.modeling.segment-diagram",
    milestoneId: g4MilestoneId(9),
    stageNo: 3,
    title: "画线段图找数量关系",
    summary: "用长短不同的线段表示数量，直观看出相差与倍数关系。",
    estimatedMinutes: 7,
    nodeId: "math.modeling.word_problem_models",
    hookTitle: "把关系画出来",
    hookBody: "用一条短线段表示较小的数，再用更长的线段表示较大的数，关系就清楚了。",
    conceptTitle: "线段长度对应数量大小",
    conceptBody: "线段图能帮助判断该用加法、减法还是乘法，尤其适合“比多比少”和“是几倍”的问题。",
    questions: [
      q("apply", "甲有 15 个，乙比甲少 4 个，乙有多少个？", ["11 个", "19 个", "4 个"], 0, "15-4=11。"),
      q("apply", "甲有 15 个，乙是甲的 4 倍，乙有多少个？", ["60 个", "19 个", "45 个"], 0, "15×4=60。"),
      q("transfer", "甲有 15 个，乙是甲的 4 倍，两人一共有多少个？", ["75 个", "60 个", "64 个"], 0, "乙有 60 个，15+60=75 个。", 2),
    ],
  }),
  createChapter({
    id: "chapter.multi-step.relevant-info",
    milestoneId: g4MilestoneId(10),
    stageNo: 3,
    title: "挑出多步骤问题的相关信息",
    summary: "先明确要求什么，再从条件中选出真正需要的信息。",
    estimatedMinutes: 7,
    nodeId: "math.modeling.multi_step_problems",
    hookTitle: "不是每个数字都要用",
    hookBody: "题目里出现的数字不一定都用得上，先看问题问的是什么。",
    conceptTitle: "问题决定需要哪些条件",
    conceptBody: "解决多步骤问题时，先写清最终要求什么，再倒推需要的中间量，过滤掉无关信息。",
    questions: [
      q("identify", "求“还剩多少”，通常需要哪些信息？", ["总数和用去的量", "总数和每份价钱", "颜色和数量"], 0, "还剩多少等于总数减去已经用去的量。"),
      q("apply", "每本 8 元，买 5 本，付 100 元。求找回多少元，应先算哪一步？", ["5 本的总价", "每本的价钱", "付了几张纸币"], 0, "先求 5 本的总价，再用 100 元减去它。"),
      q("transfer", "每本 8 元，买 5 本，付 100 元，应找回多少元？", ["60 元", "40 元", "68 元"], 0, "5 本共 40 元，100-40=60 元。", 2),
    ],
  }),
];

export const chapters: Chapter[] = [...foundationChapters, ...additionalChapters];

const additionalBossSeeds: Record<number, QuestionSeed[]> = {
  2: [
    q("identify", "4/6 化简后是哪个分数？", ["2/3", "2/6", "4/3"], 0, "分子和分母同时除以 2，得到 2/3。"),
    q("judge", "1/2 和 3/6 大小相等。", ["正确", "错误"], 0, "1/2 的分子和分母同时乘 3，得到 3/6。"),
    q("apply", "在 9/12、4/3、3/12 中，与 3/4 相等的分数是哪一个？", ["9/12", "4/3", "3/12"], 0, "3/4 的分子和分母同时乘 3，得到 9/12。"),
    q("transfer", "12/16 与哪个分数相等？", ["3/4", "4/3", "6/8 的一半"], 0, "分子和分母同时除以 4，得到 3/4。", 2),
  ],
  3: [
    q("judge", "分母相同时，分子越大分数越大。", ["正确", "错误"], 0, "每一份大小相同，取走的份数越多，分数越大。"),
    q("apply", "5/8 + 2/8 等于多少？", ["7/8", "7/16", "3/8"], 0, "同分母相加，分子相加。"),
    q("apply", "9/11 - 4/11 等于多少？", ["5/11", "5/0", "13/11"], 0, "同分母相减，分子 9-4=5。"),
    q("transfer", "2/5 和 3/8 哪个更大？", ["2/5", "3/8", "一样大"], 0, "通分后分别为 16/40 和 15/40。", 2),
  ],
  4: [
    q("identify", "0.09 表示哪个分数？", ["9/100", "9/10", "1/9"], 0, "百分位上的 9 表示 9/100。"),
    q("apply", "7/10 写成小数是多少？", ["0.7", "7.10", "0.07"], 0, "十分之七写作 0.7。"),
    q("judge", "0.5 和 5/10 相等。", ["正确", "错误"], 0, "0.5 表示 5 个十分之一。"),
    q("transfer", "0.68 中的 6 表示多少？", ["6 个十分之一", "6 个百分之一", "6 个一"], 0, "小数点后第一位是十分位。", 2),
  ],
  5: [
    q("apply", "1.2+0.9 等于多少？", ["2.1", "1.11", "2.11"], 0, "1.2+0.9=2.1。"),
    q("apply", "4.5-1.8 等于多少？", ["2.7", "3.3", "2.3"], 0, "4.5-1.8=2.7。"),
    q("judge", "小数加减时要把末位对齐。", ["错误", "正确"], 0, "应先把小数点对齐，也就是相同数位对齐。"),
    q("transfer", "一根 3.2 米绳子剪去 1.45 米，还剩多少米？", ["1.75 米", "2.75 米", "1.85 米"], 0, "3.20-1.45=1.75。", 2),
  ],
  6: [
    q("identify", "长方形的对边通常是什么关系？", ["互相平行", "互相垂直", "相交成锐角"], 0, "长方形两组对边分别平行。"),
    q("judge", "两条直线相交成直角，它们互相垂直。", ["正确", "错误"], 0, "垂直关系由直角确定。"),
    q("apply", "只有一组对边平行的四边形叫什么？", ["梯形", "平行四边形", "正方形"], 0, "梯形只有一组对边平行。"),
    q("transfer", "正方形具备哪组特征？", ["四边相等且有四个直角", "只有一组对边平行", "没有直角"], 0, "正方形四边相等，四角都是直角。", 2),
  ],
  7: [
    q("identify", "条形统计图中一格表示 5 人，4 格表示多少人？", ["20 人", "9 人", "15 人"], 0, "4×5=20。"),
    q("apply", "三天借书 12、18、15 本，总数是多少？", ["45 本", "40 本", "35 本"], 0, "12+18+15=45。"),
    q("judge", "统计表中数量最大的直条通常最高。", ["正确", "错误"], 0, "同一统计图中直条高度对应数量。"),
    q("transfer", "甲数 32，乙数比甲数少 7，两数之和是多少？", ["57", "25", "39"], 0, "乙数 32-7=25，和是 32+25=57。", 2),
  ],
  8: [
    q("apply", "6+3×4 等于多少？", ["18", "36", "15"], 0, "先乘后加，6+12=18。"),
    q("apply", "(6+3)×4 等于多少？", ["36", "18", "24"], 0, "先算括号内 9，再乘 4，得到 36。"),
    q("judge", "同级运算通常从左到右计算。", ["正确", "错误"], 0, "乘除同级或加减同级时按从左到右。"),
    q("transfer", "48÷(3+5) 等于多少？", ["6", "11", "16"], 0, "先算 3+5=8，再算 48÷8=6。", 2),
  ],
  9: [
    q("apply", "每盒 12 个，5 盒一共多少个？", ["60 个", "17 个", "50 个"], 0, "12×5=60。"),
    q("apply", "小明 15 岁，弟弟比他小 6 岁，弟弟几岁？", ["9 岁", "21 岁", "6 岁"], 0, "15-6=9。"),
    q("judge", "“是它的 4 倍”通常用乘法求。", ["正确", "错误"], 0, "求一个数的几倍，用这个数乘倍数。"),
    q("transfer", "每支笔 7 元，买 6 支付 50 元，应找回多少元？", ["8 元", "42 元", "10 元"], 0, "6 支 42 元，50-42=8 元。", 2),
  ],
  10: [
    q("apply", "一辆车每时行 50 千米，3 时行多少千米？", ["150 千米", "53 千米", "100 千米"], 0, "50×3=150。"),
    q("apply", "150 千米后还剩 35 千米，全程多少千米？", ["185 千米", "115 千米", "175 千米"], 0, "150+35=185。"),
    q("judge", "多步骤问题可以先求中间量。", ["正确", "错误"], 0, "拆出中间量能让最终关系更清楚。"),
    q("transfer", "每盒 8 支，买 4 盒用去 12 支，还剩多少支？", ["20 支", "32 支", "24 支"], 0, "先求 8×4=32，再算 32-12=20。", 2),
  ],
};

const additionalBossQuestions = Object.entries(additionalBossSeeds).flatMap(
  ([stageText, seeds]) => {
    const stageNo = Number(stageText);
    const milestoneId = g4MilestoneId(stageNo);
    const nodeId = chapters.find(
      (chapter) => chapter.milestoneId === milestoneId,
    )?.nodeIds[0];
    if (!nodeId) throw new Error(`MISSING_STAGE_NODE:${stageNo}`);

    const chapterQuestions = chapters
      .filter((chapter) => chapter.milestoneId === milestoneId)
      .flatMap((chapter) =>
        chapter.steps.flatMap((step) => (step.question ? [step.question] : [])),
      );
    const seedQuestions = seeds.map((seed, index) => ({
      ...seed,
      id: `item.g4.${String(stageNo).padStart(2, "0")}.seed.${index + 1}`,
      nodeId,
    }));

    return generateBossQuestionSet({
      sourceQuestions: [...chapterQuestions, ...seedQuestions],
      seed: 20260900 + stageNo,
      questionCount: 10,
      idPrefix: `item.g4.boss.${String(stageNo).padStart(2, "0")}`,
    });
  },
);

export const milestones: Milestone[] = [
  {
    id: "math.g4.milestone.01",
    stageNo: 1,
    name: "分数裂谷",
    theme: "看懂部分与整体",
    summary: "辨认分数、比较同分子的分数，并找出等值分数。",
    nodeIds: ["math.fractions_decimals.fraction_meaning"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(1))
      .map((chapter) => chapter.id),
    bossId: "boss.math.fraction_warden",
  },
  {
    id: "math.g4.milestone.02",
    stageNo: 2,
    name: "等值回廊",
    theme: "在不同写法间穿梭",
    summary: "继续扩展分数意义与等值关系。",
    nodeIds: ["math.fractions_decimals.fraction_equivalence"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(2))
      .map((chapter) => chapter.id),
    bossId: "boss.math.equivalent_keeper",
  },
  {
    id: "math.g4.milestone.03",
    stageNo: 3,
    name: "比较高塔",
    theme: "判断分数大小",
    summary: "比较不同分子和分母的分数。",
    nodeIds: ["math.fractions_decimals.fraction_operations"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(3))
      .map((chapter) => chapter.id),
    bossId: "boss.math.compare_tower",
  },
  {
    id: "math.g4.milestone.04",
    stageNo: 4,
    name: "小数渡口",
    theme: "连接分数与小数",
    summary: "理解小数位值并完成基础互换。",
    nodeIds: ["math.fractions_decimals.decimal_meaning"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(4))
      .map((chapter) => chapter.id),
    bossId: "boss.math.decimal_ferry",
  },
  {
    id: "math.g4.milestone.05",
    stageNo: 5,
    name: "精度工坊",
    theme: "进行小数运算",
    summary: "完成小数加减并估计结果。",
    nodeIds: ["math.fractions_decimals.decimal_operations"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(5))
      .map((chapter) => chapter.id),
    bossId: "boss.math.precision_engineer",
  },
  {
    id: "math.g4.milestone.06",
    stageNo: 6,
    name: "图形测场",
    theme: "理解图形的性质",
    summary: "识别平行、垂直和常见图形关系。",
    nodeIds: ["math.geometry.shapes_relations"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(6))
      .map((chapter) => chapter.id),
    bossId: "boss.math.shape_surveyor",
  },
  {
    id: "math.g4.milestone.07",
    stageNo: 7,
    name: "数据棱镜",
    theme: "读取统计信息",
    summary: "从统计图与表格中提取信息。",
    nodeIds: ["math.data_probability.charts"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(7))
      .map((chapter) => chapter.id),
    bossId: "boss.math.data_prism",
  },
  {
    id: "math.g4.milestone.08",
    stageNo: 8,
    name: "运算中枢",
    theme: "掌握运算顺序",
    summary: "使用括号并按顺序完成混合运算。",
    nodeIds: ["math.arithmetic.mixed_operations"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(8))
      .map((chapter) => chapter.id),
    bossId: "boss.math.operation_core",
  },
  {
    id: "math.g4.milestone.09",
    stageNo: 9,
    name: "情境枢纽",
    theme: "把题意变成算式",
    summary: "提取数量关系并完成多步骤问题。",
    nodeIds: ["math.modeling.word_problem_models"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(9))
      .map((chapter) => chapter.id),
    bossId: "boss.math.context_hub",
  },
  {
    id: "math.g4.milestone.10",
    stageNo: 10,
    name: "终局演算",
    theme: "综合迁移",
    summary: "连接本世界核心能力并完成终结挑战。",
    nodeIds: ["math.modeling.multi_step_problems"],
    chapterIds: chapters
      .filter((chapter) => chapter.milestoneId === g4MilestoneId(10))
      .map((chapter) => chapter.id),
    bossId: "boss.math.final_algorithm",
  },
];

const firstBossQuestions: ContentQuestion[] = [
  {
    id: "item.fraction.boss.01",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "identify",
    prompt: "一个整体平均分成 7 份，取走 3 份。表示取走部分的分数是哪一个？",
    options: ["3/7", "7/3", "3/4"],
    answerIndex: 0,
    explanation: "分母表示平均分成 7 份，分子表示取走 3 份。",
    timeLimitSec: 20,
    damage: 1,
    visual: fractionBar(7, 3),
  },
  {
    id: "item.fraction.boss.02",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "identify",
    prompt: "图中涂色部分表示哪个分数？",
    options: ["2/3", "3/2", "1/3"],
    answerIndex: 2,
    explanation: "整体平均分成 3 份，涂色 1 份。",
    timeLimitSec: 20,
    damage: 1,
    visual: fractionBar(3, 1),
  },
  {
    id: "item.fraction.boss.03",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "judge",
    prompt: "在同样大的整体中，1/4 大于 1/9。",
    options: ["正确", "错误"],
    answerIndex: 0,
    explanation: "分子相同时，分母越小，每一份越大。",
    timeLimitSec: 20,
    damage: 1,
  },
  {
    id: "item.fraction.boss.04",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "judge",
    prompt: "1/2 和 2/4 表示同样的大小。",
    options: ["正确", "错误"],
    answerIndex: 0,
    explanation: "1/2 的分子和分母同时乘 2，得到 2/4。",
    timeLimitSec: 20,
    damage: 1,
  },
  {
    id: "item.fraction.boss.05",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "apply",
    prompt: "在 6/10、5/6、3/10 中，与 3/5 相等的分数是哪一个？",
    options: ["6/10", "5/6", "3/10"],
    answerIndex: 0,
    explanation: "3/5 的分子和分母同时乘 2，得到 6/10。",
    timeLimitSec: 30,
    damage: 2,
  },
  {
    id: "item.fraction.boss.06",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "apply",
    prompt: "一个整体平均分成 9 份，取走 4 份。对应分数是哪一个？",
    options: ["9/4", "4/9", "4/5"],
    answerIndex: 1,
    explanation: "总份数是分母 9，取走份数是分子 4。",
    timeLimitSec: 30,
    damage: 2,
  },
  {
    id: "item.fraction.boss.07",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "apply",
    prompt: "同样大的果汁，A 杯喝了 1/6，B 杯喝了 1/3。哪杯喝得更多？",
    options: ["A 杯", "B 杯", "一样多"],
    answerIndex: 1,
    explanation: "整体相同时，1/3 大于 1/6。",
    timeLimitSec: 45,
    damage: 2,
  },
  {
    id: "item.fraction.boss.08",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "transfer",
    prompt: "哪一组分数相等？",
    options: ["2/3 和 4/6", "2/3 和 3/4", "4/8 和 1/4"],
    answerIndex: 0,
    explanation: "2/3 的分子和分母同时乘 2，得到 4/6。",
    timeLimitSec: 45,
    damage: 2,
  },
  {
    id: "item.fraction.boss.09",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "transfer",
    prompt: "把 6/8 的分子和分母同时除以 2，得到哪个分数？",
    options: ["3/4", "2/4", "4/6"],
    answerIndex: 0,
    explanation: "6÷2=3，8÷2=4，所以得到 3/4。",
    timeLimitSec: 60,
    damage: 2,
  },
  {
    id: "item.fraction.boss.10",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "transfer",
    prompt: "一条长条先平均分成 4 份，再把每份平均分成 2 份，总共得到多少份？",
    options: ["6 份", "8 份", "10 份"],
    answerIndex: 1,
    explanation: "4 份中的每一份再分成 2 份，总共 4×2=8 份。",
    timeLimitSec: 60,
    damage: 2,
  },
  {
    id: "item.fraction.boss.decisive",
    nodeId: "math.fractions_decimals.fraction_meaning",
    kind: "decisive",
    prompt: "决胜题：关于 1/2 等值分数的三种说法中，正确的是哪一个？",
    options: [
      "1/2 = 4/8，因为分子分母同时乘 4",
      "1/2 = 2/3，因为分母增加了 1",
      "1/2 = 1/4，因为整体被继续细分",
    ],
    answerIndex: 0,
    explanation: "1/2 的分子和分母同时乘 4，得到 4/8，大小不变。",
    timeLimitSec: 120,
    damage: 3,
  },
];

export const bossQuestions: ContentQuestion[] = [
  ...firstBossQuestions,
  ...additionalBossQuestions,
];

export const bosses: Boss[] = [
  {
    id: "boss.math.fraction_warden",
    milestoneId: "math.g4.milestone.01",
    name: "分数守卫",
    epithet: "裂谷的守门者",
    hp: 9,
    initialDistance: 5,
    questionIds: firstBossQuestions.map((question) => question.id),
  },
  {
    id: "boss.math.equivalent_keeper",
    milestoneId: g4MilestoneId(2),
    name: "等值回廊守望者",
    epithet: "把守等价之路",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.02."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.compare_tower",
    milestoneId: g4MilestoneId(3),
    name: "比较高塔",
    epithet: "衡量大小之人",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.03."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.decimal_ferry",
    milestoneId: g4MilestoneId(4),
    name: "小数摆渡人",
    epithet: "看管十分位与百分位",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.04."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.precision_engineer",
    milestoneId: g4MilestoneId(5),
    name: "精度工程师",
    epithet: "校准每一个小数点",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.05."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.shape_surveyor",
    milestoneId: g4MilestoneId(6),
    name: "图形测绘师",
    epithet: "判定边角关系",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.06."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.data_prism",
    milestoneId: g4MilestoneId(7),
    name: "数据棱镜",
    epithet: "折射统计信息",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.07."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.operation_core",
    milestoneId: g4MilestoneId(8),
    name: "运算中枢",
    epithet: "控制运算顺序",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.08."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.context_hub",
    milestoneId: g4MilestoneId(9),
    name: "情境枢纽",
    epithet: "编织数量关系",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.09."))
      .map((question) => question.id),
  },
  {
    id: "boss.math.final_algorithm",
    milestoneId: g4MilestoneId(10),
    name: "终局演算者",
    epithet: "综合本世界的能力",
    hp: 10,
    initialDistance: 5,
    questionIds: additionalBossQuestions
      .filter((question) => question.id.startsWith("item.g4.boss.10."))
      .map((question) => question.id),
  },
];

export const firstMilestone = milestones[0];
export const firstBoss = bosses[0];

export function getMilestone(milestoneId: string) {
  return milestones.find((milestone) => milestone.id === milestoneId);
}

export function getChapter(chapterId: string) {
  return chapters.find((chapter) => chapter.id === chapterId);
}

export function getBoss(bossId: string) {
  return bosses.find((boss) => boss.id === bossId);
}

export function getNode(nodeId: string) {
  return knowledgeNodes.find((node) => node.id === nodeId);
}

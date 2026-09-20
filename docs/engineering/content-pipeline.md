# 内容生产流水线

## 1. 目标

把知识图谱、章节、题目和 Boss 从创作变成可校验、可审核、可发布的版本化内容。

## 2. 内容仓库

MVP 阶段使用 Git 管理结构化内容：

```text
content/
  knowledge-graphs/
    subject-knowledge-graphs.yaml
  chapters/
    math/
      g4/
        m01/
          chapter-01.yaml
  items/
    math/
      g4/
        m01/
          items.yaml
  bosses/
    math/
      g4/
        m01.yaml
```

后期可以把创作迁到后台，但 Git 仍是发布源或同步源。

## 3. 生产流程

1. 选择知识节点。
2. 编写掌握标准。
3. 编写章节微课。
4. 建立题族。
5. 生成或编写题目。
6. 添加解析和错因标签。
7. 教师审核。
8. CI 校验。
9. 编排年级和小关。
10. 发布内容快照。
11. 收集学生数据。
12. 修订并发布新版本。

## 4. CI 校验

### 图谱

- YAML 可解析。
- 节点 ID 唯一。
- 前置依赖存在。
- 图谱无环。
- 节点字段完整。
- 学科和领域 ID 唯一。

### 章节

- 章节引用的节点存在。
- 章节顺序无前置冲突。
- 预计时长合理。
- 章节短测覆盖目标节点。

### 题目

- 题目 ID 唯一。
- 关联节点存在。
- 答案和解析完整。
- 时间档合法。
- 难度合法。
- 来源记录完整。
- 没有重复或近似重复题。

### Boss

- Boss 引用的目标节点存在。
- 题目分布覆盖目标节点和前置节点。
- 题量符合 8 到 12 题。
- 没有连续两道 2 分钟或 5 分钟题。
- 题目版本已发布。

## 5. 题目生成

生成器接口：

```ts
type GenerateItemInput = {
  templateId: string;
  nodeIds: string[];
  difficulty: number;
  timeLimitSec: number;
  seed: string;
};

type GenerateItemOutput = {
  item: ItemPayload;
  answer: AnswerPayload;
  explanation: ExplanationPayload;
  errorTags: string[];
};
```

要求：

- 同一输入和种子生成同一题目。
- 自动执行答案校验。
- 自动执行边界条件测试。
- 生成的题目仍需进入审核队列。

## 6. 审核

审核状态：

```text
draft
  -> machine_validated
  -> teacher_review
  -> approved
  -> published
  -> retired
```

驳回原因：

- 知识点不匹配。
- 答案错误。
- 存在多解。
- 解析不足。
- 难度不符。
- 时间不合理。
- 表达不清晰。
- 版权来源不合规。
- 内容不适合目标年龄。

## 7. 发布

发布生成不可变快照：

```yaml
content_version: 12
published_at: 2026-09-18T00:00:00Z
graph_hash: ...
curriculum_hash: ...
item_set_hash: ...
```

进行中的战斗固定使用开始时的版本。

## 8. 埋点回流

每道题记录：

- 下发次数。
- 作答次数。
- 正确率。
- 平均用时。
- 超时率。
- 放弃率。
- 选项分布。
- 错误标签分布。

质量告警：

- 正确率异常高或低。
- 平均用时超出时间档。
- 单一错误选项过高。
- 用户投诉题目有问题。
- 解析展开率异常低。

## 9. 内容安全

- 使用原创内容来源台账。
- 禁止抓取商业题库。
- 禁止未经授权复制教材。
- 对开放许可内容逐项核验。
- 未成年人内容经过敏感审核。
- 所有教师和作者签署内容归属协议。


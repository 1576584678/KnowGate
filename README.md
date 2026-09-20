# KnowGate

KnowGate 是一个原创能力闯关教育产品。

中文品牌名：知关

核心定位：把每个年级的核心能力压缩成 10 个闯关里程碑，先学 3 到 5 个短章节，再通过限时问答 Boss 战验证掌握度。

## 当前阶段

产品定义和领域建模阶段，尚未进入工程实现。

## 核心决策

- 不按教材章节组织课程。
- 不复制教材、教辅、商业题库或试卷内容。
- 以原创知识图谱作为课程编排的唯一事实来源。
- 一个年级对应一个世界。
- 每个世界固定 10 个小关。
- 每个小关对应 3 到 5 个学习章节和 1 个 Boss。
- 题目、章节和 Boss 都由知识节点驱动生成或编排。

## 文档入口

- [文档总览](docs/README.md)
- [产品方案](docs/product/product-plan.md)
- [游戏设计](docs/product/game-design.md)
- [内容策略](docs/product/content-strategy.md)
- [MVP 路线图](docs/product/mvp-roadmap.md)
- [知识图谱模型](docs/domain/knowledge-graph-model.md)
- [学科知识图谱](docs/domain/subject-knowledge-graphs.yaml)
- [系统架构](docs/engineering/architecture.md)
- [数据模型](docs/engineering/data-model.md)
- [API 草案](docs/engineering/api-spec.md)

## 推荐下一步

1. 选定第一个 MVP 学科和年级。
2. 从知识图谱中裁出 30 到 50 个核心节点。
3. 将节点编排成 10 个小关。
4. 完成一个小关的课程、题库和 Boss 垂直切片。
5. 用真实学生测试通关率、失败点和学习增益。


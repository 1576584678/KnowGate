# 学科知识图谱说明

`subject-knowledge-graphs.yaml` 是产品课程编排的底层数据。

## 当前覆盖

共 11 个学科，166 个知识节点。

| 学科 | 节点数 |
|---|---:|
| 数学 | 28 |
| 语文 | 19 |
| 英语 | 14 |
| 科学 | 11 |
| 物理 | 14 |
| 化学 | 13 |
| 生物 | 15 |
| 历史 | 15 |
| 地理 | 13 |
| 道德与法治及思想政治 | 12 |
| 信息科技 | 12 |

## 字段

- `id`：全局唯一节点 ID。
- `name`：知识节点名称。
- `stage`：主要覆盖学段。
- `prerequisites`：必须先掌握的前置节点。
- `mastery`：掌握标准。
- `item_families`：必须覆盖的题型。
- `boss_theme`：适合包装成 Boss 的主题。

## ID 规则

```text
subject.domain.node
```

示例：

```text
math.arithmetic.multiplication_table
chinese.reading.inference
physics.electricity.series_parallel
```

## 编排规则

- 前置依赖必须先学。
- 节点可以跨年级，但编排到某年级世界时需要控制总量。
- 一个年级优先保留 30 到 50 个核心节点。
- 一个小关对应 3 到 8 个节点。
- Boss 题必须覆盖目标节点和必要前置节点。

## 边界

本图谱是原创能力图谱，不复制任何教材的章节、例题、插图、题目或解析。课程标准和公开资料只用于确认覆盖范围与教育顺序。

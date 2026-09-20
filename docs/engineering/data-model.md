# 数据模型

## 1. 原则

- 内容和用户行为分离。
- 发布内容不可变，修改产生新版本。
- 战斗固定题目版本。
- 知识节点 ID 是内容、题目、掌握度和补课路径的连接键。

## 2. 内容实体

### subjects

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 学科 ID |
| name | text | 学科名称 |
| status | text | draft、published、archived |
| created_at | timestamptz | 创建时间 |

### domains

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 领域 ID |
| subject_id | text | 所属学科 |
| name | text | 领域名称 |
| sort_order | integer | 排序 |

### knowledge_nodes

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 全局节点 ID |
| domain_id | text | 所属领域 |
| name | text | 节点名称 |
| stage | text | 建议学段 |
| mastery | jsonb | 掌握标准 |
| item_families | jsonb | 题型族 |
| boss_theme | text | Boss 主题 |
| status | text | 状态 |
| version | integer | 内容版本 |

### node_prerequisites

| 字段 | 类型 | 说明 |
|---|---|---|
| node_id | text | 后继节点 |
| prerequisite_node_id | text | 前置节点 |

主键使用 `node_id + prerequisite_node_id`。

### grade_worlds

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 年级世界 ID |
| subject_id | text | 学科 |
| grade | integer | 年级 |
| name | text | 世界名称 |
| version | integer | 内容版本 |

### milestones

小关和里程碑是同一实体。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 小关 ID |
| grade_world_id | text | 所属年级世界 |
| stage_no | integer | 1 到 10 |
| name | text | 小关名称 |
| boss_id | text | Boss |
| node_ids | jsonb | 目标节点 |

### chapters

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 章节 ID |
| milestone_id | text | 所属小关 |
| stage_no | integer | 章节顺序 |
| name | text | 章节名称 |
| node_ids | jsonb | 覆盖节点 |
| content | jsonb | 微课内容 |
| estimated_minutes | integer | 预计时长 |

### item_templates

参数化题模板。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 模板 ID |
| node_ids | jsonb | 关联节点 |
| type | text | 题型 |
| generator | text | 生成器名称 |
| difficulty | integer | 难度 |
| time_limit_sec | integer | 时间档 |

### items

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 题目 ID |
| node_ids | jsonb | 关联节点 |
| type | text | 题型 |
| difficulty | integer | 难度 |
| time_limit_sec | integer | 时间档 |
| payload | jsonb | 题干和交互 |
| answer | jsonb | 正确答案 |
| explanation | jsonb | 解析 |
| error_tags | jsonb | 错因标签 |
| source_id | text | 来源记录 |
| status | text | 状态 |
| version | integer | 版本 |

### bosses

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | Boss ID |
| milestone_id | text | 所属小关 |
| name | text | Boss 名称 |
| hp | integer | 血量 |
| initial_distance | integer | 初始距离 |
| rules | jsonb | 特殊规则 |

### boss_question_rules

| 字段 | 类型 | 说明 |
|---|---|---|
| boss_id | text | Boss |
| node_scope | jsonb | 目标节点和前置范围 |
| distribution | jsonb | 题型和难度分布 |
| max_questions | integer | 最大题量 |

## 3. 用户与学习

### users

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 用户 ID |
| role | text | student、parent、teacher、admin |
| display_name | text | 展示名 |
| grade | integer | 年级 |
| status | text | 状态 |

### user_node_mastery

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | uuid | 用户 |
| node_id | text | 知识节点 |
| mastery | numeric | 0 到 100 |
| confidence | numeric | 置信度 |
| last_practiced_at | timestamptz | 最近练习 |
| next_review_at | timestamptz | 下次复习 |

主键使用 `user_id + node_id`。

### user_milestone_progress

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | uuid | 用户 |
| milestone_id | text | 小关 |
| chapter_status | jsonb | 章节状态 |
| boss_status | text | locked、available、won、failed |
| stars | integer | 星级 |
| best_time_sec | integer | 最佳时间 |

## 4. 战斗

### battle_sessions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 战斗 ID |
| user_id | uuid | 用户 |
| boss_id | text | Boss |
| content_version | integer | 内容版本 |
| status | text | created、active、won、lost、abandoned |
| boss_hp | integer | 当前血量 |
| boss_distance | integer | 当前距离 |
| combo | integer | 当前连击 |
| question_count | integer | 已发题数 |
| started_at | timestamptz | 开始时间 |
| finished_at | timestamptz | 结束时间 |

### battle_questions

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 战斗题 ID |
| battle_id | uuid | 战斗 |
| item_id | text | 题目 |
| item_version | integer | 题目版本 |
| sequence | integer | 顺序 |
| served_at | timestamptz | 下发时间 |
| deadline_at | timestamptz | 截止时间 |
| status | text | served、answered、timed_out、skipped |

### battle_answers

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 答案 ID |
| battle_question_id | uuid | 战斗题 |
| answer | jsonb | 用户答案 |
| correct | boolean | 是否正确 |
| submitted_at | timestamptz | 提交时间 |
| evaluated_at | timestamptz | 裁决时间 |
| damage | integer | 造成伤害 |
| boss_advance | integer | Boss 前进 |

## 5. 内容来源

### content_sources

| 字段 | 类型 | 说明 |
|---|---|---|
| id | text | 来源 ID |
| name | text | 来源名称 |
| source_type | text | original、public_domain、cc、licensed |
| license | text | 许可证 |
| commercial_use | boolean | 是否允许商用 |
| adaptation_allowed | boolean | 是否允许改编 |
| attribution | text | 归属要求 |
| expires_at | timestamptz | 到期时间 |

## 6. 事件表

MVP 可以使用统一事件表，后续再拆分析库。

### learning_events

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | 事件 ID |
| user_id | uuid | 用户 |
| event_type | text | 事件类型 |
| entity_type | text | 实体类型 |
| entity_id | text | 实体 ID |
| payload | jsonb | 事件内容 |
| occurred_at | timestamptz | 发生时间 |
| content_version | integer | 内容版本 |

核心事件：

- chapter_started
- chapter_completed
- practice_answered
- boss_started
- boss_question_served
- boss_answer_submitted
- boss_answer_resolved
- boss_won
- boss_lost
- remediation_started
- remediation_completed


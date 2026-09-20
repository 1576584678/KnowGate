# API 草案

## 1. 约定

- 前缀：`/v1`
- 格式：JSON
- 认证：Bearer Token
- 所有写请求支持 `Idempotency-Key`
- 时间统一使用 ISO 8601 UTC
- 内容版本通过响应返回

## 2. 内容接口

### 获取学科列表

```http
GET /v1/subjects
```

### 获取年级世界

```http
GET /v1/grade-worlds/{gradeWorldId}
```

返回 10 个小关、用户进度和锁状态。

### 获取小关

```http
GET /v1/milestones/{milestoneId}
```

返回节点、章节、Boss 和学习目标。

### 获取章节

```http
GET /v1/chapters/{chapterId}
```

返回章节内容、练习和短测配置。

### 完成章节

```http
POST /v1/chapters/{chapterId}/complete
```

请求：

```json
{
  "answers": [
    {
      "itemId": "item.math.fraction.compare.0001",
      "itemVersion": 1,
      "answer": "A"
    }
  ],
  "durationSec": 320
}
```

响应：

```json
{
  "passed": true,
  "score": 85,
  "masteryDelta": {
    "math.fractions_decimals.fraction_operations": 12
  },
  "nextAction": "boss_available"
}
```

## 3. 战斗接口

### 创建战斗

```http
POST /v1/battles
```

请求：

```json
{
  "milestoneId": "math.g4.milestone.03",
  "mode": "standard"
}
```

响应：

```json
{
  "battleId": "uuid",
  "status": "active",
  "boss": {
    "id": "boss.math.fraction_warden",
    "name": "分数守卫",
    "hp": 9,
    "distance": 5
  },
  "currentQuestion": {
    "battleQuestionId": "uuid",
    "itemId": "item.math.fraction.compare.0001",
    "type": "single_choice",
    "timeLimitSec": 30,
    "deadlineAt": "2026-09-18T08:00:30Z",
    "payload": {}
  }
}
```

### 提交答案

```http
POST /v1/battles/{battleId}/answers
```

请求：

```json
{
  "battleQuestionId": "uuid",
  "answer": "A",
  "clientSubmittedAt": "2026-09-18T08:00:24Z"
}
```

响应：

```json
{
  "correct": true,
  "damage": 2,
  "bossAdvance": 0,
  "bossHp": 7,
  "bossDistance": 5,
  "combo": 1,
  "explanation": {},
  "nextQuestion": {},
  "status": "active"
}
```

### 放弃战斗

```http
POST /v1/battles/{battleId}/abandon
```

### 获取战斗状态

```http
GET /v1/battles/{battleId}
```

用于刷新和断网恢复。

## 4. 掌握度接口

### 获取节点掌握度

```http
GET /v1/users/me/mastery?subject=math&grade=4
```

响应：

```json
{
  "nodes": [
    {
      "nodeId": "math.algebra.linear_equation_one_var",
      "mastery": 76,
      "status": "developing",
      "nextReviewAt": "2026-09-21T00:00:00Z"
    }
  ]
}
```

### 获取补课路径

```http
GET /v1/users/me/remediation?nodeId=math.algebra.linear_equation_one_var
```

响应按最短前置路径返回章节和练习。

## 5. 家长报告

```http
GET /v1/reports/student/{studentId}/weekly
```

只返回：

- 学习时长。
- 完成章节。
- 已掌握节点。
- 待补节点。
- Boss 通过情况。
- 建议复习。

不做公开排名。

## 6. 内容后台

### 图谱校验

```http
POST /v1/admin/knowledge-graph/validate
```

### 发布图谱

```http
POST /v1/admin/knowledge-graph/publish
```

### 编排年级世界

```http
POST /v1/admin/curriculum/compile
```

请求：

```json
{
  "subjectId": "math",
  "grade": 4
}
```

### 题目审核

```http
POST /v1/admin/items/{itemId}/review
```

### 内容来源审核

```http
POST /v1/admin/content-sources/{sourceId}/review
```

## 7. 错误格式

```json
{
  "error": {
    "code": "BATTLE_ALREADY_FINISHED",
    "message": "The battle has already finished.",
    "requestId": "uuid"
  }
}
```

常用错误码：

- UNAUTHENTICATED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- IDEMPOTENCY_CONFLICT
- PREREQUISITE_NOT_MET
- BATTLE_NOT_ACTIVE
- BATTLE_ALREADY_FINISHED
- QUESTION_ALREADY_ANSWERED
- CONTENT_VERSION_MISMATCH


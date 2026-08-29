---
name: recommend-and-accept
display_name: 建议与接受
version: 1.0.0
intent: recommend_and_accept
description: 给出可执行建议；仅当用户明确接受/采纳后经 Gateway 提案。用户问建议、派单、接受建议、采纳时启用。
risk_level: R1
triggers: [建议, 派单, 接受建议, 采纳]
trigger_weight: 3
depends_on: [attribution-analyzer]
required_context:
  object_types: [Doctor, Hospital, SalesTarget, SalesRep]
  max_hops: 1
allowed_tools:
  - ontology.query
allowed_actions:
  - scheduleVisit
  - markAsAtRisk
  - recovery_plan_drafter
human_review_required: true
evidence_requirements:
  min_coverage: 0.4
  require_provenance: true
---

# 建议与接受

两段式：先建议（只读卡片），用户明确接受后再走 Gateway。禁止把建议当成已落库。

## 何时启用

用户要「怎么办 / 给建议 / 派单」，或回复「接受建议」「采纳」。

## 建议生成规则

对每个目标对象（优先 warning/critical、有 ID）：

| 条件 | 建议动作 | 说明 |
|------|----------|------|
| 医生/医院达成或处方异常 | scheduleVisit | 安排随访，R2，待审批 |
| status 为 warning/critical 或生命周期 at_risk | markAsAtRisk | 标记风险，R3，待审批 |
| 需要书面整改步骤 | recovery_plan_drafter | 只建草稿提案 |

动作必须在本 Skill `allowed_actions` 白名单内。

## 步骤

1. 从 pack 取目标 `object_id`；没有对象则只输出「缺少对象，无法建议」，不调 Gateway。
2. **未接受**：渲染动作卡 `status=pending` + `requires_accept=true`。文案写清对象 ID 与动作名。
3. **已接受**（问句含「接受」「采纳」「确认建议」）：对选定动作调用 `ActionGateway.submit`。无对象 ID 则 HR-001 拒绝。
4. 提交成功：卡片变为待审批（R2+）或已落库（若合同允许自动执行）。失败：卡片 `failed`，展示规则号。
5. 读工具不到审批；本 Skill 的写全部进 Gateway。

## 输出合同

```
建议
- {动作中文} → {object_id}  状态=待接受|待审批|已落库|失败
未接受时引导: 点击「接受建议」或回复「接受建议」
```

## 禁止

- 用户未接受时不得 submit。
- 不得绕过 Gateway 调 ActionExecutor。
- 不得建议培训、学术活动、上岗备案（本产品不做这些台）。

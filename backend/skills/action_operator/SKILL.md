---
name: action_operator
display_name: 动作网关
version: 1.0.0
intent: operate_action
description: 唯一默认允许调用 Action Gateway 提交写操作的 Skill。用户明确要执行、审批、提交动作时启用。
risk_level: R2
triggers: [执行, 审批, 提交动作, execute, 批准]
trigger_weight: 5
required_context:
  object_types: [Doctor, Hospital, ComplianceAlert, SalesTarget]
  max_hops: 1
allowed_tools: []
allowed_actions:
  - scheduleVisit
  - updateSentiment
  - flagComplianceRisk
  - markAsAtRisk
human_review_required: true
evidence_requirements:
  min_coverage: 0.8
  require_provenance: true
---

# 动作网关

写路径唯一入口（与 recommend-and-accept 接受后的 submit 同走 Gateway）。本 Skill 负责「用户已经决定要做这个动作」。

## 何时启用

问句是命令式：执行拜访、提交审批、标记合规、改态度。分析类问句不应落到这里。

## 槽位

| 问句线索 | action_type |
|----------|-------------|
| 拜访 / schedule | scheduleVisit |
| 合规 / compliance | flagComplianceRisk |
| 态度 / sentiment | updateSentiment |
| 流失 / at_risk | markAsAtRisk |

不在 `allowed_actions` 的动作直接 blocked。

## 步骤

1. 解析 action_type；缺省为 scheduleVisit，但仍须在白名单。
2. 绑定 object_id（slots 或 pack 首个 ID）。无 ID → Gateway HR-001，不得本地写库。
3. `ActionGateway.submit(...)`。R2+ 只创建 pending 提案；禁止 `_via_gateway=False`。
4. 审批在工作台完成：他人批准后 `approve_action` 自动 `execute_approved`。提交人 ≠ 终审人（HR-003）。
5. SSE 下发动作卡：pending / executed / failed。

## 硬规则（必须出现在上下文中，被裁则拒答）

- HR-001 无对象 ID 不得写
- HR-002 R2+ 必须人工审批
- HR-003 提交人不得自批
- HR-004 动作必须作用于合同中的本体类或其子类

## 输出合同

```
Gateway {action_type} → {object_id}
状态: pending|executed|blocked|failed
提案: {proposal_id}
规则: {HR-xxx 若有}
```

## 禁止

- 不得直接调 ActionExecutor。
- 不得执行白名单外动作（含培训、学术、上岗类）。
- 读查询不得走本 Skill。

---
name: alert-manager
display_name: 预警扫描
version: 1.0.0
intent: manage_alerts
description: 扫描 warning/critical 对象并给出待处理预警清单。用户问预警、告警、风险扫描时启用。
risk_level: R0
triggers: [预警, 告警, 风险扫描, alert]
trigger_weight: 4
depends_on: [metric_diagnosis]
required_context:
  object_types: [Doctor, Hospital, SalesTarget, ComplianceAlert]
  max_hops: 1
allowed_tools:
  - ontology.query
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.3
  require_provenance: true
---

# 预警扫描

只读。把已经处于风险状态的对象收成工作台清单，不落库、不派单（派单走 recommend-and-accept）。

## 何时启用

用户要看「现在有哪些预警 / 告警 / 风险扫描」，而不是解释某一块为什么差。

## 分级

| 级别 | 条件 |
|------|------|
| critical | status=critical，或达成率 < 60%（若 pack 中有） |
| high | status=warning，或合规风险字段非空 |
| medium | 生命周期 at_risk 但 status 仍 normal |

## 步骤

1. 扫描 pack 内对象，只保留有 ID 的条目。
2. 按上表分级；无风险对象不进清单。
3. 每条预警写：级别、名称、id、触发条件。
4. 数据卡输出清单。可建议「安排随访」但卡片 `requires_accept=true`，本 Skill 不 submit。
5. 清单为空时明确「当前 pack 无预警对象」，不要编造告警。

## 输出合同

```
预警扫描
- [critical|high|medium] {name} ({id}): {原因}
合计: n
```

## 禁止

- 不得把预警写成已执行动作。
- 不得扫描培训/学术/CSO 台账。

---
name: metric_diagnosis
display_name: 指标诊断
version: 1.0.0
intent: diagnose_metrics
description: 对达成率、处方量、流向做阈值诊断。用户在问诊断、达成、指标异常、下滑时启用。
risk_level: R0
triggers: [诊断, 达成, 指标, 异常, 下滑]
trigger_weight: 2
thresholds:
  achievement_warn: 80
  achievement_critical: 60
required_context:
  object_types: [SalesTarget, SalesFlow, Doctor, Hospital, Product]
  metrics: [achievement_rate, prescription_volume, flow_amount]
  max_hops: 2
allowed_tools:
  - ontology.query
  - decision.explain
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.6
  require_provenance: true
---

# 指标诊断

只读。用对象属性与时序观测做规则化诊断，每条发现绑定对象 ID。

## 何时启用

用户要判断「好不好 / 正不正常」，还没要求归因或下钻。例如：达成率异常、处方量下滑、指标诊断。

## 阈值（写死在本 Skill，运行时读取）

| 信号 | 预警 | 严重 |
|------|------|------|
| 达成率 | < 80% | < 60% |
| 对象 status | warning | critical |
| 时序 | 文案含「下降」 | 连续下降且绑定对象 ID |

## 步骤

1. 从 pack 取 SalesTarget / SalesFlow / Doctor / Hospital / Product，忽略无 ID 实例。
2. 读取 `achievementRate` / `achievement_rate`：低于预警写入发现，低于严重级标记为优先。
3. 读取 `prescriptionVolume`：有值则记录现状，不把「有处方量」当成异常。
4. 扫描 `timeSeriesSummary`：序列摘要含「下降」则记为趋势异常。
5. 对象 `status` 为 warning/critical 的，无论指标是否缺失都记一条。
6. 覆盖率 = 有证据的对象数 / pack 对象数。低于 `min_coverage` 时在结论末尾声明证据不足，仍列出已见对象 ID。
7. 不执行写动作。若用户同时要整改，交给 `recovery_plan_drafter` / `recommend-and-accept`。

## 输出合同

```
指标诊断
- [严重|预警|观察] {name} ({id}): {指标}={值}，判定={规则}
证据对象: id1, id2
```

按严重 > 预警 > 观察排序。没有触发阈值时写明「未触发诊断规则」并列出纳入分析的对象 ID。

## 禁止

- 不得编造未出现在 pack 里的数字。
- 不得把诊断直接变成已执行的拜访或标记流失。

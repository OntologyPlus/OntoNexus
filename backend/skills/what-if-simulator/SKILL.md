---
name: what-if-simulator
display_name: 情景推演
version: 1.0.0
intent: simulate_scenario
description: 调用情景服务做假设推演，输出预测达成与风险。用户问如果、假设、模拟、what-if、情景时启用。
risk_level: R0
triggers: [what-if, what if, 情景, 如果, 模拟, 假设]
trigger_weight: 4
required_context:
  object_types: [SalesTarget, SalesFlow, TerritoryPerformance]
  max_hops: 1
allowed_tools:
  - scenario.recalculate
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.3
  require_provenance: false
---

# 情景推演

只读计算。调用 `scenario_service.recalculate`，不改销售目标真值、不走 Gateway。

## 何时启用

用户在做假设：「如果覆盖提升」「模拟费用增加」「what-if」。不是问历史为什么差。

## 步骤

1. 列出当前情景目录；用问题中的名称/类别匹配，匹配不到则取第一条并声明「使用默认情景 {id}」。
2. 从 slots.scenario_params 或问句中的数字读取参数；没有参数则用情景默认值跑一遍基线。
3. 调用 `recalculate_scenario(scenario_id, params)`。
4. 读取 `forecastResult`：预测值、达成率、风险（on_track / at_risk / critical）。
5. 对比基线：写清「参数变化 → 预测变化」。缺基线时只报本次结果。
6. 输出数据卡，供工作台展示。风险 critical 时提示可转 `recommend-and-accept`，本 Skill 不提案。

## 输出合同

```
What-if「{情景名}」({id})
- 参数: {k=v 或 默认}
- 预测值 / 达成率 / 风险
- 相对基线: {Δ 或 无基线}
```

## 禁止

- 不得把推演结果写回 SalesTarget.actualValue。
- 不得在无情景数据时编造预测数字；应明确「没有可模拟情景」。

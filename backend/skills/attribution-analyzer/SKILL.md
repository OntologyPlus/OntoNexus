---
name: attribution-analyzer
display_name: 达成归因
version: 1.0.0
intent: attribute_performance
description: 把达成/处方变化按幅度排序归因到覆盖、拜访效果、KOL、费用 ROI、产品。用户问为什么这块达成差、归因、覆盖/KOL/ROI 时启用。
risk_level: R0
triggers: [归因, 为什么这块, 达成差, 覆盖, kol, roi, 拜访效果]
trigger_weight: 4
depends_on: [metric_diagnosis]
thresholds:
  coverage_weak: 50
  visit_effect_material: 5
  roi_weak: 1
required_context:
  object_types: [SalesTarget, SalesFlow, Doctor, Hospital, Product, VisitRecord, ExpenseROI]
  relations: [HAS_VISIT, INFLUENCES, MANAGED_BY, WORKS_AT]
  rules: [coverage, kol, roi, visit_effect]
  max_hops: 2
allowed_tools:
  - ontology.query
  - decision.explain
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.5
  require_provenance: true
---

# 达成归因

只读。把「差在哪」拆成可比较的销售信号，按贡献幅度排序。不做 CRM 录入。

## 何时启用

用户问达成差的原因，或点名覆盖、KOL、ROI、拜访效果。可与 metric_diagnosis、decision-penetrate 同时激活。

## 驱动因子（必须按此顺序采集，再按 |幅度| 排序输出）

1. **覆盖率**：已拜访医生 / 应覆盖医生。低于 50% 视为覆盖不足。
2. **拜访效果**：处方时序访前 vs 访后差值。|Δ| ≥ 5 视为有效应。
3. **KOL 影响力**：`influence_score` + `INFLUENCES` 下游人数。
4. **费用 ROI**：`roi_ratio`；低于 1 视为投入无产出。
5. **产品**：对象上的 productId / 流向产品，作为并列解释项，无则省略。

## 步骤

1. 对 pack 内每个有 ID 的对象读取 `sales_signals`（OAG 注入，不另开录入页）。
2. 为每个非空信号生成一条驱动：`因子=值，对象=id`。
3. 按 |数值| 降序排列；并列时覆盖 > 拜访效果 > KOL > ROI > 产品。
4. 主因写第一句，其余列为次因。禁止把「状态 warning」单独当成归因（那是诊断）。
5. 输出数据卡：对象、覆盖率、KOL、ROI、拜访 Δ。
6. 证据不足时列出缺哪类信号，仍保留已有对象 ID。

## 输出合同

```
达成归因
主因: {因子} {值} — {name} ({id})
次因:
- ...
建议下一步: 穿透到医院/代表，或给出可接受的动作（不在本 Skill 落库）
```

## 禁止

- 不得执行拜访、不得改目标、不得把未计算的 ROI 写成「费用浪费」。
- 不得引入培训/学术推广/CSO 操作作为原因。

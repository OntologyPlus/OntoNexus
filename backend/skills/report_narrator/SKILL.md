---
name: report_narrator
display_name: 报告叙述
version: 1.0.0
intent: narrate_report
description: 把已验证分析整理成报告草稿，并标明哪些是事实、哪些是叙述。用户问报告、汇报、综述时启用。
risk_level: R1
triggers: [报告, 汇报, 综述, narrat]
trigger_weight: 3
required_context:
  object_types: [SalesTarget, Doctor, Hospital]
  max_hops: 1
allowed_tools:
  - ontology.query
  - decision.explain
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.4
  require_provenance: false
---

# 报告叙述

只读成文。只复述 pack 里已有的对象与指标，不发明结论。

## 何时启用

用户要对外汇报材料，而不是诊断或执行。可在诊断/归因之后合并激活。

## 步骤

1. 圈定范围：pack 内对象名称 + ID 列表。没有对象则输出「无分析范围，无法成文」。
2. **事实段**：只写 pack 中出现的 status、达成率、销售信号。每句至少一枚对象 ID。
3. **叙述段**：用 3～5 句把事实串起来，段首标注「叙述（需复核）」。
4. **限制段**：写明未验证项（缺失的 ROI、未下钻的医院）。
5. 不调用 Gateway。需要动作时指向 recommend-and-accept。

## 输出合同

```
报告草稿
范围: {names} / {ids}
事实:
- ...
叙述（需复核）:
- ...
限制: ...
```

## 禁止

- 不得把叙述段的措辞当成已审计事实。
- 不得在报告里声称「已安排拜访」除非 Gateway 回执为 executed。

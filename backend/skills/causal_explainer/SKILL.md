---
name: causal_explainer
display_name: 因果解释
version: 1.0.0
intent: explain_causal
description: 把对象关系与决策因果边写成可读因果链。用户在问为什么、导致、影响链时启用。
risk_level: R0
triggers: [为什么, 因果, 导致, 影响链, cause]
trigger_weight: 3
required_context:
  object_types: [Doctor, Hospital, Product, SalesRep]
  relations: [WORKS_AT, PRESCRIBES, MANAGED_BY, INFLUENCES]
  max_hops: 3
allowed_tools:
  - ontology.query
  - decision.explain
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.5
  require_provenance: true
---

# 因果解释

只解释。把图上的边变成「A 经关系 R 作用于 B」的句子，不执行、不归因排序（排序归 attribution-analyzer）。

## 何时启用

用户要「为什么 / 谁影响谁 / 因果链」，且重点是关系路径而不是覆盖率/ROI 数字。

## 步骤

1. 以 pack 中相关度最高的对象为起点，最多 3 跳。
2. 优先关系：`INFLUENCES`（KOL）→ `MANAGED_BY`（代表覆盖）→ `WORKS_AT`（执业医院）→ `PRESCRIBES`（产品）。
3. 每条边写成：`{sourceName}({sourceId}) --{linkType}--> {targetName}({targetId})`。
4. 子图 edges 去重后并入，避免同一条边写两次。
5. 关系密度不足时明确「无法形成因果链」，列出起点对象 ID，不要用散文补因果。
6. 数字变化（达成差、拜访后处方）只点到「见归因 Skill」，本 Skill 不计算 ROI。

## 输出合同

```
因果链
- {A}({id}) --{REL}--> {B}({id})
路径含义: {一句话，必须能从边类型读出}
```

## 禁止

- 不得把相关当成因果（没有边就不要写「导致」）。
- 不得输出无 ID 节点。

---
name: ontology_lookup
display_name: 对象检索
version: 1.0.0
intent: lookup_ontology
description: 按名称/类型从本体取出对象、关系、可用动作。用户在问「是谁、哪家医院、什么关系、查对象」时启用。
risk_level: R0
triggers: [是谁, 对象, 关系, 查找, 哪些医生, 医院, 查一下]
trigger_weight: 1
required_context:
  object_types: [Doctor, Hospital, Product, SalesRep, SalesTarget]
  relations: [WORKS_AT, MANAGED_BY, PRESCRIBES, INFLUENCES]
  max_hops: 2
allowed_tools:
  - ontology.query
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.5
  require_provenance: false
---

# 对象检索

只读。从 Ontology 取出结构化事实，不改世界状态，不走 Action Gateway。

## 何时启用

用户在定位人或机构，而不是问「为什么差」或「帮我执行」。例如：张主任是谁、哪些医生、某医院有什么关系。

## 步骤

1. 用问题里的专名（医生/医院/产品/代表）在 OAG pack 里匹配对象；命中名称优先于类型兜底。
2. 列出每个命中对象：`名称`、`objectType`、`id`、`status`、生命周期。缺 `id` 的条目丢弃。
3. 展开 1～2 跳关系：`WORKS_AT` / `MANAGED_BY` / `PRESCRIBES` / `INFLUENCES`。每条关系写清 `linkType → targetName (targetId)`。
4. 附上该对象当前可提案动作名称（只展示，不执行）。
5. 若 pack 为空：明确说「未匹配到对象」，不要编造人名或医院。

## 输出合同

```
对象检索
- {name} ({objectType}) id={id} 状态={status}
  [LINK] → {target} ({targetId})
```

每条结论必须带对象 ID。相关度低的实例排后面。

## 禁止

- 不得调用 Gateway、不得改属性、不得把猜测写成事实。
- 不得输出无 ID 的「某三甲医院」「某主任」。

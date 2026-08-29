---
name: decision-penetrate
display_name: 指标穿透
version: 1.0.0
intent: penetrate_metric
description: 从指标下钻到医院、医生、代表。用户问穿透、下钻、分解到医院/医生/代表时启用。
risk_level: R0
triggers: [穿透, 下钻, 分解到, 医院/医生, 到代表]
trigger_weight: 4
depends_on: [metric_diagnosis]
required_context:
  object_types: [SalesTarget, Hospital, Doctor, SalesRep, TerritoryPerformance]
  relations: [CONTAINS, WORKS_AT, MANAGED_BY]
  max_hops: 2
allowed_tools:
  - ontology.query
allowed_actions: []
human_review_required: false
evidence_requirements:
  min_coverage: 0.4
  require_provenance: true
---

# 指标穿透

只读下钻。把汇总指标拆到可问责的医院 / 医生 / 代表节点。

## 何时启用

用户已经知道「这块差」，要知道「差在哪个医院、哪位医生、哪位代表」。可与归因同时激活。

## 下钻路径（按边类型，禁止跳层编造）

```
SalesTarget / TerritoryPerformance
  --CONTAINS--> Hospital / Territory
Hospital --(逆 WORKS_AT / CONTAINS_MEMBER)--> Doctor
Doctor --MANAGED_BY--> SalesRep
```

## 步骤

1. 以 pack 中指标对象（SalesTarget / TerritoryPerformance）为根；没有则用当前相关度最高对象。
2. 只保留 targetType ∈ {Hospital, Doctor, SalesRep, Territory} 的边。
3. 分层输出：L1 医院/区域 → L2 医生 → L3 代表。每一层必须带 id。
4. 若某层没有边，写「{层} 无下钻边」，不要用同名猜测补节点。
5. 数据卡列出沿途对象的 status 与销售信号（若有）。

## 输出合同

```
指标穿透 根={name}({id})
L1 医院/区域
- ...
L2 医生
- ...
L3 代表
- ...
```

## 禁止

- 不得把无关医生塞进路径。
- 不得在本 Skill 提交拜访或标记流失。

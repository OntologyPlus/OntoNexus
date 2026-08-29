---
name: recovery_plan_drafter
display_name: 整改草稿
version: 1.0.0
intent: draft_recovery
description: 只创建整改计划草稿/提案，不直接改对象状态。用户问整改、挽回、流失、recovery 时启用。
risk_level: R1
triggers: [整改, 挽回, recovery, 流失]
trigger_weight: 3
depends_on: [metric_diagnosis]
required_context:
  object_types: [Doctor, RecoveryPlan, SalesRep]
  max_hops: 2
allowed_tools:
  - ontology.query
allowed_actions:
  - recovery_plan_drafter
human_review_required: true
plan_steps:
  - 核实现状指标（达成率/处方量，引用对象 ID）
  - 核对覆盖与最近拜访效果（分析信号，不录入拜访）
  - 明确责任代表（MANAGED_BY → SalesRep id，没有则写「代表未知」）
  - 建议随访或风险标记（草稿条目，真正执行走 Gateway）
  - 复盘检查点：审批通过后才能落库
evidence_requirements:
  min_coverage: 0.6
  require_provenance: true
---

# 整改草稿

只提案。草稿必须绑对象 ID，经 Action Gateway 进入待审批，不直接改生命周期或达成数字。

## 何时启用

用户要「出整改 / 挽回流失」，而不是立刻执行拜访。执行类问句应命中 action_operator。

## 草稿必须包含的步骤（按序，可按对象信号增删，不可删掉核验）

1. 核实现状指标（达成率/处方量，引用对象 ID）
2. 核对覆盖与最近拜访效果（分析信号，不录入拜访）
3. 明确责任代表（MANAGED_BY → SalesRep id，没有则写「代表未知」）
4. 建议随访或风险标记（仍只是草稿条目，真正执行交给 Gateway 白名单动作）
5. 复盘检查点：审批通过后才能落库

## 步骤

1. 选定 target_id：slots.object_id 或 pack 中相关度最高且 status 异常的对象。
2. 无 target_id：拒绝提案，返回「HR-001 无对象，不能创建整改」。
3. `ActionGateway.submit(action_type=recovery_plan_drafter, object_id=target, params=草稿)`。
4. 默认 pending。SoD：提交人不能自批。
5. 输出提案号与草稿步骤，供审批人阅读。

## 输出合同

```
整改草稿 → {target_id}
提案: {proposal_id} 状态={pending|blocked}
步骤:
1. ...
```

## 禁止

- 不得把草稿写成「已执行」。
- 不得在草稿里要求培训备案或学术推广流程。

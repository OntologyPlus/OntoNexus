# OntoNexus 架构说明

OntoNexus 是**医药销售 AI 决策中枢**：感知 → 推理 → 规划 → 执行。不承担业务录入，事实由 ERP/CRM 提供。改变世界状态的写操作经 Action Gateway（硬规则、职责分离、审批后落库）。

## 分层

```
routers → ai/orchestrator (DecisionAgent) → skills → semantic / decision / actions.gateway → services → SQLite SoT
```

单一 DecisionAgent；由 Skills 切换上下文。关系图是只读投影。改变世界状态的写操作一律走 Action Gateway。

## Supervisor 编排

对话请求经过七步 Supervisor 流水线：

1. 护栏（Guardrails）
2. 缓存（Cache）
3. 意图识别（Intent）
4. 槽位填充（Slot fill）
5. Agent + Skill 选择（1～3 个 Skill；合并 activated 对象/规则）
6. 反思 / 幻觉检查
7. 持久化（DecisionRecord）

SSE 流包含 `routing`，并在适用时附带 `actions` / `data_card`。分析类 Skill 只下发数据卡；写动作卡来自具备写能力的 Skill（如 `action_operator`、recommend-and-accept）。前端卡片展示已执行 / 待审批 / 失败。审批动作会调用 `execute_approved`，用户无需再点一次执行。

## 本体

`backend/semantic/ontology.py` 将 `ontology_definition.py` 中的定义索引为类、数据类型属性、对象属性，以及小型子类格（概念 `interfaces`，加上显式父类如 Doctor ⊂ HCP）。`validate_object` / `validate_link` 在 CRUD 与 Gateway 写路径上执行。节点形状（SHACL 式结构契约）由 `semantic/shapes.py` 生成。

快照校验、冲突策略、时态边过滤（`as_of`）均为一等能力。系统不依赖外部本体运行时包。

## Logic

`backend/semantic/logic.py` 物化子类事实（`Doctor` → `HCP`）、`AtRisk` / `NeedsFollowUp`，以及传递的 `INFLUENCES`。推导事实保留在工作内存中，不回写 SQLite。

## Action（绑定本体的契约）

写动作声明 `applies_to` 类。Gateway HR-004 会拒绝例如在 `Product` 上执行 `scheduleVisit`。每个 OAG 实例带有 `eligible_actions` 戳记。提案在审批前须通过硬规则与职责分离检查。

## 本体 → Logic → Action → Skills

`semantic.pipeline.activate` 是 Supervisor 入口。OAG pack 携带 schema、shapes、推导事实、logic trace，以及类合法动作。Skills 只能提出能通过该链路的写操作。

Skills 可声明 `depends_on`（递归解析，最大深度 5）。L3 `references/` 仅在 Skill 真正执行时加载。决策类 Skill 覆盖归因、What-if、穿透、建议与预警；销售信号（覆盖率、KOL 影响力、ROI、拜访后效果）注入分析上下文。

## OAG pack

硬规则保留专用 token 窗口（被裁则拒答）。实例按与查询及已激活 Skill 对象类型的相关度打分，再裁剪到预算内。Schema（允许的类/关系）与实例一并注入。图边按 `as_of` 过滤（默认：当前时刻）；可选 `lookback_days` 裁剪观测。

## 学习闭环

被接受或审批通过的动作写入 **pending** 状态的 `SkillOutcome`，`evaluate_after = now+24h`。后续评估轮次按拜访效果 / 覆盖率 / ROI 打分，再调整 Skill 路由权重（`apply_feedback`：<0.3 降权，>0.7 升权）。DecisionRecord 元数据保存精简的 `reasoning_trace`。

## CRM/ERP 映射

`POST /api/ingest/sync` 将带类型的记录 upsert 到 `OntologyObject` + 领域行 + `ObjectLink`，并记住 `(source_system, external_id) → object_id`。非法类 / 缺必填属性 / 非法 domain-range 链接按记录拒绝（savepoint 隔离）。不做 NER，也不编造身份。

## 设计边界

OntoNexus 是决策中枢，不是培训台、学术活动控制台、入职工具、报销套件，也不是电商/广告平台。完整 OWL/SPARQL、湖仓连接器、自动实体抽取均不在范围内。
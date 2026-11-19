# OntoNexus 项目整体优化方案（上线前工程化路线图）

---

## 0. 一句话结论

OntoNexus 的**设计骨架是好的**：本体即契约、单一写入口（Gateway）、硬规则不可裁、确定性 Skill 优先、审计哈希链。问题不在方向，而在**实现没有完全兑现设计**：

1. 设计文档宣称的「安全边界」在代码里有旁路（默认密钥、部分端点匿名可访问）。
2. 工程基线缺失（无 CI、无容器化、迁移体系双轨；测试目录此前不存在）。
3. 前端把一整套「推理/规划/感知」引擎在 TS 里又写了一遍，与后端职责重叠，且体量失控。
4. 文档与代码已开始漂移。

演示期已经**收掉了其中最影响可信度的两条**：第二条 Agent 写路径已移除、`/api/oag*` 已强制登录（见 §1.3）。其余按 **P0 安全与基线 → P1 架构收敛 → P2 性能与可观测 → P3 前端与产品化** 推进，并新增 **§1.4 演示期遗留项**（演示后必须清理）。上述都是工程层面的优化；**功能层面**（感知、推理、规划、执行各环节的业务深度）见 **§9 功能路线图**。

---

## 1. 现状评估

### 1.0 状态图例

| 标记 | 含义 |
|---|---|
| ✅ 已完成 | 演示期已落地（本地需运行确认的会注明） |
| 🔶 部分完成 | 已收口一部分，仍有残留 |
| ⏳ 待办 | 按本文阶段推进 |
| ❓ 待核实 | 未读到相关源码 |

### 1.1 做得好的地方（保持）

| 项 | 说明 |
|---|---|
| 分层清晰 | routers → orchestrator → skills → semantic/decision/gateway → services |
| 写边界 | HR-001~004 + SoD + 契约 R0–R4，审批后自动执行 |
| 可离线 | 主编排不依赖 LLM，LLM 可选 |
| 审计 | SHA-256 哈希链 + `verify-chain` |
| 摄入隔离 | `ingest/sync` 每条 SAVEPOINT，非法记录单条拒绝 |
| 前端基础 | 路由级 `lazy` 分包、TanStack Query、图计算走 Web Worker |

### 1.2 问题清单（按严重度，含当前状态）

| # | 问题 | 证据 | 严重度 | 状态 |
|---|---|---|---|---|
| S1 | **默认 JWT 密钥硬编码回退** | `auth.py:13`：`os.environ.get("SECRET_KEY", "ontonexus-dev-secret-key")`；未设置环境变量时服务照常启动，任何人可伪造 token（含 admin） | 🔴 严重 | ⏳ 演示可忽略，**对外前必改**（演示机请至少设置 `SECRET_KEY`） |
| S2 | **大量端点匿名可访问** | 只用 `get_current_user`（未登录返回 `None`，不拒绝）或无鉴权的路由：`memory`、`reasoning`、`scenarios`、`events`、`ontology_definition` 等；`identity_from_user(None)` 会生成 `id="system"` 身份 | 🔴 严重 | 🔶 `agent`、`/api/oag*`、新增的 `oag_compare`、`cio` 已强制登录；其余路由 ⏳（需逐个核实） |
| S3 | **开放注册** | `POST /api/auth/register` 无任何限制，任何人可自助创建账号。**已核实**：客户端不能传 `role`，`User.role` 默认 `"user"`，所以不是直接提权，但仍是无限制开户入口 | 🟡 中（由 🔴 下调） | ⏳ |
| S4 | **WebSocket 回声与广播面** | `ws.py` 对任意客户端消息原样 `echo`；`periodic_risk_scan` 向**所有**连接广播，不分角色/数据范围。**已核实**：连接时会校验 token 且要求 `sub == user_id`，不是未鉴权 | 🟠 高 | ⏳ |
| S5 | **CORS 默认值过宽** | `allow_credentials=True` + 默认放行含 `0.0.0.0:5173`、`tauri://` 及多个 localhost 端口；生产未显式设置 `ALLOWED_ORIGINS` 时沿用开发默认。演示期又加入了 `localhost:4173`、`127.0.0.1:4173`（vite preview） | 🟠 高 | ⏳（演示期反而多放行了两个来源，见 §1.4） |
| S6 | **Token 7 天有效，无刷新/吊销** | `ACCESS_TOKEN_EXPIRE_MINUTES = 60*24*7`；无 refresh、无黑名单；Token 经 WS query string 传递（会进访问日志） | 🟠 高 | ⏳ 演示阶段明确不做 |
| A1 | **存在第二条 Agent 路径，绕开 Gateway** | 旧 `agents/cognitive_graph.py`（LangGraph）直接构造执行器并自建 session | 🟠 高 | ✅ 已解决：旧文件替换为抛 `ImportError` 的占位；新 `agents/war_room.py` 的所有写入只经 `ActionGateway.submit`；`tests/test_architecture_guard.py` 守护（见 §1.3） |
| A2 | **三套并行的「推理」实现** | 后端 `reasoning_service`（53KB）+ `semantic/logic`；前端 `src/inference/*`（12 个引擎，约 17 万字节）；旧 Agent 里的 `_execute_*_reasoning` | 🟠 高 | 🔶 旧 Agent 里那一套已随 A1 移除；前后端两套仍在 ⏳ |
| A3 | **两套 OAG 入口** | `/api/chat/stream`（Supervisor 七步，带硬规则拒答）与 `/api/oag*`（`oag_service`，请求体是裸 `dict`、无 schema）并存 | 🟠 高 | 🔶 `/api/oag*` 已强制登录；仍是两套入口、仍是裸 `dict` ⏳。演示期新增的作战室与对比页复用 `build_context_pack`，没有再增加第三套上下文构建逻辑 |
| A4 | **Schema 管理双轨** | 同时存在 Alembic（仅一个 33KB 的 `initial` 迁移）与 `Base.metadata.create_all` + `_migrate_schema` + `_add_column_if_not_exists`（`except Exception: pass` 吞错）+ `_ensure_execution_logs_table` | 🟠 高 | ⏳ 演示期不动 |
| A5 | **启动即 seed** | `lifespan` 每次启动调用 `seed_database()`。演示期又在其中追加了 `_ensure_demo_story`（周教授故事线、历史评分），每次启动幂等执行 | 🟡 中 | ⏳ 演示期**有意保留**；上线前必须改成 CLI/仅 dev |
| A6 | **后台任务在进程内、无互斥** | `periodic_risk_scan` / `periodic_learning_eval` 用 `asyncio.create_task`；多 worker 会重复执行（学习评估重复调权 = 业务错误） | 🟡 中 | ⏳ 演示为单进程，不触发 |
| Q1 | **`pytest.ini` 指向 `tests/`，但目录不存在** | 此前 `backend/tests/` 不存在；前端 `vite.config.ts` 引用 `./src/__tests__/setup.ts` 同样未见 | 🟠 高 | 🔶 后端已建 `tests/`：纯逻辑 14 条 + 架构守护 3 条，共 17 条（沙箱已通过，**你本地需再跑一次**）；Gateway/SoD/审计链/鉴权遍历等仍 ⏳；前端 ⏳ |
| Q2 | **无 CI / 无容器** | 仓库根无 `.github/workflows`；仅 `frontend/build-all-platforms.yml`（Tauri 打包，且重复两份） | 🟡 中 | ⏳ 演示阶段明确不做 |
| Q3 | **运行产物进仓风险** | `.gitignore` 目前只有 `node_modules/ dist/ .env .env.* data/ test-results/ *.log .DS_Store .work .npm-cache .claude .gitnexus/`。**缺** `venv/`、`.venv/`、`*.db`、`*.db-shm`、`*.db-wal`、`__pycache__/`、`.vscode/`（需用 `git ls-files` 确认是否已被跟踪）。`data/` 已忽略，所以演示期的录制回放目录 `backend/data/replays/` 默认不入库 | 🟡 中 | ⏳（改一行就能做，建议顺手补） |
| D1 | **依赖不合理** | `datasets~=2.12.0`、`text2vec~=1.3.8`（拉入 torch/transformers，体积数 GB）仅为 embedding；`pytest` 混在运行时依赖；`simplejson~=3.3.0`；`langgraph-sdk` 等子包显式钉死；`numpy~=1.26` | 🟡 中 | ⏳ |
| D2 | **LLM 层重复与默认值不一致** | 原 `llm.py` 三个函数各自拼装消息；`LLM_TEMPERATURE` 代码默认 `0.7` 而 `.env.example` 为 `0.1`；`chat_with_llm` 把历史都当 `HumanMessage`；异常静默返回 `None` | 🟡 中 | 🔶 `llm.py` 已增加 `get_llm_for(role)`（main/fast 双角色）、超时与有限重试、`llm_info()`，旧函数保持兼容；消息角色丢失、`None` 静默返回仍在旧函数里 ⏳ |
| D3 | **数据库层** | `on_connect` 事件在模块导入时绑定 `_get_engine()`；`SessionLocal` 每次重建工厂；`pool_size/max_overflow` 对 SQLite 无意义，易 `database is locked` | 🟡 中 | ⏳ |
| D4 | **缓存实现重复** | `orchestrator` 内自带 LRU（256 条/60s）、`pipeline.activate` 30s 缓存、`cache_service.OntologyCache`（300s，含手写 SQL 建表）。三处策略各异、失效互不联动 | 🟡 中 | ⏳ `activate` 缓存键是否含角色仍待核实 |
| F1 | **前端体量与职责失衡** | 单文件：`InferenceRulesPanel.tsx` 69KB、`ScenarioSim.tsx` 56KB、`OntologyGraph.tsx` 53KB、`InsightEngine.tsx` 45KB；`agent/ inference/ perception/ planning/ decision/ ontology/` 共约 35 个引擎文件 | 🟠 高 | ⏳ 演示期新增的 `AgentRoom.tsx`、`OagCompare.tsx`、`CioPage.tsx` 均为单文件，**符合 < 600 行目标** |
| F2 | **死代码/占位** | `DecisionOverview.tsx` 仅 39 字节；`resolveTab` 保留旧 tab 别名；`copy.ts` 与组件内硬编码文案并存；`AgentStatusPanel.tsx` 与 `client.ts` 中的 `invokeAgent` 已无调用 | 🟢 低 | ⏳ |
| F3 | **构建/环境** | `.env.production` 写死 `VITE_API_URL=http://localhost:8000`；开发代理 `host: '0.0.0.0'`；`build` 无 `lint`/`test` 门禁；`vite@8`、`eslint@10`、`vitest@4` 等大版本需确认生态兼容 | 🟡 中 | ⏳ |
| X1 | **文档漂移** | ARCHITECTURE.md 写「单一 DecisionAgent」，代码曾另有 LangGraph Agent；DESIGN.md 称 `backend/tests/` 覆盖多主题，此前不存在 | 🟡 中 | 🔶 A1 已解决后 ARCHITECTURE.md 需改写 Agent 小节；DESIGN.md §9 需按真实测试清单更新 ⏳ |

### 1.3 演示期已落地的改动（相对 v1 的变化）

| 类别 | 改动 | 对应问题 |
|---|---|---|
| 单一写入口 | 新 `agents/war_room.py`：感知（确定性评分）→ 推理（LLM 流式）→ 规划（LLM 出 JSON，`normalize_steps` 校验）→ 执行（只调 `ActionGateway.submit`）→ 反思；`/api/agent/run/stream` 统一入口，`/invoke`、`/invoke/stream` 为兼容别名 | A1 |
| 单一写入口 | 旧 `cognitive_graph.py` 替换为抛 `ImportError` 的占位；`tests/test_architecture_guard.py` 扫描 `agents/`、`routers/agent.py`、`routers/oag_compare.py`，禁止出现 `ActionExecutor`、`execute_object_action`、`ActionProposal(`、`db.add(`、`.execute_approved(` | A1、P1-1 的雏形 |
| 网关扩展 | `ActionGateway.submit(..., reasoning=...)` 可选参数：把推理结论、置信度、证据写进提案，供审批人查看；不影响规则判定 | — |
| 鉴权 | `/api/oag`、`/api/oag/stream`、`/api/oag/analyze/{id}` 改为 `Depends(require_auth)`；新增接口一律强制登录 | S2（部分） |
| OAG 上下文 | `_find_relevant_objects` 重写：先按问题里出现的对象名/≥3 字符重叠做实体链接，再按类型提示（医生/医院/产品等）+ 高风险优先，最后才兜底；原先「找不到就取前 10 个对象」的行为已去掉 | A3 周边质量 |
| LLM | `llm.py` 增加 `get_llm_for(role)`（main 流式 / fast 规划与反思）、超时、有限重试、`llm_info()`；旧函数保持兼容 | D2（部分） |
| 降级与稳定 | 感知评分、兜底推理、兜底规划、兜底反思均为确定性逻辑，LLM 离线/超时自动降级并在事件里带 `degraded`；真实运行可录制/回放（`backend/data/replays/<key>.json`，仅 admin 可录制） | 对应 §8 风险 |
| 数字可追溯 | `ground_numbers`：LLM 输出的数字必须能在上下文里找到（识别千分位），否则在界面上标注；`cited_objects` 统计引用了哪些企业对象 | P2-4 的雏形 |
| 新接口 | `POST /api/oag/compare/stream`（同一问题：普通 LLM vs OAG，并排流式）；`GET /api/cio/overview`（审计链校验、硬规则、动作契约、提案统计、LLM 状态）；`POST /api/agent/sod-demo`（演示职责分离） | — |
| 演示数据 | `seed.py` 增加 `_ensure_demo_story`（隐性风险医生周教授 + 3 条历史已评分效果）；`scripts/reset_demo.py` 一键重置（仅 `ENV` 为 `dev`/`demo` 时允许） | A5 加重，见 §1.4 |
| 前端 | 新增 `api/warRoom.ts`、`AgentRoom.tsx`（AI 作战室）、`OagCompare.tsx`、`CioPage.tsx`；`Layout.tsx` 增加三处导航入口与「演示：切换身份」；`App.tsx` 增加路由 | F1 体量符合目标 |
| 测试 | `backend/tests/`：14 条纯逻辑 + 3 条架构守护，共 17 条 | Q1（部分） |

> **验证口径**：以上后端代码在沙箱中只做了 `py_compile` 和纯逻辑 pytest；前端只做了 TypeScript 语法转译，**没有真正启动过服务，也没有运行 `tsc --noEmit`**。涉及数据库、网关、SQLAlchemy 排序表达式和大模型 JSON 稳定性的部分，必须在你本地启动后验证。

### 1.4 演示期遗留项（演示之后、对外之前必须清理）

这些是为了让演示更顺而**有意留下**的技术债，不应带进任何对外环境：

| # | 遗留项 | 位置 | 处理 |
|---|---|---|---|
| L1 | 演示账号（`admin`/`wang`/`manager`，密码 `123456`）与前端「演示：切换身份」按钮（硬编码密码） | `seed.py`、`Layout.tsx` | 前端设 `VITE_DEMO_ACCOUNTS=off` 可关闭入口；上线前删除种子账号或改为随机密码并移除切换按钮 |
| L2 | 每次启动自动 seed + 演示故事线 | `main.py` 的 `lifespan`、`seed._ensure_demo_story` | 改为 CLI；仅 `ENV=dev` 且库为空时自动执行（即 P1-4 的一部分） |
| L3 | `POST /api/agent/sod-demo` 会在真实库里写一条提案和一条拦截审计 | `agents/war_room.py: sod_demo`、`routers/agent.py` | 用配置开关（如 `ENABLE_DEMO_ENDPOINTS`）包住，默认关闭 |
| L4 | Agent 提交人是固定字符串 `ai_agent`，不是真实的服务账号 | `agents/war_room_logic.py: AGENT_USER_ID` | 改成数据库里的服务账号，权限与审计可按账号配置 |
| L5 | 前端对 SSE 事件使用 `any` 类型 | `api/warRoom.ts`、`AgentRoom.tsx`、`OagCompare.tsx` | 定义判别联合类型，并与后端共用一份 JSON Schema（即 P3-4） |
| L6 | `/api/cio/overview` 对所有已登录用户开放 | `routers/cio.py` | 限制为 admin/CIO 角色；`HARD_RULES` 文案是手写的，应改为从 `actions/hard_rules.py` 派生，避免规则改了页面不变 |
| L7 | CORS 默认来源多放行了 `4173` 两个端口 | `main.py` | 与 S5 一起收窄，生产必须显式设置 `ALLOWED_ORIGINS` |
| L8 | 对比页的「演示安全拒答」靠人为压缩上下文预算触发（页面已明确标注） | `routers/oag_compare.py`（`simulate_budget_squeeze`） | 保留但仅在 demo 环境开放；同时按 P2-4 给硬规则窗口加 10% 余量，让真实场景下也不会误拒或漏拒 |
| L9 | 对比页同时起两个线程调用大模型，没有并发与费用限制 | `routers/oag_compare.py` | 加全局并发上限与每用户限流（并入 P2-3） |
| L10 | `.env.example` 新增了 `ENV=demo` 等演示项 | `backend/.env.example` | 区分 `.env.example`（最小）与 `.env.demo.example` |

---

## 2. 目标状态

```
                    ┌────────────── 统一鉴权中间层（JWT + 角色 + 数据范围）──────────────┐
前端（展示 + 交互）  │                                                                    │
  只做：渲染/交互/    │  /api/chat/stream（唯一对话入口）                                   │
  轻量本地计算        │      Supervisor 七步 → Skills → Gateway（唯一写入口）               │
        │            │  /api/oag/* → 内部别名，复用同一管线                               │
        ▼            │  /api/agent/* → 以 Skill 形式并入，或下线                          │
   HTTP/SSE/WS ─────►│                                                                    │
                     │  reasoning_service ＝ 唯一推理实现（前端不再复制）                 │
                     └──────────────┬─────────────────────────────────────────────────────┘
                                    ▼
              Alembic 唯一迁移 ── 数据库（开发 SQLite / 生产 Postgres）
                                    ▲
              独立 worker（学习评估、风险扫描，单实例/带锁）
```

**成功标准（可度量）**

| 维度 | 指标 |
|---|---|
| 安全 | 除 `/health`、`/api/auth/login` 外**零匿名端点**；启动时无 `SECRET_KEY` 则拒绝启动 |
| 质量 | 后端核心路径（Gateway/SoD/pipeline/learning/ingest/audit）测试覆盖 ≥ 70%；CI 必过 |
| 一致性 | 「写世界状态」调用点 100% 经 Gateway（有静态检查/测试守护） |
| 性能 | 对话首 token（确定性路径）P95 < 800ms；`activate` 缓存命中率可观测 |
| 前端 | 单文件 < 600 行；首屏 JS gzip < 250KB（用现有 `analyze` 脚本度量） |

---

## 3. 分阶段方案

### P0：安全与工程基线（建议 1～2 周，优先级最高）

> 演示阶段明确**不做** CI、容器化、令牌体系；本阶段是「对外/生产之前」的前置门槛。已落地部分见 §1.3，下面每条标注当前进度。

**P0-1 鉴权收口**（🔶 部分完成：`agent`、`/api/oag*`、`oag_compare`、`cio` 已强制登录）
- `auth.py`：去掉 `SECRET_KEY` 默认值；启动时检查，缺失或等于 `.env.example` 占位值则 `raise RuntimeError`（开发可用 `ENV=dev` 显式放行）。
- 新增全局依赖：默认所有 `/api/*` 路由 `Depends(require_auth)`，仅白名单（`/health`、`/api/auth/login`）豁免。做法：`app.include_router(..., dependencies=[Depends(require_auth)])`，再对公开路由单独挂载。
- 清理所有 `get_current_user` 的「可选」用法（`agent`、`memory`、`reasoning`、`scenarios`、`events`、`oag*`、`inference`、`notifications`、`reminders`、`ontology`），改为 `require_auth`；`identity_from_user(None)` 的 `"system"` 回退仅保留给后台任务，不再用于请求路径。
- `ontology_definition`、`scenarios`、`reasoning`、`memory` 的写类端点补 `require_roles`。
- **验收**：新增一个遍历 `app.routes` 的测试，断言除白名单外每个路由都带鉴权依赖。
- **注意**：`identity_from_user(None)` 的 `"system"` 回退与 Agent 提交人 `ai_agent`（L4）要一起梳理，服务账号应是真实账号，不能靠未登录回退。

**P0-2 注册与令牌**（⏳ 演示阶段明确不做）
- `register` 改为 admin 邀请制或配置开关 `ALLOW_SELF_REGISTER=false`（默认关）。（已核实：当前客户端本就不能传 role，新用户默认角色为 `user`，这一条主要是防止无限制开户。）
- 令牌：access 15–60 分钟 + refresh；加 `jti` 与简单吊销表（SQLite 即可）；WS 改为首帧鉴权或短期一次性 ticket，避免 token 出现在 URL。

**P0-3 WebSocket**（⏳）
- 删除 `echo`；广播按 `role / 数据范围` 过滤；设置最大连接数与心跳超时。

**P0-4 CORS 与部署配置**（⏳，同时回收 L7）
- `ALLOWED_ORIGINS` 生产必填；默认值只保留 `localhost:5173`；`allow_methods/headers` 收窄。
- `frontend/.env.production` 改为相对路径 `/api`（由反向代理转发）。

**P0-5 工程基线**（🔶 后端 `tests/` 已建；其余 ⏳）
- 继续补 `backend/tests/`（已有 17 条，见 §4），补前端 `src/__tests__/setup.ts`。
- `.gitignore` 现状见 Q3，增加：`venv/`、`.venv/`、`__pycache__/`、`*.db`、`*.db-shm`、`*.db-wal`、`.vscode/`（如无共享需求）；`git rm --cached` 清理已跟踪产物。这一条成本最低，建议不等其它 P0 项，现在就做。
- 新增 `.github/workflows/ci.yml`：后端 `ruff` + `pytest`；前端 `tsc --noEmit` + `eslint` + `vitest` + `vite build`；`frontend/build-all-platforms.yml` 移到 `.github/workflows/` 并删除 `src/interaction/` 下的重复副本。
- 新增 `backend/Dockerfile`、`frontend/Dockerfile`、`docker-compose.yml`（含 volume 持久化 db）。

> 这一阶段不改业务逻辑，风险低、收益最大。

---

### P1：架构收敛（建议 2～4 周）

**P1-1 统一写入口，并用测试守护**（🔶 Agent 层已完成，其余待扩展）
- ✅ 旧 `cognitive_graph` 的直接写路径已移除；`tests/test_architecture_guard.py` 目前只守护 `agents/`、`routers/agent.py`、`routers/oag_compare.py`，用的是简单的子串扫描。
- ⏳ 扩展到 `services/`、全部 `routers/`：扫描对领域表的 `db.add / db.merge / update` 与 `ActionExecutor` 直接调用，白名单之外报错；子串扫描升级为 AST，减少误报与漏报。

**P1-2 合并对话入口**（🔶 `/api/oag*` 已强制登录，仍待合并）
- `/api/oag*` 为裸 `dict` 请求：改成 `ChatRequest` schema，内部直接调用 `orchestrate_stream`，仅保留路由别名以兼容前端；`oag_service` 里与 pipeline 重复的逻辑下线。
- `/api/chat/stream` 与 `/api/stream/chat` 重复路由：保留一个，另一个 `deprecated=True` 后移除。

**P1-3 Agent 路径去留**（✅ 已决策并落地）

选择了方案 A 的变体：不再保留 LangGraph 图，而是重写为 `agents/war_room.py`（感知→推理→规划→执行→反思），写动作强制走 Gateway，`/api/agent/*` 作为正式入口。后续要做的只是把它登记进 `ARCHITECTURE.md`，并把「是否并入 Supervisor 作为长任务 Skill」留给 P1-2 一并评估。

**P1-4 迁移体系单轨化**
- 以 Alembic 为唯一来源：用当前真实库生成基线 revision，删除 `_migrate_schema` / `_add_column_if_not_exists` / `_ensure_execution_logs_table` / `_create_index_if_not_exists`（它们的 `except: pass` 会掩盖失败）。
- 启动时只做「`alembic upgrade head`」或仅校验版本；`create_all` 只在测试中使用。
- `seed_database()` 改为 CLI：`python -m scripts.seed`；`lifespan` 仅在 `ENV=dev` 且库为空时自动 seed。演示期新增的 `_ensure_demo_story` 与 `scripts/reset_demo.py` 一并归入「仅 demo/dev 环境」（L2）。

**P1-5 后台任务外移**
- 学习评估与风险扫描迁出 `lifespan`：先用 `python -m worker`（独立进程，单实例）；多 worker 场景用 DB 行锁/`SELECT ... FOR UPDATE SKIP LOCKED`（Postgres）或简单租约表实现互斥。
- 评估操作做**幂等**（`SkillOutcome` 状态 pending→evaluated 用条件更新），避免重复调权。

**P1-6 推理逻辑单一来源**
- 以 `reasoning_service` + `semantic/logic` 为唯一实现；`cognitive_graph` 中的 `_execute_*_reasoning` 改为调用同一 service。
- 前端 `src/inference/*` 先审计：凡仅做展示/本地试算（如 `ScenarioEngine`）可保留；凡与后端结果可能不一致的（归因、因果、一致性校验、反事实）改为调用 API。逐个迁移，每迁一个删一个。

---

### P2：性能、数据与可观测性（建议 3～5 周，可与 P1 并行）

> 演示期已在作战室里做了数字可追溯、超时与有限重试、降级标注的雏形（§1.3），P2 是把它们推广到所有对话入口并加上度量。

**P2-1 数据库**
- 开发继续用 SQLite；生产迁 PostgreSQL（`pgvector` 替代 `sqlite-vec`，`tsvector` 替代 FTS5）。抽象 `memory_service` 的向量/全文接口，避免业务层直连 SQLite 特性。
- 若短期仍用 SQLite：去掉 `pool_size/max_overflow`（改 `NullPool` 或 `StaticPool` 视场景）；`SessionLocal` 做成模块级 `sessionmaker` 单例；把 `event.listens_for` 移入 `_create_engine()`，消除 import 副作用。
- 为高频过滤列补索引：`OntologyObject(object_type, status)`、`ActionProposal(status, submitter_id)`、`SkillOutcome(status, evaluate_after)`、`DecisionRecord(causation_id, created_at)`、`ObjectLink(source_id, target_id, rel_type)`。用 `EXPLAIN QUERY PLAN` 验证。

**P2-2 缓存统一**
- 抽出一个 `CacheLayer`（命名空间 + TTL + 版本号）：orchestrator 缓存、activate 缓存、ontology 缓存全部挂上；本体/权限/动作结果变更时**按命名空间失效**（发布 `ontology_changed` 事件，已有 `event_bus` 可复用）。
- 去掉 `cache_service` 里手写 `CREATE TABLE IF NOT EXISTS` 的持久化，要持久就用 ORM 模型 + Alembic。
- 缓存键纳入 `AccessScope`/角色，避免不同权限用户串缓存（orchestrator 键含 `user_id`，但 `activate` 键需核实）。

**P2-3 同步/异步混用**
- `chat` 路由内 `orchestrate_stream` 是同步生成器，被 `StreamingResponse` 放进线程池消费，每个流占一个线程；高并发会耗尽线程。方案：编排核心保持同步（便于测试），在路由层用 `iterate_in_threadpool` 并限流，或逐步把 LLM 调用路径改成原生 `async`。
- `chat_stream` 内手动 `SessionLocal()` 与依赖注入的 `db` 并存（请求级 `db` 未使用）：统一为一种。

**P2-4 LLM 层重构（`llm.py`）**
- 抽一个 `_build_messages(history, system)`，保留真实角色（`user/assistant`）；三个函数合并为 `invoke` / `stream(include_thinking: bool)`。
- 加超时、重试（指数退避 + 抖动）、熔断；失败返回结构化错误而非 `None`，上层据此降级到确定性输出并在 SSE 里显式标注 `degraded: true`。
- `LLM_TEMPERATURE` 默认值与 `.env.example` 对齐；`estimate_tokens` 的 `len/3` 对中英混排偏差大，改用 `tiktoken` 或按字符类别加权，并**为硬规则窗口留 10% 余量**（否则边界上误拒答）。
- 加 Prompt 注入防护：本体实例名/备注等外部来源文本进入上下文时做边界标记与转义。

**P2-5 可观测性**
- 结构化日志（`loguru` 已在依赖里，但代码用标准 `logging`；二选一并统一），每个请求带 `request_id`，SSE 事件与 `DecisionRecord` 带同一 `trace_id`。
- 指标：编排各步耗时、缓存命中率、拒答率（硬规则）、Gateway 各 HR 拦截计数、学习评估积压量。暴露 `/metrics`（`prometheus-fastapi-instrumentator`）。
- `/health` 扩展为 `/health/live` 与 `/health/ready`（检查 DB、迁移版本、embedding 模型是否加载）。

**P2-6 依赖瘦身（D1）**
- 拆 `requirements.txt`：`requirements.txt`（运行）/ `requirements-dev.txt`（pytest、ruff）/ 可选 `requirements-ml.txt`。
- 评估 embedding 方案：`text2vec`+`datasets` 引入重依赖，仅为 768 维向量。可换为调用外部 embedding API（与 LLM 同一网关），或 `sentence-transformers` 精简模型/ONNX；Docker 镜像体积与冷启动会显著下降。
- 删除 `simplejson`、`datasets`（确认无引用后）；用 `pip-compile`/`uv lock` 产出锁文件；去掉对 `langgraph-sdk` 等间接依赖的显式钉死。

---

### P3：前端与产品化（建议 4～8 周）

**P3-1 拆分巨型组件**
目标：单文件 < 600 行。优先级：`InferenceRulesPanel`(69KB) → `ScenarioSim`(56KB) → `OntologyGraph`(53KB，且与 `OntologyGraphView` 并存，需合并) → `InsightEngine`(45KB) → `Layout`(24KB) / `AgentStatusPanel`(23KB) / `ChatInterface`(21KB)。
拆法：数据获取放 `api/hooks.ts`（TanStack Query），纯展示放子组件，计算放 `utils`，大图表 `React.memo` + `useMemo`。

**P3-2 目录与职责**
```
src/
  app/          App.tsx、路由、Provider
  features/     brief / watch / approve / effect / chat / graph / insights / rules / scenario
                  ├─ components/  ├─ hooks/  └─ api.ts
  shared/       ui、api client、types、copy、utils
```
把 `components/` 平铺的 50+ 文件按功能归位；引擎类（`inference/ planning/ perception/ agent/ decision/`）按 P1-6 逐步迁出，最终仅保留纯前端必须的（图布局、情景试算）。

**P3-3 路由与状态**
- `App.tsx` 用 `useState` 手写 tab 路由，无 URL、不可分享/不支持前进后退。引入 `react-router`（或 TanStack Router），tab 别名映射用重定向表。
- 全局状态：5 个 Context（`Ontology/Object/Perception/Cognitive/Auth`）中，服务端数据类的（Ontology/Object/Perception）并入 TanStack Query；Context 只留 Auth 与 UI 状态，减少整树重渲。

**P3-4 类型与契约**
- 后端导出 OpenAPI → `openapi-typescript` 生成 `types`，替换手写 21KB 的 `types.ts` 与 `apiMappers.ts`；CI 校验生成物无 diff。
- SSE 事件（`thinking/intent/routing/…/done`）定义为判别联合类型，前后端共用一份 JSON Schema。

**P3-5 体验与可靠性**
- 全局 `ErrorBoundary`；SSE 断线重连与 `Last-Event-ID`；审批卡的乐观更新 + 失败回滚。
- 可访问性：键盘导航、对比度、图谱提供文字替代（表格视图）。
- 清理：删除 `DecisionOverview.tsx` 空壳、`resolveTab` 旧别名、`copy.ts` 与组件内重复文案；`framer-motion` 页面切换动画时长 0.4s 偏长，建议缩短到 ≤ 0.2s。
- 构建：`build` 加 `lint` 与 `vitest run`；确认 vite 8 / eslint 10 的插件兼容性，必要时回退到稳定大版本。

---

## 4. 测试方案（填补 Q1）

DESIGN.md §9 已列出测试主题，先**按它落地**，再扩展。下表标注当前进度：

| 优先级 | 测试 | 要点 | 状态 |
|---|---|---|---|
| P0 | 路由鉴权全覆盖 | 遍历路由，断言需鉴权；匿名请求 → 401 | ⏳ |
| P0 | Gateway/HR/SoD | HR-001~004 各一正一反；提交人=审批人被拒 | ⏳（演示期的「自批自审」只是手动验证，没有自动化用例） |
| P0 | 审计链 | 篡改任一记录 → `verify-chain` 失败 | ⏳ |
| P1 | OAG pack | 硬规则窗口被裁 → `refuse=true`；`as_of`/`lookback` 过滤；权限裁剪 | ⏳ |
| P1 | 前向链 | 不动点、禁自环、20 轮上限 | ⏳ |
| P1 | ingest | 非法类/缺属性/非法 domain-range 单条拒绝，其余成功 | ⏳ |
| P1 | 学习闭环 | pending→评估→权重边界 [0.3,1.5]；重复评估幂等 | ⏳ |
| P2 | 编排端到端 | 用假 LLM（stub）跑 SSE，断言事件序列与 `DecisionRecord` | ⏳ |
| P2 | 架构守护 | 写世界状态只能经 Gateway | 🔶 已覆盖 Agent 层（3 条），其余目录待扩展 |
| P2 | 前端 | 审批卡、聊天 SSE 解析、权限路由的 Testing Library 用例 | ⏳ |
| — | Agent 纯逻辑 | 风险评分与隐性风险判定、计划规范化与用户意图合并、数字可追溯核验等 | ✅ 14 条（`tests/test_war_room_logic.py`） |

现有 `backend/evals/`（`eval_cases.yaml` + `runner.py`）保留为**回归评测**，接入 CI 的夜间任务，输出趋势而非只看通过/失败。

测试基础设施：`conftest.py` 提供内存 SQLite、迁移后的空库 fixture、`TestClient`、角色 token 工厂、假 LLM。当前 17 条测试都不需要数据库，也不需要 FastAPI 依赖，所以可以在没装依赖的环境里跑；要覆盖 Gateway 与路由，必须先建好上面这套 fixture。

**建议新增的演示相关回归用例**（演示翻车风险最高的几处）：
- 规划 JSON 解析：大模型返回带代码围栏、多余文字、未知动作名、缺字段时，`normalize_steps` 仍能产出合法步骤或降级。
- 事件序列：用假 LLM 跑作战室，断言 `start → stage → … → done` 的顺序与 `summary` 计数。
- 自批自审：以同一用户提交并审批，断言返回 HR-003 且审计链多一条且仍可校验。

---

## 5. 文档修订（X1）

1. `ARCHITECTURE.md`：改写 Agent 小节（现为 `war_room` 五阶段，写入只经 Gateway），补鉴权模型、事件协议（`start/stage/perceive.*/context/reason.*/plan.*/act.result/reflect.done/done`）、部署拓扑（api / worker / db）。
2. `DESIGN.md`：§9 改成真实的测试清单与覆盖率；§2.3 写明生产数据库；§8 的「JWT 生产必须替换」改为「启动强校验」。
3. `README.md`：补环境变量表、Docker 启动、`make test`/`make lint`、数据 seed 命令。
4. 新增 `docs/adr/`：每个关键决策一页（Agent 去留、数据库选型、推理单一来源、缓存失效策略）。
5. 新增 `SECURITY.md`：角色矩阵、数据范围、令牌策略、漏洞报告方式。
6. 新增 `docs/DEMO.md`：演示账号、一键重置、预设问题、录制/回放用法、已知限制（把演示期遗留项 L1–L10 列清楚，防止被误带进对外环境）。

---

## 6. 路线图与优先级

| 阶段 | 内容 | 预估 | 风险 | 收益 | 当前进度 |
|---|---|---|---|---|---|
| **演示期** | 作战室、OAG 对比、治理页、自批自审、账号切换、种子故事线与一键重置 | 已完成 | 低 | 内部演示 | ✅ 代码已写回仓库，待本地启动验证 |
| **演示后清理** | §1.4 的 L1–L10 | 约 2–3 天 | 低 | 避免演示捷径带入对外环境 | ⏳ |
| **P0** | 鉴权收口、密钥强校验、注册/WS/CORS、gitignore、CI、Docker、基础测试 | 1–2 周 | 低（前端需带 token，部分匿名调用会 401） | 🔴 消除严重安全缺口，建立回归网 | 🔶 部分 |
| **P1** | Gateway 守护扩展、对话入口合并、Alembic 单轨、worker 外移、推理单一来源 | 2–4 周 | 中（涉及行为统一，需测试先行） | 架构与文档一致，可多实例部署 | 🔶 Agent 去留与 Agent 层写入守护已完成 |
| **P2** | 数据库/索引、缓存统一、LLM 层、可观测、依赖瘦身 | 3–5 周 | 中 | 性能与稳定性、镜像体积 | ⏳ |
| **P3** | 前端拆分/路由/类型生成/引擎迁出 | 4–8 周 | 中高（面广） | 可维护性、首屏、与后端一致 | ⏳ |

**演示结束后的第一周 Checklist**

- [ ] 在本地跑通演示全流程，并记录问题（启动、重置数据、三个预设问题、对比页、自批自审、账号切换）
- [ ] 清理 L1–L10（关闭演示账号与切换入口、给演示接口加开关、去掉启动自动 seed）
- [ ] `auth.py` 去默认密钥并启动强校验
- [ ] 全局 `require_auth` + 路由鉴权遍历测试
- [ ] `register` 默认关闭
- [ ] 删除 WS `echo`，广播加过滤
- [ ] `.gitignore` 补 `venv/ *.db* __pycache__/`，清理已跟踪产物
- [ ] 补 Gateway/SoD/审计链三组测试（演示期只有 Agent 纯逻辑与架构守护）
- [ ] 加 CI（ruff + pytest + tsc + eslint + build）
- [ ] 用 `git ls-files` 与 `grep` 核实仍标注「待核实」的项：A3 `oag_service` 是否绕过硬规则与决策记录、D4 `activate` 缓存键是否含角色、`reasoning_service` 内部重复、S2 中其余匿名路由清单（S3 与 A1 已核实）

---

## 7. 决策记录与待确认

**已决定（演示期）**

| 决策 | 结论 | 日期 |
|---|---|---|
| LangGraph Agent 去留 | 不保留旧图，重写为 `war_room`，写入只经 Gateway | 2026-11-18 |
| 大模型接入 | OpenAI 兼容接口，主模型流式 + 可选快模型做规划/反思 | 2026-11-18 |
| 演示数据与网络 | 使用种子数据；联网调用大模型；离线自动降级并可回放 | 2026-11-18 |
| 演示阶段不做 | CI、容器化、PostgreSQL、令牌体系 | 2026-11-18 |

**仍待你确认（影响演示后的路线）**

1. **生产数据库**：是否接受迁移到 PostgreSQL？（决定 P2-1 的深度）
2. **前端引擎**（`inference/ planning/ perception/ agent/`）：是否同意「后端为唯一推理来源，前端逐步迁出」？
3. **注册策略**：自助注册是否需要保留（例如内部演示环境）？
4. **部署形态**：Web 为主，还是同时发布 Tauri 桌面端？（影响 CORS、token 存储与 `build-all-platforms` 的取舍）
5. **Agent 是否并入 Supervisor**：保持 `/api/agent/*` 独立入口，还是作为长任务 Skill 由 Supervisor 调度？
6. **演示接口的归宿**：作战室、OAG 对比、治理页是否作为正式功能保留？若保留，L3、L6、L8、L9 要按正式功能的标准补权限与限流。
7. **功能路线图的先后**：是否同意先做 §9 的 F1（回测与置信度校准）、F2（合规规则）、F3（执行回流与评估加固）？依赖项见 §9.5。

---

## 8. 风险与回滚

- **鉴权收口会让依赖匿名的前端调用 401**：先在 staging 以「仅记录日志、不拒绝」模式灰度一天，统计受影响端点，再切换为强制。
- **迁移体系单轨**：上线前对生产库备份；先在副本上 `alembic stamp` 到基线，再 `upgrade`。
- **前端引擎迁出**：每个引擎迁移时保留一个版本的双跑对比（前端旧结果 vs 后端新结果），差异超阈值再告警，确认一致后删除旧实现。
- **演示捷径外泄**：演示账号、自动 seed、`sod-demo` 等如果被部署到共享环境，等同于留后门。以 §1.4 清单作为发布前检查项，并在 `docs/DEMO.md` 里写明。
- **大模型输出不稳定**：规划 JSON 偶发不合规时，`normalize_steps` 会丢弃未知动作并降级到确定性规划；重要演示前先用管理员账号录制一次真实运行，必要时回放。
- 所有阶段以**小 PR + CI 绿灯**合入，不做大爆炸式重构。

---

## 9. 功能路线图：让「感知→推理→规划→执行」更有业务深度

§1–§8 主要谈工程质量。本节谈**功能本身**：骨架（闭环 + 硬规则 + 审计）是对的，但各环节的业务深度还偏浅。

> **依据与限度**：以下来自对作战室、感知评分、OAG 上下文、学习闭环等代码的阅读；`reasoning_service`（53KB）和 `skills/runtime.py` 内部没有逐行读过，涉及它们的地方是推测，标为「待核实」。

### 9.1 各环节现状与缺口

| 环节 | 现状 | 缺口 | 影响 |
|---|---|---|---|
| **感知** | 主要信号是处方量趋势（半程对比）与拜访频次，确定性评分；周期扫描每 5 分钟只统计告警数 | ① 无季节性基线、无同类医生对比，易误报/漏报缓慢恶化；② 无事件触发（拜访逾期、费用超支、合规告警出现时不会立刻重算）；③ 无外部与非结构化信号（竞品、集采/医保目录、拜访纪要）；④ 不感知数据新鲜度，同步滞后时仍自信下结论 | 误报率与漏报率不可控；原因类问题答不到根上 |
| **推理** | LLM 基于 OAG 上下文流式作答，数字做可追溯核验；作战室里置信度为固定值 0.82 / 0.62 | ① 置信度是占位，不是校准概率；② 只核验数字，不核验归因，缺少备选假设与证据对比、反事实检验；③ 前后端三套推理实现，结论可能互相矛盾（A2）；④ 本体缺竞品、医保/集采状态、患者路径等关键对象；`reasoning_service` 内部是否重复待核实 | 结论听起来有道理，但"为什么是这个原因"站不稳 |
| **规划** | 从 10 种允许动作里选步骤，`normalize_steps` 校验；拜访日期默认今天 + 3 天 | ① 动作之间无依赖关系；② 无资源约束（代表时间、预算、日程）与优先级/成本对比；③ 不做"先模拟再提交"，前端已有情景试算但规划没用；④ 不是目标驱动（销售目标缺口不能反推一组行动）；⑤ 多个代表同时被安排时无冲突检查 | 计划能执行，但不一定是**最优**或**可行**的 |
| **执行** | 经行动网关提交，低风险自动执行，高风险待审批；写入审计链 | ① 大部分是系统内记录与通知，**不回写 CRM/ERP**，也没有企业微信、邮件等实际触达渠道；② 审批单级，无超时升级与撤销/补偿；③ 学习评估窗口 24 小时，而处方变化通常滞后数周到数月；无对照组，分不清"动作起效"还是"本来就会回升"；样本少，权重调整的统计意义有限 | 闭环断在源系统之外，学习信号可能是噪声 |

### 9.2 横向缺口

| 缺口 | 说明 | 建议形态 |
|---|---|---|
| **医药行业合规规则** | 目前 HR-001~004 是通用规则 | 增加行业规则并由代码强制：拜访频次上限、礼品/赞助额度、超适应症推广限制等；规则来源与版本可追溯 |
| **回测** | 缺少对历史的验证 | 用历史数据检验"系统能否提前发现已发生的下滑"，输出命中率、误报率、提前量；对管理层最有说服力 |
| **角色视图** | 代表、经理、VP 共用同一套界面 | 代表：每日推送与待办；经理：审批与团队视图；VP：区域与目标视图 |
| **价值度量** | 无法讲 ROI | 建议采纳率、采纳后效果、人工处理时间节省、被拦截的高风险动作数 |
| **反馈回路** | "不承担业务录入"意味着结果必须靠源系统回流 | CRM 拜访结果、处方数据同步的时效与完整性要纳入监控，否则学习闭环会"断粮" |

### 9.3 优先级与做法

| 优先级 | 事项 | 做法 | 依赖 | 验收 |
|---|---|---|---|---|
| **F1** | 回测 + 置信度校准 | 以历史时间序列为"当时可见数据"回放感知评分；用命中结果拟合置信度，替换作战室里的固定值；输出分层报告（按区域、科室） | 历史数据质量；与 P2-5 的指标口径对齐 | 给出提前量与误报率；置信度与实际命中率的偏差可量化 |
| **F2** | 行业合规规则入硬规则层 | 先由合规/法务确认规则清单，再做成可配置规则 + 单元测试；与 `evaluate_hard_rules` 同一入口，被拦截时给出业务语言原因 | 合规部门输入 | 每条规则有正反用例；拦截写入审计链 |
| **F3** | 执行回流与学习闭环加固 | 动作通过适配器回写 CRM；评估窗口按动作类型配置（拜访类按周/月）；引入对照（同类未干预医生）；样本不足时不调权 | CRM 接口、P1-5 评估幂等 | 评估与对照可复现；权重只在样本量达标后变化 |
| F4 | 感知增强 | 基线与同类对比；事件触发重算；数据新鲜度标注与降权 | 数据同步时间戳 | 误报率下降；过期数据不再产生高置信结论 |
| F5 | 推理增强 | 备选假设 + 证据列表；归因核验；与后端 `reasoning_service` 合并为单一实现（A2） | A2 | 同一问题多处入口结论一致 |
| F6 | 规划增强 | 依赖关系、资源约束、优先级；复用情景试算做预估；冲突检查 | 代表日历、预算数据 | 计划可执行且不冲突 |
| F7 | 角色视图与价值度量 | 按角色重组首页；增加采纳率与效果度量页 | F1、F3 提供的数据 | 三类角色各有首页；ROI 指标可展示 |
| F8 | 外部与非结构化信号 | 竞品、集采/医保目录、拜访纪要；需先扩展本体 | 数据来源与合规审查 | 新信号进入感知与推理，并有来源标注 |

**为什么先做 F1–F3**：F1 让所有结论有"成绩单"；F2 是医药行业专有、最难被复制的壁垒；F3 不做的话闭环只是看起来在闭合。F4–F8 都依赖更多数据来源，宜在前三项稳定后推进。

### 9.4 与工程路线图的关系

| 功能项 | 依赖的工程项 |
|---|---|
| F1 回测 | P2-5 指标与 `trace_id`；§4 测试基础设施 |
| F2 合规规则 | P1-1 写入口守护（规则只在 Gateway 一处生效） |
| F3 回流与评估 | P1-5 worker 外移与评估幂等；P1-4 迁移单轨 |
| F5 推理合并 | P1-6 推理单一来源 |
| F7 角色视图 | P0-1 鉴权与角色体系；P3-3 路由与状态 |

### 9.5 待确认

1. 医药合规规则清单由谁提供、以何种形式（文档、制度条款）交付？
2. CRM/ERP 是否提供回写接口？还是只能走批量文件或中间表？
3. 历史数据能回溯多久？颗粒度（日/周/月）？回测至少需要覆盖若干个完整的"下滑—干预—恢复"周期。
4. 处方效果的合理评估窗口：按业务经验是几周还是几个月？
5. 是否有可用的竞品或集采/医保数据源（内部或采购）？

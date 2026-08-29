# OntoNexus — 医药销售 AI 决策中枢

感知 → 推理 → 规划 → 执行。不承担业务录入，事实由 ERP/CRM 提供。

对话走 **OAG**（本体增强生成：用本体上下文作答，而非纯文档 RAG）。改变世界状态的动作经 Action Gateway：硬规则 + 职责分离 + 审批后落库。


## 能力

| 能力 | 说明 |
|------|------|
| 本体 | 对象 / 关系 / 动作 / 权限；写路径校验类型与 domain/range |
| Logic | 前向链：子类、AtRisk、KOL 传递影响；推导事实进 OAG pack |
| OAG 对话 | Supervisor 七步编排 + 单一 DecisionAgent + Skill 组合；硬规则窗口被裁则拒答 |
| 决策记录 | 因果边、政策门、先例检索、`/api/decisions` |
| 动作闭环 | Gateway 提案 → 审批 → 自动执行；动作绑定本体类（HR-004）；聊天里可点动作卡 |
| 销售信号 | 覆盖率、KOL 影响力链、费用 ROI、拜访后处方变化，注入分析上下文 |
| 学习闭环 | 建议/审批 24h 后按销售信号评分，再回写 Skill 路由权重（&lt;0.3 降权，&gt;0.7 升权） |
| 源系统映射 | 显式 CRM/ERP 记录 → 本体实例（校验类型与关系，非法拒绝；无 NER） |
| 审计 | SHA-256 哈希链，`GET /api/audit/verify-chain` |

## 快速开始

Python 3.11+、Node.js 20+。

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

```bash
cd frontend
npm install
npm run dev
```

- API：http://localhost:8000/docs
- UI：http://localhost:5173


设计文档见 [docs/DESIGN.md](docs/DESIGN.md)，架构说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 许可

MIT

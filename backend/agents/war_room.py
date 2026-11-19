"""Agent war room: perceive -> reason -> plan -> act -> reflect.

Design rules (see docs/DESIGN.md):
* The LLM *explains and proposes*; it never writes. Every world-changing action
  goes through ``ActionGateway.submit`` (hard rules, SoD, approval, audit chain).
* Perception is deterministic (ontology + time series + Logic), not an LLM guess.
* Every LLM stage has a deterministic fallback; the stream marks ``degraded``.
* The generator yields plain dict events; the router serialises them as SSE.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
import uuid
from datetime import date
from typing import Any, Dict, Iterator, List, Optional

from agents import war_room_logic as L

logger = logging.getLogger(__name__)

PRESET_QUESTIONS = [
    {
        "id": "scan",
        "label": "本周哪些医生最值得我关注？",
        "query": "本周哪些医生最值得我关注？请给出处理方案",
        "hint": "感知：AI 自己巡视数据，找出还没被标记的风险",
    },
    {
        "id": "cause",
        "label": "张主任处方为什么下降，该怎么办？",
        "query": "张主任处方为什么下降，该怎么办？",
        "hint": "推理：沿本体关系与时序解释原因，并给出方案",
    },
    {
        "id": "guard",
        "label": "帮我给诺欣妥这个产品安排一次拜访",
        "query": "帮我给诺欣妥这个产品安排一次拜访",
        "hint": "闸门：AI 照办提案，动作闸门当场拦下",
    },
]

ACTION_LABELS = {
    "generateVisitBrief": "生成拜访简报",
    "scheduleVisit": "安排拜访",
    "send_notification": "发送通知",
    "updateSentiment": "更新医生态度",
    "flagComplianceRisk": "标记合规风险",
    "markAsAtRisk": "标记流失风险",
    "escalate": "升级处理",
    "updateAccessStatus": "更新准入状态",
    "allocateBudget": "分配预算",
    "inviteToEvent": "邀请参加活动",
}

TYPE_LABELS = {
    "Doctor": "医生", "HCP": "医疗专业人士", "Hospital": "医院", "Product": "产品",
    "SalesRep": "销售代表", "SalesTarget": "销售目标", "ComplianceAlert": "合规告警",
    "Territory": "区域", "BudgetCategory": "预算分类",
}

REASON_SYSTEM = """你是 OntoNexus 的决策 Agent，基于企业本体（OAG）工作，不是通用聊天机器人。
规则：
1. 只能使用【感知发现】和【本体上下文】中出现的事实与数字；没有的数据不得编造，不确定就明确说「数据中没有」。
2. 提到对象时写成「名称（ID）」，例如 周教授（d6）。
3. 若上下文中有 INFLUENCES 关系或推导事实，说明风险如何沿影响链传导。
4. 你只负责分析与建议，不直接执行；任何写操作只能由动作闸门在审批后执行。
5. 输出结构：**结论**（1-2 句）→ **依据**（至多 3 条，标明信号来源）→ **建议方向**（1-2 句）。总字数不超过 320 字。"""

PLAN_SYSTEM = """你是 OntoNexus 的规划模块。把推理结论转换成可提交给「动作闸门」的结构化动作。
规则：
1. 对高风险医生，按「生成拜访简报 → 安排拜访 → 通知区域经理」组织动作。
2. 用户明确要求的动作必须原样提出，即使你认为它可能违规——是否放行由动作闸门裁决，你不负责拦截，也不要静默丢弃。
3. object_id 必须取自「可引用对象」；确实无法确定对象时填 null。
4. 最多 5 步，每步 rationale 不超过 40 字，并引用数据。
5. 只输出 JSON，不要任何解释，格式：
{"steps":[{"action_type":"...","object_id":"...","params":{...},"rationale":"..."}]}"""

REFLECT_SYSTEM = (
    "你是 OntoNexus 复盘模块。基于动作执行结果，用不超过 120 字总结："
    "已自动完成什么、哪些在等待审批、哪些被闸门拦下及原因、下一步（24 小时后按处方变化复盘）。语气务实，不夸大，不编造数字。"
)

# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------


def _content_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and isinstance(part.get("text"), str):
                parts.append(part["text"])
        return "".join(parts)
    return ""


def _stream_llm(messages: list, role: str = "main") -> Iterator[str]:
    from llm import get_llm_for

    llm = get_llm_for(role)
    if llm is None:
        raise RuntimeError("LLM not configured")
    for chunk in llm.stream(messages):
        text = _content_text(getattr(chunk, "content", ""))
        if text:
            yield text


def _invoke_llm(messages: list, role: str = "fast") -> str:
    from llm import get_llm_for

    llm = get_llm_for(role)
    if llm is None:
        raise RuntimeError("LLM not configured")
    return _content_text(llm.invoke(messages).content)


def _fmt_money(value: Any) -> str:
    try:
        v = float(value)
    except (TypeError, ValueError):
        return "—"
    return f"{v:.0f}（约{v / 10000:.0f}万）"


# ----------------------------------------------------------------------------
# perception (deterministic)
# ----------------------------------------------------------------------------


def _downstream_ids(src: str, out_links: Dict[str, list], max_depth: int = 2) -> List[Any]:
    seen = {src}
    frontier = [src]
    found: List[Any] = []
    for _ in range(max_depth):
        nxt = []
        for node in frontier:
            for lk in out_links.get(node, []):
                if lk.link_type == "INFLUENCES" and lk.target_id not in seen:
                    seen.add(lk.target_id)
                    nxt.append(lk.target_id)
                    found.append(lk)
        frontier = nxt
    return found


def _doctor_findings(db) -> List[Dict[str, Any]]:
    from models.domain import Doctor
    from models.ontology import ObjectLink, OntologyObject, TimeSeriesData

    objs = db.query(OntologyObject).filter(OntologyObject.object_type.in_(["Doctor", "HCP"])).all()
    if not objs:
        return []
    ids = [o.id for o in objs]
    doctors = {d.id: d for d in db.query(Doctor).filter(Doctor.id.in_(ids)).all()}
    out_links: Dict[str, list] = {}
    for lk in db.query(ObjectLink).filter(ObjectLink.source_id.in_(ids)).all():
        out_links.setdefault(lk.source_id, []).append(lk)

    series: Dict[tuple, list] = {}
    rows = (
        db.query(TimeSeriesData)
        .filter(
            TimeSeriesData.object_id.in_(ids),
            TimeSeriesData.series_name.in_(["prescriptionVolume", "prescription", "visitFrequency"]),
        )
        .order_by(TimeSeriesData.timestamp.asc())
        .all()
    )
    for r in rows:
        series.setdefault((r.object_id, r.series_name), []).append(r.value)

    findings: List[Dict[str, Any]] = []
    for obj in objs:
        rx = series.get((obj.id, "prescriptionVolume")) or series.get((obj.id, "prescription")) or []
        visits = series.get((obj.id, "visitFrequency")) or []
        links = out_links.get(obj.id, [])
        downstream = _downstream_ids(obj.id, out_links)
        hospital = next((lk.target_name for lk in links if lk.link_type == "WORKS_AT"), None)
        rep_link = next((lk for lk in links if lk.link_type == "MANAGED_BY"), None)
        doc = doctors.get(obj.id)
        influence = getattr(doc, "influence_score", None) if doc else None
        feats = {
            "rx_trend_pct": L.half_trend_pct(rx),
            "visits_last": visits[-1] if visits else None,
            "influence_score": influence,
            "downstream_count": len(downstream),
            "status": obj.status,
        }
        score, reasons = L.score_doctor(feats)
        findings.append({
            "kind": "doctor",
            "id": obj.id,
            "name": obj.name,
            "type": obj.object_type,
            "status": obj.status or "normal",
            "hospital": hospital,
            "rep": rep_link.target_name if rep_link else None,
            "rep_id": rep_link.target_id if rep_link else None,
            "specialty": getattr(doc, "specialty", None) if doc else None,
            "influence_score": influence,
            "rx_series": [round(v, 1) for v in rx[-8:]],
            "rx_trend_pct": feats["rx_trend_pct"],
            "visits_last": feats["visits_last"],
            "downstream": [lk.target_name for lk in downstream],
            "downstream_count": len(downstream),
            "score": score,
            "reasons": reasons,
            "hidden": L.is_hidden_risk(score, obj.status),
        })
    return findings


def _other_findings(db) -> List[Dict[str, Any]]:
    from models.domain import ComplianceAlert, SalesTarget
    from models.ontology import OntologyObject

    out: List[Dict[str, Any]] = []
    names = {o.id: o.name for o in db.query(OntologyObject).filter(OntologyObject.object_type.in_(["SalesTarget", "ComplianceAlert"])).all()}
    for t in db.query(SalesTarget).all():
        rate = t.achievement_rate
        if rate is not None and float(rate) < 85:
            gap = float(t.target_value or 0) - float(t.actual_value or 0)
            out.append({
                "kind": "target", "id": t.id, "name": names.get(t.id, t.id), "type": "SalesTarget",
                "achievement_rate": rate, "gap": gap, "risk_level": t.risk_level, "score": 0,
                "reasons": [f"达成率 {float(rate):g}%，缺口 ¥{_fmt_money(gap)}"],
            })
    for a in db.query(ComplianceAlert).filter(ComplianceAlert.alert_status == "pending").all():
        out.append({
            "kind": "compliance", "id": a.id, "name": names.get(a.id, a.id), "type": "ComplianceAlert",
            "severity": a.severity, "score": 0,
            "reasons": [str(a.alert_description or a.risk_type or "待处理合规告警")],
        })
    return out


def perceive(db, query: str) -> Dict[str, Any]:
    doctors = L.rank_findings(_doctor_findings(db), query)
    return {"doctors": doctors, "others": _other_findings(db)}


def findings_text(perception: Dict[str, Any], limit: int = 4) -> str:
    lines = ["## 感知发现（确定性计算，按风险分排序）"]
    for f in perception["doctors"][:limit]:
        flag = "；系统未标记，由趋势与影响链识别" if f.get("hidden") else ""
        lines.append(
            f"- {f['name']}（{f['id']}）风险分 {f['score']}；医院：{f.get('hospital') or '未知'}；负责代表：{f.get('rep') or '未知'}；"
            f"状态：{f['status']}{flag}；处方序列：{f['rx_series']}；信号：{'；'.join(f['reasons']) or '无显著异常'}；"
            f"影响下游：{'、'.join(f['downstream']) or '无'}"
        )
    for f in perception["others"][:3]:
        lines.append(f"- [{f['type']}] {f['name']}（{f['id']}）：{'；'.join(f['reasons'])}")
    return "\n".join(lines)


# ----------------------------------------------------------------------------
# OAG pack view (also used by the OAG-vs-LLM comparison endpoint)
# ----------------------------------------------------------------------------

_PREFERRED_PREDICATES = ("INFLUENCES", "AtRisk", "NeedsFollowUp")


def pack_summary(pack: Dict[str, Any]) -> Dict[str, Any]:
    contexts = pack.get("contexts") or []
    objects = []
    for ctx in contexts:
        obj = ctx.get("object") or {}
        objects.append({
            "id": obj.get("id"), "name": obj.get("name"), "type": obj.get("objectType"),
            "status": obj.get("status"), "relevance": round(float(ctx.get("relevance_score") or 0), 1),
        })
    edges, seen = [], set()
    for ctx in contexts:
        for e in ((ctx.get("subgraph") or {}).get("edges") or []):
            key = (e.get("source_id"), e.get("type"), e.get("target_id"))
            if key in seen or not all(key):
                continue
            seen.add(key)
            edges.append({"source": key[0], "rel": key[1], "target": key[2], "derived": False})
    derived = []
    trace = pack.get("logic_trace") or []
    preferred = [s for s in trace if any(str(s.get("conclusion", "")).startswith(p + "(") for p in _PREFERRED_PREDICATES)]
    for step in (preferred + [s for s in trace if s not in preferred])[:12]:
        derived.append({"fact": step.get("conclusion"), "rule": step.get("rule"), "name": step.get("name")})
        m = re.match(r"INFLUENCES\(([^,]+),([^)]+)\)", str(step.get("conclusion", "")))
        if m and (m.group(1), "INFLUENCES", m.group(2)) not in seen:
            seen.add((m.group(1), "INFLUENCES", m.group(2)))
            edges.append({"source": m.group(1), "rel": "INFLUENCES", "target": m.group(2), "derived": True})
    return {
        "objects": objects,
        "edges": edges[:30],
        "derived_facts": derived,
        "hard_rules": [r.get("id") for r in (pack.get("hard_rules") or [])],
        "token_estimate": pack.get("token_estimate"),
        "token_budget": 8000,
        "refuse": bool(pack.get("refuse")),
        "refuse_reason": pack.get("refuse_reason"),
    }


def known_objects(pack: Dict[str, Any], perception: Optional[Dict[str, Any]] = None) -> Dict[str, Dict[str, str]]:
    known: Dict[str, Dict[str, str]] = {}
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        if obj.get("id"):
            known[obj["id"]] = {"name": obj.get("name") or "", "type": obj.get("objectType") or ""}
    for f in (perception or {}).get("doctors", []):
        known.setdefault(f["id"], {"name": f["name"], "type": f["type"]})
    return known


# ----------------------------------------------------------------------------
# plan pre-check (read-only; the Gateway remains the authority)
# ----------------------------------------------------------------------------


def _business_message(rule_id: str, action: str, obj_type: Optional[str], applies_to: List[str]) -> str:
    label = ACTION_LABELS.get(action, action)
    if rule_id == "HR-001":
        return f"「{label}」没有指定对象，系统不允许无对象的写操作。"
    if rule_id == "HR-004":
        allowed = "、".join(TYPE_LABELS.get(t, t) for t in applies_to) or "指定类型"
        return f"「{label}」不能作用于{TYPE_LABELS.get(obj_type or '', obj_type or '该对象')}，只适用于：{allowed}。"
    if rule_id == "OBJ-404":
        return "本体中不存在该对象，已拒绝。"
    return "违反系统硬规则。"


def precheck_step(db, step: Dict[str, Any]) -> Dict[str, Any]:
    from actions.contracts import get_contract, risk_rank
    from actions.hard_rules import evaluate_hard_rules
    from models.ontology import OntologyObject

    action = step["action_type"]
    contract = get_contract(action)
    needs_approval = contract.requires_approval or risk_rank(contract.risk_level) >= 2
    info: Dict[str, Any] = {
        "ok": True,
        "risk": contract.risk_level,
        "needs_approval": needs_approval,
        "applies_to": contract.applies_to,
        "object_name": None,
        "object_type": None,
    }
    obj_type = None
    if step.get("object_id"):
        obj = db.query(OntologyObject).filter(OntologyObject.id == step["object_id"]).first()
        if obj is None:
            info.update(ok=False, rule="OBJ-404", message=_business_message("OBJ-404", action, None, []))
            return info
        obj_type = obj.object_type
        info["object_name"] = obj.name
        info["object_type"] = obj.object_type
    violations = evaluate_hard_rules(
        action, step.get("object_id"), approved=False, submitter_id=L.AGENT_USER_ID, executing=False, object_type=obj_type,
    )
    if violations:
        v = violations[0]
        info.update(ok=False, rule=v["rule_id"], message=_business_message(v["rule_id"], action, obj_type, contract.applies_to))
    info["expected"] = "blocked" if violations else ("pending" if needs_approval else "auto")
    return info


# ----------------------------------------------------------------------------
# act (Gateway only)
# ----------------------------------------------------------------------------


def submit_step(db, step: Dict[str, Any], *, run_id: str, decision_id: Optional[str], pre: Dict[str, Any]) -> Dict[str, Any]:
    from actions.gateway import ActionGateway
    from actions.hard_rules import HardRuleViolation
    from actions.sod import SoDViolation
    from exceptions import OntoNexusError

    action = step["action_type"]
    params = dict(step.get("params") or {})
    if pre.get("object_name"):
        params.setdefault("entity_name", pre["object_name"])
    reasoning = {
        "conclusion": step.get("rationale") or ACTION_LABELS.get(action, action),
        "confidence": 0.82,
        "evidence": f"ontology|{step.get('rationale') or '来自 Agent 推理'}|0.6,agent_run|run_id={run_id}|0.4",
    }
    try:
        result = ActionGateway(db).submit(
            action_type=action,
            object_id=step.get("object_id"),
            params=params,
            user_id=L.AGENT_USER_ID,
            title=f"[AI] {ACTION_LABELS.get(action, action)}" + (f" · {pre['object_name']}" if pre.get("object_name") else ""),
            causation_id=run_id,
            decision_id=decision_id,
            reasoning=reasoning,
        )
        db.commit()
    except HardRuleViolation as exc:
        db.commit()  # keep the blocked decision + audit record the Gateway wrote
        return {"status": "blocked", "rule": exc.rule_id,
                "message": _business_message(exc.rule_id, action, pre.get("object_type"), pre.get("applies_to") or [])}
    except SoDViolation as exc:
        db.commit()
        return {"status": "blocked", "rule": "HR-003", "message": exc.message}
    except OntoNexusError as exc:
        db.rollback()
        return {"status": "blocked" if exc.code == "ONTOLOGY_VALIDATION_ERROR" else "failed", "rule": exc.code, "message": exc.message}
    except Exception as exc:  # noqa: BLE001 - surface any failure to the UI instead of crashing the stream
        db.rollback()
        logger.exception("war_room submit failed")
        return {"status": "failed", "message": f"提交失败：{exc}"}

    raw = str(result.get("status") or "")
    proposal_id = result.get("proposal_id") or result.get("action_id")
    status = {"pending": "pending", "executed": "executed", "approved": "executed", "failed": "failed", "rejected": "failed"}.get(raw, raw or "failed")
    message = {
        "pending": "已提交，等待区域经理审批；审批通过后自动执行。",
        "executed": "低风险动作，已由系统自动执行并写入审计链。",
        "failed": result.get("message") or "执行失败",
    }.get(status, result.get("message") or "")
    if result.get("idempotent"):
        message = "此前已提交过相同动作，沿用既有提案。"
    return {"status": status, "proposal_id": proposal_id, "reused": bool(result.get("idempotent")), "message": message}


# ----------------------------------------------------------------------------
# main run
# ----------------------------------------------------------------------------


def _pack_text(pack: Dict[str, Any], limit: int = 6000) -> str:
    return (pack.get("pack_text") or "")[:limit]


def _plan_messages(query: str, perception: Dict[str, Any], reasoning_text: str, known: Dict[str, Dict[str, str]]) -> list:
    from langchain_core.messages import HumanMessage, SystemMessage

    catalog = "\n".join(f"- {name}：{desc}" for name, desc in L.PLAN_ALLOWED_ACTIONS.items())
    refs = "\n".join(f"- {oid}：{meta['name']}（{meta['type']}）" for oid, meta in list(known.items())[:24])
    human = (
        f"用户问题：{query}\n\n{findings_text(perception)}\n\n## 推理结论\n{reasoning_text}\n\n"
        f"## 可引用对象\n{refs}\n\n## 可用动作\n{catalog}\n\n今天：{date.today().isoformat()}\n请只输出 JSON。"
    )
    return [SystemMessage(content=PLAN_SYSTEM), HumanMessage(content=human)]


def _reflect_text(results: List[Dict[str, Any]]) -> str:
    done = [r for r in results if r["status"] == "executed"]
    pending = [r for r in results if r["status"] == "pending"]
    blocked = [r for r in results if r["status"] == "blocked"]
    parts = []
    if done:
        parts.append(f"已自动完成 {len(done)} 项低风险动作（{'、'.join(r['label'] for r in done)}）")
    if pending:
        parts.append(f"{len(pending)} 项高风险动作已提交，等待区域经理审批（提交人不能自批）")
    if blocked:
        parts.append(f"{len(blocked)} 项被动作闸门拦下（{'；'.join((r.get('rule') or '') + ' ' + r['label'] for r in blocked)}）")
    if not parts:
        parts.append("本次没有产生需要执行的动作")
    return "；".join(parts) + "。审批通过并执行后，系统将在 24 小时后按处方变化复盘，并据此调整后续建议权重。"


def run(db, *, query: str, user: Any, run_id: Optional[str] = None) -> Iterator[Dict[str, Any]]:
    from llm import is_llm_configured
    from semantic.context_pack import build_context_pack

    run_id = run_id or f"run_{uuid.uuid4().hex[:10]}"
    t0 = time.time()
    online = is_llm_configured()
    degraded = False
    yield {"type": "start", "run_id": run_id, "query": query, "llm_online": online, "mode": "live" if online else "offline"}

    try:
        # ---- 1. perceive -----------------------------------------------------
        yield {"type": "stage", "stage": "perceive", "status": "start"}
        ts = time.time()
        perception = perceive(db, query)
        shown = perception["doctors"][:4] + perception["others"][:2]
        for f in shown:
            yield {"type": "perceive.finding", "finding": f}
            time.sleep(0.18)
        hidden_ids = [f["id"] for f in perception["doctors"] if f.get("hidden")]
        yield {"type": "perceive.done", "count": len(shown), "hidden_ids": hidden_ids}
        yield {"type": "stage", "stage": "perceive", "status": "done", "ms": int((time.time() - ts) * 1000)}

        top_names = " ".join(f["name"] for f in perception["doctors"][:3])
        pack = build_context_pack(db, f"{query} {top_names}", user=user)
        if pack.get("refuse"):
            yield {"type": "error", "stage": "context", "message": pack.get("refuse_reason") or "硬规则窗口被裁，拒绝作答"}
            yield {"type": "done", "run_id": run_id, "refused": True, "pending_action_ids": [], "summary": {}, "degraded": False,
                   "ms": int((time.time() - t0) * 1000)}
            return
        view = pack_summary(pack)
        yield {"type": "context", **view}
        known = known_objects(pack, perception)
        source_text = findings_text(perception, limit=8) + "\n" + _pack_text(pack, limit=20000)

        # ---- 2. reason (LLM + OAG) ----------------------------------------------
        yield {"type": "stage", "stage": "reason", "status": "start"}
        ts = time.time()
        reasoning_text = ""
        reason_degraded = False
        if online:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                messages = [
                    SystemMessage(content=REASON_SYSTEM),
                    HumanMessage(content=f"用户问题：{query}\n\n{findings_text(perception)}\n\n## 本体上下文\n{_pack_text(pack)}"),
                ]
                for token in _stream_llm(messages, "main"):
                    reasoning_text += token
                    yield {"type": "reason.token", "text": token}
            except Exception as exc:  # noqa: BLE001
                logger.warning("war_room reason LLM failed: %s", exc)
                reason_degraded = not reasoning_text
        else:
            reason_degraded = True
        if not reasoning_text.strip():
            reason_degraded = True
            reasoning_text = L.deterministic_reasoning(perception["doctors"])
            for chunk in L.iter_text_chunks(reasoning_text, 6):
                yield {"type": "reason.token", "text": chunk}
                time.sleep(0.012)
        degraded = degraded or reason_degraded
        verified = L.ground_numbers(reasoning_text, source_text)
        cited = L.cited_objects(reasoning_text, known)
        yield {"type": "reason.done", "text": reasoning_text, "cited": cited, "verified": verified, "degraded": reason_degraded}
        yield {"type": "stage", "stage": "reason", "status": "done", "ms": int((time.time() - ts) * 1000)}

        # ---- 3. plan --------------------------------------------------------------
        yield {"type": "stage", "stage": "plan", "status": "start"}
        ts = time.time()
        steps: List[Dict[str, Any]] = []
        plan_degraded = False
        if online:
            try:
                raw_text = _invoke_llm(_plan_messages(query, perception, reasoning_text, known), "fast")
                steps = L.normalize_steps(L.extract_json(raw_text))
            except Exception as exc:  # noqa: BLE001
                logger.warning("war_room plan LLM failed: %s", exc)
        if not steps:
            plan_degraded = True
            steps = L.deterministic_plan(perception["doctors"])
        steps = L.merge_steps(steps, L.intent_steps(query, known))
        degraded = degraded or plan_degraded
        prechecks: List[Dict[str, Any]] = []
        for idx, step in enumerate(steps):
            pre = precheck_step(db, step)
            prechecks.append(pre)
            yield {
                "type": "plan.step", "index": idx,
                "step": {**step, "label": ACTION_LABELS.get(step["action_type"], step["action_type"]), "pre_check": pre},
            }
            time.sleep(0.15)
        yield {"type": "plan.done", "count": len(steps), "degraded": plan_degraded}
        yield {"type": "stage", "stage": "plan", "status": "done", "ms": int((time.time() - ts) * 1000)}

        # ---- 4. act (Gateway only) ----------------------------------------------
        yield {"type": "stage", "stage": "act", "status": "start"}
        ts = time.time()
        decision_id = None
        try:
            from decision.recorder import DecisionRecorder

            rec = DecisionRecorder(db).record(
                category="agent_run",
                scenario=query[:200],
                reasoning=reasoning_text[:1500],
                outcome="recommended",
                confidence=0.82 if verified["ok"] else 0.62,
                decision_maker=L.AGENT_USER_ID,
                evidence_ids=[c["id"] for c in cited],
                causation_id=run_id,
                entity_ids=[c["id"] for c in cited],
                metadata={"run_id": run_id, "mode": "live" if online and not degraded else "degraded",
                          "findings": [f["id"] for f in perception["doctors"][:4]]},
            )
            db.commit()
            decision_id = rec.get("id")
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            logger.warning("war_room decision record failed: %s", exc)

        results: List[Dict[str, Any]] = []
        for idx, (step, pre) in enumerate(zip(steps, prechecks)):
            outcome = submit_step(db, step, run_id=run_id, decision_id=decision_id, pre=pre)
            outcome["label"] = ACTION_LABELS.get(step["action_type"], step["action_type"])
            outcome["risk"] = pre.get("risk")
            results.append(outcome)
            yield {"type": "act.result", "index": idx, "action_type": step["action_type"],
                   "object_id": step.get("object_id"), "object_name": pre.get("object_name"), **outcome}
            time.sleep(0.2)
        yield {"type": "stage", "stage": "act", "status": "done", "ms": int((time.time() - ts) * 1000)}

        # ---- 5. reflect -------------------------------------------------------------
        yield {"type": "stage", "stage": "reflect", "status": "start"}
        ts = time.time()
        reflect_text = ""
        reflect_degraded = False
        if online:
            try:
                from langchain_core.messages import HumanMessage, SystemMessage

                brief = json.dumps(
                    [{"动作": r["label"], "状态": r["status"], "规则": r.get("rule"), "说明": r.get("message")} for r in results],
                    ensure_ascii=False,
                )
                reflect_text = _invoke_llm([SystemMessage(content=REFLECT_SYSTEM), HumanMessage(content=brief)], "fast").strip()
            except Exception as exc:  # noqa: BLE001
                logger.warning("war_room reflect LLM failed: %s", exc)
        if not reflect_text:
            reflect_degraded = True
            reflect_text = _reflect_text(results)
        degraded = degraded or reflect_degraded
        yield {"type": "reflect.done", "text": reflect_text, "degraded": reflect_degraded}
        yield {"type": "stage", "stage": "reflect", "status": "done", "ms": int((time.time() - ts) * 1000)}

        summary = {k: sum(1 for r in results if r["status"] == k) for k in ("executed", "pending", "blocked", "failed")}
        yield {
            "type": "done", "run_id": run_id, "decision_id": decision_id,
            "pending_action_ids": [r["proposal_id"] for r in results if r["status"] == "pending" and r.get("proposal_id")],
            "summary": summary, "degraded": degraded, "ms": int((time.time() - t0) * 1000),
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("war_room run failed")
        try:
            db.rollback()
        except Exception:  # noqa: BLE001
            pass
        yield {"type": "error", "stage": "run", "message": f"Agent 运行出错：{exc}"}
        yield {"type": "done", "run_id": run_id, "pending_action_ids": [], "summary": {}, "degraded": True,
               "ms": int((time.time() - t0) * 1000), "failed": True}


# ----------------------------------------------------------------------------
# record / replay (rehearsal safety net for unreliable networks)
# ----------------------------------------------------------------------------

_REPLAY_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "replays")


def _replay_path(key: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9_-]", "", key or "")[:40] or "default"
    return os.path.join(_REPLAY_DIR, f"{safe}.json")


def has_replay(key: Optional[str]) -> bool:
    return bool(key) and os.path.exists(_replay_path(key or ""))


def stream_events(db, *, query: str, user: Any, replay_key: Optional[str] = None, record_key: Optional[str] = None) -> Iterator[Dict[str, Any]]:
    """Live run, optionally recorded; or replay a previously recorded *real* run at its original pace."""
    if replay_key and has_replay(replay_key):
        with open(_replay_path(replay_key), encoding="utf-8") as fh:
            frames = json.load(fh)
        last = 0.0
        for frame in frames:
            gap = min(max(float(frame["t"]) - last, 0.0), 2.0)
            last = float(frame["t"])
            time.sleep(gap * 0.8)
            ev = dict(frame["ev"])
            if ev.get("type") == "start":
                ev["mode"] = "replay"
            yield ev
        return

    frames: List[Dict[str, Any]] = []
    t0 = time.time()
    for ev in run(db, query=query, user=user):
        if record_key:
            frames.append({"t": round(time.time() - t0, 3), "ev": ev})
        yield ev
    if record_key and frames:
        os.makedirs(_REPLAY_DIR, exist_ok=True)
        with open(_replay_path(record_key), "w", encoding="utf-8") as fh:
            json.dump(frames, fh, ensure_ascii=False)


# ----------------------------------------------------------------------------
# "try it yourself": submit, then try to approve your own proposal (SoD / HR-003)
# ----------------------------------------------------------------------------


def sod_demo(db, user) -> Dict[str, Any]:
    """Submit a high-risk action as the *current user*, then immediately try to approve it as the
    same user. The Gateway must refuse (HR-003); the refusal is audited. Nothing is executed."""
    from actions.gateway import ActionGateway
    from actions.sod import SoDViolation

    gw = ActionGateway(db)
    target = "d6"
    try:
        sub = gw.submit(
            action_type="markAsAtRisk",
            object_id=target,
            params={"entity_name": "周教授", "reason": f"演示：自批自审 {date.today().isoformat()}"},
            user_id=user.id,
            title="[演示] 标记周教授为风险客户",
        )
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        return {"submitted": False, "blocked": False, "message": f"提交失败：{exc}"}
    proposal_id = sub.get("proposal_id")
    if sub.get("status") != "pending":
        return {"submitted": True, "blocked": False, "proposal_id": proposal_id,
                "message": f"提案状态为 {sub.get('status')}，无需审批。"}
    try:
        gw.approve(proposal_id, user.id)
        db.commit()
        return {"submitted": True, "blocked": False, "proposal_id": proposal_id,
                "message": "意外：自批通过了。请检查 SoD 规则。"}
    except SoDViolation as exc:
        db.commit()  # keep the blocked record the Gateway wrote
        return {"submitted": True, "blocked": True, "rule": "HR-003", "proposal_id": proposal_id, "message": exc.message}

"""Supervisor seven-step orchestrator.

guardrails → cache → intent → slot → agent+skill → reflection → hallucination → persist

One DecisionAgent; Skills switch activated context (1–3 merged).
Writes only go through Action Gateway.
"""

from __future__ import annotations

import threading
import time
import uuid
from collections import OrderedDict
from typing import Any, Dict, Generator, List, Optional

from sqlalchemy.orm import Session

from ai.hallucination import detect_hallucination
from semantic.pipeline import activate
from skills.loader import get_skill_loader
from skills.runtime import run_skills


_CACHE_MAX = 256
_CACHE_TTL = 60
_CACHE: OrderedDict[str, Dict[str, Any]] = OrderedDict()
_CACHE_LOCK = threading.Lock()


def _cache_get(key: str) -> Optional[Dict[str, Any]]:
    with _CACHE_LOCK:
        item = _CACHE.get(key)
        if not item:
            return None
        if time.time() - item["ts"] >= _CACHE_TTL:
            _CACHE.pop(key, None)
            return None
        _CACHE.move_to_end(key)
        return item


def _cache_set(key: str, value: Dict[str, Any]) -> None:
    with _CACHE_LOCK:
        _CACHE[key] = value
        _CACHE.move_to_end(key)
        while len(_CACHE) > _CACHE_MAX:
            _CACHE.popitem(last=False)


def _sse(event_type: str, **payload) -> Dict[str, Any]:
    data = {"type": event_type, **payload}
    return data


def classify_intent(query: str) -> str:
    skill = get_skill_loader().match(query)
    return skill.intent


def extract_slots(query: str, pack: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    slots: Dict[str, Any] = {"query": query, "context_pack": pack}
    ids = []
    for ctx in pack.get("contexts") or []:
        oid = (ctx.get("object") or {}).get("id")
        if oid:
            ids.append(oid)
    extra = context or {}
    pinned = extra.get("object_id")
    if pinned:
        ids = [pinned] + [i for i in ids if i != pinned]
    if ids:
        slots["object_id"] = ids[0]
        slots["object_ids"] = ids
    parent = extra.get("parent_decision_id") or extra.get("decision_id")
    if parent:
        slots["parent_decision_id"] = parent
    if extra.get("causation_id"):
        slots["causation_id"] = extra["causation_id"]
    if extra.get("action_type"):
        slots["action_type"] = extra["action_type"]
    q = query.lower()
    if "拜访" in q or "schedule" in q:
        slots["action_type"] = extra.get("action_type") or "scheduleVisit"
    elif "合规" in q or "compliance" in q:
        slots["action_type"] = extra.get("action_type") or "flagComplianceRisk"
    elif "态度" in q or "sentiment" in q:
        slots["action_type"] = extra.get("action_type") or "updateSentiment"
    elif "流失" in q or "at_risk" in q:
        slots["action_type"] = extra.get("action_type") or "markAsAtRisk"
    elif extra.get("action_type"):
        slots["action_type"] = extra["action_type"]
    return slots


def _follow_ups(skill_name: str, object_id: Optional[str], has_accept_cards: bool) -> List[Dict[str, str]]:
    suffix = f" {object_id}" if object_id else ""
    catalog = {
        "attribution-analyzer": [
            {"label": "情景模拟", "query": f"对这个对象做 what-if 模拟{suffix}".strip()},
            {"label": "给出建议", "query": f"基于刚才的归因给出可执行建议{suffix}".strip()},
            {"label": "决策穿透", "query": f"穿透这条指标到医院医生代表{suffix}".strip()},
        ],
        "metric_diagnosis": [
            {"label": "归因分析", "query": f"为什么这块达成差{suffix}".strip()},
            {"label": "给出建议", "query": f"给出可执行建议{suffix}".strip()},
        ],
        "what-if-simulator": [
            {"label": "给出建议", "query": f"根据模拟结果给出可执行建议{suffix}".strip()},
        ],
        "causal_explainer": [
            {"label": "给出建议", "query": f"给出可执行建议{suffix}".strip()},
        ],
        "recommend-and-accept": [] if has_accept_cards else [
            {"label": "接受建议", "query": f"接受建议{suffix}".strip()},
        ],
    }
    return catalog.get(skill_name) or []


def _suggested_actions(query: str, result: Dict[str, Any], pack: Dict[str, Any], skill_name: Optional[str] = None) -> List[Dict[str, Any]]:
    existing = list(result.get("actions") or [])
    if existing:
        return existing
    # CrossBorder: query-class skills must not emit write action cards.
    if skill_name not in ("action_operator", "recommend-and-accept"):
        return []
    object_ids = result.get("object_ids") or []
    target = object_ids[0] if object_ids else None
    if not target:
        return []
    if any(k in query for k in ("拜访", "执行", "接受", "采纳")):
        return [
            {
                "id": f"suggest_scheduleVisit_{target}",
                "title": "安排随访",
                "description": f"针对 {target} 提交拜访提案（经 Gateway）",
                "status": "pending",
                "action_type": "scheduleVisit",
                "object_id": target,
                "requires_accept": True,
            }
        ]
    return []


def _data_cards_from_result(result: Dict[str, Any], pack: Dict[str, Any]) -> List[Dict[str, Any]]:
    cards = list(result.get("data_cards") or [])
    if cards:
        return cards
    rows = []
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        signals = ctx.get("sales_signals") or {}
        rows.append(
            {
                "id": obj.get("id"),
                "name": obj.get("name"),
                "type": obj.get("objectType"),
                "status": obj.get("status"),
                "coverage": (signals.get("coverage") or {}).get("rate"),
                "kol": (signals.get("kol") or {}).get("influence_score"),
                "roi": (signals.get("roi") or {}).get("roi_ratio"),
                "visit_effect": (signals.get("visit_effect") or {}).get("delta"),
            }
        )
    if not rows:
        return []
    return [{"title": "分析对象", "rows": rows[:8]}]


def orchestrate(
    db: Session,
    query: str,
    *,
    user=None,
    thread_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    events: List[Dict[str, Any]] = []
    for event in orchestrate_stream(db, query, user=user, thread_id=thread_id, context=context):
        events.append(event)
    done = next((e for e in reversed(events) if e.get("type") == "done"), {})
    return {
        "response": done.get("content") or done.get("answer") or "",
        "thread_id": done.get("thread_id") or thread_id,
        "decision_id": done.get("decision_id"),
        "skill": done.get("skill"),
        "skills": done.get("skills") or [],
        "events": events,
        "refused": done.get("refused", False),
        "actions": done.get("actions") or [],
        "data_cards": done.get("data_cards") or [],
        "reasoning_trace": done.get("reasoning_trace") or [],
        "follow_ups": done.get("follow_ups") or [],
        "insight_chain": done.get("insight_chain"),
        "missing_signals": done.get("missing_signals"),
        "evidence": done.get("evidence") or [],
        "object_ids": done.get("object_ids") or [],
    }


def orchestrate_stream(
    db: Session,
    query: str,
    *,
    user=None,
    thread_id: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> Generator[Dict[str, Any], None, None]:
    from auth import identity_from_user

    started = time.time()
    user = identity_from_user(user)
    user_id = user.id or "system"
    thread_id = thread_id or f"th_{uuid.uuid4().hex[:8]}"
    context = dict(context or {})
    causation_id = context.get("causation_id") or str(uuid.uuid4())
    context["causation_id"] = causation_id
    pinned = context.get("object_id") or ""

    yield _sse("thinking", content="护栏检查中…")
    trace: List[Dict[str, Any]] = [{"step": "guardrails", "status": "ok"}]
    if not query or not str(query).strip():
        yield _sse("error", content="空查询被护栏拒绝")
        yield _sse("done", content="空查询被护栏拒绝", answer="空查询被护栏拒绝", thread_id=thread_id, refused=True)
        return
    if len(query) > 8000:
        yield _sse("error", content="输入过长")
        yield _sse("done", content="输入过长", answer="输入过长", thread_id=thread_id, refused=True)
        return

    cache_key = f"{user_id}:{pinned}:{query.strip()}"
    cached = _cache_get(cache_key)
    if cached and time.time() - cached["ts"] < _CACHE_TTL:
        yield _sse("content", content=cached["content"])
        done = dict(cached.get("done") or {})
        done["thread_id"] = thread_id
        done["cached"] = True
        yield _sse("done", **done)
        return

    loader = get_skill_loader()
    weights = {}
    try:
        from decision.learning import get_weights
        weights = get_weights(db)
    except Exception:
        weights = {}
    primary = loader.match(query, weights=weights)
    skills = loader.match_many(query, limit=3, weights=weights)
    if primary.name not in {s.name for s in skills}:
        skills = [primary] + [s for s in skills if s.name != primary.name]
        skills = skills[:3]
    intent = primary.intent

    pack = activate(db, query, user=user, skills=skills)
    if pack.get("refuse") or pack.get("truncated_hard_rules"):
        from decision.recorder import DecisionRecorder
        rec = DecisionRecorder(db).record(
            category="analysis",
            scenario=query,
            reasoning=pack.get("refuse_reason") or "硬规则被裁掉",
            outcome="blocked",
            confidence=1.0,
            decision_maker=user_id,
            force_blocked=True,
            refuse_reason=pack.get("refuse_reason") or "硬规则窗口被裁掉，拒绝作答",
        )
        db.commit()
        msg = pack.get("refuse_reason") or "硬规则窗口被裁掉，拒绝作答"
        yield _sse("error", content=msg)
        yield _sse(
            "done",
            content=msg,
            answer=msg,
            thread_id=thread_id,
            decision_id=rec["id"],
            refused=True,
        )
        return

    yield _sse("intent", content=intent, intent=intent)
    trace.append({"step": "intent", "value": intent})
    yield _sse(
        "routing",
        content="DecisionAgent",
        agent="DecisionAgent",
        skills=[s.name for s in skills],
    )
    trace.append({"step": "routing", "agent": "DecisionAgent", "skills": [s.name for s in skills]})
    slots = extract_slots(query, pack, context)
    slots["causation_id"] = causation_id
    yield _sse(
        "skill",
        content=",".join(s.name for s in skills),
        skill=primary.name,
        skills=[s.name for s in skills],
        risk_level=primary.risk_level,
    )
    yield _sse(
        "reasoning",
        content="启用 Skill：" + "；".join(f"{s.title} — {s.description}" for s in skills if s.description),
    )

    result = None
    for round_idx in range(3):
        result = run_skills(db, skills, query, slots, user=user)
        if result.get("status") == "refused":
            from decision.recorder import DecisionRecorder
            rec = DecisionRecorder(db).record(
                category="analysis",
                scenario=query,
                reasoning=result.get("reason") or result.get("content"),
                outcome="blocked",
                confidence=1.0,
                decision_maker=user_id,
                force_blocked=True,
                refuse_reason=result.get("reason") or result.get("content"),
            )
            db.commit()
            yield _sse("error", content=result.get("content"))
            yield _sse("done", content=result.get("content"), answer=result.get("content"), thread_id=thread_id, decision_id=rec["id"], refused=True)
            return
        yield _sse("reasoning", content=f"reflection round {round_idx + 1}: {result.get('status')}")
        if result.get("status") == "ok" and result.get("content"):
            trace.append({"step": "reflection", "round": round_idx + 1, "status": result.get("status")})
            break

    result = result or {}
    hallu = detect_hallucination(
        result.get("content") or "",
        object_ids=result.get("object_ids") or [],
        pack=pack,
    )
    trace.append({"step": "hallucination", "passed": hallu.get("passed"), "issues": hallu.get("issues") or []})
    content = result.get("content") or ""
    if not hallu["passed"]:
        content = content + "\n\n（幻觉检测提示：" + "; ".join(i["detail"] for i in hallu["issues"][:3]) + "）"

    tools_used = result.get("gateway") or result.get("proposal")
    if tools_used:
        yield _sse("tools_used", content=str(tools_used), tools_used=tools_used)

    actions = _suggested_actions(query, result, pack, skill_name=primary.name)
    data_cards = _data_cards_from_result(result, pack)
    if actions:
        yield _sse("actions", content=f"{len(actions)} actions", actions=actions)
    for card in data_cards:
        yield _sse("data_card", content=card.get("title") or "data", data_card=card)

    suggestions = []
    follow_ups = _follow_ups(
        primary.name,
        (result.get("object_ids") or [None])[0],
        any(a.get("requires_accept") for a in actions),
    )
    if follow_ups:
        suggestions = [item["label"] for item in follow_ups]
    elif primary.name in ("metric_diagnosis", "causal_explainer", "attribution-analyzer") and result.get("object_ids"):
        suggestions.append("可进一步生成整改草稿或提交待审批动作")
    if follow_ups:
        yield _sse("follow_ups", content=follow_ups[0]["label"], follow_ups=follow_ups)
    if suggestions:
        yield _sse("suggestions", content=suggestions[0], suggestions=suggestions)

    from decision.recorder import DecisionRecorder
    rec = DecisionRecorder(db).record(
        category="analysis" if primary.risk_level in ("R0", "R1") else "action",
        scenario=query,
        reasoning=content[:2000],
        outcome="blocked" if result.get("status") == "blocked" else "diagnosed" if primary.name in ("metric_diagnosis", "attribution-analyzer") else "recorded",
        confidence=0.85 if hallu["passed"] else 0.55,
        decision_maker=user_id,
        evidence_ids=result.get("evidence") or [],
        entity_ids=result.get("object_ids") or [],
        causation_id=causation_id,
        parent_decision_id=slots.get("parent_decision_id"),
        metadata={
            "skill": primary.name,
            "skills": [s.name for s in skills],
            "intent": intent,
            "hallucination": hallu,
            "latency_ms": int((time.time() - started) * 1000),
            "reasoning_trace": trace,
            "insight_chain": result.get("insight_chain"),
            "missing_signals": result.get("missing_signals"),
            "object_id": slots.get("object_id"),
        },
    )
    if slots.get("parent_decision_id"):
        try:
            from decision.causal import add_causal_relationship
            add_causal_relationship(db, slots["parent_decision_id"], rec["id"], "precedes")
        except Exception:
            pass
    db.commit()

    yield _sse("content", content=content)
    done_payload = {
        "content": content,
        "answer": content,
        "decision_id": rec["id"],
        "skill": primary.name,
        "skills": [s.name for s in skills],
        "intent": intent,
        "hallucination": hallu,
        "refused": False,
        "actions": actions,
        "data_cards": data_cards,
        "reasoning_trace": trace,
        "follow_ups": follow_ups,
        "insight_chain": result.get("insight_chain"),
        "missing_signals": result.get("missing_signals"),
        "evidence": result.get("evidence") or [],
        "object_ids": result.get("object_ids") or [],
    }
    _cache_set(cache_key, {"ts": time.time(), "content": content, "done": done_payload})
    yield _sse("done", thread_id=thread_id, **done_payload)

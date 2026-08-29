"""OAG Context Pack: token budget + hard-rule reservation window.

If HR-* rules would be truncated, callers must refuse (finance pattern).
Instances are scored by relevance and trimmed. Schema (classes / relations)
and sales signals are injected alongside instances.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from semantic.context_graph import LocalSemanticAdapter
from semantic.ontology import get_ontology
from semantic.ports import AccessScope
from semantic.sales_signals import compute_sales_signals_batch, format_signals

HARD_RULES = [
    {
        "id": "HR-001",
        "text": "HR-001: 无对象 ID 不得提案写操作。改变世界状态的动作必须绑定明确的 Ontology 对象。",
    },
    {
        "id": "HR-002",
        "text": "HR-002: 高风险动作（风险级 R2 及以上）必须经人工审批后才可执行。",
    },
    {
        "id": "HR-003",
        "text": "HR-003: 职责分离（SoD）：提交人不得等于终审人。",
    },
    {
        "id": "HR-004",
        "text": "HR-004: 动作必须作用于合同声明的本体类或其子类（例如 scheduleVisit 仅适用于 HCP/Hospital）。",
    },
]

HARD_RULE_TOKEN_BUDGET = 1500
DEFAULT_TOTAL_TOKEN_BUDGET = 8000


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 3)


def format_hard_rules() -> str:
    return "\n".join(f"- {r['text']}" for r in HARD_RULES)


def merge_required_context(skills: Optional[List[Any]] = None) -> Dict[str, Any]:
    object_types: List[str] = []
    relations: List[str] = []
    rules: List[str] = []
    max_hops = 1
    for skill in skills or []:
        ctx = getattr(skill, "required_context", None) or {}
        for ot in ctx.get("object_types") or []:
            if ot not in object_types:
                object_types.append(ot)
        for rel in ctx.get("relations") or []:
            if rel not in relations:
                relations.append(rel)
        for rule in ctx.get("rules") or []:
            if rule not in rules:
                rules.append(rule)
        hops = ctx.get("max_hops")
        if isinstance(hops, int) and hops > max_hops:
            max_hops = hops
    return {
        "object_types": object_types,
        "relations": relations,
        "rules": rules,
        "max_hops": max_hops,
    }


def relevance_score(obj, query: str, preferred_types: Optional[List[str]] = None) -> float:
    q = (query or "").lower()
    name = (getattr(obj, "name", None) or "").lower()
    ot = getattr(obj, "object_type", "") or ""
    score = 0.0
    if name and name in q:
        score += 6.0
    elif name and any(token and token in name for token in q.split() if len(token) >= 2):
        score += 2.0
    if ot.lower() in q:
        score += 2.0
    if preferred_types and ot in preferred_types:
        score += 3.0
    status = getattr(obj, "status", None)
    if status in ("warning", "critical"):
        score += 1.5
    return score


def build_context_pack(
    db: Session,
    query: str,
    *,
    user=None,
    object_types: Optional[List[str]] = None,
    hops: int = 1,
    total_budget: int = DEFAULT_TOTAL_TOKEN_BUDGET,
    hard_rule_budget: int = HARD_RULE_TOKEN_BUDGET,
    required_context: Optional[Dict[str, Any]] = None,
    skills: Optional[List[Any]] = None,
    as_of: Optional[datetime] = None,
    lookback_days: Optional[int] = None,
) -> Dict[str, Any]:
    """Build a permission-trimmed, token-budgeted analysis context.

    Returns truncated_hard_rules=True when HR-* cannot fit the reserved window.
    as_of / lookback_days apply OntoNexus-style temporal filtering on edges and observations.
    """
    from services.ontology_context import (
        _build_action_context,
        _build_object_context,
        _find_relevant_objects,
        format_context_for_llm,
    )

    merged = dict(required_context or {})
    if skills:
        from_skills = merge_required_context(skills)
        types = list(merged.get("object_types") or [])
        for ot in from_skills["object_types"]:
            if ot not in types:
                types.append(ot)
        merged["object_types"] = types
        merged["relations"] = from_skills["relations"]
        merged["rules"] = from_skills["rules"]
        hops = max(hops, from_skills["max_hops"])

    preferred_types = object_types or merged.get("object_types") or None
    scope = LocalSemanticAdapter.scope_from_user(user)
    adapter = LocalSemanticAdapter(db)
    as_of = as_of or datetime.now(timezone.utc)
    hard_text = format_hard_rules()
    hard_tokens = estimate_tokens(hard_text)

    truncated_hard_rules = hard_tokens > hard_rule_budget
    remaining = max(0, total_budget - min(hard_tokens, hard_rule_budget))

    onto = get_ontology()
    schema = onto.schema_for_oag(preferred_types)
    schema_text = _format_schema(schema, merged.get("relations") or [])
    schema_tokens = estimate_tokens(schema_text)
    remaining = max(0, remaining - min(schema_tokens, remaining // 4))

    objects = _find_relevant_objects(db, query, None)
    ranked = sorted(
        objects,
        key=lambda o: relevance_score(o, query, preferred_types),
        reverse=True,
    )

    candidates = [obj for obj in ranked[:16] if scope.can_read_type(obj.object_type)]
    signals_by_id = compute_sales_signals_batch(db, candidates)
    if hops >= 1 and candidates:
        adapter.hydrate_neighborhood(
            [obj.id for obj in candidates],
            hops=hops,
            scope=scope,
            as_of=as_of,
        )

    contexts: List[Dict[str, Any]] = []
    used = 0
    for obj in candidates:
        ctx = _build_object_context(db, obj)
        ctx["properties"] = scope.mask_properties(obj.object_type, ctx.get("properties") or {})
        ctx["class"] = obj.object_type
        ctx["ancestors"] = onto.ancestors(obj.object_type)
        ctx["relevance_score"] = relevance_score(obj, query, preferred_types)
        signals = signals_by_id.get(obj.id) or {}
        if signals:
            ctx["sales_signals"] = signals
            ctx["sales_signals_text"] = format_signals(signals)
        allowed = [
            r
            for r in schema.get("object_properties") or []
            if onto.compatible(obj.object_type, r.get("domain") or [])
        ]
        ctx["allowed_relations"] = allowed[:12]
        if hops >= 1:
            subgraph = adapter.get_subgraph([obj.id], hops=hops, scope=scope, as_of=as_of)
            ctx["subgraph"] = {
                "nodeCount": len(subgraph.get("nodes", [])),
                "edgeCount": len(subgraph.get("edges", [])),
                "edges": subgraph.get("edges", [])[:12],
                "asOf": as_of.isoformat() if hasattr(as_of, "isoformat") else str(as_of),
            }
        if lookback_days:
            obs = adapter.get_observations(obj.id, window=f"{int(lookback_days)}d")
            ctx["observations"] = _trim_observations(obs, as_of, lookback_days)
        ctx["availableActions"] = _build_action_context(db, obj)
        piece = format_context_for_llm(ctx)
        if ctx.get("sales_signals_text"):
            piece = piece + "\n" + ctx["sales_signals_text"]
        piece_tokens = estimate_tokens(piece)
        if used + piece_tokens > remaining and contexts:
            break
        contexts.append(ctx)
        used += piece_tokens

    analysis_text_parts = []
    for ctx in contexts:
        piece = format_context_for_llm(ctx)
        if ctx.get("sales_signals_text"):
            piece = piece + "\n" + ctx["sales_signals_text"]
        analysis_text_parts.append(piece)
    analysis_text = "\n\n".join(analysis_text_parts)

    pack_text = (
        f"## 硬规则（必须遵守）\n{hard_text}\n\n"
        f"## 本体图式\n{schema_text}\n\n"
        f"## 分析上下文\n{analysis_text}"
    )

    pack = {
        "query": query,
        "as_of": as_of.isoformat() if hasattr(as_of, "isoformat") else str(as_of),
        "lookback_days": lookback_days,
        "hard_rules": HARD_RULES if not truncated_hard_rules else [],
        "hard_rules_text": hard_text if not truncated_hard_rules else "",
        "truncated_hard_rules": truncated_hard_rules,
        "schema": schema,
        "required_context": merged,
        "contexts": contexts,
        "matchedObjects": len(contexts),
        "token_estimate": estimate_tokens(pack_text),
        "pack_text": pack_text if not truncated_hard_rules else "",
        "refuse": truncated_hard_rules,
        "refuse_reason": "硬规则窗口被裁掉，拒绝作答" if truncated_hard_rules else None,
    }
    from semantic.logic import facts_about, infer_pack
    from semantic.shapes import shapes_from_ontology
    from actions.contracts import eligible_write_actions

    if pack.get("refuse") or pack.get("truncated_hard_rules"):
        pack["shapes"] = []
        pack["derived_facts"] = []
        pack["logic_trace"] = []
        return pack
    preferred = merged.get("object_types") or None
    pack["shapes"] = shapes_from_ontology(onto, preferred)
    inferred = infer_pack(pack, onto)
    pack["derived_facts"] = inferred["facts"]
    pack["logic_trace"] = inferred["trace"]
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        ot = obj.get("objectType") or obj.get("type")
        ctx["derived_facts"] = facts_about(inferred["facts"], oid) if oid else []
        ctx["eligible_actions"] = eligible_write_actions(ot)
    if inferred["trace"] and pack.get("pack_text"):
        lines = [f"- {step['conclusion']} ⇐ {step['rule']}" for step in inferred["trace"][:16]]
        pack["pack_text"] = pack["pack_text"] + "\n\n## 推导事实\n" + "\n".join(lines)
        pack["token_estimate"] = estimate_tokens(pack["pack_text"])
    return pack


def _format_schema(schema: Dict[str, Any], preferred_relations: List[str]) -> str:
    lines = ["类:"]
    for cls in (schema.get("classes") or [])[:12]:
        parents = ",".join(cls.get("parents") or [])
        lines.append(f"- {cls.get('name')}" + (f" ⊂ {parents}" if parents else ""))
    lines.append("允许关系:")
    rels = schema.get("object_properties") or []
    if preferred_relations:
        rels = [r for r in rels if r.get("linkType") in preferred_relations] or rels
    for rel in rels[:16]:
        lines.append(
            f"- {rel.get('linkType')}: {rel.get('domain')} → {rel.get('range')} ({rel.get('cardinality')})"
        )
    return "\n".join(lines)


def _trim_observations(obs: Dict[str, Any], as_of: datetime, lookback_days: int) -> Dict[str, Any]:
    start = as_of - timedelta(days=int(lookback_days))
    series = {}
    for name, points in (obs.get("series") or {}).items():
        kept = []
        for point in points:
            ts = point.get("timestamp")
            if not ts:
                continue
            try:
                parsed = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
                if parsed.tzinfo:
                    parsed = parsed.replace(tzinfo=None)
                moment = as_of.replace(tzinfo=None) if getattr(as_of, "tzinfo", None) else as_of
                window_start = start.replace(tzinfo=None) if getattr(start, "tzinfo", None) else start
                if window_start <= parsed <= moment:
                    kept.append(point)
            except (TypeError, ValueError):
                kept.append(point)
        if kept:
            series[name] = kept
    events = []
    for event in obs.get("events") or []:
        ts = event.get("timestamp")
        if not ts:
            events.append(event)
            continue
        try:
            parsed = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            if parsed.tzinfo:
                parsed = parsed.replace(tzinfo=None)
            moment = as_of.replace(tzinfo=None) if getattr(as_of, "tzinfo", None) else as_of
            window_start = start.replace(tzinfo=None) if getattr(start, "tzinfo", None) else start
            if window_start <= parsed <= moment:
                events.append(event)
        except (TypeError, ValueError):
            events.append(event)
    return {"window": f"{lookback_days}d", "series": series, "events": events[:12]}

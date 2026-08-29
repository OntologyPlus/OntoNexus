"""Hallucination checks: fact anchor, numeric tolerance, relation, context sufficiency."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


NUMERIC_TOLERANCE = 0.05


def detect_hallucination(
    content: str,
    *,
    object_ids: Optional[List[str]] = None,
    pack: Optional[Dict[str, Any]] = None,
    numeric_facts: Optional[Dict[str, float]] = None,
) -> Dict[str, Any]:
    issues = []
    pack = pack or {}
    object_ids = object_ids or []
    contexts = pack.get("contexts") or []

    known_ids = set(object_ids)
    known_names = set()
    known_relations = set()
    for ctx in contexts:
        obj = ctx.get("object") or {}
        if obj.get("id"):
            known_ids.add(obj["id"])
        if obj.get("name"):
            known_names.add(str(obj["name"]))
        for link in ctx.get("links") or []:
            known_relations.add(link.get("linkType"))
            if link.get("targetName"):
                known_names.add(str(link["targetName"]))

    if not contexts and not known_ids:
        issues.append({"strategy": "context_sufficiency", "detail": "分析上下文为空"})

    cited_ids = set(re.findall(r"\b(?:obj_|d_|h_|p_|dec_|ap_)[A-Za-z0-9_-]+", content or ""))
    cited_ids |= set(re.findall(r"id=([A-Za-z0-9_-]+)", content or ""))
    unknown = [cid for cid in cited_ids if known_ids and cid not in known_ids]
    if unknown:
        issues.append({"strategy": "fact_anchor", "detail": f"未锚定对象: {unknown[:5]}"})

    if numeric_facts:
        numbers = [float(n) for n in re.findall(r"(\d+(?:\.\d+)?)", content or "")]
        for name, expected in numeric_facts.items():
            if expected == 0:
                continue
            close = any(abs(n - expected) / abs(expected) <= NUMERIC_TOLERANCE for n in numbers)
            if str(expected) in (content or "") or str(int(expected)) in (content or ""):
                close = True
            if name.lower() in (content or "").lower() and numbers and not close:
                issues.append({"strategy": "numeric", "detail": f"{name} 偏离允许容差 {NUMERIC_TOLERANCE}"})

    relation_mentions = re.findall(r"\[([A-Z_]+)\]", content or "")
    for rel in relation_mentions:
        if known_relations and rel not in known_relations:
            issues.append({"strategy": "relation", "detail": f"未知关系 {rel}"})

    passed = len(issues) == 0
    return {"passed": passed, "issues": issues}

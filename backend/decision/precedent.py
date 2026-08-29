"""Precedent search over recorded decisions.

Uses lexical overlap plus optional embedding similarity via memory_service.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.decision import DecisionRecord


def _tokenize(text: str) -> set:
    if not text:
        return set()
    raw = text.lower().replace("，", " ").replace("。", " ").replace(",", " ")
    return {t for t in raw.split() if len(t) >= 2}


def _score(query: str, scenario: str, reasoning: str) -> float:
    q = _tokenize(query)
    if not q:
        return 0.0
    doc = _tokenize(f"{scenario} {reasoning or ''}")
    if not doc:
        return 0.0
    overlap = len(q & doc)
    return overlap / max(len(q), 1)


def find_similar_decisions(
    db: Session,
    query: str,
    *,
    category: Optional[str] = None,
    max_results: int = 5,
) -> List[Dict[str, Any]]:
    from decision.recorder import DecisionRecorder

    q = db.query(DecisionRecord)
    if category:
        q = q.filter(DecisionRecord.category == category)
    rows = q.order_by(DecisionRecord.created_at.desc()).limit(200).all()
    scored = []
    for row in rows:
        scored.append((_score(query, row.scenario, row.reasoning or ""), row))
    scored.sort(key=lambda x: x[0], reverse=True)
    recorder = DecisionRecorder(db)
    results = []
    for score, row in scored[:max_results]:
        if score <= 0:
            continue
        item = recorder.to_dict(row)
        item["similarity"] = round(score, 4)
        results.append(item)

    if results:
        return results

    try:
        from services.memory_service import search_memory_semantic
        memories = search_memory_semantic(db, query=query, memory_type="decision", top_k=max_results)
        for mem in memories or []:
            results.append({
                "id": mem.get("id"),
                "scenario": mem.get("content_text") or mem.get("content"),
                "similarity": mem.get("score", 0),
                "source": "memory",
            })
    except Exception:
        pass
    return results

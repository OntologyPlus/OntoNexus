"""Causal edges between decisions."""

from __future__ import annotations

import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.decision import DecisionEdge, DecisionRecord

VALID_RELATIONS = {"triggers", "enables", "causes", "precedes"}


def add_causal_relationship(
    db: Session,
    source_id: str,
    target_id: str,
    relation: str = "causes",
) -> Dict[str, Any]:
    if relation not in VALID_RELATIONS:
        raise ValueError(f"relation must be one of {VALID_RELATIONS}")
    edge = DecisionEdge(
        id=f"de_{uuid.uuid4().hex[:12]}",
        source_id=source_id,
        target_id=target_id,
        relation=relation,
    )
    db.add(edge)
    db.flush()
    return {"id": edge.id, "sourceId": source_id, "targetId": target_id, "relation": relation}


def trace_decision_chain(db: Session, decision_id: str, direction: str = "ancestors") -> Dict[str, Any]:
    from decision.recorder import DecisionRecorder

    recorder = DecisionRecorder(db)
    root = recorder.get(decision_id)
    if not root:
        return {"error": "Decision not found", "nodes": [], "edges": []}

    nodes = {decision_id: root}
    edges: List[Dict[str, Any]] = []
    visited = {decision_id}
    frontier = [decision_id]

    while frontier:
        current = frontier.pop()
        if direction == "ancestors":
            rels = db.query(DecisionEdge).filter(DecisionEdge.target_id == current).all()
            next_ids = [e.source_id for e in rels]
        else:
            rels = db.query(DecisionEdge).filter(DecisionEdge.source_id == current).all()
            next_ids = [e.target_id for e in rels]
        for edge in rels:
            edges.append({
                "id": edge.id,
                "sourceId": edge.source_id,
                "targetId": edge.target_id,
                "relation": edge.relation,
            })
        for nid in next_ids:
            if nid in visited:
                continue
            visited.add(nid)
            node = recorder.get(nid)
            if node:
                nodes[nid] = node
                frontier.append(nid)

    parent = root.get("parentDecisionId")
    if parent and parent not in nodes:
        p = recorder.get(parent)
        if p:
            nodes[parent] = p
            edges.append({
                "id": f"parent_{parent}",
                "sourceId": parent,
                "targetId": decision_id,
                "relation": "precedes",
            })

    return {"rootId": decision_id, "nodes": list(nodes.values()), "edges": edges}


def analyze_decision_impact(db: Session, decision_id: str) -> Dict[str, Any]:
    downstream = trace_decision_chain(db, decision_id, direction="descendants")
    return {
        "decisionId": decision_id,
        "downstreamCount": max(0, len(downstream.get("nodes", [])) - 1),
        "edges": downstream.get("edges", []),
        "nodes": downstream.get("nodes", []),
    }

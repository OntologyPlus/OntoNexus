"""AI learning loop (SalesClaw apply_feedback + 24h delayed evaluation).

Accept / approve records a pending SkillOutcome with evaluate_after = now+24h.
When due, effectiveness is scored from sales signals (visit effect / coverage / status),
then weights adjust:
  score < 0.3 → weight -= 0.2 (floor 0.3)
  score > 0.7 → weight += 0.1 (cap 1.5)
Immediate reject is scored now (known negative outcome). Approve is never scored 0.8 on the spot.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.learning import SkillOutcome, SkillWeight

FLOOR = 0.3
CEILING = 1.5
DEFAULT_WEIGHT = 1.0
EVALUATE_AFTER_HOURS = float(os.environ.get("SKILL_EVALUATE_AFTER_HOURS", "24"))


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_weights(db: Session) -> Dict[str, float]:
    rows = db.query(SkillWeight).all()
    return {row.skill_name: float(row.weight or DEFAULT_WEIGHT) for row in rows}


def get_weight(db: Session, skill_name: str) -> float:
    row = db.query(SkillWeight).filter(SkillWeight.skill_name == skill_name).first()
    if not row:
        return DEFAULT_WEIGHT
    return float(row.weight or DEFAULT_WEIGHT)


def apply_feedback(db: Session, skill_name: str, effectiveness: float, *, note: Optional[str] = None) -> Dict[str, Any]:
    score = max(0.0, min(1.0, float(effectiveness)))
    row = db.query(SkillWeight).filter(SkillWeight.skill_name == skill_name).first()
    if not row:
        row = SkillWeight(skill_name=skill_name, weight=DEFAULT_WEIGHT, samples=0)
        db.add(row)
        db.flush()
    weight = float(row.weight or DEFAULT_WEIGHT)
    if score < 0.3:
        weight = max(FLOOR, weight - 0.2)
    elif score > 0.7:
        weight = min(CEILING, weight + 0.1)
    row.weight = round(weight, 4)
    row.samples = int(row.samples or 0) + 1
    row.last_score = score
    db.flush()
    return {
        "skill": skill_name,
        "weight": row.weight,
        "samples": row.samples,
        "last_score": score,
        "note": note,
    }


def record_outcome(
    db: Session,
    *,
    skill_name: str,
    object_id: Optional[str] = None,
    action_id: Optional[str] = None,
    status: str = "pending",
    effectiveness: Optional[float] = None,
    note: Optional[str] = None,
    evaluate_after: Optional[datetime] = None,
) -> Dict[str, Any]:
    due = evaluate_after
    if status == "pending" and due is None:
        due = _utcnow() + timedelta(hours=EVALUATE_AFTER_HOURS)
    rec = SkillOutcome(
        id=f"so_{uuid.uuid4().hex[:12]}",
        skill_name=skill_name,
        object_id=object_id,
        action_id=action_id,
        status=status,
        effectiveness=effectiveness,
        note=note,
        evaluate_after=due,
    )
    db.add(rec)
    db.flush()
    if status == "scored" and effectiveness is not None:
        rec.evaluated_at = _utcnow()
        apply_feedback(db, skill_name, effectiveness, note=note)
    return {
        "id": rec.id,
        "skill": skill_name,
        "status": status,
        "effectiveness": effectiveness,
        "evaluate_after": rec.evaluate_after.isoformat() if rec.evaluate_after else None,
    }


def list_pending_outcomes(db: Session, *, limit: int = 20) -> List[Dict[str, Any]]:
    now = _utcnow()
    rows = (
        db.query(SkillOutcome)
        .filter(SkillOutcome.status == "pending")
        .order_by(SkillOutcome.evaluate_after.asc())
        .limit(limit)
        .all()
    )
    out = []
    for rec in rows:
        due = rec.evaluate_after
        seconds = int((due - now).total_seconds()) if due else None
        out.append(
            {
                "id": rec.id,
                "skill": rec.skill_name,
                "object_id": rec.object_id,
                "action_id": rec.action_id,
                "status": rec.status,
                "note": rec.note,
                "evaluate_after": due.isoformat() if due else None,
                "seconds_until_due": seconds,
                "due": bool(due and due <= now),
            }
        )
    return out


def list_scored_outcomes(db: Session, *, limit: int = 8) -> List[Dict[str, Any]]:
    rows = (
        db.query(SkillOutcome)
        .filter(SkillOutcome.status == "scored")
        .order_by(SkillOutcome.evaluated_at.desc())
        .limit(limit)
        .all()
    )
    out = []
    for rec in rows:
        out.append(
            {
                "id": rec.id,
                "object_id": rec.object_id,
                "action_id": rec.action_id,
                "status": rec.status,
                "note": rec.note,
                "effectiveness": rec.effectiveness,
                "evaluated_at": rec.evaluated_at.isoformat() if rec.evaluated_at else None,
            }
        )
    return out


def score_outcome(db: Session, outcome_id: str, effectiveness: float, note: Optional[str] = None) -> Optional[Dict[str, Any]]:
    rec = db.query(SkillOutcome).filter(SkillOutcome.id == outcome_id).first()
    if not rec:
        return None
    rec.status = "scored"
    rec.effectiveness = max(0.0, min(1.0, float(effectiveness)))
    rec.note = note or rec.note
    rec.evaluated_at = _utcnow()
    db.flush()
    feedback = apply_feedback(db, rec.skill_name, rec.effectiveness, note=note)
    return {"id": rec.id, **feedback}


def score_from_signals(db: Session, object_id: Optional[str]) -> Dict[str, Any]:
    """Map post-action sales signals to 0–1 effectiveness (SalesClaw evaluate_outcome)."""
    if not object_id:
        return {"effectiveness": 0.5, "note": "no_object", "signals": {}}
    from models.ontology import OntologyObject
    from semantic.sales_signals import compute_sales_signals

    obj = db.query(OntologyObject).filter(OntologyObject.id == object_id).first()
    if not obj:
        return {"effectiveness": 0.5, "note": "object_missing", "signals": {}}
    signals = compute_sales_signals(db, obj)
    ve = ((signals.get("visit_effect") or {}).get("delta"))
    if ve is not None:
        if ve > 0:
            return {"effectiveness": 0.85, "note": "visit_effect_up", "signals": signals}
        if ve < 0:
            return {"effectiveness": 0.2, "note": "visit_effect_down", "signals": signals}
    cov = (signals.get("coverage") or {}).get("rate")
    if cov is not None:
        if cov >= 60:
            return {"effectiveness": 0.75, "note": "coverage_ok", "signals": signals}
        if cov < 30:
            return {"effectiveness": 0.25, "note": "coverage_low", "signals": signals}
    roi = (signals.get("roi") or {}).get("roi_ratio")
    if roi is not None:
        if roi >= 1:
            return {"effectiveness": 0.8, "note": "roi_positive", "signals": signals}
        return {"effectiveness": 0.25, "note": "roi_negative", "signals": signals}
    if obj.status in ("warning", "critical"):
        return {"effectiveness": 0.25, "note": "still_at_risk", "signals": signals}
    if obj.status == "normal":
        return {"effectiveness": 0.7, "note": "status_normal", "signals": signals}
    return {"effectiveness": 0.5, "note": "neutral", "signals": signals}


def evaluate_due_outcomes(db: Session, *, now: Optional[datetime] = None, limit: int = 100) -> List[Dict[str, Any]]:
    """Score pending outcomes whose evaluate_after has passed."""
    cutoff = now or _utcnow()
    due = (
        db.query(SkillOutcome)
        .filter(SkillOutcome.status == "pending", SkillOutcome.evaluate_after != None)  # noqa: E711
        .order_by(SkillOutcome.evaluate_after.asc())
        .limit(limit)
        .all()
    )
    results: List[Dict[str, Any]] = []
    for rec in due:
        if rec.evaluate_after and rec.evaluate_after > cutoff:
            continue
        scored = score_from_signals(db, rec.object_id)
        result = score_outcome(db, rec.id, scored["effectiveness"], note=scored["note"])
        if result:
            result["signals_note"] = scored["note"]
            results.append(result)
    return results

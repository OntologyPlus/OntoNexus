"""Hash-chained audit log (SHA-256). Tamper-evident append-only trail."""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.orm import Session

from models.audit import AuditLog


def _canonical(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _last_hash(db: Session) -> str:
    last = db.query(AuditLog).order_by(AuditLog.timestamp.desc(), AuditLog.id.desc()).first()
    if last and last.record_hash:
        return last.record_hash
    return "0" * 64


def append_audit(
    db: Session,
    *,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    entity_name: Optional[str] = None,
    user_id: Optional[str] = None,
    details: Optional[Any] = None,
    causation_id: Optional[str] = None,
    decision_id: Optional[str] = None,
) -> AuditLog:
    prev = _last_hash(db)
    details_text = details if isinstance(details, str) else _canonical(details or {})
    body = {
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "user_id": user_id,
        "details": details_text,
        "prev_hash": prev,
        "causation_id": causation_id,
        "decision_id": decision_id,
    }
    record_hash = _sha256(prev + _canonical(body))
    rec = AuditLog(
        id=f"al_{uuid.uuid4().hex[:12]}",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_name=entity_name,
        user_id=user_id,
        details=details_text,
        prev_hash=prev,
        record_hash=record_hash,
        causation_id=causation_id,
        decision_id=decision_id,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(rec)
    db.flush()
    return rec


def verify_chain(db: Session) -> Dict[str, Any]:
    rows = db.query(AuditLog).order_by(AuditLog.timestamp.asc(), AuditLog.id.asc()).all()
    hashed = [r for r in rows if r.record_hash]
    if not hashed:
        return {"valid": True, "count": 0, "legacy_unhashed": len(rows)}
    prev = "0" * 64
    started = False
    for rec in hashed:
        if not started:
            if rec.prev_hash and rec.prev_hash != "0" * 64:
                expected_prev = rec.prev_hash
            else:
                expected_prev = "0" * 64
            started = True
        else:
            expected_prev = prev
        if rec.prev_hash != expected_prev:
            return {"valid": False, "broken_at": rec.id, "reason": "prev_hash mismatch", "count": len(hashed)}
        body = {
            "action": rec.action,
            "entity_type": rec.entity_type,
            "entity_id": rec.entity_id,
            "user_id": rec.user_id,
            "details": rec.details or "{}",
            "prev_hash": rec.prev_hash,
            "causation_id": rec.causation_id,
            "decision_id": rec.decision_id,
        }
        expected = _sha256(rec.prev_hash + _canonical(body))
        if expected != rec.record_hash:
            return {"valid": False, "broken_at": rec.id, "reason": "record_hash mismatch", "count": len(hashed)}
        prev = rec.record_hash
    return {"valid": True, "count": len(hashed), "legacy_unhashed": len(rows) - len(hashed)}

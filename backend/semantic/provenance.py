"""W3C PROV-O style provenance with SHA-256 integrity (OntoNexus pattern).

entity / activity / agent records chained by prev_hash. SQLite is SoT.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models.provenance import ProvenanceRecord


def _canonical(payload: Dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class ProvenanceManager:
    def __init__(self, db: Session):
        self.db = db

    def _last_hash(self) -> str:
        last = (
            self.db.query(ProvenanceRecord)
            .order_by(ProvenanceRecord.created_at.desc(), ProvenanceRecord.id.desc())
            .first()
        )
        return last.record_hash if last else "0" * 64

    def _write(
        self,
        record_type: str,
        subject_id: Optional[str],
        agent: str,
        payload: Dict[str, Any],
    ) -> ProvenanceRecord:
        prev = self._last_hash()
        body = {
            "type": record_type,
            "subject_id": subject_id,
            "agent": agent,
            "payload": payload,
            "prev_hash": prev,
        }
        record_hash = _sha256(prev + _canonical(body))
        rec = ProvenanceRecord(
            id=f"prov_{uuid.uuid4().hex[:12]}",
            record_type=record_type,
            subject_id=subject_id,
            agent=agent,
            payload=_canonical(payload),
            prev_hash=prev,
            record_hash=record_hash,
            created_at=datetime.now(timezone.utc),
        )
        self.db.add(rec)
        self.db.flush()
        return rec

    def track_entity(
        self,
        entity_id: str,
        agent: str = "system",
        source: str = "sot",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        rec = self._write(
            "entity",
            entity_id,
            agent,
            {"source": source, **(metadata or {})},
        )
        return rec.id

    def track_relationship(
        self,
        source_id: str,
        link_type: str,
        target_id: str,
        agent: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        rec = self._write(
            "relationship",
            f"{source_id}:{link_type}:{target_id}",
            agent,
            {"source_id": source_id, "link_type": link_type, "target_id": target_id, **(metadata or {})},
        )
        return rec.id

    def track_activity(
        self,
        activity_type: str,
        agent: str = "system",
        entity_ids: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        rec = self._write(
            "activity",
            activity_type,
            agent,
            {
                "activity_type": activity_type,
                "entity_ids": entity_ids or [],
                **(metadata or {}),
            },
        )
        return rec.id

    def get_record(self, evidence_id: str) -> Optional[Dict[str, Any]]:
        rec = self.db.query(ProvenanceRecord).filter(ProvenanceRecord.id == evidence_id).first()
        if not rec:
            return None
        return self._to_dict(rec)

    def lineage(self, subject_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        rows = (
            self.db.query(ProvenanceRecord)
            .filter(ProvenanceRecord.subject_id == subject_id)
            .order_by(ProvenanceRecord.created_at.desc())
            .limit(limit)
            .all()
        )
        return [self._to_dict(r) for r in rows]

    def verify_chain(self) -> Dict[str, Any]:
        rows = (
            self.db.query(ProvenanceRecord)
            .order_by(ProvenanceRecord.created_at.asc(), ProvenanceRecord.id.asc())
            .all()
        )
        prev = "0" * 64
        for rec in rows:
            if rec.prev_hash != prev:
                return {"valid": False, "broken_at": rec.id, "reason": "prev_hash mismatch"}
            body = {
                "type": rec.record_type,
                "subject_id": rec.subject_id,
                "agent": rec.agent,
                "payload": json.loads(rec.payload) if rec.payload else {},
                "prev_hash": rec.prev_hash,
            }
            expected = _sha256(rec.prev_hash + _canonical(body))
            if expected != rec.record_hash:
                return {"valid": False, "broken_at": rec.id, "reason": "record_hash mismatch"}
            prev = rec.record_hash
        return {"valid": True, "count": len(rows)}

    @staticmethod
    def _to_dict(rec: ProvenanceRecord) -> Dict[str, Any]:
        return {
            "id": rec.id,
            "recordType": rec.record_type,
            "subjectId": rec.subject_id,
            "agent": rec.agent,
            "payload": json.loads(rec.payload) if rec.payload else {},
            "prevHash": rec.prev_hash,
            "recordHash": rec.record_hash,
            "createdAt": rec.created_at.isoformat() if rec.created_at else None,
        }

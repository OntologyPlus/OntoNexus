"""Map CRM/ERP records onto ontology instances. No NER, no new identity.

Caller supplies typed objects + links. We validate against the ontology TBox,
upsert ABox (OntologyObject + domain row + ObjectLink), and remember
(source, external_id) → object_id.
"""

from __future__ import annotations

import re
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from exceptions import OntologyValidationError
from models.ontology import ObjectLink, OntologyObject
from models.source_binding import SourceBinding
from semantic.ontology import get_ontology
from services.domain_mapper import _create_domain_row, _update_domain_row


def _camel_to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _domain_properties(properties: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for key, value in (properties or {}).items():
        out[key] = value
        snake = _camel_to_snake(key)
        if snake not in out:
            out[snake] = value
    return out


def _binding(db: Session, source: str, external_id: str) -> Optional[SourceBinding]:
    return (
        db.query(SourceBinding)
        .filter(SourceBinding.source_system == source, SourceBinding.external_id == external_id)
        .first()
    )


def list_bindings(db: Session, limit: int = 50) -> List[Dict[str, Any]]:
    rows = db.query(SourceBinding).order_by(SourceBinding.updated_at.desc()).limit(limit).all()
    return [
        {
            "source": r.source_system,
            "external_id": r.external_id,
            "object_id": r.object_id,
            "object_type": r.object_type,
            "last_status": r.last_status,
            "last_error": r.last_error,
        }
        for r in rows
    ]


def sync_record(db: Session, source: str, record: Dict[str, Any]) -> Dict[str, Any]:
    external_id = str(record.get("external_id") or "").strip()
    object_type = str(record.get("object_type") or record.get("objectType") or "").strip()
    name = str(record.get("name") or "").strip()
    if not source or not external_id:
        raise OntologyValidationError("source 与 external_id 必填")
    if not object_type:
        raise OntologyValidationError("object_type 必填")
    if not name:
        raise OntologyValidationError("name 必填")

    onto = get_ontology()
    if object_type not in onto.classes:
        raise OntologyValidationError(f"未知本体类: {object_type}")

    properties = record.get("properties") or {}
    onto.require_valid_object(object_type, properties, partial=False)

    links = record.get("links") or []
    resolved_links = []
    for link in links:
        link_type = link.get("linkType") or link.get("link_type") or ""
        target_type = link.get("targetType") or link.get("target_type") or ""
        target_id = _resolve_target_id(db, source, link)
        if not target_id:
            raise OntologyValidationError(
                f"关系 {link_type} 的目标未绑定：需要已存在的 target_id 或同系统 target_external_id"
            )
        onto.require_valid_link(str(link_type), object_type, str(target_type))
        target = db.query(OntologyObject).filter(OntologyObject.id == target_id).first()
        if not target:
            raise OntologyValidationError(f"目标对象不存在: {target_id}")
        if target_type and target.object_type != target_type and not onto.is_a(target.object_type, target_type):
            raise OntologyValidationError(
                f"目标类型不符: {target_id} 是 {target.object_type}，声明为 {target_type}"
            )
        resolved_links.append(
            {
                "link_type": link_type,
                "target_id": target_id,
                "target_name": link.get("targetName") or link.get("target_name") or target.name,
                "target_type": target.object_type,
            }
        )

    existing = _binding(db, source, external_id)
    preferred = str(record.get("id") or "").strip() or None
    if existing:
        object_id = existing.object_id
        obj = db.query(OntologyObject).filter(OntologyObject.id == object_id).first()
        if not obj:
            raise OntologyValidationError(f"绑定指向缺失对象 {object_id}")
        if obj.object_type != object_type:
            raise OntologyValidationError(f"{external_id} 已绑定为 {obj.object_type}，不能改为 {object_type}")
        obj.name = name
        if record.get("status"):
            obj.status = record["status"]
        if record.get("lifecycle_stage") or record.get("lifecycleStage"):
            obj.lifecycle_stage = record.get("lifecycle_stage") or record.get("lifecycleStage")
        _update_domain_row(db, object_type, object_id, _domain_properties(properties))
        existing.last_status = "updated"
        existing.last_error = None
        action = "updated"
    else:
        object_id = preferred or f"{object_type.lower()}_{uuid.uuid4().hex[:8]}"
        clash = db.query(OntologyObject).filter(OntologyObject.id == object_id).first()
        if clash:
            if clash.object_type != object_type:
                raise OntologyValidationError(f"id {object_id} 已被 {clash.object_type} 占用")
            obj = clash
            obj.name = name
            if record.get("status"):
                obj.status = record["status"]
            _update_domain_row(db, object_type, object_id, _domain_properties(properties))
            action = "bound_existing"
        else:
            db.add(
                OntologyObject(
                    id=object_id,
                    object_type=object_type,
                    name=name,
                    status=record.get("status") or "normal",
                    lifecycle_stage=record.get("lifecycle_stage") or record.get("lifecycleStage"),
                    owner_id=record.get("owner_id") or record.get("ownerId"),
                )
            )
            _create_domain_row(db, object_type, object_id, _domain_properties(properties))
            action = "created"
        db.add(
            SourceBinding(
                id=f"sb_{uuid.uuid4().hex[:12]}",
                source_system=source,
                external_id=external_id,
                object_id=object_id,
                object_type=object_type,
                last_status=action,
            )
        )

    for link in resolved_links:
        exists = (
            db.query(ObjectLink)
            .filter(
                ObjectLink.source_id == object_id,
                ObjectLink.link_type == link["link_type"],
                ObjectLink.target_id == link["target_id"],
            )
            .first()
        )
        if exists:
            continue
        db.add(
            ObjectLink(
                source_id=object_id,
                link_type=link["link_type"],
                target_id=link["target_id"],
                target_name=link["target_name"],
                target_type=link["target_type"],
                provenance=source,
            )
        )

    db.flush()
    return {
        "status": "accepted",
        "action": action,
        "external_id": external_id,
        "object_id": object_id,
        "object_type": object_type,
    }


def _resolve_target_id(db: Session, source: str, link: Dict[str, Any]) -> Optional[str]:
    target_id = link.get("targetId") or link.get("target_id")
    if target_id:
        return str(target_id)
    ext = link.get("target_external_id") or link.get("targetExternalId")
    if not ext:
        return None
    bound = _binding(db, source, str(ext))
    return bound.object_id if bound else None


def sync_batch_isolated(db: Session, source: str, records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Each record is its own savepoint so one reject does not undo others."""
    accepted: List[Dict[str, Any]] = []
    rejected: List[Dict[str, Any]] = []
    for record in records:
        nested = db.begin_nested()
        try:
            accepted.append(sync_record(db, source, record))
            nested.commit()
        except (OntologyValidationError, ValueError) as exc:
            nested.rollback()
            rejected.append(
                {
                    "status": "rejected",
                    "external_id": record.get("external_id"),
                    "error": getattr(exc, "message", None) or str(exc),
                }
            )
    db.commit()
    return {
        "source": source,
        "accepted": accepted,
        "rejected": rejected,
        "accepted_count": len(accepted),
        "rejected_count": len(rejected),
    }

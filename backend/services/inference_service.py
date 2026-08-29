import uuid
import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from models.inference import InferenceRule, InferenceResult
from models.ontology import OntologyObject, ObjectLink
from models.notification import Notification
from services.domain_mapper import _split_field, DOMAIN_MODEL_MAP
from services import link_service


def combine_confidence_bayesian(prior: float, evidence_strength: float) -> float:
    """使用贝叶斯更新融合置信度。
    P(H|E) = P(E|H) * P(H) / [P(E|H) * P(H) + P(E|¬H) * P(¬H)]
    """
    if prior <= 0.0 or prior >= 1.0:
        return prior
    likelihood = max(0.01, min(0.99, evidence_strength))
    numerator = likelihood * prior
    denominator = numerator + (1 - likelihood) * (1 - prior)
    if denominator == 0:
        return prior
    return min(1.0, numerator / denominator)


def combine_confidence_dempster(p1: float, p2: float) -> float:
    """使用 Dempster-Shafer 证据理论融合两个置信度。
    m12 = (m1 * m2) / (1 - conflict)
    """
    conflict = p1 * (1 - p2) + (1 - p1) * p2
    if abs(1 - conflict) < 1e-10:
        return (p1 + p2) / 2
    combined = (p1 * p2) / (1 - conflict)
    return min(1.0, max(0.0, combined))


def calculate_dynamic_confidence(rule: InferenceRule, matched_objects: List[OntologyObject], evidence_sources: int = 1) -> float:
    """根据规则、匹配对象数量和证据源数量动态计算置信度。"""
    base = rule.confidence_base or 0.5
    confidence = base

    if rule.confidence_modifiers:
        modifiers = _split_field(rule.confidence_modifiers)
        for mod in modifiers:
            parts = mod.split("|")
            if len(parts) >= 2:
                try:
                    modifier_value = float(parts[1])
                    confidence = combine_confidence_bayesian(confidence, max(0.01, min(0.99, base + modifier_value)))
                except (ValueError, TypeError):
                    pass

    if evidence_sources > 1:
        for _ in range(evidence_sources - 1):
            confidence = combine_confidence_dempster(confidence, base)

    evidence_boost = min(0.15, len(matched_objects) * 0.03)
    confidence = min(1.0, confidence + evidence_boost)

    return round(confidence, 4)


def get_inference_rules(db: Session) -> List[Dict[str, Any]]:
    rules = db.query(InferenceRule).all()
    results = []
    for r in rules:
        result = _rule_to_dict(r)
        results.append(result)
    return results


def execute_rule(db: Session, rule_id: str) -> Dict[str, Any]:
    rule = db.query(InferenceRule).filter(InferenceRule.id == rule_id).first()
    if not rule:
        return {"success": False, "error": "Rule not found"}

    if not rule.enabled:
        return {"success": False, "error": "Rule is disabled"}

    matched_objects = _evaluate_condition(db, rule)
    if not matched_objects:
        return {
            "success": True,
            "result": {
                "id": None,
                "rule_id": rule.id,
                "rule_name": rule.name,
                "result_type": rule.conclusion_type or "alert",
                "confidence": rule.confidence_base or 0.5,
                "status": "no_match",
                "matched_count": 0,
                "affected_objects": [],
            },
        }

    conclusion_results = _apply_conclusion(db, rule, matched_objects)

    dynamic_confidence = calculate_dynamic_confidence(rule, matched_objects)

    result = InferenceResult(
        id=f"ir_{rule_id}_{uuid.uuid4().hex[:8]}",
        rule_id=rule.id,
        rule_name=rule.name,
        result_type=rule.conclusion_type or "alert",
        confidence=dynamic_confidence,
        evidence=_build_evidence(rule, matched_objects),
        status="active",
    )
    if conclusion_results.get("source_entity_id"):
        result.source_entity_id = conclusion_results["source_entity_id"]
    if conclusion_results.get("target_entity_id"):
        result.target_entity_id = conclusion_results["target_entity_id"]
    if conclusion_results.get("inferred_link_type"):
        result.inferred_link_type = conclusion_results["inferred_link_type"]
    if conclusion_results.get("inferred_property"):
        result.inferred_property = conclusion_results["inferred_property"]
    if conclusion_results.get("inferred_value"):
        result.inferred_value = conclusion_results["inferred_value"]

    db.add(result)
    db.commit()

    return {
        "success": True,
        "result": {
            "id": result.id,
            "rule_id": result.rule_id,
            "rule_name": result.rule_name,
            "result_type": result.result_type,
            "confidence": result.confidence,
            "status": result.status,
            "matched_count": len(matched_objects),
            "affected_objects": [obj.id for obj in matched_objects],
            "conclusion_applied": conclusion_results.get("applied", False),
            "conclusion_detail": conclusion_results.get("detail", ""),
        },
    }


def _evaluate_condition(db: Session, rule: InferenceRule) -> List[OntologyObject]:
    if not rule.condition_pattern:
        return []

    pattern = rule.condition_pattern
    parts = pattern.split(".")
    object_type = parts[0] if parts else pattern

    query = db.query(OntologyObject).filter(OntologyObject.object_type == object_type)
    objects = query.all()

    if not objects:
        return []

    filters = _split_field(rule.condition_filters) if rule.condition_filters else []
    if not filters:
        return objects

    filtered = []
    for obj in objects:
        domain_row = _get_domain_row(db, obj)
        if domain_row and _matches_filters(domain_row, filters):
            filtered.append(obj)

    return filtered


def _get_domain_row(db: Session, obj: OntologyObject):
    model_class = DOMAIN_MODEL_MAP.get(obj.object_type)
    if not model_class:
        return None
    return db.query(model_class).filter(model_class.id == obj.id).first()


def _matches_filters(domain_row, filters: List[str]) -> bool:
    for f in filters:
        if ">=" in f:
            field, value = f.split(">=", 1)
            actual = _resolve_filter_value(domain_row, field)
            if actual is None:
                return False
            try:
                if float(actual) < float(_parse_duration(value)):
                    return False
            except (ValueError, TypeError):
                return False
        elif "<=" in f:
            field, value = f.split("<=", 1)
            actual = _resolve_filter_value(domain_row, field)
            if actual is None:
                return False
            try:
                if float(actual) > float(_parse_duration(value)):
                    return False
            except (ValueError, TypeError):
                return False
        elif "!=" in f:
            field, value = f.split("!=", 1)
            actual = _resolve_filter_value(domain_row, field)
            if actual is None or str(actual) == value:
                return False
        elif ">" in f:
            field, value = f.split(">", 1)
            actual = _resolve_filter_value(domain_row, field)
            if actual is None:
                return False
            try:
                if float(actual) <= float(_parse_duration(value)):
                    return False
            except (ValueError, TypeError):
                return False
        elif "<" in f:
            field, value = f.split("<", 1)
            actual = _resolve_filter_value(domain_row, field)
            if actual is None:
                return False
            try:
                if float(actual) >= float(_parse_duration(value)):
                    return False
            except (ValueError, TypeError):
                return False
        elif "=" in f:
            field, value = f.split("=", 1)
            actual = _resolve_filter_value(domain_row, field)
            if actual is None or str(actual) != value:
                return False
    return True


def _resolve_filter_value(domain_row, field: str):
    actual = getattr(domain_row, field, None)
    if actual is not None:
        return actual
    if hasattr(domain_row, 'properties') and isinstance(domain_row.properties, dict):
        return domain_row.properties.get(field)
    return None


def _parse_duration(value: str) -> str:
    import re
    match = re.match(r'^(\d+)(months?|days?|weeks?)$', value)
    if match:
        num = int(match.group(1))
        unit = match.group(2)
        if unit.startswith('month'):
            return str(num * 30)
        elif unit.startswith('week'):
            return str(num * 7)
        elif unit.startswith('day'):
            return str(num)
    return value


def _apply_conclusion(db: Session, rule: InferenceRule, matched_objects: List[OntologyObject]) -> Dict[str, Any]:
    conclusion_type = rule.conclusion_type
    result: Dict[str, Any] = {"applied": False, "detail": ""}

    if conclusion_type == "new_link" and len(matched_objects) >= 2:
        source = matched_objects[0]
        target = matched_objects[1]
        link_type = rule.conclusion_link_type or "INFERRED"
        strength = None
        if rule.conclusion_strength_formula:
            try:
                strength = float(rule.conclusion_strength_formula)
            except (ValueError, TypeError):
                strength = rule.confidence_base or 0.5

        has_conflict, conflict_desc = link_service.check_link_conflict(
            db, source.id, link_type, target.id, strength
        )
        if has_conflict:
            result = {
                "applied": False,
                "detail": f"Link conflict: {conflict_desc}",
                "source_entity_id": source.id,
                "target_entity_id": target.id,
                "inferred_link_type": link_type,
            }
        else:
            existing = db.query(ObjectLink).filter(
                ObjectLink.source_id == source.id,
                ObjectLink.target_id == target.id,
                ObjectLink.link_type == link_type,
            ).first()
            if not existing:
                link = ObjectLink(
                    source_id=source.id,
                    link_type=link_type,
                    target_id=target.id,
                    target_name=target.name,
                    target_type=target.object_type,
                    link_strength=strength,
                    provenance="inference",
                )
                db.add(link)
                db.flush()

                link_service.create_inverse_link(
                    db, source.id, link_type, target.id,
                    target.name, target.object_type, source,
                )

                result = {
                    "applied": True,
                    "detail": f"Created {link_type} link: {source.name} -> {target.name}",
                    "source_entity_id": source.id,
                    "target_entity_id": target.id,
                    "inferred_link_type": link_type,
                }

    elif conclusion_type == "new_property" and matched_objects:
        obj = matched_objects[0]
        prop_name = rule.conclusion_property
        value_formula = rule.conclusion_value_formula
        if prop_name and value_formula:
            model_class = DOMAIN_MODEL_MAP.get(obj.object_type)
            if model_class:
                row = db.query(model_class).filter(model_class.id == obj.id).first()
                if row:
                    col_names = {c.name for c in model_class.__table__.columns}
                    if prop_name in col_names:
                        setattr(row, prop_name, value_formula)
                        result = {
                            "applied": True,
                            "detail": f"Set {obj.name}.{prop_name} = {value_formula}",
                            "source_entity_id": obj.id,
                            "inferred_property": prop_name,
                            "inferred_value": value_formula,
                        }

    elif conclusion_type == "alert" and matched_objects:
        for obj in matched_objects:
            severity = rule.conclusion_alert_severity or "info"
            message = rule.conclusion_alert_message_template or f"Rule {rule.name} triggered"
            message = message.replace("{entity}", obj.name).replace("{type}", obj.object_type)

            alert_type = rule.conclusion_alert_type or "inference_alert"
            existing = db.query(Notification).filter(
                Notification.entity_id == obj.id,
                Notification.type == alert_type,
                Notification.read == False,
            ).first()
            if not existing:
                notification = Notification(
                    id=f"n_{uuid.uuid4().hex[:8]}",
                    user_id="default_user",
                    type=rule.conclusion_alert_type or "inference_alert",
                    title=f"[{rule.name}] 推理告警",
                    message=message,
                    priority=severity,
                    entity_id=obj.id,
                )
                db.add(notification)

        result = {
            "applied": True,
            "detail": f"Created alerts for {len(matched_objects)} objects",
            "source_entity_id": matched_objects[0].id if matched_objects else None,
        }

    elif conclusion_type == "tag" and matched_objects:
        tag = rule.conclusion_tag
        for obj in matched_objects:
            if tag and obj.lifecycle_stage != tag:
                obj.lifecycle_stage = tag
        result = {
            "applied": True,
            "detail": f"Tagged {len(matched_objects)} objects with '{tag}'",
            "source_entity_id": matched_objects[0].id if matched_objects else None,
            "inferred_property": "lifecycleStage",
            "inferred_value": tag,
        }

    return result


def _build_evidence(rule: InferenceRule, matched_objects: List[OntologyObject]) -> str:
    parts = [f"Rule: {rule.name}"]
    if rule.condition_description:
        parts.append(f"Condition: {rule.condition_description}")
    parts.append(f"Matched: {len(matched_objects)} objects")
    for obj in matched_objects[:5]:
        parts.append(f"  - {obj.object_type}/{obj.id}: {obj.name}")
    return "; ".join(parts)


def _rule_to_dict(r: InferenceRule) -> Dict[str, Any]:
    conditions = []
    if r.condition_pattern:
        cond = {"pattern": r.condition_pattern}
        if r.condition_filters:
            cond["filters"] = _split_field(r.condition_filters)
        if r.condition_description:
            cond["description"] = r.condition_description
        conditions.append(cond)

    conclusion = {}
    if r.conclusion_type == "new_link":
        conclusion["newLink"] = {
            "sourcePattern": r.conclusion_source_pattern or "",
            "targetPattern": r.conclusion_target_pattern or "",
            "type": r.conclusion_link_type or "",
            "strengthFormula": r.conclusion_strength_formula,
        }
    elif r.conclusion_type == "new_property":
        conclusion["newProperty"] = {
            "entityPattern": r.conclusion_entity_pattern or "",
            "property": r.conclusion_property or "",
            "valueFormula": r.conclusion_value_formula or "",
        }
    elif r.conclusion_type == "alert":
        conclusion["alert"] = {
            "type": r.conclusion_alert_type or "",
            "messageTemplate": r.conclusion_alert_message_template or "",
            "severity": r.conclusion_alert_severity or "info",
        }
    elif r.conclusion_type == "tag":
        conclusion["tag"] = {
            "entityPattern": r.conclusion_tag_entity_pattern or "",
            "tag": r.conclusion_tag or "",
        }

    confidence = {"base": r.confidence_base or 0.5}
    if r.confidence_modifiers:
        modifiers = []
        for item in _split_field(r.confidence_modifiers):
            parts = item.split("|")
            if len(parts) >= 2:
                modifiers.append({"condition": parts[0], "modifier": float(parts[1])})
        confidence["modifiers"] = modifiers

    config = {
        "enabled": r.enabled,
        "priority": r.priority,
    }
    if r.ttl is not None:
        config["ttl"] = r.ttl
    config["autoApply"] = r.auto_apply

    metadata = {}
    if r.author:
        metadata["author"] = r.author
    if r.tags:
        metadata["tags"] = _split_field(r.tags)
    if r.created_at:
        metadata["createdAt"] = r.created_at.isoformat()
    if r.updated_at:
        metadata["updatedAt"] = r.updated_at.isoformat()

    return {
        "id": r.id,
        "name": r.name,
        "description": r.description,
        "type": r.rule_type,
        "conditions": conditions,
        "conclusion": conclusion,
        "confidence": confidence,
        "config": config,
        "metadata": metadata,
    }

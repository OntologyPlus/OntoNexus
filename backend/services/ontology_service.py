import uuid
import json
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from models.ontology import OntologyObject, ObjectLink, ObjectAction, ActionParameter, ObjectEvent, TimeSeriesData
from services import lifecycle_service
from services import link_service
from services.event_bus import publish_ontology_event, EventType
from services.cache_service import get_cached_object, set_cached_object, invalidate_object_cache, invalidate_all_cache
from services.ontology_response_builder import build_ontology_object_response, _domain_row_to_dict, _link_properties_to_dict
from services.domain_mapper import DOMAIN_MODEL_MAP, _split_field, _join_field, _create_domain_row, _update_domain_row


def _batch_load_related_data(db: Session, object_ids: List[str], objects: List[OntologyObject], include_time_series: bool = True, max_events: Optional[int] = None) -> Dict[str, Dict[str, Any]]:
    if not object_ids:
        return {}

    all_links = db.query(ObjectLink).filter(ObjectLink.source_id.in_(object_ids)).all()
    all_links = link_service.filter_expired_links(all_links)
    links_by_obj: Dict[str, List[ObjectLink]] = {}
    for link in all_links:
        links_by_obj.setdefault(link.source_id, []).append(link)

    all_actions = db.query(ObjectAction).filter(ObjectAction.object_id.in_(object_ids)).all()
    actions_by_obj: Dict[str, List[ObjectAction]] = {}
    action_ids = []
    for action in all_actions:
        actions_by_obj.setdefault(action.object_id, []).append(action)
        action_ids.append(action.id)

    action_params_map: Dict[str, List[ActionParameter]] = {}
    if action_ids:
        all_params = db.query(ActionParameter).filter(ActionParameter.action_id.in_(action_ids)).all()
        for p in all_params:
            action_params_map.setdefault(p.action_id, []).append(p)

    all_events = db.query(ObjectEvent).filter(ObjectEvent.object_id.in_(object_ids)).order_by(ObjectEvent.timestamp.desc()).all()
    events_by_obj: Dict[str, List[ObjectEvent]] = {}
    for event in all_events:
        events_by_obj.setdefault(event.object_id, []).append(event)

    if max_events is not None:
        for obj_id in events_by_obj:
            events_by_obj[obj_id] = events_by_obj[obj_id][:max_events]

    ts_by_obj: Dict[str, List[TimeSeriesData]] = {}
    if include_time_series:
        all_time_series = db.query(TimeSeriesData).filter(TimeSeriesData.object_id.in_(object_ids)).all()
        for ts in all_time_series:
            ts_by_obj.setdefault(ts.object_id, []).append(ts)

    type_to_ids: Dict[str, List[str]] = {}
    for obj in objects:
        type_to_ids.setdefault(obj.object_type, []).append(obj.id)

    domain_rows_by_id: Dict[str, Any] = {}
    for obj_type, ids in type_to_ids.items():
        model_class = DOMAIN_MODEL_MAP.get(obj_type)
        if model_class:
            rows = db.query(model_class).filter(model_class.id.in_(ids)).all()
            for row in rows:
                domain_rows_by_id[row.id] = row

    result = {}
    for obj_id in object_ids:
        result[obj_id] = {
            "links": links_by_obj.get(obj_id, []),
            "actions": actions_by_obj.get(obj_id, []),
            "action_params_map": action_params_map,
            "events": events_by_obj.get(obj_id, []),
            "time_series": ts_by_obj.get(obj_id, []),
            "domain_row": domain_rows_by_id.get(obj_id),
        }
    return result


def get_all_objects(db: Session, object_type: Optional[str] = None, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    query = db.query(OntologyObject)
    if object_type:
        query = query.filter(OntologyObject.object_type == object_type)

    total = query.count()
    offset = (page - 1) * page_size
    objects = query.offset(offset).limit(page_size).all()

    if not objects:
        return {"results": [], "total": total, "page": page, "page_size": page_size, "has_next": offset + page_size < total}

    object_ids = [obj.id for obj in objects]
    related_data = _batch_load_related_data(db, object_ids, objects, include_time_series=False, max_events=3)

    results = []
    for obj in objects:
        data = related_data.get(obj.id, {})
        result = build_ontology_object_response(
            obj,
            data.get("links", []),
            data.get("actions", []),
            data.get("action_params_map", {}),
            data.get("events", []),
            data.get("time_series", []),
            data.get("domain_row"),
        )
        results.append(result)
    return {"results": results, "total": total, "page": page, "page_size": page_size, "has_next": offset + page_size < total}


def get_compact_objects(
    db: Session,
    object_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 200,
) -> Dict[str, Any]:
    """Slim list for graph/perception: identity + links, no domain properties."""
    query = db.query(OntologyObject)
    if object_type:
        query = query.filter(OntologyObject.object_type == object_type)

    total = query.count()
    offset = (page - 1) * page_size
    objects = query.offset(offset).limit(page_size).all()
    if not objects:
        return {"results": [], "total": total, "page": page, "page_size": page_size, "has_next": False}

    object_ids = [obj.id for obj in objects]
    all_links = db.query(ObjectLink).filter(ObjectLink.source_id.in_(object_ids)).all()
    all_links = link_service.filter_expired_links(all_links)
    links_by_obj: Dict[str, List[ObjectLink]] = {}
    for link in all_links:
        links_by_obj.setdefault(link.source_id, []).append(link)

    results = []
    for obj in objects:
        links = []
        for link in links_by_obj.get(obj.id, []):
            item = {
                "linkType": link.link_type,
                "targetId": link.target_id,
                "targetName": link.target_name or "",
                "targetType": link.target_type or "",
            }
            link_props = _link_properties_to_dict(link)
            if link_props:
                item["properties"] = link_props
            links.append(item)
        results.append({
            "id": obj.id,
            "objectType": obj.object_type,
            "name": obj.name,
            "properties": {},
            "links": links,
            "actions": [],
            "events": [],
            "timeSeries": {},
            "interfaces": [],
            "status": obj.status,
            "lifecycleStage": obj.lifecycle_stage,
            "sentiment": obj.sentiment,
            "complianceRiskLevel": obj.compliance_risk_level,
            "ownerId": obj.owner_id,
        })
    return {
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": offset + page_size < total,
    }


def get_object_by_id(db: Session, object_type: str, object_id: str) -> Optional[Dict[str, Any]]:
    cached = get_cached_object(object_id)
    if cached:
        return cached
    obj = db.query(OntologyObject).filter(
        OntologyObject.id == object_id,
        OntologyObject.object_type == object_type,
    ).first()
    if not obj:
        return None
    related_data = _batch_load_related_data(db, [obj.id], [obj])
    data = related_data.get(obj.id, {})
    result = build_ontology_object_response(
        obj,
        data.get("links", []),
        data.get("actions", []),
        data.get("action_params_map", {}),
        data.get("events", []),
        data.get("time_series", []),
        data.get("domain_row"),
    )
    set_cached_object(object_id, result)
    return result


def search_objects(db: Session, object_type: str, query: str, limit: int = 10) -> List[Dict[str, Any]]:
    objects = db.query(OntologyObject).filter(
        OntologyObject.object_type == object_type,
        OntologyObject.name.contains(query),
    ).limit(limit).all()

    if not objects:
        return []

    object_ids = [obj.id for obj in objects]
    related_data = _batch_load_related_data(db, object_ids, objects)

    results = []
    for obj in objects:
        data = related_data.get(obj.id, {})
        result = build_ontology_object_response(
            obj,
            data.get("links", []),
            data.get("actions", []),
            data.get("action_params_map", {}),
            data.get("events", []),
            data.get("time_series", []),
            data.get("domain_row"),
        )
        results.append(result)
    return results


def _get_full_object(db: Session, obj: OntologyObject) -> Dict[str, Any]:
    related_data = _batch_load_related_data(db, [obj.id], [obj])
    data = related_data.get(obj.id, {})
    return build_ontology_object_response(
        obj,
        data.get("links", []),
        data.get("actions", []),
        data.get("action_params_map", {}),
        data.get("events", []),
        data.get("time_series", []),
        data.get("domain_row"),
    )


def create_object(db: Session, object_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    from semantic.ontology import get_ontology

    properties = data.get("properties") or {}
    onto = get_ontology()
    onto.require_valid_object(object_type, properties)
    for link_data in data.get("links") or []:
        onto.require_valid_link(
            link_data.get("linkType") or "",
            object_type,
            link_data.get("targetType") or "",
        )

    obj_id = data.get("id") or f"{object_type.lower()}_{uuid.uuid4().hex[:8]}"
    obj = OntologyObject(
        id=obj_id,
        object_type=object_type,
        name=data.get("name", ""),
        status=data.get("status", "normal"),
        lifecycle_stage=data.get("lifecycleStage"),
        sentiment=data.get("sentiment"),
        compliance_risk_level=data.get("complianceRiskLevel"),
        owner_id=data.get("ownerId"),
        stakeholders=json.dumps(data["stakeholders"]) if data.get("stakeholders") else None,
    )
    db.add(obj)

    properties = data.get("properties", {})
    _create_domain_row(db, object_type, obj_id, properties)

    for link_data in data.get("links", []):
        link_type = link_data.get("linkType", "")
        target_id = link_data.get("targetId", "")
        link_props = link_data.get("properties", {}) or {}

        valid, reason = link_service.validate_link_cardinality(db, obj_id, link_type, target_id)
        if not valid:
            from exceptions import OntologyValidationError
            raise OntologyValidationError(reason or "关系基数不满足")

        confidence = link_props.get("confidence")
        has_conflict, conflict_desc = link_service.check_link_conflict(db, obj_id, link_type, target_id, confidence)
        if has_conflict and confidence is not None:
            confidence = min(confidence, 0.3)

        link = ObjectLink(
            source_id=obj_id,
            link_type=link_type,
            target_id=target_id,
            target_name=link_data.get("targetName", ""),
            target_type=link_data.get("targetType", ""),
            link_strength=link_props.get("strength"),
            link_frequency=link_props.get("frequency"),
            link_volume=link_props.get("volume"),
            confidence=confidence,
            valid_from=link_props.get("valid_from"),
            valid_to=link_props.get("valid_to"),
            provenance=link_props.get("provenance", "manual"),
            inverse_relation=link_props.get("inverse_relation"),
        )
        db.add(link)
        db.flush()

        link_service.create_inverse_link(
            db, obj_id, link_type, target_id,
            link_data.get("targetName", ""),
            link_data.get("targetType", ""),
            obj,
        )

    for action_data in data.get("actions", []):
        action = ObjectAction(
            id=action_data.get("id", f"act_{obj_id}_{action_data.get('name', '')}"),
            object_id=obj_id,
            name=action_data.get("name", ""),
            description=action_data.get("description"),
            requires_approval=action_data.get("requiresApproval", False),
            preconditions=_join_field(action_data.get("preconditions", [])),
            side_effects=_join_field(action_data.get("sideEffects", [])),
            write_back_targets=_join_field(action_data.get("writeBackTargets", [])),
        )
        db.add(action)
        for param_data in action_data.get("parameters", []):
            param = ActionParameter(
                action_id=action.id,
                name=param_data.get("name", ""),
                param_type=param_data.get("type", "string"),
                required=param_data.get("required", False),
                default_value=param_data.get("defaultValue"),
                description=param_data.get("description"),
            )
            db.add(param)

    for event_data in data.get("events", []):
        event = ObjectEvent(
            id=event_data.get("id", f"evt_{obj_id}_{uuid.uuid4().hex[:8]}"),
            object_id=obj_id,
            event_type=event_data.get("eventType", ""),
            timestamp=event_data.get("timestamp", ""),
            description=event_data.get("description"),
            related_object_id=event_data.get("relatedObjectId"),
            related_object_name=event_data.get("relatedObjectName"),
        )
        db.add(event)

    for series_name, points in data.get("timeSeries", {}).items():
        for point in points:
            ts = TimeSeriesData(
                object_id=obj_id,
                series_name=series_name,
                timestamp=point.get("timestamp", ""),
                value=point.get("value", 0),
            )
            db.add(ts)

    db.commit()
    result = _get_full_object(db, obj)
    set_cached_object(obj_id, result)
    publish_ontology_event(EventType.OBJECT_CREATED, object_id=obj_id, object_type=object_type, object_name=data.get("name", ""), source="api")
    return result


def update_object(db: Session, object_type: str, object_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    obj = db.query(OntologyObject).filter(
        OntologyObject.id == object_id,
        OntologyObject.object_type == object_type,
    ).first()
    if not obj:
        return None

    old_lifecycle_stage = obj.lifecycle_stage
    old_status = obj.status

    if "name" in data:
        obj.name = data["name"]
    if "status" in data:
        obj.status = data["status"]
    if "lifecycleStage" in data:
        target_stage = data["lifecycleStage"]
        if obj.lifecycle_stage and not lifecycle_service.validate_transition(
            obj.object_type, obj.lifecycle_stage, target_stage
        ):
            raise ValueError(
                f"Invalid lifecycle transition for {obj.object_type}: "
                f"{obj.lifecycle_stage} → {target_stage}"
            )
        obj.lifecycle_stage = target_stage
    if "sentiment" in data:
        obj.sentiment = data["sentiment"]
    if "complianceRiskLevel" in data:
        obj.compliance_risk_level = data["complianceRiskLevel"]
    if "ownerId" in data:
        obj.owner_id = data["ownerId"]
    if "stakeholders" in data:
        obj.stakeholders = json.dumps(data["stakeholders"]) if data["stakeholders"] else None

    if "properties" in data:
        from semantic.ontology import get_ontology
        get_ontology().require_valid_object(object_type, data["properties"], partial=True)
        _update_domain_row(db, object_type, object_id, data["properties"])

    db.commit()
    invalidate_object_cache(object_id)
    publish_ontology_event(EventType.OBJECT_UPDATED, object_id=object_id, object_type=object_type, object_name=obj.name, source="api")
    if old_lifecycle_stage != obj.lifecycle_stage:
        publish_ontology_event(EventType.LIFECYCLE_CHANGED, object_id=object_id, object_type=object_type, object_name=obj.name, data={"from": old_lifecycle_stage, "to": obj.lifecycle_stage}, source="api")
    if old_status != obj.status:
        publish_ontology_event(EventType.STATUS_CHANGED, object_id=object_id, object_type=object_type, object_name=obj.name, data={"from": old_status, "to": obj.status}, source="api")
    return _get_full_object(db, obj)


def delete_object(db: Session, object_type: str, object_id: str) -> bool:
    obj = db.query(OntologyObject).filter(
        OntologyObject.id == object_id,
        OntologyObject.object_type == object_type,
    ).first()
    if not obj:
        return False

    obj_name = obj.name

    links = db.query(ObjectLink).filter(ObjectLink.source_id == object_id).all()
    for link in links:
        link_service.delete_inverse_link(db, link.source_id, link.link_type, link.target_id)
    db.query(ObjectLink).filter(ObjectLink.source_id == object_id).delete()

    incoming_links = db.query(ObjectLink).filter(ObjectLink.target_id == object_id).all()
    for link in incoming_links:
        link_service.delete_inverse_link(db, link.source_id, link.link_type, link.target_id)
    db.query(ObjectLink).filter(ObjectLink.target_id == object_id).delete()
    db.query(ObjectAction).filter(ObjectAction.object_id == object_id).delete()
    db.query(ObjectEvent).filter(ObjectEvent.object_id == object_id).delete()
    db.query(TimeSeriesData).filter(TimeSeriesData.object_id == object_id).delete()

    model_class = DOMAIN_MODEL_MAP.get(object_type)
    if model_class:
        domain_row = db.query(model_class).filter(model_class.id == object_id).first()
        if domain_row:
            db.delete(domain_row)

    db.delete(obj)
    db.commit()
    invalidate_object_cache(object_id)
    publish_ontology_event(EventType.OBJECT_DELETED, object_id=object_id, object_type=object_type, object_name=obj_name, source="api")
    return True


def get_entity_with_domain(db: Session, entity_id: str) -> Optional[Dict[str, Any]]:
    obj = db.query(OntologyObject).filter(OntologyObject.id == entity_id).first()
    if not obj:
        return None

    model_class = DOMAIN_MODEL_MAP.get(obj.object_type)
    domain_row = None
    if model_class:
        domain_row = db.query(model_class).filter(model_class.id == entity_id).first()

    related_data = _batch_load_related_data(db, [entity_id], [obj])
    data = related_data.get(entity_id, {})

    result = build_ontology_object_response(
        obj,
        data.get("links", []),
        data.get("actions", []),
        data.get("action_params_map", {}),
        data.get("events", []),
        data.get("time_series", []),
        domain_row,
    )
    result["entityType"] = obj.object_type
    if domain_row:
        result["domainData"] = _domain_row_to_dict(domain_row)

    return result

import json
from typing import List, Optional, Dict, Any
from models.ontology import OntologyObject, ObjectLink, ObjectAction, ActionParameter, ObjectEvent, TimeSeriesData
from services.domain_mapper import _split_field


def _domain_row_to_dict(row) -> Dict[str, Any]:
    if row is None:
        return {}
    result = {}
    for col in row.__table__.columns:
        if col.name == "id":
            continue
        val = getattr(row, col.name, None)
        if val is None:
            continue
        col_type = str(col.type).upper()
        if col_type == "TEXT" and isinstance(val, str):
            if col.name in (
                "specialty", "key_insights", "preconditions", "side_effects",
                "write_back_targets", "do_actions", "check_results",
                "act_improvements", "related_expenses", "compliance_history",
            ):
                val = _split_field(val)
        result[col.name] = val
    return result


def _link_properties_to_dict(link: ObjectLink) -> Optional[Dict[str, Any]]:
    props = {}
    if link.link_strength is not None:
        props["strength"] = link.link_strength
    if link.link_frequency is not None:
        props["frequency"] = link.link_frequency
    if link.link_volume is not None:
        props["volume"] = link.link_volume
    if link.confidence is not None:
        props["confidence"] = link.confidence
    if link.valid_from is not None:
        props["valid_from"] = link.valid_from
    if link.valid_to is not None:
        props["valid_to"] = link.valid_to
    if link.provenance is not None:
        props["provenance"] = link.provenance
    if link.inverse_relation is not None:
        props["inverse_relation"] = link.inverse_relation
    return props if props else None


def build_ontology_object_response(
    obj: OntologyObject,
    links: List[ObjectLink],
    actions: List[ObjectAction],
    action_params_map: Dict[str, List[ActionParameter]],
    events: List[ObjectEvent],
    time_series: List[TimeSeriesData],
    domain_row=None,
) -> Dict[str, Any]:
    properties = _domain_row_to_dict(domain_row) if domain_row else {}

    link_schemas = []
    for link in links:
        link_dict = {
            "linkType": link.link_type,
            "targetId": link.target_id,
            "targetName": link.target_name,
            "targetType": link.target_type,
        }
        link_props = _link_properties_to_dict(link)
        if link_props:
            link_dict["properties"] = link_props
        link_schemas.append(link_dict)

    action_schemas = []
    for action in actions:
        params = action_params_map.get(action.id, [])
        param_list = []
        for p in params:
            param_list.append({
                "name": p.name,
                "type": p.param_type,
                "required": p.required,
                "defaultValue": p.default_value,
                "description": p.description,
            })
        action_schemas.append({
            "id": action.id,
            "name": action.name,
            "description": action.description,
            "parameters": param_list,
            "preconditions": _split_field(action.preconditions),
            "sideEffects": _split_field(action.side_effects),
            "writeBackTargets": _split_field(action.write_back_targets),
            "requiresApproval": action.requires_approval,
        })

    event_schemas = []
    for event in events:
        event_schemas.append({
            "id": event.id,
            "eventType": event.event_type,
            "timestamp": event.timestamp,
            "description": event.description,
            "relatedObjectId": event.related_object_id,
            "relatedObjectName": event.related_object_name,
        })

    ts_dict: Dict[str, List[Dict[str, Any]]] = {}
    for ts in time_series:
        if ts.series_name not in ts_dict:
            ts_dict[ts.series_name] = []
        ts_dict[ts.series_name].append({
            "timestamp": ts.timestamp,
            "value": ts.value,
        })

    return {
        "id": obj.id,
        "objectType": obj.object_type,
        "name": obj.name,
        "properties": properties,
        "links": link_schemas,
        "actions": action_schemas,
        "events": event_schemas,
        "timeSeries": ts_dict,
        "interfaces": [],
        "status": obj.status,
        "lifecycleStage": obj.lifecycle_stage,
        "sentiment": obj.sentiment,
        "complianceRiskLevel": obj.compliance_risk_level,
        "ownerId": obj.owner_id,
        "stakeholders": json.loads(obj.stakeholders) if obj.stakeholders else None,
    }

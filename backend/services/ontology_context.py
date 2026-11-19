import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from models.ontology import OntologyObject, ObjectLink, ObjectAction, ActionParameter, ObjectEvent, TimeSeriesData
from services.domain_mapper import DOMAIN_MODEL_MAP
from services.ontology_response_builder import _domain_row_to_dict
from services.ontology_definition import get_concept_definition, get_relation_definition


def build_ontology_context(db: Session, object_id: str, depth: int = 2) -> Dict[str, Any]:
    obj = db.query(OntologyObject).filter(OntologyObject.id == object_id).first()
    if not obj:
        return {"error": f"Object {object_id} not found"}

    context = _build_object_context(db, obj)

    if depth >= 1:
        context["relatedObjects"] = _build_related_context(db, obj, depth)

    context["availableActions"] = _build_action_context(db, obj)
    context["recentEvents"] = _build_event_context(db, obj)
    context["timeSeriesSummary"] = _build_timeseries_context(db, obj)
    context["ontologyDefinition"] = _build_definition_context(obj.object_type)

    return context


def build_ontology_context_for_query(db: Session, query: str, object_types: Optional[List[str]] = None) -> Dict[str, Any]:
    relevant_objects = _find_relevant_objects(db, query, object_types)

    contexts = []
    for obj in relevant_objects[:5]:
        ctx = _build_object_context(db, obj)
        ctx["relatedObjects"] = _build_related_context(db, obj, depth=1)
        ctx["availableActions"] = _build_action_context(db, obj)
        contexts.append(ctx)

    return {
        "query": query,
        "matchedObjects": len(relevant_objects),
        "contexts": contexts,
    }


def build_ontology_context_via_port(db: Session, object_id: str, depth: int = 2, user=None) -> Dict[str, Any]:
    """Analysis-facing context via SemanticContextPort (graph is a projection)."""
    from semantic.context_graph import LocalSemanticAdapter

    adapter = LocalSemanticAdapter(db)
    scope = LocalSemanticAdapter.scope_from_user(user)
    obj = adapter.get_object(object_id, scope=scope)
    if not obj:
        return {"error": f"Object {object_id} not found"}
    subgraph = adapter.get_subgraph([object_id], hops=depth, scope=scope)
    observations = adapter.get_observations(object_id)
    base = build_ontology_context(db, object_id, depth=depth)
    base["portObject"] = obj
    base["subgraph"] = subgraph
    base["observations"] = observations
    return base


def format_context_for_llm(context: Dict[str, Any]) -> str:
    parts = []

    if "error" in context:
        return f"Context Error: {context['error']}"

    obj = context.get("object", {})
    parts.append(f"## 当前对象: {obj.get('name', 'N/A')} ({obj.get('objectType', 'N/A')})")
    parts.append(f"- ID: {obj.get('id', 'N/A')}")
    parts.append(f"- 状态: {obj.get('status', 'N/A')}")
    parts.append(f"- 生命周期: {obj.get('lifecycleStage', 'N/A')}")
    parts.append(f"- 负责人: {obj.get('ownerId', 'N/A')}")

    if obj.get("sentiment"):
        parts.append(f"- 态度: {obj['sentiment']}")
    if obj.get("complianceRiskLevel"):
        parts.append(f"- 合规风险: {obj['complianceRiskLevel']}")

    properties = context.get("properties", {})
    if properties:
        parts.append("\n### 属性")
        for key, value in properties.items():
            parts.append(f"- {key}: {value}")

    links = context.get("links", [])
    if links:
        parts.append("\n### 关系")
        for link in links:
            parts.append(f"- [{link.get('linkType')}] → {link.get('targetName', 'N/A')} ({link.get('targetType', 'N/A')})")

    related = context.get("relatedObjects", [])
    if related:
        parts.append("\n### 关联对象")
        for r in related:
            parts.append(f"- {r.get('name', 'N/A')} ({r.get('objectType', 'N/A')}): 状态={r.get('status', 'N/A')}, 生命周期={r.get('lifecycleStage', 'N/A')}")
            rprops = r.get("properties", {})
            for k, v in list(rprops.items())[:3]:
                parts.append(f"  - {k}: {v}")

    actions = context.get("availableActions", [])
    if actions:
        parts.append("\n### 可执行动作")
        for action in actions:
            approval = " [需审批]" if action.get("requiresApproval") else ""
            parts.append(f"- {action.get('name')}{approval}: {action.get('description', '')}")
            if action.get("preconditions"):
                parts.append(f"  前置条件: {', '.join(action['preconditions'])}")

    events = context.get("recentEvents", [])
    if events:
        parts.append("\n### 近期事件")
        for event in events[:5]:
            parts.append(f"- [{event.get('timestamp', 'N/A')}] {event.get('eventType')}: {event.get('description', '')}")

    ts = context.get("timeSeriesSummary", {})
    if ts:
        parts.append("\n### 时序数据趋势")
        for series_name, summary in ts.items():
            parts.append(f"- {series_name}: {summary}")

    definition = context.get("ontologyDefinition", {})
    if definition:
        parts.append("\n### Ontology定义")
        parts.append(f"- 描述: {definition.get('description', 'N/A')}")
        if definition.get("interfaces"):
            parts.append(f"- 接口: {', '.join(definition['interfaces'])}")

    return "\n".join(parts)


def _build_object_context(db: Session, obj: OntologyObject) -> Dict[str, Any]:
    model_class = DOMAIN_MODEL_MAP.get(obj.object_type)
    domain_row = None
    if model_class:
        domain_row = db.query(model_class).filter(model_class.id == obj.id).first()

    properties = _domain_row_to_dict(domain_row) if domain_row else {}

    links = db.query(ObjectLink).filter(ObjectLink.source_id == obj.id).all()
    link_list = []
    for link in links:
        link_dict = {
            "linkType": link.link_type,
            "targetId": link.target_id,
            "targetName": link.target_name,
            "targetType": link.target_type,
        }
        if link.link_strength is not None:
            link_dict["strength"] = link.link_strength
        link_list.append(link_dict)

    result = {
        "object": {
            "id": obj.id,
            "objectType": obj.object_type,
            "name": obj.name,
            "status": obj.status,
            "lifecycleStage": obj.lifecycle_stage,
            "sentiment": obj.sentiment,
            "complianceRiskLevel": obj.compliance_risk_level,
            "ownerId": obj.owner_id if hasattr(obj, 'owner_id') else None,
        },
        "properties": properties,
        "links": link_list,
    }

    return result


def _build_related_context(db: Session, obj: OntologyObject, depth: int) -> List[Dict[str, Any]]:
    related = []
    visited = {obj.id}
    current_level_ids = [obj.id]

    for _ in range(depth):
        next_level_ids = []
        for source_id in current_level_ids:
            links = db.query(ObjectLink).filter(ObjectLink.source_id == source_id).all()
            for link in links:
                if link.target_id in visited:
                    continue
                visited.add(link.target_id)
                next_level_ids.append(link.target_id)

                target_obj = db.query(OntologyObject).filter(OntologyObject.id == link.target_id).first()
                if target_obj:
                    ctx = {
                        "id": target_obj.id,
                        "objectType": target_obj.object_type,
                        "name": target_obj.name,
                        "status": target_obj.status,
                        "lifecycleStage": target_obj.lifecycle_stage,
                        "linkType": link.link_type,
                    }

                    model_class = DOMAIN_MODEL_MAP.get(target_obj.object_type)
                    if model_class:
                        domain_row = db.query(model_class).filter(model_class.id == target_obj.id).first()
                        if domain_row:
                            ctx["properties"] = _domain_row_to_dict(domain_row)

                    related.append(ctx)

        current_level_ids = next_level_ids

    return related


def _build_action_context(db: Session, obj: OntologyObject) -> List[Dict[str, Any]]:
    actions = db.query(ObjectAction).filter(ObjectAction.object_id == obj.id).all()
    result = []
    for action in actions:
        params = db.query(ActionParameter).filter(ActionParameter.action_id == action.id).all()
        result.append({
            "id": action.id,
            "name": action.name,
            "description": action.description,
            "requiresApproval": action.requires_approval,
            "preconditions": [p.strip() for p in (action.preconditions or "").split(",") if p.strip()],
            "sideEffects": [p.strip() for p in (action.side_effects or "").split(",") if p.strip()],
            "parameters": [{"name": p.name, "type": p.param_type, "required": p.required} for p in params],
        })
    return result


def _build_event_context(db: Session, obj: OntologyObject) -> List[Dict[str, Any]]:
    events = db.query(ObjectEvent).filter(
        ObjectEvent.object_id == obj.id
    ).order_by(ObjectEvent.timestamp.desc()).limit(10).all()

    return [{
        "id": e.id,
        "eventType": e.event_type,
        "timestamp": e.timestamp,
        "description": e.description,
        "relatedObjectId": e.related_object_id,
    } for e in events]


def _build_timeseries_context(db: Session, obj: OntologyObject) -> Dict[str, str]:
    ts_data = db.query(TimeSeriesData).filter(TimeSeriesData.object_id == obj.id).all()

    series_map = {}
    for ts in ts_data:
        if ts.series_name not in series_map:
            series_map[ts.series_name] = []
        series_map[ts.series_name].append((ts.timestamp, ts.value))

    result = {}
    for name, points in series_map.items():
        sorted_points = sorted(points, key=lambda x: x[0])
        if len(sorted_points) >= 2:
            latest = sorted_points[-1][1]
            earliest = sorted_points[0][1]
            if earliest != 0:
                change_pct = round(((latest - earliest) / abs(earliest)) * 100, 1)
            else:
                change_pct = 0
            direction = "上升" if latest > earliest else "下降" if latest < earliest else "持平"
            result[name] = f"{direction} ({change_pct}%, {earliest}→{latest})"
        elif len(sorted_points) == 1:
            result[name] = f"当前值: {sorted_points[0][1]}"

    return result


def _build_definition_context(object_type: str) -> Dict[str, Any]:
    concept = get_concept_definition(object_type)
    if not concept:
        return {}

    return {
        "description": concept.get("description", ""),
        "interfaces": concept.get("interfaces", []),
        "properties": [
            {"name": p["name"], "type": p["type"], "required": p["required"]}
            for p in concept.get("properties", [])
        ],
    }


_TYPE_HINTS = {
    "医生": ["Doctor"], "主任": ["Doctor"], "教授": ["Doctor"], "专家": ["Doctor"], "处方": ["Doctor"],
    "医院": ["Hospital"], "产品": ["Product"], "代表": ["SalesRep"],
    "达成": ["SalesTarget"], "目标": ["SalesTarget"], "业绩": ["SalesTarget", "SalesRep"],
    "合规": ["ComplianceAlert", "ComplianceRule"], "费用": ["ExpenseROI", "ComplianceAlert"],
    "区域": ["Territory"], "拜访": ["VisitRecord", "Doctor"],
}
_MAX_RELEVANT = 12


def _longest_common_substring_len(a: str, b: str, cap: int = 12) -> int:
    """Length of the longest common substring (small strings only)."""
    if not a or not b:
        return 0
    best = 0
    for i in range(len(a)):
        for j in range(len(b)):
            k = 0
            while i + k < len(a) and j + k < len(b) and a[i + k] == b[j + k]:
                k += 1
                if k >= cap:
                    return k
            best = max(best, k)
    return best


def _find_relevant_objects(db: Session, query: str, object_types: Optional[List[str]] = None) -> List[OntologyObject]:
    """Entity-link a natural-language query to ontology objects.

    Order of evidence: (1) object name contains the whole query (legacy behaviour),
    (2) object name appears in the query, or shares a >=3 char fragment with it
    (e.g. "瑞金医院" -> "上海瑞金医院"), (3) type hints in the query (医生/医院/产品…),
    preferring warning/critical objects, (4) fallback: risky objects first.
    """
    q = db.query(OntologyObject)
    if object_types:
        q = q.filter(OntologyObject.object_type.in_(object_types))

    text = (query or "").strip()
    found: List[OntologyObject] = []
    seen = set()

    def add(rows):
        for obj in rows:
            if obj.id not in seen:
                seen.add(obj.id)
                found.append(obj)

    if text:
        add(q.filter(OntologyObject.name.contains(text)).limit(10).all())
        scored = []
        for obj in q.limit(2000).all():
            name = obj.name or ""
            if len(name) < 2:
                continue
            if name in text:
                scored.append((100 + len(name), obj))
            else:
                overlap = _longest_common_substring_len(name, text)
                if overlap >= 3:
                    scored.append((overlap, obj))
        scored.sort(key=lambda pair: -pair[0])
        add([obj for _, obj in scored[:6]])

        hinted_types: List[str] = []
        for keyword, types in _TYPE_HINTS.items():
            if keyword in text:
                for t in types:
                    if t not in hinted_types:
                        hinted_types.append(t)
        if hinted_types:
            risky_first = q.filter(OntologyObject.object_type.in_(hinted_types)).order_by(
                OntologyObject.status.in_(["warning", "critical"]).desc()
            )
            add(risky_first.limit(6).all())

    if not found:
        add(q.order_by(OntologyObject.status.in_(["warning", "critical"]).desc()).limit(10).all())

    return found[:_MAX_RELEVANT]

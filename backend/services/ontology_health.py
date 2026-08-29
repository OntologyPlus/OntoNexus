import json
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func
from models.ontology import OntologyObject, ObjectLink, ObjectAction, ObjectEvent, TimeSeriesData
from services.ontology_definition import get_concept_definition, get_relation_definition


def get_ontology_health(db: Session) -> Dict[str, Any]:
    total_objects = db.query(sql_func.count(OntologyObject.id)).scalar() or 0
    total_links = db.query(sql_func.count(ObjectLink.id)).scalar() or 0
    total_actions = db.query(sql_func.count(ObjectAction.id)).scalar() or 0
    total_events = db.query(sql_func.count(ObjectEvent.id)).scalar() or 0

    objects_by_type = db.query(
        OntologyObject.object_type, sql_func.count(OntologyObject.id)
    ).group_by(OntologyObject.object_type).all()

    objects_by_status = db.query(
        OntologyObject.status, sql_func.count(OntologyObject.id)
    ).group_by(OntologyObject.status).all()

    orphan_objects = _find_orphan_objects(db)
    zombie_actions = _find_zombie_actions(db)
    missing_properties = _find_missing_properties(db)
    stale_links = _find_stale_links(db)

    health_score = _calculate_health_score(
        total_objects, len(orphan_objects), len(zombie_actions),
        len(missing_properties), len(stale_links)
    )

    return {
        "healthScore": health_score,
        "summary": {
            "totalObjects": total_objects,
            "totalLinks": total_links,
            "totalActions": total_actions,
            "totalEvents": total_events,
            "objectsByType": dict(objects_by_type),
            "objectsByStatus": dict(objects_by_status),
        },
        "issues": {
            "orphanObjects": orphan_objects,
            "zombieActions": zombie_actions,
            "missingProperties": missing_properties,
            "staleLinks": stale_links,
        },
        "recommendations": _generate_recommendations(orphan_objects, zombie_actions, missing_properties, stale_links),
    }


def _find_orphan_objects(db: Session) -> List[Dict[str, Any]]:
    objects_with_links = db.query(ObjectLink.source_id).distinct().all()
    linked_ids = {row[0] for row in objects_with_links}

    target_ids = db.query(ObjectLink.target_id).distinct().all()
    linked_ids.update({row[0] for row in target_ids})

    all_objects = db.query(OntologyObject).all()
    orphans = []
    for obj in all_objects:
        if obj.id not in linked_ids:
            orphans.append({
                "id": obj.id,
                "objectType": obj.object_type,
                "name": obj.name,
                "issue": "No links to/from any other object",
            })

    return orphans


def _find_zombie_actions(db: Session) -> List[Dict[str, Any]]:
    executed_action_names = db.query(ObjectEvent.description).filter(
        ObjectEvent.event_type.like("ActionExecuted:%")
    ).all()

    executed_names = set()
    for desc in executed_action_names:
        if desc[0]:
            action_name = desc[0].replace("Executed action '", "").replace("'", "").split(" on ")[0]
            executed_names.add(action_name)

    all_actions = db.query(ObjectAction).all()
    zombies = []
    for action in all_actions:
        if action.name not in executed_names:
            zombies.append({
                "id": action.id,
                "name": action.name,
                "objectId": action.object_id,
                "issue": "Action defined but never executed",
            })

    return zombies


def _find_missing_properties(db: Session) -> List[Dict[str, Any]]:
    from services.domain_mapper import DOMAIN_MODEL_MAP
    from services.ontology_response_builder import _domain_row_to_dict

    issues = []
    all_objects = db.query(OntologyObject).all()

    type_to_objects: Dict[str, List[OntologyObject]] = {}
    for obj in all_objects:
        type_to_objects.setdefault(obj.object_type, []).append(obj)

    for obj_type, objects in type_to_objects.items():
        concept = get_concept_definition(obj_type)
        if not concept:
            continue

        model_class = DOMAIN_MODEL_MAP.get(obj_type)
        if not model_class:
            continue

        obj_ids = [o.id for o in objects]
        rows = db.query(model_class).filter(model_class.id.in_(obj_ids)).all()
        rows_by_id = {r.id: r for r in rows}

        required_props = [
            p for p in concept.get("properties", [])
            if p.get("required") and not p.get("computed")
        ]
        if not required_props:
            continue

        for obj in objects:
            domain_row = rows_by_id.get(obj.id)
            if not domain_row:
                issues.append({
                    "id": obj.id,
                    "objectType": obj.object_type,
                    "name": obj.name,
                    "issue": "No domain properties row exists",
                })
                continue

            properties = _domain_row_to_dict(domain_row)
            for prop_def in required_props:
                if prop_def["name"] not in properties or properties[prop_def["name"]] is None:
                    issues.append({
                        "id": obj.id,
                        "objectType": obj.object_type,
                        "name": obj.name,
                        "issue": f"Missing required property: {prop_def['name']}",
                    })

    return issues


def _find_stale_links(db: Session) -> List[Dict[str, Any]]:
    all_links = db.query(ObjectLink).all()
    stale = []

    target_ids = set()
    for link in all_links:
        target_ids.add(link.target_id)

    existing_objects = db.query(OntologyObject.id).filter(
        OntologyObject.id.in_(target_ids)
    ).all()
    existing_ids = {row[0] for row in existing_objects}

    for link in all_links:
        if link.target_id not in existing_ids:
            stale.append({
                "linkId": link.id,
                "sourceId": link.source_id,
                "linkType": link.link_type,
                "targetId": link.target_id,
                "targetName": link.target_name,
                "issue": "Target object no longer exists",
            })

    return stale


def _calculate_health_score(total_objects, orphan_count, zombie_count, missing_count, stale_count) -> float:
    if total_objects == 0:
        return 100.0

    penalty = 0
    penalty += min(orphan_count * 5, 30)
    penalty += min(zombie_count * 3, 20)
    penalty += min(missing_count * 4, 25)
    penalty += min(stale_count * 8, 25)

    return max(0.0, round(100.0 - penalty, 1))


def _generate_recommendations(orphan_objects, zombie_actions, missing_properties, stale_links) -> List[Dict[str, str]]:
    recommendations = []

    if orphan_objects:
        recommendations.append({
            "type": "orphan_objects",
            "priority": "medium",
            "action": f"为 {len(orphan_objects)} 个孤立对象添加关系链接",
            "detail": "孤立对象无法在关系网络中被发现，降低了Ontology的价值",
        })

    if zombie_actions:
        recommendations.append({
            "type": "zombie_actions",
            "priority": "low",
            "action": f"审查 {len(zombie_actions)} 个从未执行的动作定义",
            "detail": "未使用的动作可能是设计冗余或缺少触发条件",
        })

    if missing_properties:
        recommendations.append({
            "type": "missing_properties",
            "priority": "high",
            "action": f"补充 {len(missing_properties)} 个对象的缺失属性",
            "detail": "缺失必要属性会导致对象不完整，影响分析和AI判断",
        })

    if stale_links:
        recommendations.append({
            "type": "stale_links",
            "priority": "high",
            "action": f"清理 {len(stale_links)} 个指向不存在对象的链接",
            "detail": "悬空链接会导致关系推理错误",
        })

    return recommendations

import uuid
import json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models.ontology_change import OntologyChangeRequest, OntologyVersion
from models.ontology import OntologyObject, ObjectLink, ObjectAction
from sqlalchemy import func as sql_func


def create_change_request(db: Session, change_type: str, target_type: str,
                          target_id: Optional[str], change_description: str,
                          before_snapshot: Optional[Dict] = None,
                          after_snapshot: Optional[Dict] = None,
                          requested_by: str = "system") -> Dict[str, Any]:
    impact = _analyze_impact(db, change_type, target_type, target_id)

    request = OntologyChangeRequest(
        id=f"cr_{uuid.uuid4().hex[:8]}",
        change_type=change_type,
        target_type=target_type,
        target_id=target_id,
        change_description=change_description,
        before_snapshot=json.dumps(before_snapshot) if before_snapshot else None,
        after_snapshot=json.dumps(after_snapshot) if after_snapshot else None,
        impact_analysis=json.dumps(impact),
        status="pending",
        requested_by=requested_by,
    )
    db.add(request)
    db.commit()

    return {
        "id": request.id,
        "status": "pending",
        "impactAnalysis": impact,
    }


def review_change_request(db: Session, request_id: str, reviewer_id: str,
                          approved: bool, notes: Optional[str] = None) -> Optional[Dict[str, Any]]:
    request = db.query(OntologyChangeRequest).filter(
        OntologyChangeRequest.id == request_id
    ).first()
    if not request:
        return None

    request.status = "approved" if approved else "rejected"
    request.reviewed_by = reviewer_id
    request.reviewed_at = datetime.now(timezone.utc)
    request.review_notes = notes
    db.commit()

    return {
        "id": request.id,
        "status": request.status,
        "reviewedBy": reviewer_id,
    }


def get_pending_change_requests(db: Session) -> List[Dict[str, Any]]:
    requests = db.query(OntologyChangeRequest).filter(
        OntologyChangeRequest.status == "pending"
    ).all()

    return [{
        "id": r.id,
        "changeType": r.change_type,
        "targetType": r.target_type,
        "targetId": r.target_id,
        "description": r.change_description,
        "impactAnalysis": json.loads(r.impact_analysis) if r.impact_analysis else {},
        "requestedBy": r.requested_by,
        "createdAt": r.created_at.isoformat() if r.created_at else "",
    } for r in requests]


def create_version_snapshot(db: Session, description: str = "", created_by: str = "system") -> Dict[str, Any]:
    latest = db.query(OntologyVersion).order_by(
        OntologyVersion.version_number.desc()
    ).first()

    version_number = (latest.version_number + 1) if latest else 1

    objects_data = db.query(OntologyObject).all()
    links_data = db.query(ObjectLink).all()
    actions_data = db.query(ObjectAction).all()

    snapshot = {
        "objects": [{"id": o.id, "objectType": o.object_type, "name": o.name,
                      "status": o.status, "lifecycleStage": o.lifecycle_stage}
                     for o in objects_data],
        "links": [{"sourceId": l.source_id, "linkType": l.link_type,
                    "targetId": l.target_id, "targetName": l.target_name}
                   for l in links_data],
        "actions": [{"id": a.id, "objectId": a.object_id, "name": a.name}
                     for a in actions_data],
    }

    version = OntologyVersion(
        id=f"v_{uuid.uuid4().hex[:8]}",
        version_number=version_number,
        snapshot=json.dumps(snapshot),
        object_count=len(objects_data),
        link_count=len(links_data),
        action_count=len(actions_data),
        description=description,
        created_by=created_by,
    )
    db.add(version)
    db.commit()

    return {
        "id": version.id,
        "versionNumber": version_number,
        "objectCount": len(objects_data),
        "linkCount": len(links_data),
        "actionCount": len(actions_data),
    }


def get_version_history(db: Session) -> List[Dict[str, Any]]:
    versions = db.query(OntologyVersion).order_by(
        OntologyVersion.version_number.desc()
    ).limit(20).all()

    return [{
        "id": v.id,
        "versionNumber": v.version_number,
        "objectCount": v.object_count,
        "linkCount": v.link_count,
        "actionCount": v.action_count,
        "description": v.description,
        "createdBy": v.created_by,
        "createdAt": v.created_at.isoformat() if v.created_at else "",
    } for v in versions]


def compare_versions(db: Session, version_id_1: str, version_id_2: str) -> Dict[str, Any]:
    v1 = db.query(OntologyVersion).filter(OntologyVersion.id == version_id_1).first()
    v2 = db.query(OntologyVersion).filter(OntologyVersion.id == version_id_2).first()

    if not v1 or not v2:
        return {"error": "Version not found"}

    snap1 = json.loads(v1.snapshot)
    snap2 = json.loads(v2.snapshot)

    obj_ids_1 = {o["id"] for o in snap1.get("objects", [])}
    obj_ids_2 = {o["id"] for o in snap2.get("objects", [])}

    added_objects = obj_ids_2 - obj_ids_1
    removed_objects = obj_ids_1 - obj_ids_2

    link_ids_1 = {(l["sourceId"], l["linkType"], l["targetId"]) for l in snap1.get("links", [])}
    link_ids_2 = {(l["sourceId"], l["linkType"], l["targetId"]) for l in snap2.get("links", [])}

    added_links = link_ids_2 - link_ids_1
    removed_links = link_ids_1 - link_ids_2

    return {
        "version1": {"id": v1.id, "number": v1.version_number},
        "version2": {"id": v2.id, "number": v2.version_number},
        "objectsAdded": len(added_objects),
        "objectsRemoved": len(removed_objects),
        "linksAdded": len(added_links),
        "linksRemoved": len(removed_links),
        "addedObjectIds": list(added_objects),
        "removedObjectIds": list(removed_objects),
    }


def _analyze_impact(db: Session, change_type: str, target_type: str, target_id: Optional[str]) -> Dict[str, Any]:
    impact = {"affectedObjects": 0, "affectedLinks": 0, "riskLevel": "low"}

    if target_id:
        affected_links = db.query(ObjectLink).filter(
            (ObjectLink.source_id == target_id) | (ObjectLink.target_id == target_id)
        ).count()
        impact["affectedLinks"] = affected_links

        if affected_links > 10:
            impact["riskLevel"] = "high"
        elif affected_links > 3:
            impact["riskLevel"] = "medium"

    if change_type in ("delete_object", "delete_link"):
        impact["riskLevel"] = "high" if impact["riskLevel"] != "low" else "medium"

    return impact

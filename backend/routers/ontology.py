import uuid
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, require_auth
from models.user import User
from schemas.ontology import (
    OntologyObjectResponse, OntologyObjectListResponse,
    SearchResponse, ActionExecutionRequest, ActionExecutionResponse,
    OntologyObjectCreate, OntologyObjectUpdate,
)
from services.ontology_service import get_all_objects, get_compact_objects, get_object_by_id, search_objects, create_object, update_object, delete_object
from services.permission_service import check_permission, filter_sensitive_fields, check_action_permission, get_readable_object_types
from models.ontology import OntologyObject, ObjectEvent
from models.audit import AuditLog

router = APIRouter(prefix="/api/ontology", tags=["ontology"])


@router.get("/objects", response_model=OntologyObjectListResponse)
def list_objects(
    type: Optional[str] = Query(None, alias="type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    compact: bool = Query(False),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if user and type:
        readable_types = get_readable_object_types(user)
        if "*" not in readable_types and type not in readable_types:
            raise HTTPException(status_code=403, detail="No read permission for this object type")

    if compact:
        result = get_compact_objects(db, type, page, min(page_size, 500))
    else:
        result = get_all_objects(db, type, page, min(page_size, 100))

    if user:
        readable_types = get_readable_object_types(user)
        if "*" not in readable_types:
            filtered_results = []
            for item in result.get("results", []):
                obj_type = item.get("objectType", "")
                if obj_type in readable_types:
                    item["properties"] = filter_sensitive_fields(user, obj_type, item.get("properties", {}))
                    filtered_results.append(item)
            result["results"] = filtered_results
            result["total"] = len(filtered_results)
        else:
            for item in result.get("results", []):
                obj_type = item.get("objectType", "")
                item["properties"] = filter_sensitive_fields(user, obj_type, item.get("properties", {}))

    return OntologyObjectListResponse(**result)


@router.get("/snapshot/validate")
def validate_ontology_snapshot(
    strict: bool = Query(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from semantic.ontology import validate_snapshot
    return validate_snapshot(db, strict=strict)


@router.get("/{object_type}/search", response_model=SearchResponse)
def search(
    object_type: str,
    query: str = Query(""),
    limit: int = Query(10),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if user and not check_permission(db, user, object_type, None, "can_read"):
        raise HTTPException(status_code=403, detail="No read permission for this object type")

    results = search_objects(db, object_type, query, limit)

    if user:
        for item in results:
            item["properties"] = filter_sensitive_fields(user, object_type, item.get("properties", {}))

    return SearchResponse(results=results, total=len(results), limit=limit)


@router.get("/{object_type}/{object_id}")
def get_object(
    object_type: str,
    object_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if user and not check_permission(db, user, object_type, object_id, "can_read"):
        raise HTTPException(status_code=403, detail="No read permission for this object type")

    result = get_object_by_id(db, object_type, object_id)
    if not result:
        return {"id": object_id, "type": object_type, "properties": {}, "links": {}, "metadata": {}}

    if user:
        result["properties"] = filter_sensitive_fields(user, object_type, result.get("properties", {}))

    return result


@router.post("/{object_type}")
def create_new_object(
    object_type: str,
    data: OntologyObjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if not check_permission(db, user, object_type, None, "can_write"):
        raise HTTPException(status_code=403, detail="No write permission for this object type")

    result = create_object(db, object_type, data.model_dump())
    return result


@router.put("/{object_type}/{object_id}")
def update_existing_object(
    object_type: str,
    object_id: str,
    data: OntologyObjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if not check_permission(db, user, object_type, object_id, "can_write"):
        raise HTTPException(status_code=403, detail="No write permission for this object type")

    update_data = data.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = update_object(db, object_type, object_id, update_data)
    if not result:
        raise HTTPException(status_code=404, detail="Object not found")
    return result


@router.delete("/{object_type}/{object_id}")
def delete_existing_object(
    object_type: str,
    object_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    if not check_permission(db, user, object_type, object_id, "can_admin"):
        raise HTTPException(status_code=403, detail="No admin permission for this object type")

    success = delete_object(db, object_type, object_id)
    if not success:
        raise HTTPException(status_code=404, detail="Object not found")
    return {"success": True}


@router.post("/{object_type}/{object_id}/action", response_model=ActionExecutionResponse)
def execute_action(
    object_type: str,
    object_id: str,
    req: ActionExecutionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_auth),
):
    from actions.gateway import ActionGateway
    from actions.hard_rules import HardRuleViolation
    from exceptions import ActionExecutionError

    gateway = ActionGateway(db)
    params = dict(req.params or {})
    params["entity_type"] = object_type
    try:
        result = gateway.submit(
            action_type=req.action,
            object_id=object_id,
            params=params,
            user_id=user.id,
        )
        db.commit()
    except (HardRuleViolation, ActionExecutionError) as exc:
        db.rollback()
        return ActionExecutionResponse(
            success=False,
            error=str(exc),
            transaction_id="",
        )

    if result.get("status") == "pending":
        return ActionExecutionResponse(
            success=True,
            data=result,
            transaction_id=result.get("proposal_id", ""),
        )
    if result.get("status") == "failed" or result.get("success") is False:
        return ActionExecutionResponse(
            success=False,
            error=result.get("message") or result.get("error") or "Action execution failed",
            transaction_id=result.get("action_id", ""),
        )
    return ActionExecutionResponse(
        success=True,
        data=result,
        transaction_id=result.get("action_id", f"tx_{uuid.uuid4().hex[:8]}"),
    )

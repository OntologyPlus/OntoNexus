from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from services.ontology_definition import (
    get_concept_definition, get_relation_definition,
    get_inverse_link_type, get_link_cardinality,
    get_axiom_definitions, get_sensitive_fields,
    validate_object_properties, validate_link,
    ONTOLOGY_DEFINITIONS,
)

router = APIRouter(prefix="/api/ontology-def", tags=["ontology-definition"])


@router.get("/domains")
def list_domains():
    return {
        "domains": [
            {"name": k, "description": v.get("description", "")}
            for k, v in ONTOLOGY_DEFINITIONS.items()
        ]
    }


@router.get("/domains/{domain}")
def get_domain(domain: str):
    data = ONTOLOGY_DEFINITIONS.get(domain)
    if not data:
        return {"error": f"Domain {domain} not found"}
    return data


@router.get("/concepts/{object_type}")
def get_concept(object_type: str):
    concept = get_concept_definition(object_type)
    if not concept:
        return {"error": f"Concept {object_type} not found"}
    return concept


@router.get("/relations/{link_type}")
def get_relation(link_type: str):
    relation = get_relation_definition(link_type)
    if not relation:
        return {"error": f"Relation {link_type} not found"}
    return relation


@router.get("/relations/{link_type}/inverse")
def get_inverse(link_type: str):
    inverse = get_inverse_link_type(link_type)
    return {"linkType": link_type, "inverseLinkType": inverse}


@router.get("/relations/{link_type}/cardinality")
def get_cardinality(link_type: str):
    cardinality = get_link_cardinality(link_type)
    return {"linkType": link_type, "cardinality": cardinality}


@router.get("/axioms")
def list_axioms(constraint_type: Optional[str] = None):
    return {"axioms": get_axiom_definitions(constraint_type)}


@router.get("/sensitive-fields/{object_type}")
def get_sensitive(object_type: str):
    return {"objectType": object_type, "sensitiveFields": get_sensitive_fields(object_type)}


@router.post("/validate/properties")
def validate_properties(request: dict):
    valid, errors = validate_object_properties(request.get("objectType", ""), request.get("properties", {}))
    return {"valid": valid, "errors": errors}


@router.post("/validate/link")
def validate_link_endpoint(request: dict):
    valid, error = validate_link(request.get("linkType", ""), request.get("sourceType", ""), request.get("targetType", ""))
    return {"valid": valid, "error": error}

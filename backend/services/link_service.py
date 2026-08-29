import json
from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from models.ontology import ObjectLink, OntologyObject

INVERSE_LINK_MAP = {
    "WORKS_AT": "CONTAINS_MEMBER",
    "CONTAINS_MEMBER": "WORKS_AT",
    "PRESCRIBES": "PRESCRIBED_BY",
    "PRESCRIBED_BY": "PRESCRIBES",
    "MANAGED_BY": "MANAGES",
    "MANAGES": "MANAGED_BY",
    "INFLUENCES": "INFLUENCED_BY",
    "INFLUENCED_BY": "INFLUENCES",
    "BELONGS_TO": "CONTAINS",
    "CONTAINS": "BELONGS_TO",
    "HAS_VISIT": "VISIT_OF",
    "VISIT_OF": "HAS_VISIT",
    "HAS_ALERT": "ALERT_FOR",
    "ALERT_FOR": "HAS_ALERT",
    "ATTENDED": "ATTENDED_BY",
    "ATTENDED_BY": "ATTENDED",
    "PARTICIPATES_IN": "HAS_PARTICIPANT",
    "HAS_PARTICIPANT": "PARTICIPATES_IN",
    "FLOWS_TO": "RECEIVES_FROM",
    "RECEIVES_FROM": "FLOWS_TO",
    "ACHIEVES": "ACHIEVED_BY",
    "ACHIEVED_BY": "ACHIEVES",
    "POTENTIAL_OF": "HAS_POTENTIAL",
    "HAS_POTENTIAL": "POTENTIAL_OF",
    "CLASSIFIED_AS": "CLASSIFIES",
    "CLASSIFIES": "CLASSIFIED_AS",
    "DRIVEN_BY": "DRIVES",
    "DRIVES": "DRIVEN_BY",
    "CONSUMES": "CONSUMED_BY",
    "CONSUMED_BY": "CONSUMES",
    "PRODUCES": "PRODUCED_BY",
    "PRODUCED_BY": "PRODUCES",
    "CATEGORIZED_AS": "CATEGORY_OF",
    "CATEGORY_OF": "CATEGORIZED_AS",
    "FEEDS_BACK": "FEEDBACK_FROM",
    "FEEDBACK_FROM": "FEEDS_BACK",
    "FOLLOWS": "FOLLOWED_BY",
    "FOLLOWED_BY": "FOLLOWS",
    "STRATEGY_FOR": "HAS_STRATEGY",
    "HAS_STRATEGY": "STRATEGY_FOR",
    "COMPLIES_WITH": "COMPLIED_BY",
    "COMPLIED_BY": "COMPLIES_WITH",
    "VIOLATES": "VIOLATED_BY",
    "VIOLATED_BY": "VIOLATES",
    "GOVERNS": "GOVERNED_BY",
    "GOVERNED_BY": "GOVERNS",
    "CONDUCTS": "CONDUCTED_BY",
    "CONDUCTED_BY": "CONDUCTS",
    "ENROLLS": "ENROLLED_IN",
    "ENROLLED_IN": "ENROLLS",
    "DEPENDS_ON": "REQUIRED_BY",
    "REQUIRED_BY": "DEPENDS_ON",
    "IMPACTS": "IMPACTED_BY",
    "IMPACTED_BY": "IMPACTS",
    "AFFECTS": "AFFECTED_BY",
    "AFFECTED_BY": "AFFECTS",
}

LINK_CARDINALITY = {
    "WORKS_AT": "N:1",
    "MANAGED_BY": "N:1",
    "BELONGS_TO": "N:1",
    "STRATEGY_FOR": "1:1",
    "POTENTIAL_OF": "1:1",
    "PRESCRIBES": "N:M",
    "INFLUENCES": "N:M",
    "FLOWS_TO": "N:M",
    "ACHIEVES": "1:N",
    "CONTAINS": "1:N",
    "MANAGES": "1:N",
    "CONDUCTS": "1:N",
    "ENROLLS": "N:M",
    "DEPENDS_ON": "N:M",
    "CLASSIFIED_AS": "N:1",
    "CATEGORIZED_AS": "N:1",
    "COMPLIES_WITH": "N:M",
    "VIOLATES": "N:M",
}


def get_inverse_link_type(link_type: str) -> Optional[str]:
    return INVERSE_LINK_MAP.get(link_type)


def validate_link_cardinality(db: Session, source_id: str, link_type: str, target_id: str) -> Tuple[bool, str]:
    cardinality = LINK_CARDINALITY.get(link_type)
    if not cardinality:
        return True, ""

    if cardinality == "1:1":
        source_links = db.query(ObjectLink).filter(
            ObjectLink.source_id == source_id,
            ObjectLink.link_type == link_type,
        ).all()
        if len(source_links) >= 1:
            return False, f"1:1 cardinality violated: source '{source_id}' already has a '{link_type}' link"

        target_links = db.query(ObjectLink).filter(
            ObjectLink.target_id == target_id,
            ObjectLink.link_type == link_type,
        ).all()
        if len(target_links) >= 1:
            return False, f"1:1 cardinality violated: target '{target_id}' already has a '{link_type}' link"

    elif cardinality == "1:N":
        source_links = db.query(ObjectLink).filter(
            ObjectLink.source_id == source_id,
            ObjectLink.link_type == link_type,
            ObjectLink.target_id == target_id,
        ).first()
        if source_links:
            return False, f"1:N cardinality violated: source '{source_id}' already has a '{link_type}' link to target '{target_id}'"

    elif cardinality == "N:1":
        pass

    return True, ""


def create_inverse_link(db: Session, source_id: str, link_type: str, target_id: str, target_name: str, target_type: str, source_obj: OntologyObject) -> Optional[ObjectLink]:
    inverse_type = get_inverse_link_type(link_type)
    if not inverse_type:
        return None

    existing = db.query(ObjectLink).filter(
        ObjectLink.source_id == target_id,
        ObjectLink.link_type == inverse_type,
        ObjectLink.target_id == source_id,
    ).first()
    if existing:
        return None

    inverse_link = ObjectLink(
        source_id=target_id,
        link_type=inverse_type,
        target_id=source_id,
        target_name=source_obj.name,
        target_type=source_obj.object_type,
        provenance="auto_inverse",
        inverse_relation=link_type,
    )
    db.add(inverse_link)
    return inverse_link


def delete_inverse_link(db: Session, source_id: str, link_type: str, target_id: str) -> bool:
    inverse_type = get_inverse_link_type(link_type)
    if not inverse_type:
        return False

    inverse_link = db.query(ObjectLink).filter(
        ObjectLink.source_id == target_id,
        ObjectLink.link_type == inverse_type,
        ObjectLink.target_id == source_id,
    ).first()
    if not inverse_link:
        return False

    db.delete(inverse_link)
    return True


def filter_expired_links(links: List[ObjectLink]) -> List[ObjectLink]:
    return [link for link in links if not is_link_expired(link)]


def check_link_conflict(db: Session, source_id: str, link_type: str, target_id: str, confidence: Optional[float] = None) -> Tuple[bool, Optional[str]]:
    existing = db.query(ObjectLink).filter(
        ObjectLink.source_id == source_id,
        ObjectLink.link_type == link_type,
        ObjectLink.target_id == target_id,
    ).first()
    if existing:
        return True, f"Duplicate link: {link_type} from {source_id} to {target_id} already exists"

    inverse_type = get_inverse_link_type(link_type)
    if inverse_type:
        contradictory_types = _get_contradictory_types(link_type)
        for contra_type in contradictory_types:
            contra_link = db.query(ObjectLink).filter(
                ObjectLink.source_id == source_id,
                ObjectLink.link_type == contra_type,
                ObjectLink.target_id == target_id,
            ).first()
            if contra_link:
                return True, f"Contradictory link: {contra_type} from {source_id} to {target_id} conflicts with {link_type}"

    return False, None


def is_link_expired(link: ObjectLink) -> bool:
    if not link.valid_to:
        return False
    try:
        valid_to = datetime.strptime(link.valid_to, "%Y-%m-%d")
        return valid_to < datetime.now()
    except (ValueError, TypeError):
        try:
            valid_to = datetime.strptime(link.valid_to, "%Y-%m-%dT%H:%M:%S")
            return valid_to < datetime.now()
        except (ValueError, TypeError):
            return False


def _get_contradictory_types(link_type: str) -> List[str]:
    contradiction_pairs = [
        {"VIOLATES", "COMPLIES_WITH"},
        {"INFLUENCES", "INFLUENCED_BY"},
        {"MANAGES", "MANAGED_BY"},
    ]
    result = []
    for pair in contradiction_pairs:
        if link_type in pair:
            result.extend(pair - {link_type})
    return result

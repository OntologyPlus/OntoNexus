"""Local ontology: Class / DatatypeProperty / ObjectProperty, hierarchy, validation.

Mirrors OntoNexus-style structure without importing the OntoNexus package.
Definitions come from services.ontology_definition; extra classes fill the lattice
(Doctor ⊂ HCP, concept interfaces as mixin parents).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from exceptions import OntologyValidationError


def _camel_to_snake(name: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "_", name).lower()


def _property_aliases(name: str) -> List[str]:
    snake = _camel_to_snake(name)
    return list(dict.fromkeys([name, snake, name[0].lower() + name[1:] if name else name]))


def _lookup_value(properties: Dict[str, Any], name: str) -> Tuple[bool, Any]:
    for alias in _property_aliases(name):
        if alias in properties:
            return True, properties[alias]
    return False, None


@dataclass
class DatatypeProperty:
    name: str
    owner: str
    value_type: str
    required: bool = False
    computed: bool = False
    enum_values: Optional[List[Any]] = None
    description: str = ""


@dataclass
class ObjectProperty:
    name: str
    link_type: str
    domain: List[str]
    range: List[str]
    cardinality: str = "N:M"
    description: str = ""


@dataclass
class OntologyClass:
    name: str
    description: str = ""
    parents: List[str] = field(default_factory=list)
    datatype_properties: List[DatatypeProperty] = field(default_factory=list)


# Seed classes that appear in relations / domain rows but may lack a concept block.
_SEED_CLASSES: Dict[str, Dict[str, Any]] = {
    "Thing": {"description": "顶层类", "parents": []},
    "HCP": {"description": "医疗卫生专业人士", "parents": ["Thing"]},
    "Targetable": {"description": "可设目标的对象", "parents": ["Thing"]},
    "Auditable": {"description": "可审计对象", "parents": ["Thing"]},
    "Scorable": {"description": "可打分对象", "parents": ["Thing"]},
    "Doctor": {"description": "医生", "parents": ["HCP"]},
    "Hospital": {"description": "医院", "parents": ["Thing"]},
    "Product": {"description": "产品", "parents": ["Thing"]},
    "SalesRep": {"description": "销售代表", "parents": ["Thing"]},
    "VisitRecord": {"description": "拜访记录（分析信号，非录入台）", "parents": ["Thing"]},
    "SalesTarget": {"description": "销售目标", "parents": ["Targetable"]},
    "Territory": {"description": "区域", "parents": ["Thing"]},
    "ExpenseROI": {"description": "费用投入产出", "parents": ["Thing"]},
    "ActionItem": {"description": "行动项", "parents": ["Thing"]},
}

_SEED_OBJECT_PROPERTIES: List[Dict[str, Any]] = [
    {
        "name": "WORKS_AT",
        "linkType": "WORKS_AT",
        "description": "医生在医院执业",
        "domain": ["Doctor", "HCP"],
        "range": ["Hospital"],
        "cardinality": "N:1",
    },
    {
        "name": "HAS_VISIT",
        "linkType": "HAS_VISIT",
        "description": "对象关联拜访记录（分析用）",
        "domain": ["Doctor", "HCP", "Hospital"],
        "range": ["VisitRecord"],
        "cardinality": "1:N",
    },
    {
        "name": "INFLUENCES",
        "linkType": "INFLUENCES",
        "description": "KOL 影响力链",
        "domain": ["Doctor", "HCP"],
        "range": ["Doctor", "HCP"],
        "cardinality": "N:M",
    },
    {
        "name": "MANAGED_BY",
        "linkType": "MANAGED_BY",
        "description": "由代表覆盖",
        "domain": ["Doctor", "Hospital"],
        "range": ["SalesRep"],
        "cardinality": "N:1",
    },
    {
        "name": "HAS_ROI",
        "linkType": "HAS_ROI",
        "description": "对象关联费用投入产出（分析用）",
        "domain": ["Doctor", "HCP", "Hospital", "SalesRep"],
        "range": ["ExpenseROI"],
        "cardinality": "1:N",
    },
    {
        "name": "VISIT_OF",
        "linkType": "VISIT_OF",
        "description": "拜访记录归属的医生或医院（HAS_VISIT 的逆）",
        "domain": ["VisitRecord"],
        "range": ["Doctor", "HCP", "Hospital"],
        "cardinality": "N:1",
    },
]


class OntologyCatalog:
    def __init__(self) -> None:
        self.classes: Dict[str, OntologyClass] = {}
        self.object_properties: Dict[str, ObjectProperty] = {}
        self._rebuild()

    def _ensure_class(self, name: str, description: str = "", parents: Optional[List[str]] = None) -> OntologyClass:
        if name not in self.classes:
            self.classes[name] = OntologyClass(name=name, description=description, parents=list(parents or []))
        else:
            if description and not self.classes[name].description:
                self.classes[name].description = description
            for p in parents or []:
                if p not in self.classes[name].parents:
                    self.classes[name].parents.append(p)
        return self.classes[name]

    def _rebuild(self) -> None:
        self.classes = {}
        self.object_properties = {}
        from services.ontology_definition import ONTOLOGY_DEFINITIONS

        for name, meta in _SEED_CLASSES.items():
            self._ensure_class(name, meta.get("description", ""), meta.get("parents") or [])

        for domain_def in ONTOLOGY_DEFINITIONS.values():
            for concept in domain_def.get("concepts") or []:
                ot = concept.get("objectType") or concept.get("name")
                parents = list(concept.get("interfaces") or [])
                cls = self._ensure_class(ot, concept.get("description") or "", parents)
                for prop in concept.get("properties") or []:
                    dp = DatatypeProperty(
                        name=prop["name"],
                        owner=ot,
                        value_type=prop.get("type", "string"),
                        required=bool(prop.get("required")),
                        computed=bool(prop.get("computed")),
                        enum_values=prop.get("enumValues"),
                        description=prop.get("description") or "",
                    )
                    cls.datatype_properties.append(dp)
            for relation in domain_def.get("relations") or []:
                lt = relation.get("linkType") or relation.get("name")
                self.object_properties[lt] = ObjectProperty(
                    name=relation.get("name") or lt,
                    link_type=lt,
                    domain=list(relation.get("domain") or []),
                    range=list(relation.get("range") or []),
                    cardinality=relation.get("cardinality") or "N:M",
                    description=relation.get("description") or "",
                )

        for rel in _SEED_OBJECT_PROPERTIES:
            lt = rel["linkType"]
            if lt not in self.object_properties:
                self.object_properties[lt] = ObjectProperty(
                    name=rel["name"],
                    link_type=lt,
                    domain=list(rel["domain"]),
                    range=list(rel["range"]),
                    cardinality=rel.get("cardinality") or "N:M",
                    description=rel.get("description") or "",
                )

        for cls in self.classes.values():
            for p in cls.parents:
                self._ensure_class(p)

    def ancestors(self, class_name: str) -> List[str]:
        seen: List[str] = []
        stack = [class_name]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.append(current)
            cls = self.classes.get(current)
            if cls:
                stack.extend(cls.parents)
        return seen

    def is_a(self, class_name: str, ancestor: str) -> bool:
        if class_name == ancestor:
            return True
        return ancestor in self.ancestors(class_name)

    def compatible(self, actual: str, allowed: List[str]) -> bool:
        if not allowed:
            return True
        if not actual:
            return False
        return any(self.is_a(actual, a) for a in allowed)

    def get_class(self, name: str) -> Optional[OntologyClass]:
        return self.classes.get(name)

    def datatype_properties_of(self, class_name: str) -> List[DatatypeProperty]:
        props: List[DatatypeProperty] = []
        for ancestor in self.ancestors(class_name):
            cls = self.classes.get(ancestor)
            if cls:
                props.extend(cls.datatype_properties)
        return props

    def schema_for_oag(self, class_names: Optional[List[str]] = None) -> Dict[str, Any]:
        names = class_names or list(self.classes.keys())
        classes_out = []
        for name in names:
            cls = self.classes.get(name)
            if not cls:
                continue
            classes_out.append(
                {
                    "name": cls.name,
                    "description": cls.description,
                    "parents": cls.parents,
                    "properties": [
                        {
                            "name": p.name,
                            "type": p.value_type,
                            "required": p.required,
                            "enum": p.enum_values,
                        }
                        for p in cls.datatype_properties
                    ],
                }
            )
        relations = []
        for op in self.object_properties.values():
            if class_names and not (
                any(c in op.domain or self.compatible(c, op.domain) for c in class_names)
                or any(c in op.range or self.compatible(c, op.range) for c in class_names)
            ):
                continue
            relations.append(
                {
                    "name": op.name,
                    "linkType": op.link_type,
                    "domain": op.domain,
                    "range": op.range,
                    "cardinality": op.cardinality,
                    "description": op.description,
                }
            )
        return {"classes": classes_out, "object_properties": relations}

    def validate_object(
        self,
        object_type: str,
        properties: Optional[Dict[str, Any]] = None,
        *,
        partial: bool = False,
    ) -> Tuple[bool, List[str]]:
        properties = properties or {}
        errors: List[str] = []
        if object_type not in self.classes:
            return True, []
        for prop in self.datatype_properties_of(object_type):
            present, value = _lookup_value(properties, prop.name)
            if not present or value is None:
                if prop.required and not prop.computed and not partial:
                    errors.append(f"缺少必填属性: {prop.name}")
                continue
            errors.extend(self._type_errors(prop, value))
        return len(errors) == 0, errors

    def _type_errors(self, prop: DatatypeProperty, value: Any) -> List[str]:
        errors: List[str] = []
        t = prop.value_type
        if t == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                errors.append(f"{prop.name} 应为 number")
        elif t == "string" and not isinstance(value, str):
            errors.append(f"{prop.name} 应为 string")
        elif t == "boolean" and not isinstance(value, bool):
            errors.append(f"{prop.name} 应为 boolean")
        elif t == "array" and not isinstance(value, list):
            errors.append(f"{prop.name} 应为 array")
        elif t == "enum":
            allowed = prop.enum_values or []
            if allowed and value not in allowed:
                errors.append(f"{prop.name} 不在枚举 {allowed} 中")
        return errors

    def validate_link(self, link_type: str, source_type: str, target_type: str) -> Tuple[bool, str]:
        op = self.object_properties.get(link_type)
        if not op:
            return True, ""
        if source_type and not any(self.is_a(source_type, d) for d in op.domain):
            return False, f"非法关系: {source_type} 不在 {link_type} 的 domain {op.domain}"
        if target_type and not any(self.is_a(target_type, r) for r in op.range):
            return False, f"非法关系: {target_type} 不在 {link_type} 的 range {op.range}"
        return True, ""

    def require_valid_object(self, object_type: str, properties: Optional[Dict[str, Any]] = None, *, partial: bool = False) -> None:
        ok, errors = self.validate_object(object_type, properties, partial=partial)
        if not ok:
            raise OntologyValidationError("; ".join(errors))

    def require_valid_link(self, link_type: str, source_type: str, target_type: str) -> None:
        ok, reason = self.validate_link(link_type, source_type, target_type)
        if not ok:
            raise OntologyValidationError(reason)

    def validate_write_params(self, params: Optional[Dict[str, Any]], source_type: Optional[str] = None) -> None:
        params = params or {}
        link_type = params.get("linkType") or params.get("link_type")
        target_type = params.get("targetType") or params.get("target_type")
        if link_type and source_type:
            self.require_valid_link(str(link_type), source_type, str(target_type or ""))
        object_type = params.get("objectType") or params.get("object_type") or source_type
        properties = params.get("properties")
        if object_type and isinstance(properties, dict):
            self.require_valid_object(str(object_type), properties)

    def validate_snapshot(self, db, *, strict: bool = False, limit: int = 200) -> Dict[str, Any]:
        """SHACL-like check over current SQLite instances (Semantica validate, no pip)."""
        from models.ontology import ObjectLink, OntologyObject
        from semantic.context_graph import LocalSemanticAdapter

        adapter = LocalSemanticAdapter(db)
        violations: List[Dict[str, Any]] = []
        objects = db.query(OntologyObject).limit(limit).all()
        for obj in objects:
            props = adapter._object_properties(obj)
            ok, errors = self.validate_object(obj.object_type, props, partial=not strict)
            for err in errors:
                violations.append({"kind": "object", "id": obj.id, "type": obj.object_type, "detail": err})
        links = db.query(ObjectLink).limit(limit).all()
        type_by_id = {obj.id: obj.object_type for obj in objects}
        extra_ids = set()
        for link in links:
            extra_ids.add(link.source_id)
            extra_ids.add(link.target_id)
        missing = extra_ids - set(type_by_id)
        if missing:
            extras = db.query(OntologyObject).filter(OntologyObject.id.in_(list(missing))).all()
            for obj in extras:
                type_by_id[obj.id] = obj.object_type
        outbound: Dict[tuple, int] = {}
        for link in links:
            source_type = type_by_id.get(link.source_id) or ""
            target_type = link.target_type or type_by_id.get(link.target_id) or ""
            ok, reason = self.validate_link(link.link_type, source_type, target_type)
            if not ok:
                violations.append({
                    "kind": "link",
                    "id": link.id,
                    "type": link.link_type,
                    "source": link.source_id,
                    "target": link.target_id,
                    "detail": reason,
                })
            outbound[(link.source_id, link.link_type)] = outbound.get((link.source_id, link.link_type), 0) + 1
        for (source_id, link_type), count in outbound.items():
            op = self.object_properties.get(link_type)
            if not op:
                continue
            if op.cardinality in ("1:1", "N:1") and count > 1:
                violations.append({
                    "kind": "cardinality",
                    "id": source_id,
                    "type": link_type,
                    "detail": f"{link_type} cardinality {op.cardinality} exceeded ({count} outbound)",
                })
        return {
            "ok": not violations,
            "checked_objects": len(objects),
            "checked_links": len(links),
            "violations": violations[:100],
            "violation_count": len(violations),
        }


_CATALOG: Optional[OntologyCatalog] = None


def get_ontology() -> OntologyCatalog:
    global _CATALOG
    if _CATALOG is None:
        _CATALOG = OntologyCatalog()
    return _CATALOG


def reset_ontology() -> OntologyCatalog:
    global _CATALOG
    _CATALOG = OntologyCatalog()
    return _CATALOG


def validate_object(object_type: str, properties: Optional[Dict[str, Any]] = None, *, partial: bool = False) -> Tuple[bool, List[str]]:
    return get_ontology().validate_object(object_type, properties, partial=partial)


def validate_link(link_type: str, source_type: str, target_type: str) -> Tuple[bool, str]:
    return get_ontology().validate_link(link_type, source_type, target_type)


def validate_snapshot(db, *, strict: bool = False, limit: int = 200) -> Dict[str, Any]:
    return get_ontology().validate_snapshot(db, strict=strict, limit=limit)

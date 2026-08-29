"""SHACL-like shapes generated from the local ontology.
Shapes are the structural contract Skills and
the Action Gateway consult: required properties, datatypes, class range, cardinality.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from semantic.ontology import OntologyCatalog, get_ontology


@dataclass
class PropertyShape:
    path: str
    datatype: Optional[str] = None
    min_count: int = 0
    max_count: Optional[int] = None
    class_range: Optional[List[str]] = None
    severity: str = "Violation"

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {"path": self.path, "minCount": self.min_count, "severity": self.severity}
        if self.datatype:
            data["datatype"] = self.datatype
        if self.max_count is not None:
            data["maxCount"] = self.max_count
        if self.class_range:
            data["class"] = self.class_range
        return data


@dataclass
class NodeShape:
    target_class: str
    properties: List[PropertyShape] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "targetClass": self.target_class,
            "properties": [p.to_dict() for p in self.properties],
        }


def shapes_from_ontology(
    onto: Optional[OntologyCatalog] = None,
    class_names: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    onto = onto or get_ontology()
    names = class_names or list(onto.classes.keys())
    out: List[Dict[str, Any]] = []
    for name in names:
        cls = onto.classes.get(name)
        if not cls:
            continue
        props: List[PropertyShape] = []
        for dp in onto.datatype_properties_of(name):
            props.append(
                PropertyShape(
                    path=dp.name,
                    datatype=dp.value_type,
                    min_count=1 if dp.required and not dp.computed else 0,
                )
            )
        for op in onto.object_properties.values():
            if not onto.compatible(name, op.domain):
                continue
            max_count = 1 if op.cardinality in ("1:1", "N:1") else None
            props.append(
                PropertyShape(
                    path=op.link_type,
                    class_range=list(op.range),
                    min_count=0,
                    max_count=max_count,
                )
            )
        out.append(NodeShape(target_class=name, properties=props).to_dict())
    return out

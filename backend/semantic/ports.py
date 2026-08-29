"""Stable protocol for the analysis/decision context layer.

Upper layers depend only on this port. Storage (SQLite hydrate, future
graph store) stays behind LocalSemanticAdapter.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable


@dataclass
class AccessScope:
    user_id: str = "system"
    role: str = "user"
    readable_types: Optional[List[str]] = None
    field_mask: Dict[str, List[str]] = field(default_factory=dict)

    def can_read_type(self, object_type: str) -> bool:
        if self.role == "admin":
            return True
        if not self.readable_types or "*" in self.readable_types:
            return True
        return object_type in self.readable_types

    def mask_properties(self, object_type: str, properties: Dict[str, Any]) -> Dict[str, Any]:
        if self.role == "admin":
            return properties
        sensitive = self.field_mask.get(object_type, [])
        if not sensitive:
            return properties
        masked = dict(properties)
        for key in sensitive:
            if key in masked:
                masked[key] = "***"
        return masked


@runtime_checkable
class SemanticContextPort(Protocol):
    def get_object(
        self,
        object_id: str,
        as_of: Optional[datetime] = None,
        scope: Optional[AccessScope] = None,
    ) -> Optional[Dict[str, Any]]:
        ...

    def get_subgraph(
        self,
        seeds: List[str],
        hops: int = 2,
        as_of: Optional[datetime] = None,
        scope: Optional[AccessScope] = None,
    ) -> Dict[str, Any]:
        ...

    def get_observations(
        self,
        subject_id: str,
        metrics: Optional[List[str]] = None,
        window: Optional[str] = None,
    ) -> Dict[str, Any]:
        ...

    def get_provenance(self, evidence_id: str) -> Optional[Dict[str, Any]]:
        ...

    def record_decision_context(self, snapshot: Dict[str, Any]) -> str:
        ...

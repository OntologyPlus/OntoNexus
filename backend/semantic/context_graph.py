"""In-memory property-graph projection of ontology_objects / object_links.

Write-back still goes through SQLite SoT. This graph is a read projection
with temporal validity windows and BFS traversal (OntoNexus ContextGraph pattern).
"""

from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from models.ontology import OntologyObject, ObjectLink, ObjectEvent, TimeSeriesData
from semantic.ports import AccessScope
from services.domain_mapper import DOMAIN_MODEL_MAP
from services.ontology_response_builder import _domain_row_to_dict
from services.permission_service import SENSITIVE_FIELDS


def _naive_utc(dt: datetime) -> datetime:
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return _naive_utc(parsed)
    except (ValueError, TypeError):
        return None


def _link_valid_at(link: ObjectLink, as_of: Optional[datetime]) -> bool:
    """Point-in-time edge filter (OntoNexus temporal). None = now."""
    moment = _naive_utc(as_of) if as_of else datetime.now(timezone.utc).replace(tzinfo=None)
    start = _parse_dt(link.valid_from)
    end = _parse_dt(link.valid_to)
    if start and moment < start:
        return False
    if end and moment > end:
        return False
    return True


class ContextGraph:
    """Thread-local-ish projection. Hydrated per request from SoT."""

    def __init__(self):
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: List[Dict[str, Any]] = []
        self._out: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self._in: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    def add_node(self, node_id: str, node_type: str, content: str = "", metadata: Optional[Dict] = None):
        self.nodes[node_id] = {
            "id": node_id,
            "type": node_type,
            "content": content,
            "metadata": metadata or {},
        }

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        edge_type: str,
        weight: float = 1.0,
        metadata: Optional[Dict] = None,
    ):
        edge = {
            "source_id": source_id,
            "target_id": target_id,
            "type": edge_type,
            "weight": weight,
            "metadata": metadata or {},
        }
        self.edges.append(edge)
        self._out[source_id].append(edge)
        self._in[target_id].append(edge)

    def bfs(self, seeds: List[str], hops: int = 2) -> Dict[str, Any]:
        visited: Set[str] = set()
        queue: deque = deque()
        for seed in seeds:
            if seed in self.nodes:
                queue.append((seed, 0))
                visited.add(seed)

        reached_nodes = []
        reached_edges = []
        seen_edge_keys = set()

        while queue:
            node_id, depth = queue.popleft()
            reached_nodes.append(self.nodes[node_id])
            if depth >= hops:
                continue
            for edge in self._out.get(node_id, []):
                key = (edge["source_id"], edge["type"], edge["target_id"])
                if key not in seen_edge_keys:
                    seen_edge_keys.add(key)
                    reached_edges.append(edge)
                tid = edge["target_id"]
                if tid in self.nodes and tid not in visited:
                    visited.add(tid)
                    queue.append((tid, depth + 1))

        return {"nodes": reached_nodes, "edges": reached_edges, "hops": hops}

    def neighborhood(self, node_id: str, hops: int = 1) -> Dict[str, Any]:
        return self.bfs([node_id], hops=hops)


_IN_CHUNK = 400


def _chunked(ids: Iterable[str], size: int = _IN_CHUNK) -> List[List[str]]:
    unique = list(dict.fromkeys(i for i in ids if i))
    return [unique[i:i + size] for i in range(0, len(unique), size)] or [[]]


def _scope_cache_key(scope: Optional[AccessScope]) -> Tuple:
    if scope is None:
        return ()
    types = tuple(sorted(scope.readable_types or []))
    return (scope.user_id, scope.role, types)


class LocalSemanticAdapter:
    """Maps SemanticContextPort onto SQLite SoT + in-memory ContextGraph."""

    def __init__(self, db: Session, provenance_manager=None):
        self.db = db
        self.provenance = provenance_manager
        self._graph: Optional[ContextGraph] = None
        self._hydrate_key: Optional[Tuple] = None
        self._hydrate_hops: int = 0

    def hydrate(
        self,
        as_of: Optional[datetime] = None,
        scope: Optional[AccessScope] = None,
        object_ids: Optional[Iterable[str]] = None,
    ) -> ContextGraph:
        ids = tuple(sorted({i for i in (object_ids or []) if i})) or None
        key = (as_of, _scope_cache_key(scope), ids)
        if self._graph is not None and self._hydrate_key == key:
            return self._graph

        if ids is not None:
            objects = self._load_objects(ids)
            links = self._load_links_among(ids)
        else:
            objects = self.db.query(OntologyObject).all()
            links = self.db.query(ObjectLink).all()

        graph = self._build_graph(objects, links, as_of=as_of, scope=scope)
        self._graph = graph
        self._hydrate_key = key
        self._hydrate_hops = 10**9 if ids is None else 0
        return graph

    def hydrate_neighborhood(
        self,
        seeds: List[str],
        hops: int = 2,
        as_of: Optional[datetime] = None,
        scope: Optional[AccessScope] = None,
    ) -> ContextGraph:
        """Load only the BFS neighborhood of seeds instead of the full table."""
        seed_ids = [s for s in seeds if s]
        if not seed_ids:
            graph = ContextGraph()
            self._graph = graph
            self._hydrate_key = (as_of, _scope_cache_key(scope), tuple())
            self._hydrate_hops = 0
            return graph
        reached, links = self._walk_links(seed_ids, hops, as_of)
        objects = self._load_objects(reached)
        graph = self._build_graph(objects, links, as_of=as_of, scope=scope)
        self._graph = graph
        self._hydrate_key = (as_of, _scope_cache_key(scope), tuple(sorted(reached)))
        self._hydrate_hops = hops
        return graph

    def get_object(
        self,
        object_id: str,
        as_of: Optional[datetime] = None,
        scope: Optional[AccessScope] = None,
    ) -> Optional[Dict[str, Any]]:
        obj = self.db.query(OntologyObject).filter(OntologyObject.id == object_id).first()
        if not obj:
            return None
        if scope and not scope.can_read_type(obj.object_type):
            return None
        props = self._object_properties(obj)
        if scope:
            props = scope.mask_properties(obj.object_type, props)
        return {
            "id": obj.id,
            "objectType": obj.object_type,
            "name": obj.name,
            "status": obj.status,
            "lifecycleStage": obj.lifecycle_stage,
            "sentiment": obj.sentiment,
            "complianceRiskLevel": obj.compliance_risk_level,
            "ownerId": obj.owner_id,
            "properties": props,
            "asOf": as_of.isoformat() if as_of else None,
        }

    def get_subgraph(
        self,
        seeds: List[str],
        hops: int = 2,
        as_of: Optional[datetime] = None,
        scope: Optional[AccessScope] = None,
    ) -> Dict[str, Any]:
        if self._graph is not None and self._hydrate_key and self._hydrate_key[0] == as_of and self._hydrate_key[1] == _scope_cache_key(scope):
            missing = [s for s in seeds if s and s not in self._graph.nodes]
            if not missing and self._hydrate_hops >= hops:
                return self._graph.bfs(seeds, hops=hops)
        graph = self.hydrate_neighborhood(seeds, hops=hops, as_of=as_of, scope=scope)
        return graph.bfs(seeds, hops=hops)

    def _walk_links(
        self,
        seeds: List[str],
        hops: int,
        as_of: Optional[datetime],
    ) -> Tuple[Set[str], List[ObjectLink]]:
        reached: Set[str] = set(seeds)
        frontier: List[str] = list(seeds)
        collected: List[ObjectLink] = []
        for _ in range(max(int(hops), 0)):
            if not frontier:
                break
            batch_links: List[ObjectLink] = []
            for chunk in _chunked(frontier):
                if not chunk:
                    continue
                batch_links.extend(
                    self.db.query(ObjectLink).filter(ObjectLink.source_id.in_(chunk)).all()
                )
            next_frontier: List[str] = []
            for link in batch_links:
                if not _link_valid_at(link, as_of):
                    continue
                collected.append(link)
                if link.target_id not in reached:
                    reached.add(link.target_id)
                    next_frontier.append(link.target_id)
            frontier = next_frontier
        return reached, collected

    def _load_objects(self, ids: Iterable[str]) -> List[OntologyObject]:
        rows: List[OntologyObject] = []
        for chunk in _chunked(ids):
            if not chunk:
                continue
            rows.extend(self.db.query(OntologyObject).filter(OntologyObject.id.in_(chunk)).all())
        return rows

    def _load_links_among(self, ids: Iterable[str]) -> List[ObjectLink]:
        id_set = set(ids)
        rows: List[ObjectLink] = []
        for chunk in _chunked(id_set):
            if not chunk:
                continue
            rows.extend(self.db.query(ObjectLink).filter(ObjectLink.source_id.in_(chunk)).all())
        return [lk for lk in rows if lk.target_id in id_set]

    def _batch_properties(
        self,
        objects: List[OntologyObject],
        scope: Optional[AccessScope],
    ) -> Dict[str, Dict[str, Any]]:
        type_to_ids: Dict[str, List[str]] = defaultdict(list)
        for obj in objects:
            type_to_ids[obj.object_type].append(obj.id)
        props_by_id: Dict[str, Dict[str, Any]] = {obj.id: {} for obj in objects}
        for obj_type, ids in type_to_ids.items():
            model_class = DOMAIN_MODEL_MAP.get(obj_type)
            if not model_class:
                continue
            rows = []
            for chunk in _chunked(ids):
                if not chunk:
                    continue
                rows.extend(self.db.query(model_class).filter(model_class.id.in_(chunk)).all())
            row_map = {row.id: row for row in rows}
            for oid in ids:
                row = row_map.get(oid)
                props = _domain_row_to_dict(row) if row else {}
                if scope:
                    props = scope.mask_properties(obj_type, props)
                props_by_id[oid] = props
        return props_by_id

    def _build_graph(
        self,
        objects: List[OntologyObject],
        links: List[ObjectLink],
        as_of: Optional[datetime] = None,
        scope: Optional[AccessScope] = None,
    ) -> ContextGraph:
        graph = ContextGraph()
        visible = [obj for obj in objects if not scope or scope.can_read_type(obj.object_type)]
        props_by_id = self._batch_properties(visible, scope)
        for obj in visible:
            graph.add_node(
                obj.id,
                obj.object_type,
                content=obj.name,
                metadata={
                    "name": obj.name,
                    "status": obj.status,
                    "lifecycle_stage": obj.lifecycle_stage,
                    "sentiment": obj.sentiment,
                    "compliance_risk_level": obj.compliance_risk_level,
                    "owner_id": obj.owner_id,
                    "properties": props_by_id.get(obj.id, {}),
                },
            )
        for link in links:
            if not _link_valid_at(link, as_of):
                continue
            if link.source_id not in graph.nodes or link.target_id not in graph.nodes:
                continue
            graph.add_edge(
                link.source_id,
                link.target_id,
                link.link_type,
                weight=link.confidence if link.confidence is not None else (link.link_strength or 1.0),
                metadata={
                    "target_name": link.target_name,
                    "target_type": link.target_type,
                    "valid_from": link.valid_from,
                    "valid_to": link.valid_to,
                    "provenance": link.provenance,
                    "confidence": link.confidence,
                },
            )
        return graph

    def get_observations(
        self,
        subject_id: str,
        metrics: Optional[List[str]] = None,
        window: Optional[str] = None,
    ) -> Dict[str, Any]:
        q = self.db.query(TimeSeriesData).filter(TimeSeriesData.object_id == subject_id)
        rows = q.all()
        series: Dict[str, List] = {}
        for row in rows:
            if metrics and row.series_name not in metrics:
                continue
            series.setdefault(row.series_name, []).append(
                {"timestamp": row.timestamp, "value": row.value}
            )
        for name in series:
            series[name].sort(key=lambda p: p["timestamp"])
        events = self.db.query(ObjectEvent).filter(ObjectEvent.object_id == subject_id).all()
        return {
            "subjectId": subject_id,
            "window": window,
            "series": series,
            "events": [
                {
                    "id": e.id,
                    "eventType": e.event_type,
                    "timestamp": e.timestamp,
                    "description": e.description,
                }
                for e in events
            ],
        }

    def get_provenance(self, evidence_id: str) -> Optional[Dict[str, Any]]:
        if self.provenance is None:
            return None
        return self.provenance.get_record(evidence_id)

    def record_decision_context(self, snapshot: Dict[str, Any]) -> str:
        if self.provenance is None:
            from semantic.provenance import ProvenanceManager
            self.provenance = ProvenanceManager(self.db)
        return self.provenance.track_activity(
            activity_type="decision_context",
            agent=snapshot.get("decision_maker", "system"),
            entity_ids=snapshot.get("entity_ids", []),
            metadata=snapshot,
        )

    def _object_properties(self, obj: OntologyObject) -> Dict[str, Any]:
        model_class = DOMAIN_MODEL_MAP.get(obj.object_type)
        if not model_class:
            return {}
        row = self.db.query(model_class).filter(model_class.id == obj.id).first()
        if not row:
            return {}
        return _domain_row_to_dict(row)

    @staticmethod
    def scope_from_user(user) -> AccessScope:
        from services.permission_service import get_readable_object_types

        if user is None:
            return AccessScope(user_id="anonymous", role="user", readable_types=[])
        return AccessScope(
            user_id=user.id,
            role=getattr(user, "role", "user") or "user",
            readable_types=get_readable_object_types(user),
            field_mask=dict(SENSITIVE_FIELDS),
        )

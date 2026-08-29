"""Conflict detection: never silently overwrite multi-source facts.

Resolution strategies follow OntoNexus (local code, no pip): keep existing,
most recent, credibility-weighted, or escalate to expert review.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class ResolutionStrategy(str, Enum):
    KEEP_EXISTING = "keep_existing"
    MOST_RECENT = "most_recent"
    CREDIBILITY_WEIGHTED = "credibility_weighted"
    EXPERT_REVIEW = "expert_review"


class ConflictDetector:
    def detect(
        self,
        existing: Dict[str, Any],
        incoming: Dict[str, Any],
        source: str = "unknown",
    ) -> List[Dict[str, Any]]:
        conflicts = []
        for key, new_val in incoming.items():
            if key.startswith("_"):
                continue
            if key not in existing:
                continue
            old_val = existing[key]
            if old_val is None or new_val is None:
                continue
            if old_val != new_val:
                conflicts.append({
                    "field": key,
                    "existing": old_val,
                    "incoming": new_val,
                    "source": source,
                    "resolution": "flagged",
                })
        return conflicts

    def merge(
        self,
        existing: Dict[str, Any],
        incoming: Dict[str, Any],
        source: str = "unknown",
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        return ConflictResolver(ResolutionStrategy.KEEP_EXISTING).resolve(existing, incoming, source=source)


class ConflictResolver:
    def __init__(self, strategy: ResolutionStrategy = ResolutionStrategy.KEEP_EXISTING, credibility: Optional[Dict[str, float]] = None):
        self.strategy = strategy
        self.credibility = credibility or {}

    def resolve(
        self,
        existing: Dict[str, Any],
        incoming: Dict[str, Any],
        *,
        source: str = "unknown",
        incoming_ts: Optional[str] = None,
        existing_ts: Optional[str] = None,
        existing_source: str = "canonical",
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        detector = ConflictDetector()
        conflicts = detector.detect(existing, incoming, source)
        merged = dict(existing)
        history: List[Dict[str, Any]] = []
        conflict_fields = {c["field"] for c in conflicts}

        for key, value in incoming.items():
            if key.startswith("_"):
                continue
            if key not in conflict_fields:
                merged[key] = value
                continue
            chosen, confidence, mode = self._pick(
                existing.get(key),
                value,
                existing_source=existing_source,
                incoming_source=source,
                existing_ts=existing_ts,
                incoming_ts=incoming_ts,
            )
            trail = {
                "field": key,
                "existing": existing.get(key),
                "incoming": value,
                "source": source,
                "strategy": self.strategy.value,
                "resolved": chosen,
                "confidence": confidence,
                "mode": mode,
            }
            history.append(trail)
            if mode in ("expert_review", "keep_existing"):
                merged.setdefault("_conflicts", []).append(trail)
            else:
                merged[key] = chosen
                merged.setdefault("_resolutions", []).append(trail)

        return merged, history or conflicts

    def _pick(
        self,
        old: Any,
        new: Any,
        *,
        existing_source: str,
        incoming_source: str,
        existing_ts: Optional[str],
        incoming_ts: Optional[str],
    ) -> Tuple[Any, float, str]:
        if self.strategy == ResolutionStrategy.KEEP_EXISTING:
            return old, 1.0, "keep_existing"
        if self.strategy == ResolutionStrategy.MOST_RECENT:
            if incoming_ts and existing_ts and incoming_ts >= existing_ts:
                return new, 0.8, "most_recent"
            if incoming_ts and not existing_ts:
                return new, 0.7, "most_recent"
            return old, 0.7, "most_recent"
        if self.strategy == ResolutionStrategy.CREDIBILITY_WEIGHTED:
            old_c = float(self.credibility.get(existing_source, 0.5))
            new_c = float(self.credibility.get(incoming_source, 0.5))
            if new_c > old_c:
                return new, min(1.0, new_c), "credibility_weighted"
            return old, min(1.0, old_c), "credibility_weighted"
        return old, 0.0, "expert_review"

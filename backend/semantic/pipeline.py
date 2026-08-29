"""Ontology → Logic → Action → Skills activation (OntoNexus intelligence layer).

`activate` is the single entry used by the Supervisor: hydrate a permission-trimmed
OAG pack, attach SHACL-like shapes, materialise derived facts, and stamp each
instance with write actions that are legal for its class.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from semantic.context_pack import build_context_pack
from semantic.logic import facts_about, infer_pack
from semantic.ontology import get_ontology
from semantic.shapes import shapes_from_ontology
from services.cache_service import ontology_cache

_ACTIVATE_TTL = 30


def _activation_cache_key(query: str, user=None, skills: Optional[List[Any]] = None, as_of=None, lookback_days=None) -> str:
    user_id = getattr(user, "id", None) or "anon"
    skill_names = ",".join(getattr(s, "name", "") for s in (skills or []))
    as_of_key = as_of.isoformat() if hasattr(as_of, "isoformat") else str(as_of or "")
    return f"activate:{user_id}:{query}:{skill_names}:{as_of_key}:{lookback_days or ''}"


def peek_activation(
    db: Session,
    query: str,
    *,
    user=None,
    skills: Optional[List[Any]] = None,
    as_of: Optional[datetime] = None,
    lookback_days: Optional[int] = None,
) -> Optional[Dict[str, Any]]:
    """Return a cached activate() pack without running the pipeline."""
    return ontology_cache.get(_activation_cache_key(query, user, skills, as_of, lookback_days))


def enrich_pack(pack: Dict[str, Any]) -> Dict[str, Any]:
    if pack.get("refuse") or pack.get("truncated_hard_rules"):
        pack.setdefault("shapes", [])
        pack.setdefault("derived_facts", [])
        pack.setdefault("logic_trace", [])
        return pack
    onto = get_ontology()
    preferred = (pack.get("required_context") or {}).get("object_types") or None
    pack["shapes"] = shapes_from_ontology(onto, preferred)
    inferred = infer_pack(pack, onto)
    pack["derived_facts"] = inferred["facts"]
    pack["logic_trace"] = inferred["trace"]
    from actions.contracts import eligible_write_actions

    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        ot = obj.get("objectType") or obj.get("type")
        ctx["derived_facts"] = facts_about(inferred["facts"], oid) if oid else []
        ctx["eligible_actions"] = eligible_write_actions(ot)
    return pack


def activate(
    db: Session,
    query: str,
    *,
    user=None,
    skills: Optional[List[Any]] = None,
    as_of: Optional[datetime] = None,
    lookback_days: Optional[int] = None,
) -> Dict[str, Any]:
    """Supervisor entry: Ontology pack → Logic facts → Action eligibility → Skills context."""
    cache_key = _activation_cache_key(query, user, skills, as_of, lookback_days)
    cached = ontology_cache.get(cache_key)
    if cached:
        return cached
    pack = build_context_pack(
        db,
        query,
        user=user,
        skills=skills,
        as_of=as_of,
        lookback_days=lookback_days,
    )
    ontology_cache.set(cache_key, pack, ttl=_ACTIVATE_TTL)
    return pack

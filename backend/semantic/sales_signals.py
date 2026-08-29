"""Sales signals used as analysis inputs (coverage, KOL, ROI, visit effect).

Not a CRM: no new entry surfaces. Values are derived from existing objects.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any, Dict, Iterable, List, Optional, Set

from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.domain import Doctor, ExpenseROI, SalesTarget, VisitRecord
from models.ontology import ObjectLink, OntologyObject, TimeSeriesData


def compute_sales_signals(db: Session, obj: OntologyObject) -> Dict[str, Any]:
    return compute_sales_signals_batch(db, [obj]).get(obj.id, {})


def compute_sales_signals_batch(db: Session, objects: List[OntologyObject]) -> Dict[str, Dict[str, Any]]:
    if not objects:
        return {}
    store = _preload_signal_store(db, objects)
    return {obj.id: _signals_from_store(obj, store) for obj in objects}


def _chunk_ids(ids: Iterable[str], size: int = 400) -> List[List[str]]:
    unique = list(dict.fromkeys(i for i in ids if i))
    return [unique[i:i + size] for i in range(0, len(unique), size)]


def _query_by_ids(db: Session, model, ids: Iterable[str]):
    rows = []
    for chunk in _chunk_ids(ids):
        rows.extend(db.query(model).filter(model.id.in_(chunk)).all())
    return rows


def _preload_signal_store(db: Session, objects: List[OntologyObject]) -> Dict[str, Any]:
    seed_ids = [obj.id for obj in objects]
    links: List[ObjectLink] = []
    for chunk in _chunk_ids(seed_ids):
        links.extend(
            db.query(ObjectLink)
            .filter(or_(ObjectLink.source_id.in_(chunk), ObjectLink.target_id.in_(chunk)))
            .all()
        )
    from_map: Dict[str, List[ObjectLink]] = defaultdict(list)
    to_map: Dict[str, List[ObjectLink]] = defaultdict(list)
    for lk in links:
        from_map[lk.source_id].append(lk)
        to_map[lk.target_id].append(lk)

    extra_ids: Set[str] = set()
    for obj in objects:
        extra_ids.update(_coverage_doctor_ids(obj, from_map, to_map))
        extra_ids.update(_quota_target_ids(obj, to_map))
        extra_ids.update(_roi_target_ids(obj, from_map))

    extra_needed = [i for i in extra_ids if i not in set(seed_ids)]
    if extra_needed:
        extra_links: List[ObjectLink] = []
        for chunk in _chunk_ids(extra_needed):
            extra_links.extend(
                db.query(ObjectLink)
                .filter(
                    or_(ObjectLink.source_id.in_(chunk), ObjectLink.target_id.in_(chunk)),
                    ObjectLink.link_type.in_(["HAS_VISIT", "VISIT_OF"]),
                )
                .all()
            )
        for lk in extra_links:
            from_map[lk.source_id].append(lk)
            to_map[lk.target_id].append(lk)

    all_ids = list(dict.fromkeys(seed_ids + list(extra_ids)))
    doctors = {row.id: row for row in _query_by_ids(db, Doctor, all_ids)}
    targets = {row.id: row for row in _query_by_ids(db, SalesTarget, all_ids)}
    rois = {row.id: row for row in _query_by_ids(db, ExpenseROI, all_ids)}
    visits = {row.id: row for row in _query_by_ids(db, VisitRecord, all_ids)}

    series_map: Dict[str, List[TimeSeriesData]] = defaultdict(list)
    for chunk in _chunk_ids(seed_ids):
        rows = (
            db.query(TimeSeriesData)
            .filter(
                TimeSeriesData.object_id.in_(chunk),
                TimeSeriesData.series_name.in_(["prescription", "处方量", "prescriptionVolume"]),
            )
            .order_by(TimeSeriesData.timestamp.asc())
            .all()
        )
        for row in rows:
            series_map[row.object_id].append(row)

    return {
        "from_map": from_map,
        "to_map": to_map,
        "doctors": doctors,
        "targets": targets,
        "rois": rois,
        "visits": visits,
        "series": series_map,
    }


def _coverage_doctor_ids(obj: OntologyObject, from_map, to_map) -> List[str]:
    if obj.object_type in ("Doctor", "HCP"):
        return [obj.id]
    doctor_ids: List[str] = []
    if obj.object_type == "Hospital":
        doctor_ids = [lk.source_id for lk in to_map.get(obj.id, []) if lk.link_type in ("WORKS_AT", "CONTAINS_MEMBER")]
        doctor_ids.extend(lk.target_id for lk in from_map.get(obj.id, []) if lk.link_type in ("CONTAINS_MEMBER", "HAS_DOCTOR"))
    elif obj.object_type == "SalesRep":
        doctor_ids = [lk.source_id for lk in to_map.get(obj.id, []) if lk.link_type == "MANAGED_BY"]
    return list(dict.fromkeys(doctor_ids))


def _quota_target_ids(obj: OntologyObject, to_map) -> List[str]:
    if obj.object_type == "SalesTarget":
        return [obj.id]
    return [lk.source_id for lk in to_map.get(obj.id, []) if lk.link_type == "IMPACTED_BY"]


def _roi_target_ids(obj: OntologyObject, from_map) -> List[str]:
    if obj.object_type == "ExpenseROI":
        return [obj.id]
    return [lk.target_id for lk in from_map.get(obj.id, []) if lk.target_type == "ExpenseROI"]


def _signals_from_store(obj: OntologyObject, store: Dict[str, Any]) -> Dict[str, Any]:
    signals: Dict[str, Any] = {}
    coverage = _coverage_from_store(obj, store)
    if coverage is not None:
        signals["coverage"] = coverage
    kol = _kol_from_store(obj, store)
    if kol is not None:
        signals["kol"] = kol
    roi = _roi_from_store(obj, store)
    if roi is not None:
        signals["roi"] = roi
    visit_effect = _visit_effect_from_store(obj, store)
    if visit_effect is not None:
        signals["visit_effect"] = visit_effect
    quota = _quota_from_store(obj, store)
    if quota is not None:
        signals["quota"] = quota
    return signals


def _coverage_from_store(obj: OntologyObject, store: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if obj.object_type not in ("Doctor", "HCP", "Hospital", "SalesRep"):
        return None
    doctor_ids = _coverage_doctor_ids(obj, store["from_map"], store["to_map"])
    if not doctor_ids:
        return {"rate": 0.0, "covered": 0, "total": 0}
    visited = set()
    visits = store["visits"]
    from_map = store["from_map"]
    to_map = store["to_map"]
    for did in doctor_ids:
        if did in visits:
            visited.add(did)
        for lk in from_map.get(did, []):
            if lk.link_type in ("HAS_VISIT", "VISIT_OF"):
                visited.add(did)
                break
        for lk in to_map.get(did, []):
            if lk.link_type in ("HAS_VISIT", "VISIT_OF"):
                visited.add(did)
                break
    total = len(doctor_ids)
    covered = len(visited)
    rate = round(100.0 * covered / total, 1) if total else 0.0
    return {"rate": rate, "covered": covered, "total": total}


def _kol_from_store(obj: OntologyObject, store: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    from_map = store["from_map"]
    to_map = store["to_map"]
    if obj.object_type not in ("Doctor", "HCP"):
        inbound = [lk for lk in to_map.get(obj.id, []) if lk.link_type in ("INFLUENCES", "INFLUENCED_BY")]
        if not inbound:
            return None
        return {
            "influence_score": None,
            "influenced_count": len(inbound),
            "chain": [lk.source_id for lk in inbound[:8]],
        }
    doctor = store["doctors"].get(obj.id)
    outbound = [lk for lk in from_map.get(obj.id, []) if lk.link_type == "INFLUENCES"]
    return {
        "influence_score": getattr(doctor, "influence_score", None) if doctor else None,
        "influenced_count": len(outbound),
        "chain": [lk.target_id for lk in outbound[:8]],
    }


def _quota_from_store(obj: OntologyObject, store: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    targets = store["targets"]
    row = targets.get(obj.id) if obj.object_type == "SalesTarget" else None
    if row is None:
        ids = _quota_target_ids(obj, store["to_map"])
        for tid in ids:
            row = targets.get(tid)
            if row:
                break
    if not row or row.target_value is None:
        return None
    target = int(row.target_value or 0)
    actual = int(row.actual_value or 0)
    return {
        "target_value": row.target_value,
        "actual_value": row.actual_value,
        "forecast_value": row.forecast_value,
        "achievement_rate": row.achievement_rate,
        "gap": target - actual,
        "risk_level": row.risk_level,
    }


def _roi_from_store(obj: OntologyObject, store: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    rois = store["rois"]
    row = rois.get(obj.id)
    if row is None:
        for tid in _roi_target_ids(obj, store["from_map"]):
            row = rois.get(tid)
            if row:
                break
    if not row:
        return None
    return {
        "roi_ratio": row.roi_ratio,
        "expense_amount": row.expense_amount,
        "revenue_generated": row.revenue_generated,
        "period": row.calculation_period,
    }


def _visit_effect_from_store(obj: OntologyObject, store: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    series = store["series"].get(obj.id) or []
    if len(series) < 2:
        return None
    mid = len(series) // 2
    before_vals = [s.value for s in series[:mid] if s.value is not None]
    after_vals = [s.value for s in series[mid:] if s.value is not None]
    if not before_vals or not after_vals:
        return None
    before = sum(before_vals) / len(before_vals)
    after = sum(after_vals) / len(after_vals)
    return {
        "before": round(before, 1),
        "after": round(after, 1),
        "delta": round(after - before, 1),
    }


def format_signals(signals: Dict[str, Any]) -> str:
    if not signals:
        return ""
    parts = ["销售信号:"]
    cov = signals.get("coverage") or {}
    if cov:
        parts.append(f"- 覆盖率 {cov.get('rate')}%（已覆盖 {cov.get('covered')}/{cov.get('total')}）")
    kol = signals.get("kol") or {}
    if kol:
        parts.append(f"- KOL 影响力 {kol.get('influence_score')}，下游 {kol.get('influenced_count')} 人")
    roi = signals.get("roi") or {}
    if roi:
        parts.append(f"- 费用 ROI {roi.get('roi_ratio')}（投入 {roi.get('expense_amount')} / 产出 {roi.get('revenue_generated')}）")
    ve = signals.get("visit_effect") or {}
    if ve:
        parts.append(f"- 拜访后处方变化 {ve.get('delta')}（访前 {ve.get('before')} → 访后 {ve.get('after')}）")
    quota = signals.get("quota") or {}
    if quota:
        parts.append(
            f"- 本季目标缺口 {quota.get('gap')}（目标 {quota.get('target_value')} / 实际 {quota.get('actual_value')}，达成 {quota.get('achievement_rate')}%）"
        )
    return "\n".join(parts)


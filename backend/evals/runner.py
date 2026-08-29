"""Eval suite: scenario → expected conclusion / objects / forbidden actions."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

from sqlalchemy.orm import Session

from actions.gateway import ActionGateway
from actions.hard_rules import HardRuleViolation
from ai.hallucination import detect_hallucination
from ai.orchestrator import orchestrate
from semantic.context_pack import HARD_RULE_TOKEN_BUDGET, build_context_pack
from skills.loader import get_skill_loader


CASES_PATH = Path(__file__).resolve().parent / "eval_cases.yaml"


def _parse_cases(text: str) -> List[Dict[str, Any]]:
    cases: List[Dict[str, Any]] = []
    current: Dict[str, Any] = {}
    current_list_key = None
    for line in text.splitlines():
        if line.startswith("- id:"):
            if current:
                cases.append(current)
            current = {"id": line.split(":", 1)[1].strip()}
            current_list_key = None
            continue
        if not current:
            continue
        stripped = line.strip()
        if stripped.startswith("- ") and current_list_key:
            current[current_list_key].append(stripped[2:].strip())
            continue
        if ":" in line and line.startswith("  "):
            key, val = line.strip().split(":", 1)
            val = val.strip()
            current_list_key = None
            if val == "":
                current[key] = []
                current_list_key = key
            elif val.startswith("[") and val.endswith("]"):
                inner = val[1:-1].strip()
                current[key] = [x.strip() for x in inner.split(",")] if inner else []
            else:
                current[key] = val
    if current:
        cases.append(current)
    return cases


def load_cases() -> List[Dict[str, Any]]:
    if CASES_PATH.exists():
        return _parse_cases(CASES_PATH.read_text(encoding="utf-8"))
    return []


def run_eval_suite(db: Session) -> Dict[str, Any]:
    results = []
    for case in load_cases():
        results.append(_run_case(db, case))
    passed = sum(1 for r in results if r.get("passed"))
    return {
        "total": len(results),
        "passed": passed,
        "failed": len(results) - passed,
        "results": results,
    }


def _run_case(db: Session, case: Dict[str, Any]) -> Dict[str, Any]:
    kind = case.get("type")
    case_id = case.get("id")
    try:
        if kind == "hard_rule_refuse":
            pack = build_context_pack(db, case.get("query", "诊断"), hard_rule_budget=1)
            ok = bool(pack.get("truncated_hard_rules") and pack.get("refuse"))
            return {"id": case_id, "passed": ok, "detail": pack.get("refuse_reason")}
        if kind == "gateway_block_no_object":
            try:
                ActionGateway(db).submit(action_type="scheduleVisit", object_id=None, user_id="u1")
                db.rollback()
                return {"id": case_id, "passed": False, "detail": "expected HardRuleViolation"}
            except HardRuleViolation as exc:
                db.rollback()
                return {"id": case_id, "passed": exc.rule_id == "HR-001", "detail": str(exc)}
        if kind == "gateway_sod":
            from models.action import ActionProposal
            import uuid
            p = ActionProposal(
                id=f"ap_eval_{uuid.uuid4().hex[:8]}",
                title="t",
                action_type="scheduleVisit",
                entity_id="doc_1",
                status="pending",
                proposed_by="same_user",
            )
            db.add(p)
            db.flush()
            try:
                ActionGateway(db).approve(p.id, "same_user")
                db.rollback()
                return {"id": case_id, "passed": False, "detail": "expected SoD"}
            except Exception as exc:
                db.rollback()
                return {"id": case_id, "passed": "终审" in str(exc) or "SoD" in type(exc).__name__, "detail": str(exc)}
        if kind == "skill_registry":
            loader = get_skill_loader()
            expected = case.get("expected_skill")
            skill = loader.match(case.get("query", ""))
            return {"id": case_id, "passed": skill.name == expected, "detail": skill.name}
        if kind == "hallucination_numeric":
            hallu = detect_hallucination(
                case.get("content", ""),
                object_ids=["d1"],
                pack={"contexts": [{"object": {"id": "d1", "name": "A"}}]},
                numeric_facts={"达成率": 80.0},
            )
            expect_fail = case.get("expect_pass", "false").lower() == "false"
            passed = (not hallu["passed"]) if expect_fail else hallu["passed"]
            return {"id": case_id, "passed": passed, "detail": hallu}
        if kind == "orchestrate":
            out = orchestrate(db, case.get("query", "查找医生"))
            expected_skill = case.get("expected_skill")
            ok = True
            if expected_skill:
                ok = out.get("skill") == expected_skill or expected_skill in str(out.get("events"))
            if case.get("must_not_execute") == "true":
                ok = ok and not any(
                    (e.get("type") == "tools_used" and "executed" == str(e.get("content")))
                    for e in out.get("events") or []
                )
            return {"id": case_id, "passed": ok, "detail": {"skill": out.get("skill"), "decision_id": out.get("decision_id")}}
        if kind == "oag_objects":
            pack = build_context_pack(db, case.get("query", "医生"))
            ok = pack.get("matchedObjects", 0) >= int(case.get("min_objects", 0) or 0)
            return {"id": case_id, "passed": ok, "detail": pack.get("matchedObjects")}
        return {"id": case_id, "passed": False, "detail": f"unknown type {kind}"}
    except Exception as exc:
        db.rollback()
        return {"id": case_id, "passed": False, "detail": str(exc)}

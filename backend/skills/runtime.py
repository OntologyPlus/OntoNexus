"""Deterministic skill runtimes for the analysis slice. No second INTENT_MAP."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from semantic.context_pack import build_context_pack
from skills.loader import Skill


def run_skill(db: Session, skill: Skill, query: str, slots: Dict[str, Any], user=None) -> Dict[str, Any]:
    pack = slots.get("context_pack") or build_context_pack(db, query, user=user)
    if pack.get("refuse"):
        return {
            "skill": skill.name,
            "status": "refused",
            "reason": pack.get("refuse_reason"),
            "truncated_hard_rules": True,
            "content": pack.get("refuse_reason"),
            "evidence": [],
            "object_ids": [],
        }

    handlers = {
        "ontology_lookup": _ontology_lookup,
        "metric_diagnosis": _metric_diagnosis,
        "causal_explainer": _causal_explainer,
        "recovery_plan_drafter": _recovery_plan_drafter,
        "report_narrator": _report_narrator,
        "action_operator": _action_operator,
        "attribution-analyzer": _attribution_analyzer,
        "what-if-simulator": _what_if_simulator,
        "decision-penetrate": _decision_penetrate,
        "recommend-and-accept": _recommend_and_accept,
        "alert-manager": _alert_manager,
    }
    handler = handlers.get(skill.name, _ontology_lookup)
    from skills.loader import get_skill_loader
    l3 = get_skill_loader().load_l3_resources(skill.name)
    if l3:
        slots = dict(slots)
        slots["l3_resources"] = l3
    return handler(db, skill, query, pack, slots, user)


def _object_ids(pack: Dict[str, Any]) -> List[str]:
    ids = []
    for ctx in pack.get("contexts") or []:
        oid = (ctx.get("object") or {}).get("id")
        if oid:
            ids.append(oid)
    return ids


def _min_coverage(skill: Skill) -> float:
    try:
        return float((skill.evidence_requirements or {}).get("min_coverage") or 0)
    except (TypeError, ValueError):
        return 0.0


def _coverage_note(skill: Skill, evidence: List[str], pack: Dict[str, Any]) -> str:
    total = max(1, len(pack.get("contexts") or []))
    ratio = len(set(e for e in evidence if e)) / total
    need = _min_coverage(skill)
    if need and ratio < need:
        return f"\n证据覆盖 {ratio:.0%} < {skill.title} 要求 {need:.0%}，结论需谨慎。"
    return ""


def _num(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _ontology_lookup(db, skill, query, pack, slots, user):
    lines = []
    evidence = []
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        if not oid:
            continue
        evidence.append(oid)
        lines.append(f"- {obj.get('name')} ({obj.get('objectType')}) id={oid} 状态={obj.get('status')}")
        derived = ctx.get("derived_facts") or []
        classes = [d.split("(")[0] for d in derived if d.endswith(f"({oid})")]
        if classes:
            lines.append(f"  推导类: {', '.join(sorted(set(classes))[:8])}")
        for link in (ctx.get("links") or [])[:8]:
            tid = link.get("targetId")
            if not tid:
                continue
            lines.append(f"  [{link.get('linkType')}] → {link.get('targetName')} ({tid})")
        actions = ctx.get("availableActions") or []
        names = [a.get("name") for a in actions if isinstance(a, dict) and a.get("name")]
        if names:
            lines.append(f"  可提案动作（未执行）: {', '.join(names[:6])}")
    if not lines:
        content = f"{skill.title}：未匹配到对象，拒绝编造人名或医院。"
    else:
        content = f"{skill.title}：\n" + "\n".join(lines)
    content += _coverage_note(skill, evidence, pack)
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": [e for e in evidence if e],
        "object_ids": _object_ids(pack),
        "risk_level": skill.risk_level,
    }


def _metric_diagnosis(db, skill, query, pack, slots, user):
    warn_at = _num(skill.threshold("achievement_warn", 80)) or 80
    crit_at = _num(skill.threshold("achievement_critical", 60)) or 60
    l3_note = ""
    if slots.get("l3_resources"):
        l3_note = "（已加载 L3 阈值表）"
    ranked: List[tuple] = []
    evidence = []
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        props = ctx.get("properties") or {}
        oid = obj.get("id")
        name = obj.get("name")
        if not oid:
            continue
        status = obj.get("status")
        if status == "critical":
            ranked.append((0, f"[严重] {name} ({oid}): 状态=critical"))
            evidence.append(oid)
        elif status == "warning":
            ranked.append((1, f"[预警] {name} ({oid}): 状态=warning"))
            evidence.append(oid)
        rate = _num(props.get("achievement_rate") or props.get("achievementRate"))
        if rate is not None:
            if rate < crit_at:
                ranked.append((0, f"[严重] {name} ({oid}): 达成率={rate}% < {crit_at}%"))
                evidence.append(oid)
            elif rate < warn_at:
                ranked.append((1, f"[预警] {name} ({oid}): 达成率={rate}% < {warn_at}%"))
                evidence.append(oid)
            else:
                ranked.append((2, f"[观察] {name} ({oid}): 达成率={rate}%"))
        vol = props.get("prescription_volume") or props.get("prescriptionVolume")
        if vol is not None:
            ranked.append((2, f"[观察] {name} ({oid}): 处方量={vol}"))
            evidence.append(oid)
        ts = ctx.get("timeSeriesSummary") or {}
        for series, summary in ts.items():
            if "下降" in str(summary):
                ranked.append((1, f"[预警] {name} ({oid}): {series} 下降 — {summary}"))
                evidence.append(oid)
    ranked.sort(key=lambda item: item[0])
    findings = [item[1] for item in ranked]
    if not findings:
        findings.append("未触发诊断规则；纳入分析的对象: " + ", ".join(_object_ids(pack)[:8] or ["无"]))
    ids = list(dict.fromkeys(evidence))
    content = f"{skill.title}{l3_note}：\n- " + "\n- ".join(findings) + f"\n证据对象: {', '.join(ids) or '无'}"
    content += _coverage_note(skill, evidence, pack)
    coverage = min(1.0, len(set(evidence)) / max(1, len(pack.get("contexts") or [1])))
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": ids,
        "object_ids": _object_ids(pack),
        "coverage": coverage,
        "risk_level": skill.risk_level,
        "data_cards": [_data_card_from_pack(pack, "诊断对象")],
    }


def _causal_explainer(db, skill, query, pack, slots, user):
    preferred = ["INFLUENCES", "MANAGED_BY", "WORKS_AT", "PRESCRIBES"]
    seen = set()
    ordered: List[tuple] = []
    evidence = []

    def _add(rel, src_name, src_id, tgt_name, tgt_id, meaning=""):
        if not src_id or not tgt_id:
            return
        key = (src_id, rel, tgt_id)
        if key in seen:
            return
        seen.add(key)
        rank = preferred.index(rel) if rel in preferred else len(preferred)
        ordered.append((rank, f"{src_name}({src_id}) --{rel}--> {tgt_name}({tgt_id})" + (f"  路径含义: {meaning}" if meaning else "")))
        evidence.append(src_id)
        evidence.append(tgt_id)

    meanings = {
        "INFLUENCES": "KOL 影响力",
        "MANAGED_BY": "代表覆盖",
        "WORKS_AT": "执业医院",
        "PRESCRIBES": "处方产品",
    }
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        for link in ctx.get("links") or []:
            _add(
                link.get("linkType") or "",
                obj.get("name"),
                obj.get("id"),
                link.get("targetName"),
                link.get("targetId"),
                meanings.get(link.get("linkType") or "", ""),
            )
        for edge in (ctx.get("subgraph") or {}).get("edges") or []:
            _add(edge.get("type") or "", edge.get("source_id"), edge.get("source_id"), edge.get("target_id"), edge.get("target_id"))
    ordered.sort(key=lambda item: item[0])
    lines = [item[1] for item in ordered[:24]]
    if not lines:
        start = ", ".join(_object_ids(pack)[:5] or ["无"])
        lines = [f"无法形成因果链（无关系边）。起点对象: {start}"]
    content = f"{skill.title}：\n- " + "\n- ".join(lines)
    content += _coverage_note(skill, evidence, pack)
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": list(dict.fromkeys(e for e in evidence if e)),
        "object_ids": _object_ids(pack),
        "risk_level": skill.risk_level,
    }


def _recovery_plan_drafter(db, skill, query, pack, slots, user):
    object_ids = _object_ids(pack)
    target = slots.get("object_id")
    if not target:
        for ctx in pack.get("contexts") or []:
            obj = ctx.get("object") or {}
            if obj.get("status") in ("warning", "critical") and obj.get("id"):
                target = obj.get("id")
                break
        target = target or (object_ids[0] if object_ids else None)
    steps = [str(s) for s in (skill.plan_steps or [])] or [
        "核实现状指标（达成率/处方量，引用对象 ID）",
        "核对覆盖与最近拜访效果",
        "明确责任代表",
        "建议随访或风险标记",
        "复盘检查点：审批通过后才能落库",
    ]
    if not target:
        return {
            "skill": skill.name,
            "status": "blocked",
            "content": f"{skill.title}：HR-001 无对象，不能创建整改。",
            "evidence": [],
            "object_ids": object_ids,
            "risk_level": skill.risk_level,
        }
    draft = {
        "title": "整改计划草稿",
        "target_id": target,
        "steps": steps,
        "requires_approval": True,
    }
    proposal = None
    from actions.hard_rules import HardRuleViolation
    try:
        proposal = _gateway_submit(
            db,
            action_type="recovery_plan_drafter",
            object_id=target,
            params=draft,
            user=user,
            slots=slots,
        )
    except HardRuleViolation as exc:
        proposal = {"status": "blocked", "message": str(exc)}
    step_text = "\n".join(f"{i}. {s}" for i, s in enumerate(steps, 1))
    content = (
        f"{skill.title} → {target}\n"
        f"提案: {(proposal or {}).get('proposal_id') or (proposal or {}).get('action_id') or '-'} "
        f"状态={(proposal or {}).get('status')}\n步骤:\n{step_text}"
    )
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": [target],
        "object_ids": object_ids,
        "proposal": proposal,
        "actions": [_action_card_from_gateway(proposal, "recovery_plan_drafter", target)],
        "risk_level": skill.risk_level,
    }


def _report_narrator(db, skill, query, pack, slots, user):
    ids = _object_ids(pack)
    if not ids:
        return {
            "skill": skill.name,
            "status": "ok",
            "content": f"{skill.title}：无分析范围，无法成文。",
            "evidence": [],
            "object_ids": [],
            "risk_level": skill.risk_level,
        }
    facts = []
    names = []
    missing = []
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        name = obj.get("name")
        names.append(name)
        props = ctx.get("properties") or {}
        facts.append(f"{name} ({oid}) 状态={obj.get('status')}")
        rate = props.get("achievement_rate") or props.get("achievementRate")
        if rate is not None:
            facts.append(f"{name} ({oid}) 达成率={rate}")
        signals = ctx.get("sales_signals") or {}
        if signals.get("coverage"):
            facts.append(f"{name} ({oid}) 覆盖率={signals['coverage'].get('rate')}%")
        if not signals.get("roi"):
            missing.append(f"{oid} 无 ROI")
    narrative = [
        f"本报告覆盖 {len(ids)} 个对象，详见证据 ID。",
        "指标与销售信号仅来自 OAG pack，未引入外部传闻。",
        "若需动作，请转建议与接受 Skill，本报告不落库。",
    ]
    content = (
        f"{skill.title}\n"
        f"范围: {', '.join(n for n in names if n)[:200]} / {', '.join(ids[:8])}\n"
        f"事实:\n- " + "\n- ".join(facts[:12]) + "\n"
        f"叙述（需复核）:\n- " + "\n- ".join(narrative) + "\n"
        f"限制: {'; '.join(missing[:6]) or '无额外缺失项声明'}"
    )
    content += _coverage_note(skill, ids, pack)
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": ids,
        "object_ids": ids,
        "risk_level": skill.risk_level,
    }


def _gateway_submit(db, *, action_type, object_id, params, user, slots):
    from actions.gateway import ActionGateway
    return ActionGateway(db).submit(
        action_type=action_type,
        object_id=object_id,
        params=params or {},
        user_id=getattr(user, "id", None) or "agent",
        causation_id=slots.get("causation_id"),
        decision_id=slots.get("parent_decision_id"),
    )


def _action_operator(db, skill, query, pack, slots, user):
    action_type = slots.get("action_type") or "scheduleVisit"
    if action_type not in (skill.allowed_actions or []):
        return {
            "skill": skill.name,
            "status": "blocked",
            "content": f"动作 {action_type} 不在 action_operator 白名单",
            "evidence": [],
            "object_ids": _object_ids(pack),
            "risk_level": skill.risk_level,
        }
    object_id = slots.get("object_id") or (_object_ids(pack)[0] if _object_ids(pack) else None)
    from actions.hard_rules import HardRuleViolation
    try:
        result = _gateway_submit(
            db,
            action_type=action_type,
            object_id=object_id,
            params=slots.get("params") or {},
            user=user,
            slots=slots,
        )
        content = f"{skill.title}：已提交 Gateway：{result}"
        status = "ok"
        from decision.learning import record_outcome
        record_outcome(
            db,
            skill_name=skill.name,
            object_id=object_id,
            action_id=(result or {}).get("proposal_id") or (result or {}).get("action_id"),
            note=action_type,
        )
    except HardRuleViolation as exc:
        result = {"status": "blocked", "rule": exc.rule_id, "message": exc.message}
        content = f"{skill.title}：Gateway 拒绝：{exc.rule_id} {exc.message}"
        status = "blocked"
    return {
        "skill": skill.name,
        "status": status,
        "content": content,
        "evidence": [object_id] if object_id else [],
        "object_ids": _object_ids(pack),
        "gateway": result,
        "risk_level": skill.risk_level,
        "actions": [_action_card_from_gateway(result, action_type, object_id)],
    }


def run_skills(db: Session, skills: List[Skill], query: str, slots: Dict[str, Any], user=None) -> Dict[str, Any]:
    """Run 1–3 skills against the same activated pack and merge outputs."""
    if not skills:
        return {"status": "ok", "content": "", "evidence": [], "object_ids": [], "skills": []}
    parts = []
    evidence: List[str] = []
    object_ids: List[str] = []
    actions: List[Dict[str, Any]] = []
    data_cards: List[Dict[str, Any]] = []
    proposals = []
    gateways = []
    status = "ok"
    for skill in skills:
        result = run_skill(db, skill, query, slots, user=user)
        parts.append(result)
        if result.get("status") == "refused":
            return result
        if result.get("status") in ("blocked", "failed"):
            status = result.get("status")
        evidence.extend(result.get("evidence") or [])
        object_ids.extend(result.get("object_ids") or [])
        actions.extend(result.get("actions") or [])
        data_cards.extend(result.get("data_cards") or [])
        if result.get("proposal"):
            proposals.append(result["proposal"])
        if result.get("gateway"):
            gateways.append(result["gateway"])
    content = "\n\n".join(
        f"### {p.get('skill')}\n{p.get('content')}" for p in parts if p.get("content")
    )
    insight_chain = next((p.get("insight_chain") for p in parts if p.get("insight_chain")), None)
    missing_signals = next((p.get("missing_signals") for p in parts if p.get("missing_signals")), None)
    return {
        "skill": skills[0].name,
        "skills": [s.name for s in skills],
        "status": status,
        "content": content,
        "evidence": list(dict.fromkeys(e for e in evidence if e)),
        "object_ids": list(dict.fromkeys(object_ids)),
        "actions": actions,
        "data_cards": data_cards,
        "proposal": proposals[0] if proposals else None,
        "gateway": gateways[0] if gateways else None,
        "parts": parts,
        "insight_chain": insight_chain,
        "missing_signals": missing_signals,
        "risk_level": max((s.risk_level for s in skills), default="R0"),
    }


def _action_card_from_gateway(result: Optional[Dict[str, Any]], action_type: str, object_id: Optional[str]) -> Dict[str, Any]:
    result = result or {}
    status = result.get("status") or "failed"
    if status == "executed":
        card_status = "executed"
    elif status in ("pending", "approved"):
        card_status = "pending"
    else:
        card_status = "failed"
    return {
        "id": result.get("proposal_id") or result.get("action_id") or action_type,
        "title": action_type,
        "description": result.get("message") or "",
        "status": card_status,
        "action_id": result.get("proposal_id") or result.get("action_id"),
        "object_id": object_id,
        "action_type": action_type,
        "proposed_by": result.get("proposed_by"),
    }


def _data_card_from_pack(pack: Dict[str, Any], title: str) -> Dict[str, Any]:
    rows = []
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        props = ctx.get("properties") or {}
        signals = ctx.get("sales_signals") or {}
        row = {
            "id": obj.get("id"),
            "name": obj.get("name"),
            "type": obj.get("objectType"),
            "status": obj.get("status"),
            "relevance": ctx.get("relevance_score"),
        }
        rate = props.get("achievement_rate") or props.get("achievementRate")
        if rate is not None:
            row["achievement_rate"] = rate
        if signals.get("coverage"):
            row["coverage"] = signals["coverage"].get("rate")
        if signals.get("kol"):
            row["kol"] = signals["kol"].get("influence_score")
        if signals.get("roi"):
            row["roi"] = signals["roi"].get("roi_ratio")
        if signals.get("visit_effect"):
            row["visit_effect"] = signals["visit_effect"].get("delta")
        rows.append(row)
    return {"title": title, "rows": rows[:8]}


def _attribution_analyzer(db, skill, query, pack, slots, user):
    coverage_weak = _num(skill.threshold("coverage_weak", 50)) or 50
    visit_material = _num(skill.threshold("visit_effect_material", 5)) or 5
    roi_weak = _num(skill.threshold("roi_weak", 1)) or 1
    drivers: List[tuple] = []
    evidence = []
    missing: List[str] = []
    needed = ("coverage", "visit_effect", "kol", "roi")
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        name = obj.get("name")
        if not oid:
            continue
        evidence.append(oid)
        signals = ctx.get("sales_signals") or {}
        for key in needed:
            if not signals.get(key):
                missing.append(f"{name or oid} ({oid}) 未采集 {key}")
        cov = signals.get("coverage") or {}
        if cov:
            rate = _num(cov.get("rate")) or 0
            magnitude = max(0.0, coverage_weak - rate) if rate < coverage_weak else rate / 100.0
            drivers.append((
                magnitude,
                0,
                {
                    "claim": f"覆盖率 {rate}%（{cov.get('covered')}/{cov.get('total')}）— {name} ({oid})",
                    "object_id": oid,
                    "signal": "coverage",
                },
            ))
        ve = signals.get("visit_effect") or {}
        if ve and ve.get("delta") is not None:
            delta = _num(ve.get("delta")) or 0
            if abs(delta) >= visit_material:
                drivers.append((
                    abs(delta),
                    1,
                    {
                        "claim": f"拜访后处方变化 {delta}（访前 {ve.get('before')} → 访后 {ve.get('after')}）— {name} ({oid})",
                        "object_id": oid,
                        "signal": "visit_effect",
                    },
                ))
        kol = signals.get("kol") or {}
        if kol:
            drivers.append((
                float(kol.get("influenced_count") or 0),
                2,
                {
                    "claim": f"专家影响力 {kol.get('influence_score')}，下游 {kol.get('influenced_count')} 人 — {name} ({oid})",
                    "object_id": oid,
                    "signal": "kol",
                },
            ))
        roi = signals.get("roi") or {}
        if roi and roi.get("roi_ratio") is not None:
            ratio = _num(roi.get("roi_ratio")) or 0
            mag = max(0.0, roi_weak - ratio) if ratio < roi_weak else ratio
            drivers.append((
                mag,
                3,
                {
                    "claim": f"费用 ROI {ratio}— {name} ({oid})",
                    "object_id": oid,
                    "signal": "roi",
                },
            ))
        props = ctx.get("properties") or {}
        product = props.get("productId") or props.get("product_id")
        if product:
            drivers.append((0.1, 4, {"claim": f"产品 {product} — {name} ({oid})", "object_id": oid, "signal": "product"}))
    drivers.sort(key=lambda item: (-item[0], item[1]))
    if not drivers:
        body = "未采集到覆盖/拜访效果/KOL/ROI/产品信号。对象: " + ", ".join(_object_ids(pack)[:8] or ["无"])
        content = f"{skill.title}\n{body}"
        chain = {"root": [], "intermediate": [], "surface": []}
    else:
        root = [drivers[0][2]]
        intermediate = [d[2] for d in drivers[1:3]]
        surface = [d[2] for d in drivers[3:6]]
        chain = {"root": root, "intermediate": intermediate, "surface": surface}
        content = (
            f"{skill.title}\n"
            f"因果链（根因 0.5 / 中间 0.3 / 表象 0.2）\n"
            f"根因: {root[0]['claim']} [证据 {root[0]['object_id']}]\n"
        )
        if intermediate:
            content += "中间:\n- " + "\n- ".join(f"{i['claim']} [证据 {i['object_id']}]" for i in intermediate) + "\n"
        if surface:
            content += "表象:\n- " + "\n- ".join(f"{s['claim']} [证据 {s['object_id']}]" for s in surface) + "\n"
        content += "建议下一步: 穿透到医院/代表，或给出可接受的动作（本 Skill 不落库）"
    if missing:
        content += "\n未采集:\n- " + "\n- ".join(missing[:8])
    content += _coverage_note(skill, evidence, pack)
    card = _data_card_from_pack(pack, "归因数据")
    card["insight_chain"] = chain
    card["missing_signals"] = missing[:8]
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": [e for e in evidence if e],
        "object_ids": _object_ids(pack),
        "data_cards": [card],
        "insight_chain": chain,
        "missing_signals": missing[:8],
        "risk_level": skill.risk_level,
    }


def _what_if_simulator(db, skill, query, pack, slots, user):
    from services.scenario_service import get_scenarios, recalculate_scenario

    scenarios = get_scenarios(db)
    if not scenarios:
        return {
            "skill": skill.name,
            "status": "ok",
            "content": f"{skill.title}：没有可模拟情景，拒绝编造预测数字。",
            "evidence": [],
            "object_ids": _object_ids(pack),
            "data_cards": [],
            "risk_level": skill.risk_level,
        }
    q = (query or "").lower()
    scenario = next(
        (s for s in scenarios if (s.get("name") or "").lower() in q or (s.get("id") or "") in query),
        scenarios[0],
    )
    used_default = scenario is scenarios[0] and not (
        (scenario.get("name") or "").lower() in q or (scenario.get("id") or "") in (query or "")
    )
    params = slots.get("scenario_params") or {}
    forecast = recalculate_scenario(db, scenario["id"], params) or scenario
    fr = forecast.get("forecastResult") or {}
    note = f"使用默认情景 {scenario.get('id')}" if used_default else f"匹配情景 {scenario.get('id')}"
    param_text = ", ".join(f"{k}={v}" for k, v in params.items()) or "默认"
    content = (
        f"{skill.title}「{forecast.get('name') or scenario.get('name') or scenario.get('id')}」({scenario.get('id')})\n"
        f"- {note}\n"
        f"- 参数: {param_text}\n"
        f"- 预测值 {fr.get('forecastValue')} / 达成率 {fr.get('achievementRate')}% / 风险 {fr.get('riskLevel')}"
    )
    if (fr.get("riskLevel") or "") == "critical":
        content += "\n风险为 critical，可转建议与接受 Skill（本 Skill 不提案）。"
    object_ids = _object_ids(pack)
    if not object_ids:
        content += "\n未采集: pack 中无分析对象 ID，预测仅相对情景本身。"
    card = {
        "title": "What-if 结果",
        "rows": [
            {
                "id": scenario.get("id"),
                "name": forecast.get("name") or scenario.get("name"),
                "forecast": fr.get("forecastValue"),
                "achievement_rate": fr.get("achievementRate"),
                "risk": fr.get("riskLevel"),
                "object_ids": ",".join(object_ids[:6]),
            }
        ],
    }
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": [e for e in ([scenario.get("id")] + object_ids) if e],
        "object_ids": object_ids,
        "data_cards": [card],
        "risk_level": skill.risk_level,
    }


def _decision_penetrate(db, skill, query, pack, slots, user):
    l1, l2, l3 = [], [], []
    evidence = []
    root = None
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        if not oid:
            continue
        if root is None:
            root = obj
            evidence.append(oid)
        ot = obj.get("objectType")
        label = f"{obj.get('name')} ({oid})"
        if ot in ("Hospital", "Territory", "TerritoryPerformance"):
            l1.append(label)
        elif ot == "Doctor":
            l2.append(label)
        elif ot == "SalesRep":
            l3.append(label)
        for link in ctx.get("links") or []:
            tgt_id = link.get("targetId")
            tgt_type = link.get("targetType")
            if not tgt_id or tgt_type not in ("Hospital", "Doctor", "SalesRep", "Territory"):
                continue
            evidence.append(tgt_id)
            item = f"{link.get('targetName')} ({tgt_id}) via {link.get('linkType')}"
            if tgt_type in ("Hospital", "Territory"):
                l1.append(item)
            elif tgt_type == "Doctor":
                l2.append(item)
            else:
                l3.append(item)
        for edge in (ctx.get("subgraph") or {}).get("edges") or []:
            evidence.append(edge.get("target_id"))
    def _uniq(items):
        out, seen = [], set()
        for i in items:
            if i in seen:
                continue
            seen.add(i)
            out.append(i)
        return out
    l1, l2, l3 = _uniq(l1), _uniq(l2), _uniq(l3)
    root_name = (root or {}).get("name") or "无"
    root_id = (root or {}).get("id") or "无"
    content = (
        f"{skill.title} 根={root_name}({root_id})\n"
        f"L1 医院/区域\n- " + ("\n- ".join(l1) if l1 else "该层无下钻边") + "\n"
        f"L2 医生\n- " + ("\n- ".join(l2) if l2 else "该层无下钻边") + "\n"
        f"L3 代表\n- " + ("\n- ".join(l3) if l3 else "该层无下钻边")
    )
    missing_layers = []
    if not l1:
        missing_layers.append("L1 医院/区域")
    if not l2:
        missing_layers.append("L2 医生")
    if not l3:
        missing_layers.append("L3 代表")
    if missing_layers:
        content += "\n未采集: " + "、".join(missing_layers)
    content += _coverage_note(skill, [e for e in evidence if e], pack)
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": [e for e in evidence if e],
        "object_ids": _object_ids(pack),
        "data_cards": [_data_card_from_pack(pack, "穿透路径")],
        "risk_level": skill.risk_level,
    }


def _recommend_and_accept(db, skill, query, pack, slots, user):
    object_ids = _object_ids(pack)
    target = slots.get("object_id") or (object_ids[0] if object_ids else None)
    target_status = None
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        if obj.get("id") == target:
            target_status = obj.get("status")
            break
    if not target:
        return {
            "skill": skill.name,
            "status": "ok",
            "content": f"{skill.title}：缺少对象，无法建议。",
            "evidence": [],
            "object_ids": object_ids,
            "actions": [],
            "risk_level": skill.risk_level,
        }
    whitelist = set(skill.allowed_actions or [])
    target_type = None
    eligible = None
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        if obj.get("id") == target:
            target_type = obj.get("objectType") or obj.get("type")
            eligible = ctx.get("eligible_actions")
            break
    suggestions = []
    if "scheduleVisit" in whitelist:
        suggestions.append({"action_type": "scheduleVisit", "title": "安排随访", "object_id": target})
    if "markAsAtRisk" in whitelist:
        suggestions.append({"action_type": "markAsAtRisk", "title": "标记风险客户", "object_id": target})
    from actions.contracts import action_applies
    suggestions = [
        sug for sug in suggestions
        if action_applies(sug["action_type"], target_type)
        and (eligible is None or sug["action_type"] in eligible)
    ]
    accepted = any(k in (query or "") for k in ("接受", "采纳", "确认建议"))
    proposal = None
    actions = []
    if accepted:
        from actions.hard_rules import HardRuleViolation
        action_type = slots.get("action_type") or "scheduleVisit"
        if action_type not in whitelist:
            return {
                "skill": skill.name,
                "status": "blocked",
                "content": f"{skill.title}：动作 {action_type} 不在白名单 {sorted(whitelist)}",
                "evidence": [target],
                "object_ids": object_ids,
                "risk_level": skill.risk_level,
            }
        try:
            proposal = _gateway_submit(
                db,
                action_type=action_type,
                object_id=target,
                params={"reason": query},
                user=user,
                slots=slots,
            )
            actions.append(_action_card_from_gateway(proposal, action_type, target))
            from decision.learning import record_outcome
            record_outcome(
                db,
                skill_name=skill.name,
                object_id=target,
                action_id=(proposal or {}).get("proposal_id"),
                note="accepted",
            )
        except HardRuleViolation as exc:
            proposal = {"status": "failed", "message": str(exc)}
            actions.append(_action_card_from_gateway(proposal, action_type, target))
    else:
        for sug in suggestions:
            actions.append(
                {
                    "id": f"suggest_{sug['action_type']}_{sug['object_id']}",
                    "title": sug["title"],
                    "description": f"{sug['action_type']} → {sug['object_id']}（待用户接受）",
                    "status": "pending",
                    "action_type": sug["action_type"],
                    "object_id": sug["object_id"],
                    "requires_accept": True,
                }
            )
    lines = [f"- {a['title']} → {a.get('object_id')}  状态={a.get('status')}{'（待接受）' if a.get('requires_accept') else ''}" for a in actions]
    content = f"{skill.title}\n" + ("\n".join(lines) if lines else "- 无建议")
    if accepted:
        content += f"\n已按用户确认提交 Gateway：{proposal}"
    else:
        content += "\n未接受时：点击「接受建议」或回复「接受建议」。"
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": [target],
        "object_ids": object_ids,
        "proposal": proposal,
        "actions": actions,
        "data_cards": [_data_card_from_pack(pack, "建议对象")],
        "risk_level": skill.risk_level,
    }


def _alert_manager(db, skill, query, pack, slots, user):
    alerts = []
    evidence = []
    actions = []
    for ctx in pack.get("contexts") or []:
        obj = ctx.get("object") or {}
        oid = obj.get("id")
        if not oid:
            continue
        props = ctx.get("properties") or {}
        rate = _num(props.get("achievement_rate") or props.get("achievementRate"))
        level = None
        reason = None
        if obj.get("status") == "critical" or (rate is not None and rate < 60):
            level, reason = "critical", obj.get("status") or f"达成率 {rate}%"
        elif obj.get("status") == "warning" or obj.get("complianceRiskLevel"):
            level, reason = "high", obj.get("status") or f"合规 {obj.get('complianceRiskLevel')}"
        elif obj.get("lifecycleStage") == "at_risk":
            level, reason = "medium", "生命周期 at_risk"
        if not level:
            continue
        evidence.append(oid)
        alerts.append(f"[{level}] {obj.get('name')} ({oid}): {reason}")
        actions.append(
            {
                "id": f"suggest_scheduleVisit_{oid}",
                "title": "安排随访",
                "description": f"预警 {level} → {oid}",
                "status": "pending",
                "action_type": "scheduleVisit",
                "object_id": oid,
                "requires_accept": True,
            }
        )
    if not alerts:
        content = f"{skill.title}：当前 pack 无预警对象。"
    else:
        content = f"{skill.title}\n- " + "\n- ".join(alerts) + f"\n合计: {len(alerts)}"
    return {
        "skill": skill.name,
        "status": "ok",
        "content": content,
        "evidence": evidence,
        "object_ids": _object_ids(pack),
        "actions": actions[:4],
        "data_cards": [_data_card_from_pack(pack, "预警清单")],
        "risk_level": skill.risk_level,
    }

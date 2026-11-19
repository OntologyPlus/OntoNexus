"""Unit tests for the pure war-room helpers (no DB / LLM needed)."""

from datetime import date

from agents import war_room_logic as L


def test_half_trend_pct_matches_seed_story():
    # d1 prescription series from seed: 120,115,108,95,72,78,85
    assert L.half_trend_pct([120, 115, 108, 95, 72, 78, 85]) == -27.8
    # hidden-risk doctor: steady decline
    assert L.half_trend_pct([96, 92, 85, 74, 66, 58]) == -27.5
    assert L.half_trend_pct([1, 2, 3]) is None
    assert L.half_trend_pct([0, 0, 5, 5]) is None


def test_hidden_risk_outranks_flagged_known_risk():
    hidden = {"rx_trend_pct": -27.5, "visits_last": 0, "influence_score": 80, "downstream_count": 2, "status": "normal"}
    known = {"rx_trend_pct": -27.8, "visits_last": 4, "influence_score": 88, "downstream_count": 1, "status": "warning"}
    s_hidden, r_hidden = L.score_doctor(hidden)
    s_known, _ = L.score_doctor(known)
    assert s_hidden > s_known
    assert L.is_hidden_risk(s_hidden, "normal")
    assert not L.is_hidden_risk(s_known, "warning")
    assert any("拜访" in r for r in r_hidden)


def test_rank_findings_puts_named_object_first():
    findings = [
        {"id": "d6", "name": "周教授", "score": 62},
        {"id": "d1", "name": "张主任", "score": 47},
    ]
    ranked = L.rank_findings(findings, "张主任最近处方为什么下降")
    assert [f["id"] for f in ranked] == ["d1", "d6"]
    assert ranked[0]["focused"] is True


def test_extract_json_handles_fences_and_noise():
    raw = '好的，方案如下：\n```json\n{"steps": [{"action_type": "scheduleVisit", "object_id": "d1"}]}\n```'
    data = L.extract_json(raw)
    assert data and data["steps"][0]["object_id"] == "d1"
    assert L.extract_json("没有 json") is None
    assert L.extract_json("{broken") is None


def test_normalize_steps_drops_unknown_and_fills_defaults():
    today = date(2026, 11, 18)
    raw = {"steps": [
        {"action_type": "scheduleVisit", "object_id": "d6", "params": {}, "rationale": "恢复拜访"},
        {"action_type": "scheduleVisit", "object_id": "d6", "params": {}},           # duplicate
        {"action_type": "dropDatabase", "object_id": "d6"},                            # unknown
        {"action_type": "send_notification", "object_id": "null", "params": {}},
        "garbage",
    ]}
    steps = L.normalize_steps(raw, today=today)
    assert [s["action_type"] for s in steps] == ["scheduleVisit", "send_notification"]
    assert steps[0]["params"]["visitDate"] == "2026-11-21"
    assert steps[1]["object_id"] is None
    assert steps[1]["params"]["user_id"] == "user_manager"


def test_normalize_steps_keeps_user_requested_violation_for_gateway_to_judge():
    # The planner must not self-censor: scheduleVisit on a Product is proposed as-is.
    steps = L.normalize_steps({"steps": [{"action_type": "scheduleVisit", "object_id": "p1"}]}, today=date(2026, 11, 18))
    assert steps and steps[0]["object_id"] == "p1"


def test_deterministic_plan_has_auto_pending_and_notification():
    findings = [{"id": "d6", "name": "周教授", "score": 62, "reasons": ["处方量较前期下降 27.5%"]}]
    steps = L.deterministic_plan(findings, today=date(2026, 11, 18))
    assert [s["action_type"] for s in steps] == ["generateVisitBrief", "scheduleVisit", "send_notification"]
    assert L.deterministic_plan([{"id": "d9", "name": "x", "score": 5}]) == []


def test_ground_numbers_flags_invented_figures():
    source = "周教授 处方量 96 92 85 74 66 58 下降 27.5%"
    ok = L.ground_numbers("周教授处方量下降约27.5%，最近为58", source)
    assert ok["ok"] and ok["checked"] == 2
    bad = L.ground_numbers("周教授处方量下降了 43%，涉及 380 万元", source)
    assert not bad["ok"] and 43.0 in bad["ungrounded"] and 380.0 in bad["ungrounded"]
    # ids and trivial numbers are ignored
    assert L.ground_numbers("对象 d6 在 2026 年有 3 次拜访", "")["ok"]


def test_cited_objects_by_name_or_id():
    known = {"d6": {"name": "周教授", "type": "Doctor"}, "d1": {"name": "张主任", "type": "Doctor"}, "h1": {"name": "上海瑞金医院", "type": "Hospital"}}
    cites = L.cited_objects("重点关注周教授（d6），其次是 d1", known)
    assert {c["id"] for c in cites} == {"d6", "d1"}
    assert L.cited_objects("没有任何对象", known) == []


def test_deterministic_reasoning_mentions_hidden_flag():
    findings = [{"kind": "doctor", "id": "d6", "name": "周教授", "score": 62, "hidden": True,
                 "reasons": ["处方量较前期下降 27.5%"], "downstream": ["王主治"]}]
    text = L.deterministic_reasoning(findings)
    assert "周教授" in text and "尚未被标记" in text and "27.5%" in text


def test_sse_line_is_valid_event_stream_frame():
    line = L.sse_line({"type": "x", "text": "中文"})
    assert line.startswith("data: ") and line.endswith("\n\n") and "中文" in line


def test_ground_numbers_accepts_thousands_separators():
    r = L.ground_numbers("缺口约 ¥4,200,000", "gap 4200000")
    assert r["ok"] and r["checked"] == 1


def test_intent_steps_enforce_explicit_user_instruction():
    known = {"p1": {"name": "诺欣妥", "type": "Product"}, "d1": {"name": "张主任", "type": "Doctor"}}
    steps = L.intent_steps("帮我给诺欣妥这个产品安排一次拜访", known, today=date(2026, 11, 18))
    assert [(s["action_type"], s["object_id"]) for s in steps] == [("scheduleVisit", "p1")]
    # no verb -> nothing forced; unknown object -> nothing forced
    assert L.intent_steps("张主任处方为什么下降", known) == []
    assert L.intent_steps("安排一次拜访", known) == []


def test_merge_steps_does_not_duplicate_and_keeps_planner_order():
    a = [{"action_type": "scheduleVisit", "object_id": "d1"}]
    b = [{"action_type": "scheduleVisit", "object_id": "d1"}, {"action_type": "scheduleVisit", "object_id": "p1"}]
    merged = L.merge_steps(a, b)
    assert [(s["action_type"], s["object_id"]) for s in merged] == [("scheduleVisit", "d1"), ("scheduleVisit", "p1")]

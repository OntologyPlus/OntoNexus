"""Pure helpers for the Agent war room.

No database / LLM imports on purpose: everything here is deterministic and
unit-testable. The orchestration (DB, LLM, Gateway) lives in ``agents/war_room.py``.
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

AGENT_USER_ID = "ai_agent"

# Actions the planner may propose. Whether they are *allowed* is decided by the
# Action Gateway (hard rules, SoD, approval), never by the planner.
PLAN_ALLOWED_ACTIONS: Dict[str, str] = {
    "generateVisitBrief": "生成拜访简报（低风险，系统自动执行）。params: {}",
    "scheduleVisit": "安排拜访（需经理审批）。params: {visitDate:'YYYY-MM-DD', purpose:'拜访目的'}",
    "send_notification": "通知相关人员（低风险，无需对象ID）。params: {user_id:'user_manager', message:'通知内容'}",
    "updateSentiment": "更新医生态度（需审批）。params: {sentiment:'positive|neutral|negative', evidence:'依据'}",
    "flagComplianceRisk": "标记合规风险（高风险，需审批）。params: {riskType:'类型', description:'描述'}",
    "markAsAtRisk": "标记为流失风险（高风险，需审批）。params: {reason:'原因'}",
    "escalate": "升级处理（高风险，需审批）。params: {reason:'原因'}",
    "updateAccessStatus": "更新医院准入状态（需审批）。params: {status:'状态'}",
    "allocateBudget": "分配预算（高风险，需审批）。params: {amount:数字, reason:'原因'}",
    "inviteToEvent": "邀请参加学术活动（低风险）。params: {eventId:'活动ID'}",
}

_NUM_RE = re.compile(r"(?<![A-Za-z0-9_.])(\d+(?:\.\d+)?)(?![A-Za-z0-9_])")


# --------------------------------------------------------------------------
# Perception scoring
# --------------------------------------------------------------------------

def half_trend_pct(values: Sequence[Optional[float]]) -> Optional[float]:
    """Percent change of the 2nd half mean vs the 1st half mean. None if < 4 points."""
    vals = [float(v) for v in values if v is not None]
    if len(vals) < 4:
        return None
    mid = len(vals) // 2
    first = sum(vals[:mid]) / mid
    second = sum(vals[mid:]) / (len(vals) - mid)
    if first == 0:
        return None
    return round((second - first) / abs(first) * 100.0, 1)


def score_doctor(f: Dict[str, Any]) -> Tuple[int, List[str]]:
    """Composite risk score (0-100) with human-readable reasons.

    Inputs (all optional): rx_trend_pct, visits_last, influence_score,
    downstream_count, status.
    """
    score = 0
    reasons: List[str] = []

    trend = f.get("rx_trend_pct")
    if trend is not None:
        if trend <= -30:
            score += 35
        elif trend <= -15:
            score += 22
        elif trend <= -5:
            score += 10
        if trend <= -5:
            reasons.append(f"处方量较前期下降 {abs(trend):.1f}%")

    visits = f.get("visits_last")
    if visits is not None:
        if visits <= 0:
            score += 20
            reasons.append("近期拜访已中断（最近一个月 0 次）")
        elif visits <= 1:
            score += 12
            reasons.append(f"近期拜访仅 {int(visits)} 次")

    influence = f.get("influence_score")
    if influence is not None and influence >= 80:
        score += 10
        reasons.append(f"影响力 {influence:g}，属核心专家")

    downstream = int(f.get("downstream_count") or 0)
    if downstream >= 2:
        score += 10
        reasons.append(f"影响下游 {downstream} 位医生，风险会传导")
    elif downstream == 1:
        score += 5
        reasons.append("影响 1 位下游医生")

    if f.get("status") in ("warning", "critical"):
        score += 10
        reasons.append("系统已标记关注")

    return min(score, 100), reasons


def is_hidden_risk(score: int, status: Optional[str]) -> bool:
    """High score although nobody has flagged the object yet."""
    return score >= 40 and status not in ("warning", "critical")


def rank_findings(findings: List[Dict[str, Any]], query: str = "") -> List[Dict[str, Any]]:
    """Objects named in the query first, then by score (desc)."""
    q = query or ""

    def key(f: Dict[str, Any]):
        focused = bool(f.get("name")) and f["name"] in q
        f["focused"] = focused
        return (0 if focused else 1, -int(f.get("score") or 0))

    return sorted(findings, key=key)


# --------------------------------------------------------------------------
# Plan parsing
# --------------------------------------------------------------------------

def extract_json(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    cleaned = re.sub(r"```(?:json)?", "", text).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(cleaned[start:end + 1])
    except (json.JSONDecodeError, ValueError):
        return None
    return data if isinstance(data, dict) else None


def normalize_steps(
    raw: Optional[Dict[str, Any]],
    *,
    today: Optional[date] = None,
    max_steps: int = 5,
    default_notify_user: str = "user_manager",
) -> List[Dict[str, Any]]:
    """Validate/clean planner JSON into a list of steps. Unknown actions are dropped."""
    today = today or date.today()
    steps_in = (raw or {}).get("steps")
    if not isinstance(steps_in, list):
        return []
    out: List[Dict[str, Any]] = []
    seen = set()
    for item in steps_in:
        if not isinstance(item, dict):
            continue
        action = str(item.get("action_type") or "").strip()
        if action not in PLAN_ALLOWED_ACTIONS:
            continue
        object_id = item.get("object_id")
        object_id = str(object_id).strip() if object_id not in (None, "", "null") else None
        params = item.get("params") if isinstance(item.get("params"), dict) else {}
        params = dict(params)
        rationale = str(item.get("rationale") or "").strip()[:80]
        if action == "scheduleVisit":
            params.setdefault("visitDate", (today + timedelta(days=3)).isoformat())
            params.setdefault("purpose", "恢复拜访节奏，了解处方变化原因")
        elif action == "send_notification":
            params.setdefault("user_id", default_notify_user)
            params.setdefault("message", rationale or "AI 建议跟进，请查看待办")
        key = (action, object_id)
        if key in seen:
            continue
        seen.add(key)
        out.append({"action_type": action, "object_id": object_id, "params": params, "rationale": rationale})
        if len(out) >= max_steps:
            break
    return out


def deterministic_plan(
    findings: List[Dict[str, Any]],
    *,
    today: Optional[date] = None,
    top_n: int = 2,
    min_score: int = 30,
) -> List[Dict[str, Any]]:
    """Degraded-mode planner: brief -> visit -> notify for the riskiest doctors."""
    today = today or date.today()
    steps: List[Dict[str, Any]] = []
    picked = [f for f in findings if f.get("kind", "doctor") == "doctor" and (f.get("score") or 0) >= min_score][:top_n]
    for f in picked:
        why = "；".join((f.get("reasons") or [])[:2]) or "风险信号"
        steps.append({"action_type": "generateVisitBrief", "object_id": f["id"], "params": {}, "rationale": f"先备好拜访简报：{why}"[:80]})
        steps.append({
            "action_type": "scheduleVisit", "object_id": f["id"],
            "params": {"visitDate": (today + timedelta(days=3)).isoformat(), "purpose": "恢复拜访节奏，了解处方变化原因"},
            "rationale": f"尽快恢复拜访：{why}"[:80],
        })
    if picked:
        names = "、".join(f["name"] for f in picked)
        steps.append({
            "action_type": "send_notification", "object_id": None,
            "params": {"user_id": "user_manager", "message": f"AI 发现需优先跟进：{names}，已提交拜访提案待审批"},
            "rationale": "通知区域经理关注待审批提案",
        })
    return steps


# Verbs in the user's request -> action. The planner must never silently drop an
# explicit instruction: the Gateway, not the planner, decides whether it is allowed.
_INTENT_VERBS = (
    (("拜访",), "scheduleVisit"),
    (("合规", "违规"), "flagComplianceRisk"),
    (("准入",), "updateAccessStatus"),
    (("预算",), "allocateBudget"),
)


def intent_steps(
    query: str,
    known: Dict[str, Dict[str, str]],
    *,
    today: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """Steps the user explicitly asked for (object named in query + action verb)."""
    today = today or date.today()
    q = query or ""
    objects = [(oid, meta) for oid, meta in known.items() if meta.get("name") and meta["name"] in q]
    steps: List[Dict[str, Any]] = []
    for words, action in _INTENT_VERBS:
        if not any(w in q for w in words):
            continue
        for oid, meta in objects:
            params: Dict[str, Any] = {}
            if action == "scheduleVisit":
                params = {"visitDate": (today + timedelta(days=3)).isoformat(), "purpose": "按用户要求安排拜访"}
            elif action == "flagComplianceRisk":
                params = {"riskType": "user_requested", "description": "按用户要求标记合规风险"}
            elif action == "updateAccessStatus":
                params = {"status": "under_review"}
            elif action == "allocateBudget":
                params = {"reason": "按用户要求调整预算"}
            steps.append({"action_type": action, "object_id": oid, "params": params,
                          "rationale": f"用户明确要求：{meta['name']}"[:80]})
    return steps


def merge_steps(primary: List[Dict[str, Any]], extra: List[Dict[str, Any]], max_steps: int = 6) -> List[Dict[str, Any]]:
    seen = {(s["action_type"], s.get("object_id")) for s in primary}
    merged = list(primary)
    for s in extra:
        key = (s["action_type"], s.get("object_id"))
        if key not in seen and len(merged) < max_steps:
            seen.add(key)
            merged.append(s)
    return merged


# --------------------------------------------------------------------------
# Narrative fallback + verification
# --------------------------------------------------------------------------

def deterministic_reasoning(findings: List[Dict[str, Any]]) -> str:
    """Offline narrative built only from perceived facts (used when the LLM is unavailable)."""
    docs = [f for f in findings if f.get("kind", "doctor") == "doctor"][:3]
    if not docs:
        return "**结论**：当前数据中没有发现明显需要立即处理的风险对象。\n\n**依据**：感知阶段未发现处方、拜访或影响链上的异常信号。"
    lead = docs[0]
    lines = [f"**结论**：最需要优先处理的是 {lead['name']}（{lead['id']}）。"]
    if lead.get("hidden"):
        lines[0] += "他目前在系统里**尚未被标记为风险**，是靠趋势与影响链识别出来的。"
    lines.append("")
    lines.append("**依据**：")
    for f in docs:
        reasons = "；".join((f.get("reasons") or [])[:3]) or "暂无显著异常"
        extra = ""
        if f.get("downstream"):
            extra = f"（影响：{'、'.join(f['downstream'][:3])}）"
        lines.append(f"- {f['name']}（{f['id']}）风险分 {f['score']}：{reasons}{extra}")
    lines.append("")
    lines.append("**建议方向**：先生成拜访简报并提交拜访提案，由经理审批后执行；24 小时后按处方变化复盘。")
    return "\n".join(lines)


_THOUSANDS_RE = re.compile(r"(?<=\d),(?=\d{3})")


def extract_numbers(text: str) -> List[float]:
    nums: List[float] = []
    for raw in _NUM_RE.findall(_THOUSANDS_RE.sub("", text or "")):
        try:
            nums.append(float(raw))
        except ValueError:
            continue
    return nums


def _is_trivial_number(raw: float) -> bool:
    if raw == int(raw) and 0 <= raw <= 9:
        return True
    if raw == int(raw) and 2000 <= raw <= 2035:
        return True
    return False


def ground_numbers(text: str, source_text: str) -> Dict[str, Any]:
    """Check that numbers quoted in ``text`` appear in ``source_text`` (±1%, or ±0.06 for rounding)."""
    source = extract_numbers(source_text)
    ungrounded: List[float] = []
    checked = 0
    for n in extract_numbers(text):
        if _is_trivial_number(n):
            continue
        checked += 1
        ok = any(abs(n - s) <= max(0.06, 0.01 * abs(s)) for s in source)
        if not ok and n not in ungrounded:
            ungrounded.append(n)
    return {"ok": not ungrounded, "checked": checked, "ungrounded": ungrounded[:8]}


def cited_objects(text: str, known: Dict[str, Dict[str, str]]) -> List[Dict[str, str]]:
    """Objects (id/name) mentioned in ``text``. ``known`` maps id -> {name, type}."""
    out: List[Dict[str, str]] = []
    body = text or ""
    for oid, meta in known.items():
        name = meta.get("name") or ""
        id_hit = re.search(rf"(?<![A-Za-z0-9_]){re.escape(oid)}(?![A-Za-z0-9_])", body) is not None
        if id_hit or (name and name in body):
            out.append({"id": oid, "name": name, "type": meta.get("type", "")})
    return out


def sse_line(payload: Dict[str, Any]) -> str:
    return "data: " + json.dumps(payload, ensure_ascii=False, default=str) + "\n\n"


def iter_text_chunks(text: str, size: int = 6) -> Iterable[str]:
    for i in range(0, len(text), size):
        yield text[i:i + size]

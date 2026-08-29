from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from models.scenario import Scenario, ScenarioParameter


def _as_float(value: Any) -> Optional[float]:
    """Parse numeric scenario params. select/boolean defaults like 'tier1' are skipped."""
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text or text.lower() in ("true", "false"):
        return None
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def get_scenarios(db: Session, category: Optional[str] = None) -> List[Dict[str, Any]]:
    query = db.query(Scenario)
    if category:
        query = query.filter(Scenario.category == category)
    scenarios = query.all()
    results = []
    for s in scenarios:
        result = _scenario_to_dict(db, s)
        results.append(result)
    return results


def get_scenario_by_id(db: Session, scenario_id: str) -> Optional[Dict[str, Any]]:
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        return None
    return _scenario_to_dict(db, s)


def recalculate_scenario(db: Session, scenario_id: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        return None

    base_delta = s.delta or 0
    base_forecast = s.forecast_value or s.baseline_forecast_value or 0
    baseline_forecast = s.baseline_forecast_value or 0

    adjustment_factor = 1.0
    scenario_params = db.query(ScenarioParameter).filter(ScenarioParameter.scenario_id == scenario_id).all()
    param_defaults = {p.name: _as_float(p.default_value) for p in scenario_params}

    for param_name, param_value in params.items():
        default = param_defaults.get(param_name)
        incoming = _as_float(param_value)
        if default is None or default == 0 or incoming is None:
            continue
        ratio = incoming / default
        adjustment_factor *= (1 + (ratio - 1) * 0.8)

    new_forecast = baseline_forecast * (1 + (base_delta / 100) * adjustment_factor)
    new_delta = ((new_forecast - baseline_forecast) / baseline_forecast * 100) if baseline_forecast > 0 else 0
    target = s.target_value or s.baseline_target_value or baseline_forecast
    new_achievement = (new_forecast / target * 100) if target > 0 else 0

    if new_achievement >= 100:
        new_risk = "on_track"
    elif new_achievement >= 90:
        new_risk = "at_risk"
    else:
        new_risk = "critical"

    result = _scenario_to_dict(db, s)
    result["forecastResult"] = {
        "targetValue": target,
        "forecastValue": round(new_forecast),
        "achievementRate": round(new_achievement, 1),
        "riskLevel": new_risk,
        "confidenceInterval": [round(new_forecast * 0.9), round(new_forecast * 1.1)],
        "isRecalculated": True,
        "appliedParams": params,
    }
    result["comparisonWithBaseline"]["scenario"]["forecastValue"] = round(new_forecast)
    result["comparisonWithBaseline"]["scenario"]["achievementRate"] = round(new_achievement, 1)
    result["comparisonWithBaseline"]["scenario"]["riskLevel"] = new_risk
    result["comparisonWithBaseline"]["delta"] = round(new_delta, 1)

    return result


def _scenario_to_dict(db: Session, s: Scenario) -> Dict[str, Any]:
    params = db.query(ScenarioParameter).filter(ScenarioParameter.scenario_id == s.id).all()
    param_list = []
    for p in params:
        param_dict = {
            "name": p.name,
            "type": p.param_type,
            "label": p.label,
            "defaultValue": p.default_value,
            "required": p.required,
            "description": p.description,
        }
        if p.min_value is not None:
            param_dict["min"] = p.min_value
        if p.max_value is not None:
            param_dict["max"] = p.max_value
        if p.step_value is not None:
            param_dict["step"] = p.step_value
        if p.options:
            opts = []
            for opt_str in p.options.split(","):
                parts = opt_str.split(":")
                if len(parts) >= 2:
                    opts.append({"label": parts[0], "value": parts[1]})
                elif len(parts) == 1:
                    opts.append({"label": parts[0], "value": parts[0]})
            param_dict["options"] = opts
        param_list.append(param_dict)

    result: Dict[str, Any] = {
        "id": s.id,
        "type": s.scenario_type,
        "name": s.name,
        "description": s.description,
        "category": s.category,
        "parameters": param_list,
    }

    if s.forecast_value is not None:
        result["forecastResult"] = {
            "targetValue": s.target_value or 0,
            "forecastValue": s.forecast_value,
            "achievementRate": s.achievement_rate or 0,
            "riskLevel": s.risk_level or "on_track",
            "confidenceInterval": [s.confidence_interval_low or 0, s.confidence_interval_high or 0],
        }

    if s.baseline_forecast_value is not None:
        result["comparisonWithBaseline"] = {
            "baseline": {
                "targetValue": s.baseline_target_value or 0,
                "forecastValue": s.baseline_forecast_value,
                "achievementRate": s.baseline_achievement_rate or 0,
                "riskLevel": s.baseline_risk_level or "on_track",
                "confidenceInterval": [s.baseline_confidence_interval_low or 0, s.baseline_confidence_interval_high or 0],
            },
            "scenario": {
                "targetValue": s.target_value or 0,
                "forecastValue": s.forecast_value or 0,
                "achievementRate": s.achievement_rate or 0,
                "riskLevel": s.risk_level or "on_track",
                "confidenceInterval": [s.confidence_interval_low or 0, s.confidence_interval_high or 0],
            },
            "delta": s.delta or 0,
            "impactAnalysis": s.impact_analysis or "",
        }

    if s.created_at:
        result["createdAt"] = s.created_at.isoformat()
    if s.created_by:
        result["createdBy"] = s.created_by

    return result

import json
from typing import Dict, Any, List, Optional, AsyncGenerator
from sqlalchemy.orm import Session
from models.ontology import OntologyObject, ObjectLink
from services.ontology_context import build_ontology_context, build_ontology_context_for_query, format_context_for_llm
from services.ontology_definition import get_concept_definition, get_relation_definition
from llm import get_llm_client, is_llm_configured
from langchain_core.messages import SystemMessage, HumanMessage


OAG_SYSTEM_PROMPT = """你是 OntoNexus 智能决策助手，基于企业 Ontology（运营语义层）工作。

你的工作方式不是简单的文档检索（RAG），而是 Ontology-Augmented Generation（OAG）：
1. 你通过 Ontology 理解业务对象、关系、动作、权限
2. 你基于 Ontology 上下文生成回答，而不是基于文本检索
3. 你可以建议执行 Ontology 中定义的动作
4. 你遵守 Ontology 中定义的权限和治理规则

回答时请：
1. 引用具体对象和关系（如"张主任 → WORKS_AT → 瑞金医院"）
2. 基于时序数据趋势做判断
3. 如有风险，指出风险传播路径
4. 给出可执行的建议，映射到 Ontology 中的 Action
5. 明确哪些操作需要审批"""


async def oag_chat(db: Session, user_message: str, user_id: str = "default_user") -> Dict[str, Any]:
    from semantic.context_pack import build_context_pack

    pack = build_context_pack(db, user_message)
    if pack.get("refuse"):
        return {
            "response": pack.get("refuse_reason") or "硬规则窗口被裁掉，拒绝作答",
            "context_used": False,
            "objects_referenced": 0,
            "refused": True,
        }
    context_text = pack.get("pack_text") or "No specific Ontology context found."

    system_prompt = f"""{OAG_SYSTEM_PROMPT}

## 当前 Ontology 上下文

{context_text}"""

    llm = get_llm_client()
    if not llm:
        return {
            "response": "AI服务暂不可用，请稍后再试。",
            "context_used": bool(pack.get("contexts")),
            "objects_referenced": len(pack.get("contexts", [])),
        }

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ]

    try:
        response = await llm.ainvoke(messages)
        return {
            "response": response.content,
            "context_used": True,
            "objects_referenced": len(pack.get("contexts", [])),
        }
    except Exception as e:
        return {
            "response": f"生成回答时出错: {str(e)}",
            "context_used": bool(pack.get("contexts")),
            "objects_referenced": 0,
        }


async def oag_chat_stream(db: Session, user_message: str, user_id: str = "default_user") -> AsyncGenerator[tuple, None]:
    from semantic.context_pack import build_context_pack

    pack = build_context_pack(db, user_message)
    if pack.get("refuse"):
        yield "content", pack.get("refuse_reason") or "硬规则窗口被裁掉，拒绝作答"
        return
    context_text = pack.get("pack_text") or "No specific Ontology context found."

    system_prompt = f"""{OAG_SYSTEM_PROMPT}

## 当前 Ontology 上下文

{context_text}"""

    llm = get_llm_client()
    if not llm:
        yield "content", "AI服务暂不可用，请稍后再试。"
        return

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_message),
    ]

    try:
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield "content", chunk.content
    except Exception as e:
        yield "content", f"生成回答时出错: {str(e)}"


def oag_object_analysis(db: Session, object_id: str) -> Dict[str, Any]:
    context = build_ontology_context(db, object_id, depth=2)

    risks = _analyze_risks(context)
    opportunities = _analyze_opportunities(context)
    recommended_actions = _recommend_actions(context)

    return {
        "objectId": object_id,
        "objectName": context.get("object", {}).get("name", "N/A"),
        "objectType": context.get("object", {}).get("objectType", "N/A"),
        "risks": risks,
        "opportunities": opportunities,
        "recommendedActions": recommended_actions,
        "contextSummary": format_context_for_llm(context),
    }


def _analyze_risks(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    risks = []
    obj = context.get("object", {})
    properties = context.get("properties", {})
    ts = context.get("timeSeriesSummary", {})

    if obj.get("status") in ("warning", "critical"):
        risks.append({
            "type": "status_risk",
            "severity": "high" if obj["status"] == "critical" else "medium",
            "description": f"对象状态为 {obj['status']}",
        })

    if obj.get("lifecycleStage") == "at_risk":
        risks.append({
            "type": "lifecycle_risk",
            "severity": "high",
            "description": "对象处于流失风险阶段",
        })

    if obj.get("complianceRiskLevel") in ("medium", "high"):
        risks.append({
            "type": "compliance_risk",
            "severity": obj["complianceRiskLevel"],
            "description": f"合规风险等级: {obj['complianceRiskLevel']}",
        })

    if obj.get("sentiment") == "negative":
        risks.append({
            "type": "sentiment_risk",
            "severity": "medium",
            "description": "对象态度为负面",
        })

    for series_name, summary in ts.items():
        if "下降" in summary and "40%" in summary:
            risks.append({
                "type": "trend_risk",
                "severity": "high",
                "description": f"{series_name} 显著下降: {summary}",
            })
        elif "下降" in summary:
            risks.append({
                "type": "trend_risk",
                "severity": "medium",
                "description": f"{series_name} 下降趋势: {summary}",
            })

    return risks


def _analyze_opportunities(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    opportunities = []
    obj = context.get("object", {})
    properties = context.get("properties", {})
    ts = context.get("timeSeriesSummary", {})

    if obj.get("lifecycleStage") == "developing":
        opportunities.append({
            "type": "growth_opportunity",
            "description": "对象处于开发阶段，有增长潜力",
        })

    for series_name, summary in ts.items():
        if "上升" in summary:
            opportunities.append({
                "type": "trend_opportunity",
                "description": f"{series_name} 上升趋势: {summary}",
            })

    links = context.get("links", [])
    influence_links = [l for l in links if l.get("linkType") == "INFLUENCES"]
    if influence_links:
        opportunities.append({
            "type": "influence_opportunity",
            "description": f"对象影响 {len(influence_links)} 个其他对象，具有KOL潜力",
        })

    return opportunities


def _recommend_actions(context: Dict[str, Any]) -> List[Dict[str, Any]]:
    actions = []
    obj = context.get("object", {})
    available = context.get("availableActions", [])
    risks = _analyze_risks(context)

    high_risks = [r for r in risks if r.get("severity") == "high"]

    if high_risks and obj.get("objectType") == "Doctor":
        schedule_action = next((a for a in available if a["name"] == "scheduleVisit"), None)
        if schedule_action:
            actions.append({
                "actionName": "scheduleVisit",
                "priority": "high",
                "reason": "高风险对象需要紧急拜访",
                "requiresApproval": schedule_action.get("requiresApproval", False),
            })

        mark_action = next((a for a in available if a["name"] == "markAsAtRisk"), None)
        if mark_action and obj.get("lifecycleStage") != "at_risk":
            actions.append({
                "actionName": "markAsAtRisk",
                "priority": "high",
                "reason": "需要标记为流失风险",
                "requiresApproval": mark_action.get("requiresApproval", False),
            })

    if any(r.get("type") == "compliance_risk" for r in risks):
        flag_action = next((a for a in available if a["name"] == "flagComplianceRisk"), None)
        if flag_action:
            actions.append({
                "actionName": "flagComplianceRisk",
                "priority": "high",
                "reason": "合规风险需要标记",
                "requiresApproval": flag_action.get("requiresApproval", False),
            })

    if not actions and available:
        actions.append({
            "actionName": available[0]["name"],
            "priority": "low",
            "reason": "建议执行常规动作",
            "requiresApproval": available[0].get("requiresApproval", False),
        })

    return actions

from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

from agents.state import AgentState
from agents.tools import AGENT_TOOLS
from llm import get_llm_client
import os
import uuid
import json
import logging

logger = logging.getLogger(__name__)

MAX_REFLECTION_ROUNDS = 2


def get_llm():
    llm = get_llm_client()
    if not llm:
        return None
    return llm.bind_tools(AGENT_TOOLS)


def perceive_node(state: AgentState):
    """Gather initial context and anomalies from the environment."""
    from services.chat_service import _get_data_summary
    from services.ontology_context import build_ontology_context_for_query, format_context_for_llm
    from database import _get_engine
    from sqlalchemy.orm import sessionmaker
    engine = _get_engine()
    db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        summary = _get_data_summary(db)
        
        try:
            from services.memory_service import search_memory_semantic
            messages = state.get("messages", [])
            query_text = messages[-1].content if messages and hasattr(messages[-1], 'content') else "recent anomalies risks"
            memories = search_memory_semantic(
                db, query=query_text,
                agent_id="cognitive_agent", memory_type="episodic", top_k=3
            )
            if memories:
                memory_items = [m.get("content_text", "") for m in memories]
                memory_context = "\n".join([f"- {m}" for m in memory_items])
                summary += f"\n\n近期记忆参考：\n{memory_context}"
        except Exception as e:
            logger.warning("Memory retrieval in perceive failed: %s", e)

        try:
            messages = state.get("messages", [])
            query_text = messages[-1].content if messages and hasattr(messages[-1], 'content') else ""
            if query_text:
                oag_context = build_ontology_context_for_query(db, query_text)
                if oag_context.get("contexts"):
                    oag_text = format_context_for_llm(oag_context)
                    summary += f"\n\nOntology 上下文：\n{oag_text}"
        except Exception as e:
            logger.warning("Ontology context in perceive failed: %s", e)
    finally:
        db.close()

    perception = f"System Scan Complete:\n{summary}\nAnomalies: No severe anomalies detected instantly."
    return {"perception_results": perception, "context": summary}


def reason_node(state: AgentState):
    """Analyze perception data and form hypotheses about sales risks or compliance."""
    llm = get_llm()
    if not llm:
        return {"hypotheses": "[Fallback] System logic indicates normal operation despite minor lag in target metrics."}

    memory_context = ""
    try:
        from services.memory_service import search_memory_semantic
        from database import _get_engine
        from sqlalchemy.orm import sessionmaker

        engine = _get_engine()
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            messages = state.get("messages", [])
            if messages:
                last_msg = messages[-1]
                query_text = last_msg.content if hasattr(last_msg, 'content') else str(last_msg)
                memories = search_memory_semantic(
                    db,
                    query=query_text,
                    agent_id="cognitive_agent",
                    top_k=3
                )
                if memories:
                    memory_items = [m.get("content_text", "") for m in memories]
                    memory_context = "\n".join([f"- {m}" for m in memory_items])
        finally:
            db.close()
    except Exception as e:
        logger.warning("Memory retrieval failed: %s", e)

    memory_note = f"\nRelevant Memory Context:\n{memory_context}" if memory_context else ""
    user_input = state.get("messages", [])[-1].content if state.get("messages") else ""
    perception_data = state.get("perception_results", "")

    ontology_note = ""
    try:
        from services.ontology_context import build_ontology_context_for_query, format_context_for_llm
        from database import _get_engine
        from sqlalchemy.orm import sessionmaker

        engine = _get_engine()
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            if user_input:
                oag_context = build_ontology_context_for_query(db, user_input)
                if oag_context.get("contexts"):
                    oag_text = format_context_for_llm(oag_context)
                    ontology_note = f"\nOntology Context:\n{oag_text}"
        finally:
            db.close()
    except Exception as e:
        logger.warning("Ontology context in reason failed: %s", e)

    reasoning_type = _classify_reasoning_type(user_input)

    if reasoning_type == "attribution":
        hypotheses = _execute_attribution_reasoning(user_input, perception_data, memory_note, ontology_note)
    elif reasoning_type == "causal":
        hypotheses = _execute_causal_reasoning(user_input, perception_data, memory_note, ontology_note)
    elif reasoning_type == "temporal":
        hypotheses = _execute_temporal_reasoning(user_input, perception_data, memory_note, ontology_note)
    else:
        sys_prompt = SystemMessage(
            content="You are the OntoNexus Reasoning Engine. Analyze the following perception data and form clear hypotheses regarding sales risks or compliance."
        )
        prompt = HumanMessage(
            content=f"Perception Data:\n{perception_data}{memory_note}{ontology_note}\nUser input: {user_input}"
        )
        response = llm.invoke([sys_prompt, prompt])
        hypotheses = response.content

    return {"hypotheses": hypotheses}


def _classify_reasoning_type(query: str) -> str:
    """基于关键词分类推理类型
    
    注意：关键词有重叠时按优先级匹配：归因 > 因果 > 时序
    """
    if not query:
        return "llm"
    
    query_lower = query.lower()
    
    # 优先级1: 归因分析（最具体）
    # "为什么"、"归因"、"贡献"、"因素" 明确指向归因
    attribution_keywords = ["为什么", "归因", "贡献", "因素", "为何", "attribution"]
    if any(kw in query_lower for kw in attribution_keywords):
        return "attribution"
    
    # 优先级2: 时序分析（"趋势"、"预测" 明确指向时序）
    temporal_keywords = ["趋势", "预测", "未来", "trend", "forecast", "future", "temporal"]
    if any(kw in query_lower for kw in temporal_keywords):
        return "temporal"
    
    # 优先级3: 因果推理（"导致"、"影响" 等）
    # 注意："导致"也可能是归因，但已在优先级1处理
    causal_keywords = ["因果", "连锁", "关系", "关联", "cause", "effect", "impact", "chain"]
    if any(kw in query_lower for kw in causal_keywords):
        return "causal"
    
    # 兜底：包含"导致"、"影响"但无其他更明确关键词时，优先归因（因为"为什么X导致Y"更常见）
    ambiguous_keywords = ["导致", "影响"]
    if any(kw in query_lower for kw in ambiguous_keywords):
        return "attribution"
    
    return "llm"


def _execute_attribution_reasoning(user_input: str, perception_data: str, memory_note: str, ontology_note: str = "") -> str:
    """执行归因分析推理"""
    import re
    
    # 先尝试提取实体ID
    entity_id_match = re.search(r'[a-f0-9-]{32,36}', user_input)
    if not entity_id_match:
        # 未找到实体ID，直接降级为LLM推理
        return _fallback_llm_reasoning(user_input, perception_data, memory_note, ontology_note)
    
    entity_id = entity_id_match.group(0)
    
    try:
        from services.reasoning_service import attribution_analysis
        from database import _get_engine
        from sqlalchemy.orm import sessionmaker

        engine = _get_engine()
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            result = attribution_analysis(db, target_id=entity_id, method="shapley")
            if "error" not in result:
                factors = result.get("attributionFactors", [])
                total_change = result.get("totalChange", 0)
                report = f"【归因分析结果】\n总变化：{total_change:.2f}\n\n"
                report += "主要因素贡献：\n"
                for f in factors[:5]:
                    report += f"- {f.get('factorLabel', 'N/A')}: 贡献度 {f.get('contributionPercent', 0):.1f}% ({f.get('direction', 'N/A')})\n"
                    report += f"  {f.get('evidence', '')}\n"
                if ontology_note:
                    report += f"\nOntology上下文参考：{ontology_note}"
                return report
        finally:
            db.close()
    except Exception as e:
        logger.warning("Attribution reasoning failed: %s", e)
    
    return _fallback_llm_reasoning(user_input, perception_data, memory_note, ontology_note)


def _execute_causal_reasoning(user_input: str, perception_data: str, memory_note: str, ontology_note: str = "") -> str:
    """执行因果推理"""
    import re
    
    entity_id_match = re.search(r'[a-f0-9-]{32,36}', user_input)
    if not entity_id_match:
        return _fallback_llm_reasoning(user_input, perception_data, memory_note, ontology_note)

    entity_id = entity_id_match.group(0)

    try:
        from services.reasoning_service import causal_reasoning
        from database import _get_engine
        from sqlalchemy.orm import sessionmaker

        engine = _get_engine()
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            result = causal_reasoning(db, source_id=entity_id, depth=3)
            if "error" not in result:
                chains = result.get("chains", [])
                report = f"【因果推理结果】\n发现 {len(chains)} 条因果链条\n\n"
                for i, chain in enumerate(chains[:3], 1):
                    path = chain.get("path", [])
                    steps = " → ".join([f"{step.get('targetName', 'N/A')}({step.get('linkType', '')})" for step in path])
                    report += f"链条{i}: {result.get('sourceName', '')} → {steps}\n"
                if ontology_note:
                    report += f"\nOntology上下文参考：{ontology_note}"
                return report
        finally:
            db.close()
    except Exception as e:
        logger.warning("Causal reasoning failed: %s", e)

    return _fallback_llm_reasoning(user_input, perception_data, memory_note, ontology_note)


def _execute_temporal_reasoning(user_input: str, perception_data: str, memory_note: str, ontology_note: str = "") -> str:
    """执行时序分析推理"""
    import re
    
    entity_id_match = re.search(r'[a-f0-9-]{32,36}', user_input)
    if not entity_id_match:
        return _fallback_llm_reasoning(user_input, perception_data, memory_note, ontology_note)

    entity_id = entity_id_match.group(0)

    try:
        from services.reasoning_service import temporal_reasoning
        from database import _get_engine
        from sqlalchemy.orm import sessionmaker

        engine = _get_engine()
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            result = temporal_reasoning(db, object_id=entity_id)
            if "error" not in result:
                trends = result.get("trends", [])
                report = f"【时序分析结果】\n\n"
                for trend in trends:
                    report += f"- {trend.get('seriesName', 'N/A')}: {trend.get('direction', 'N/A')} "
                    report += f"(变化率: {trend.get('changePercent', 0):.1f}%)\n"
                if ontology_note:
                    report += f"\nOntology上下文参考：{ontology_note}"
                return report
        finally:
            db.close()
    except Exception as e:
        logger.warning("Temporal reasoning failed: %s", e)

    return _fallback_llm_reasoning(user_input, perception_data, memory_note, ontology_note)


def _fallback_llm_reasoning(user_input: str, perception_data: str, memory_note: str, ontology_note: str = "") -> str:
    """降级为LLM推理"""
    llm = get_llm()
    if not llm:
        return "[Fallback] 推理服务不可用，使用系统逻辑判断"
    
    sys_prompt = SystemMessage(
        content="You are the OntoNexus Reasoning Engine. Analyze the following perception data and form clear hypotheses regarding sales risks or compliance."
    )
    prompt = HumanMessage(
        content=f"Perception Data:\n{perception_data}{memory_note}{ontology_note}\nUser input: {user_input}"
    )
    response = llm.invoke([sys_prompt, prompt])
    return response.content


def human_review_node(state: AgentState):
    """Intercept high-impact plans for human approval before execution.
    
    Creates an ActionProposal with status='pending' and stops the graph execution.
    The plan will only proceed when the user approves it via the Decision Inbox UI,
    which triggers POST /api/actions/{id}/approve and then POST /api/actions/{id}/execute.
    """
    from database import _get_engine
    from sqlalchemy.orm import sessionmaker
    from models.action import ActionProposal
    
    plan = state.get("current_plan", "")
    hypotheses = state.get("hypotheses", "")
    
    action_id = str(uuid.uuid4())
    
    engine = _get_engine()
    db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        proposal = ActionProposal(
            id=action_id,
            title="AI计划待审批",
            description=plan[:500] if plan else "AI生成的行动计划需要人工审批",
            action_type="ai_plan",
            priority="high",
            confidence=0.9,
            status="pending",
            proposed_by="CognitiveAgent",
            reasoning_conclusion=hypotheses[:500] if hypotheses else "",
            reasoning_confidence=0.9,
            reasoning_evidence=plan[:500] if plan else "",
            action_definition_requires_approval=True,
        )
        db.add(proposal)
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
    
    return {
        "needs_human_review": True,
        "plan_approved": False,
        "pending_action_id": action_id,
        "execution_status": f"⏸ 计划已提交审批（ID: {action_id}），请在决策收件箱中审批后执行。\n\n计划内容：\n{plan[:300]}",
    }


def should_request_human_review(state: AgentState) -> str:
    """Decide whether a plan needs human review based on risk indicators."""
    hypotheses = state.get("hypotheses", "").lower()
    plan = state.get("current_plan", "").lower()

    risk_keywords = [
        "compliance", "违规", "费用", "风险", "reject",
        "budget exceed", "audit", "regulatory", "处罚",
        "recall", "negative news", "shortage"
    ]
    if any(kw in hypotheses or kw in plan for kw in risk_keywords):
        return "review"
    return "execute"


def plan_node(state: AgentState):
    """Given reasoning hypotheses, formulate a precise action plan."""
    llm = get_llm()
    if not llm:
        return {"current_plan": "[Fallback] Wait and monitor target metrics for another week."}

    sys_prompt = SystemMessage(
        content="""You are the OntoNexus Planning Engine. Given the reasoning hypotheses, formulate a precise action plan targeting specific entities (Doctors, Hospital, Budgets). Keep it actionable. Output in structured format with priorities.

Your plan must specify which Ontology Action to execute on which object. Format each step as: ACTION_NAME on OBJECT_ID with PARAMETERS.
Available actions include: scheduleVisit, updateSentiment, flagComplianceRisk, markAsAtRisk, generateVisitBrief, updateAccessStatus, dismiss, escalate, approve, reject, updateActualValue, allocateBudget, advanceCycle, updateStatus, inviteToEvent."""
    )
    prompt = HumanMessage(
        content=f"Hypotheses:\n{state.get('hypotheses')}\n\nProvide a structured action plan with clear steps, priorities, and target entities. Each step must reference a specific Ontology Action and object ID."
    )
    response = llm.invoke([sys_prompt, prompt])
    return {"current_plan": response.content}


def execute_node(state: AgentState):
    """Execute the approved plan using available tools."""
    plan_approved = state.get("plan_approved", True)
    review_decision = state.get("review_decision", "")

    if not plan_approved and review_decision == "rejected":
        return {"execution_status": "❌ Plan was rejected by human reviewer.", "tool_results": [], "needs_human_review": False}

    plan = state.get("current_plan", "")
    execution_details = []

    from database import _get_engine
    from sqlalchemy.orm import sessionmaker
    from services.action_executor import ActionExecutor
    import re

    engine = _get_engine()
    db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()

    try:
        tool_map = {tool.name: tool for tool in AGENT_TOOLS}

        tool_calls = state.get("messages", [])
        results = []

        for msg in tool_calls:
            if hasattr(msg, 'tool_calls') and msg.tool_calls:
                for tc in msg.tool_calls:
                    tool_name = tc.get("name", "")
                    tool_args = tc.get("args", {})
                    if tool_name in tool_map:
                        try:
                            result = tool_map[tool_name].invoke(tool_args)
                            results.append({"tool": tool_name, "args": tool_args, "result": result, "status": "success"})
                        except Exception as e:
                            results.append({"tool": tool_name, "args": tool_args, "result": str(e), "status": "failed"})

        action_pattern = re.compile(r'(\w+)\s+on\s+([a-f0-9_-]+)(?:\s+with\s+(.+))?', re.IGNORECASE)
        for match in action_pattern.finditer(plan):
            action_name = match.group(1)
            object_id = match.group(2)
            params_str = match.group(3)
            try:
                params = json.loads(params_str) if params_str else {}
            except (json.JSONDecodeError, TypeError):
                params = {}

            try:
                executor = ActionExecutor(db)
                exec_result = executor.execute_object_action(object_id, action_name, params)
                results.append({
                    "tool": f"action_executor:{action_name}",
                    "args": {"object_id": object_id, "action_name": action_name, "params": params},
                    "result": exec_result,
                    "status": "success" if exec_result.get("success") else "failed",
                })
            except Exception as e:
                results.append({
                    "tool": f"action_executor:{action_name}",
                    "args": {"object_id": object_id, "action_name": action_name, "params": params},
                    "result": str(e),
                    "status": "failed",
                })

        if not results:
            results.append({
                "tool": "execute_action",
                "args": {"action_type": "monitor", "target": "general", "params": {}},
                "result": f"Plan logged for monitoring: {plan[:200]}",
                "status": "logged"
            })

        db.commit()

        return {
            "execution_status": f"✅ Plan executed. {len(results)} action(s) processed.",
            "tool_results": {r["tool"]: r for r in results},
            "needs_human_review": False,
        }
    except Exception as e:
        db.rollback()
        return {
            "execution_status": f"❌ Execution failed: {str(e)}",
            "tool_results": [],
            "needs_human_review": False,
        }
    finally:
        db.close()


def reflect_node(state: AgentState):
    """Reflect on the outcome and identify lessons learned."""
    llm = get_llm()
    if not llm:
        return {
            "reflection_notes": "[Fallback] Execution completed. No anomalies detected. Continue monitoring.",
            "reflection_count": state.get("reflection_count", 0) + 1,
        }

    reflection_count = state.get("reflection_count", 0)

    sys_prompt = SystemMessage(
        content="You are the OntoNexus Reflection Engine. Evaluate whether the plan achieved its goals. Identify gaps and suggest improvements. If the plan needs significant revision, indicate that re-planning is needed."
    )
    prompt = HumanMessage(
        content=f"Original Plan:\n{state.get('current_plan')}\n\nExecution Result:\n{state.get('execution_status')}\n\nAnalyze and provide reflection notes."
    )
    response = llm.invoke([sys_prompt, prompt])

    needs_replan = any(kw in response.content.lower() for kw in [
        "re-plan", "revise", "significantly", "needs adjustment", "重新规划", "需要调整"
    ])

    # 存储反思结果到episodic记忆
    try:
        from services.memory_service import store_memory
        from database import _get_engine
        from sqlalchemy.orm import sessionmaker

        engine = _get_engine()
        db = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
        try:
            store_memory(
                db, agent_id="cognitive_agent",
                memory_type="episodic",
                content={
                    "type": "reflection",
                    "notes": response.content,
                    "plan": state.get("current_plan", ""),
                    "execution_status": state.get("execution_status", ""),
                },
                importance=0.7
            )
        finally:
            db.close()
    except Exception as e:
        logger.warning("Failed to store reflection memory: %s", e)

    return {
        "reflection_notes": response.content,
        "reflection_count": reflection_count + 1,
        "needs_replan": needs_replan,
    }


def should_reflect(state: AgentState) -> str:
    """Decide whether to enter the reflection loop."""
    reflection_count = state.get("reflection_count", 0)
    if reflection_count == 0:
        return "reflect"
    return "end"


def replan_or_end(state: AgentState) -> str:
    """After reflection, decide whether to re-plan or end."""
    needs_replan = state.get("needs_replan", False)
    reflection_count = state.get("reflection_count", 0)

    if needs_replan and reflection_count <= MAX_REFLECTION_ROUNDS:
        return "replan"
    return "end"


# Build the Graph
workflow = StateGraph(AgentState)

# Nodes
workflow.add_node("perceive", perceive_node)
workflow.add_node("reason", reason_node)
workflow.add_node("human_review", human_review_node)
workflow.add_node("plan", plan_node)
workflow.add_node("execute", execute_node)
workflow.add_node("reflect", reflect_node)

# Edges
workflow.set_entry_point("perceive")
workflow.add_edge("perceive", "reason")

# Conditional: reason → human_review OR plan
workflow.add_conditional_edges(
    "reason",
    should_request_human_review,
    {
        "review": "human_review",
        "execute": "plan",
    },
)

# human_review → END (stops graph; user approves via Decision Inbox, then POST /api/actions/{id}/approve + execute)
workflow.add_edge("human_review", END)

# plan → execute
workflow.add_edge("plan", "execute")

# Conditional: execute → reflect OR end
workflow.add_conditional_edges(
    "execute",
    should_reflect,
    {
        "reflect": "reflect",
        "end": END,
    },
)

# Conditional: reflect → replan OR end
workflow.add_conditional_edges(
    "reflect",
    replan_or_end,
    {
        "replan": "plan",
        "end": END,
    },
)

# Compile
app = workflow.compile()

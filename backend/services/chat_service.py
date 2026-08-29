import uuid
import re
import asyncio
import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import desc
from models.chat import ChatThread, ChatMessage
from models.ontology import OntologyObject, TimeSeriesData, ObjectEvent, ObjectLink
from models.domain import Doctor, Hospital, Product, SalesTarget, ComplianceAlert, BudgetCategory, ExpenseROI
from models.action import ActionProposal
from llm import is_llm_configured, chat_with_llm, build_system_prompt, estimate_tokens
from services.ontology_context import build_ontology_context_for_query, format_context_for_llm

logger = logging.getLogger(__name__)


def _get_recent_time_series(db: Session, object_id: str, series_name: str, limit: int = 3) -> List:
    return db.query(TimeSeriesData).filter(
        TimeSeriesData.object_id == object_id,
        TimeSeriesData.series_name == series_name
    ).order_by(TimeSeriesData.timestamp.desc()).limit(limit).all()


def _get_recent_events(db: Session, object_id: str, limit: int = 2) -> List:
    return db.query(ObjectEvent).filter(
        ObjectEvent.object_id == object_id
    ).order_by(desc(ObjectEvent.timestamp)).limit(limit).all()


def _get_pending_actions_for_entity(db: Session, entity_id: str) -> List:
    return db.query(ActionProposal).filter(
        ActionProposal.entity_id == entity_id,
        ActionProposal.status == "pending"
    ).all()


def create_or_get_thread(db: Session, user_id: str, thread_id: Optional[str] = None) -> ChatThread:
    if thread_id:
        thread = db.query(ChatThread).filter(ChatThread.id == thread_id).first()
        if thread:
            return thread
    new_id = thread_id or str(uuid.uuid4())
    thread = ChatThread(id=new_id, user_id=user_id)
    db.add(thread)
    db.commit()
    db.refresh(thread)
    return thread


def save_message(db: Session, thread_id: str, role: str, content: str) -> ChatMessage:
    msg_id = str(uuid.uuid4())
    msg = ChatMessage(id=msg_id, thread_id=thread_id, role=role, content=content)
    db.add(msg)
    db.commit()
    return msg


def _get_thread_messages(db: Session, thread_id: str, limit: int = 20, max_tokens: int = 6000) -> List[dict]:
    messages = db.query(ChatMessage).filter(
        ChatMessage.thread_id == thread_id,
    ).order_by(ChatMessage.timestamp.desc()).limit(limit).all()
    result = [{"role": m.role, "content": m.content} for m in reversed(messages)]

    total_tokens = sum(estimate_tokens(m["content"]) for m in result)
    while total_tokens > max_tokens and len(result) > 1:
        removed = result.pop(0)
        total_tokens -= estimate_tokens(removed["content"])

    return result


def _get_data_summary(db: Session) -> str:
    parts = []
    try:
        doctor_count = db.query(Doctor).count()
        hospital_count = db.query(Hospital).count()
        product_count = db.query(Product).count()
        target_count = db.query(SalesTarget).count()
        alert_count = db.query(ComplianceAlert).count()
        budget_count = db.query(BudgetCategory).count()

        parts.append(f"医生: {doctor_count} 位")
        parts.append(f"医院: {hospital_count} 家")
        parts.append(f"产品: {product_count} 个")
        parts.append(f"销售目标: {target_count} 个")
        parts.append(f"合规告警: {alert_count} 条")
        parts.append(f"预算分类: {budget_count} 个")

        targets = db.query(SalesTarget).all()
        if targets:
            avg_rate = sum(t.achievement_rate or 0 for t in targets) / len(targets)
            parts.append(f"平均销售达成率: {avg_rate:.1f}%")
    except Exception as e:
        logger.warning(f"Data summary generation failed: {e}")
    return "\n".join(parts)


async def generate_response_with_llm(db: Session, message: str, thread_id: Optional[str] = None) -> Optional[str]:
    if not is_llm_configured():
        return None

    data_summary = _get_data_summary(db)
    system_prompt = build_system_prompt(data_summary)

    try:
        oag_context = build_ontology_context_for_query(db, message)
        if oag_context.get("contexts"):
            oag_text = format_context_for_llm(oag_context)
            system_prompt += f"\n\n## Ontology 上下文\n{oag_text}"
    except Exception as e:
        logger.warning(f"OAG context build failed: {e}")

    messages = []
    if thread_id:
        messages = _get_thread_messages(db, thread_id)
    messages.append({"role": "user", "content": message})

    return await chat_with_llm(messages, system_prompt)


ENTITY_KEYWORDS = {
    "主任": "Doctor",
    "医生": "Doctor",
    "代表": "SalesRep",
    "医院": "Hospital",
    "产品": "Product",
}

TOPIC_KEYWORDS = {
    "处方量": "prescription",
    "合规": "compliance",
    "销售": "sales",
    "客户": "customer",
    "竞品": "competitor",
    "预算": "budget",
    "拜访": "visit",
    "目标": "target",
}


def _get_entity_by_name(db: Session, message: str) -> Optional[str]:
    entity_patterns = [
        (r'(.+主任)', 'Doctor'),
        (r'(.+医生)', 'Doctor'),
        (r'(.+代表)', 'SalesRep'),
        (r'(.+医院)', 'Hospital'),
        (r'(.+产品)', 'Product'),
    ]
    for pattern, obj_type in entity_patterns:
        match = re.search(pattern, message)
        if match:
            entity_name = match.group(1)
            objects = db.query(OntologyObject).filter(
                OntologyObject.object_type == obj_type,
                OntologyObject.name.ilike(f"%{entity_name}%")
            ).all()
            if objects:
                obj = objects[0]
                if obj_type == 'Doctor':
                    doctor = db.query(Doctor).filter(Doctor.id == obj.id).first()
                    if doctor:
                        return _build_doctor_narrative(db, doctor, obj)
                elif obj_type == 'Hospital':
                    hospital = db.query(Hospital).filter(Hospital.id == obj.id).first()
                    if hospital:
                        return _build_hospital_narrative(db, hospital, obj)
                elif obj_type == 'Product':
                    product = db.query(Product).filter(Product.id == obj.id).first()
                    if product:
                        return _build_product_narrative(db, product, obj)
    return None


def _get_topic_template(topic: str) -> str:
    templates = {
        "prescription": "处方量变化趋势需要关注。建议加强拜访频率，提供更多学术支持，同时关注竞品动态。系统已生成个性化干预方案，可在决策收件箱中查看。",
        "compliance": "合规风险需要重视。建议立即审核相关费用记录，加强合规培训，确保所有活动符合合规要求。AI已识别潜在风险点，请查看详情。",
        "sales": "销售目标达成情况需要关注。建议优化资源分配，加强重点客户维护，同时开发新的增长点。系统已分析各目标缺口，可提供具体建议。",
        "customer": "客户关系管理是关键。建议制定个性化维护策略，增加学术互动，提升客户满意度。AI已识别高价值客户和潜在流失风险。",
        "competitor": "竞品动态需要持续关注。建议准备针对性应对方案，加强产品差异化优势的传播。系统已监控竞品活动和市场份额变化。",
        "budget": "预算执行情况需要监控。建议优化费用结构，提高投入产出比，确保资源有效利用。AI已分析各预算分类的执行效率。",
        "visit": "拜访效果直接影响业务成果。建议优化拜访路线和内容，提升拜访质量。系统已分析拜访频率与处方量的相关性。",
        "target": "目标达成需要策略性规划。建议分解目标到具体行动，定期追踪进度。AI已识别关键影响因素和最优干预路径。",
        "默认": "指挥官，我已经分析了当前数据。系统运行正常，所有模块均在监控中。您可以问我关于医生、医院、产品、销售目标或合规的具体问题，我会提供数据分析和建议。",
    }
    return templates.get(topic, templates["默认"])


def _get_data_context(db: Session, topic: str) -> Optional[str]:
    try:
        if topic == "prescription":
            doctors = db.query(Doctor).join(OntologyObject, OntologyObject.id == Doctor.id).all()
            if doctors:
                lines = []
                for d in doctors[:5]:
                    obj = db.query(OntologyObject).filter(OntologyObject.id == d.id).first()
                    name = obj.name if obj else d.id
                    lines.append(f"- {name}：处方量 {d.prescription_volume or 'N/A'}，影响力 {d.influence_score or 'N/A'}")
                return "当前医生处方量数据：\n" + "\n".join(lines)
        elif topic == "compliance":
            alerts = db.query(ComplianceAlert).all()
            if alerts:
                critical = sum(1 for a in alerts if a.severity == 'high')
                return f"当前合规告警：总数 {len(alerts)} 条，其中严重 {critical} 条"
        elif topic == "sales":
            targets = db.query(SalesTarget).all()
            if targets:
                lines = []
                for t in targets[:3]:
                    obj = db.query(OntologyObject).filter(OntologyObject.id == t.id).first()
                    name = obj.name if obj else t.id
                    rate = t.achievement_rate or 0
                    lines.append(f"- {name}: {rate}%")
                avg_rate = sum(t.achievement_rate or 0 for t in targets) / len(targets)
                return f"销售目标情况：\n" + "\n".join(lines) + f"\n平均达成率: {avg_rate:.1f}%"
        elif topic == "customer":
            doctors = db.query(Doctor).count()
            hospitals = db.query(Hospital).count()
            return f"当前客户数据：医生 {doctors} 位，医院 {hospitals} 家"
        elif topic == "competitor":
            products = db.query(Product).join(OntologyObject, OntologyObject.id == Product.id).all()
            if products:
                lines = []
                for p in products[:5]:
                    obj = db.query(OntologyObject).filter(OntologyObject.id == p.id).first()
                    name = obj.name if obj else p.id
                    lines.append(f"- {name}：市场份额 {p.market_share or 'N/A'}%")
                return "当前产品数据：\n" + "\n".join(lines)
        elif topic == "budget":
            budgets = db.query(BudgetCategory).all()
            if budgets:
                return f"当前预算分类数量：{len(budgets)} 个"
        elif topic == "visit":
            return "拜访数据分析需要更多上下文。可以询问具体医生或医院的拜访情况。"
        elif topic == "target":
            targets = db.query(SalesTarget).all()
            if targets:
                lines = []
                for t in targets:
                    obj = db.query(OntologyObject).filter(OntologyObject.id == t.id).first()
                    name = obj.name if obj else t.id
                    rate = t.achievement_rate or 0
                    status = "✅" if rate >= 90 else "⚠️" if rate >= 70 else "❌"
                    lines.append(f"{status} {name}: {rate}%")
                avg_rate = sum(t.achievement_rate or 0 for t in targets) / len(targets)
                return "销售目标概况：\n" + "\n".join(lines) + f"\n\n平均达成率: {avg_rate:.1f}%"
    except Exception as e:
        logger.warning(f"Data context retrieval failed for topic '{topic}': {e}")
    return None


COMPLEX_QUESTION_KEYWORDS = ["为什么", "分析", "建议", "如何", "怎样", "原因", "趋势", "预测", "风险", "评估"]


def _is_complex_question(message: str) -> bool:
    return any(kw in message for kw in COMPLEX_QUESTION_KEYWORDS)


def _invoke_agent_sync(message: str) -> Optional[dict]:
    try:
        from agents.cognitive_graph import app
        from langchain_core.messages import HumanMessage

        initial_state = {
            "messages": [HumanMessage(content=message)],
            "perception_results": "",
            "hypotheses": "",
            "current_plan": "",
            "execution_status": ""
        }

        final_state = app.invoke(initial_state)

        return {
            "perception": final_state.get("perception_results", ""),
            "reasoning": final_state.get("hypotheses", ""),
            "plan": final_state.get("current_plan", ""),
            "execution": final_state.get("execution_status", ""),
            "needs_review": final_state.get("needs_human_review", False),
            "pending_action_id": final_state.get("pending_action_id"),
        }
    except Exception as e:
        logger.warning(f"Agent invocation failed: {e}")
        return None


def _build_agent_response(agent_result: dict) -> str:
    response_parts = []

    if agent_result.get("reasoning"):
        response_parts.append(f"【AI 推理分析】\n{agent_result['reasoning']}")

    if agent_result.get("plan"):
        response_parts.append(f"\n【行动计划】\n{agent_result['plan']}")

    if agent_result.get("execution"):
        response_parts.append(f"\n【执行状态】\n{agent_result['execution']}")

    if agent_result.get("needs_review"):
        action_id = agent_result.get("pending_action_id", "")
        response_parts.append(f"\n⏸ 该计划已提交审批（ID: {action_id}），请在决策收件箱中审批后执行。")

    if agent_result.get("perception"):
        response_parts.append(f"\n【感知结果】\n{agent_result['perception']}")

    return "\n".join(response_parts) if response_parts else "Agent 分析完成，未发现异常。"


def generate_response_with_agent(db: Session, message: str) -> tuple:
    agent_result = _invoke_agent_sync(message)
    if agent_result:
        return _build_agent_response(agent_result), agent_result
    return None, None


def _build_doctor_narrative(db: Session, doctor: Doctor, obj: OntologyObject) -> str:
    narrative = f"{obj.name}（{doctor.department or ''} {doctor.title or ''}）"

    ts = _get_recent_time_series(db, doctor.id, "prescriptionVolume", 3)
    if len(ts) >= 2:
        change = ts[-1].value - ts[0].value
        pct = (change / ts[0].value * 100) if ts[0].value > 0 else 0
        direction = "上升" if change > 0 else "下降"
        narrative += f"，近{len(ts)}个月处方量{direction}{abs(pct):.0f}%（{ts[0].value}→{ts[-1].value}支）"

    events = _get_recent_events(db, doctor.id, 2)
    if events:
        narrative += f"。最近动态：{events[0].description}"

    pending = _get_pending_actions_for_entity(db, doctor.id)
    if pending:
        narrative += f"。当前有 {len(pending)} 项待决策建议。"

    if doctor.influence_score and doctor.influence_score > 70:
        narrative += f"影响力评分 {doctor.influence_score}，属于高影响力医生。"

    if doctor.last_visit_date:
        narrative += f"上次拜访：{doctor.last_visit_date}。"

    return narrative


def _build_hospital_narrative(db: Session, hospital: Hospital, obj: OntologyObject) -> str:
    narrative = f"{obj.name}（{hospital.level or ''}，{hospital.location or ''}）"

    if hospital.access_status:
        status_map = {"approved": "已准入", "pending": "待审批", "restricted": "受限"}
        narrative += f"，准入状态：{status_map.get(hospital.access_status, hospital.access_status)}"

    if hospital.annual_revenue:
        narrative += f"，年度营收 {hospital.annual_revenue:,.0f} 元"

    doctors_count = db.query(ObjectLink).filter(
        ObjectLink.target_id == hospital.id,
        ObjectLink.link_type == "WORKS_AT"
    ).count()
    if doctors_count:
        narrative += f"，关联 {doctors_count} 位医生"

    activities = db.query(ObjectEvent).filter(
        ObjectEvent.event_type == "CompetitorActivity",
        ObjectEvent.object_id == hospital.id
    ).count()
    if activities:
        narrative += f"。近期发现 {activities} 次竞品活动，需关注。"

    return narrative


def _build_product_narrative(db: Session, product: Product, obj: OntologyObject) -> str:
    narrative = f"{obj.name}（{product.category or ''}）"

    if product.market_share:
        narrative += f"，市场份额 {product.market_share}%"

    if product.sales:
        narrative += f"，销售额 {product.sales:,.0f} 元"

    if product.price:
        narrative += f"，单价 ¥{product.price}"

    prescribers = db.query(ObjectLink).filter(
        ObjectLink.target_id == product.id,
        ObjectLink.link_type == "PRESCRIBES"
    ).count()
    if prescribers:
        narrative += f"，{prescribers} 位医生处方该产品"

    return narrative


def generate_response(db: Session, message: str) -> str:
    entity_info = _get_entity_by_name(db, message)
    if entity_info:
        return entity_info

    for keyword, topic in TOPIC_KEYWORDS.items():
        if keyword in message:
            data_context = _get_data_context(db, topic)
            if data_context:
                return f"【{keyword}分析】\n\n{data_context}"
            return f"关于{keyword}，当前系统运行正常。您可以询问具体医生、医院或产品的详细情况。"

    return "指挥官，我已经分析了当前数据。系统运行正常，所有模块均在监控中。您可以问我关于医生、医院、产品、销售目标或合规的具体问题，我会提供数据分析和建议。"


async def invoke_agent_stream(message: str, user_id: Optional[str] = None):
    """流式执行Agent并发送进度到WebSocket"""
    from agents.cognitive_graph import app
    from langchain_core.messages import HumanMessage
    from services.ws_manager import manager

    initial_state = {
        "messages": [HumanMessage(content=message)],
        "perception_results": "",
        "hypotheses": "",
        "current_plan": "",
        "execution_status": ""
    }

    # 发送开始信号
    if user_id:
        await manager.send_agent_progress(user_id, "starting", "Agent启动，开始认知循环...")

    try:
        # 使用astream获取每个节点的输出
        final_state = None
        async for event in app.astream(initial_state):
            for node_name, node_output in event.items():
                # 发送每个节点的进度
                step_messages = {
                    "perceive": "正在扫描系统数据...",
                    "reason": "正在进行推理分析...",
                    "plan": "正在制定行动计划...",
                    "execute": "正在执行计划...",
                    "reflect": "正在反思总结...",
                    "human_review": "等待人工审批...",
                }
                
                if user_id:
                    detail = step_messages.get(node_name, f"执行节点：{node_name}")
                    await manager.send_agent_progress(user_id, node_name, detail)
                
                final_state = node_output

        # 发送完成信号
        if user_id and final_state:
            await manager.send_agent_progress(user_id, "completed", "Agent执行完成")
        
        return final_state
    except Exception as e:
        if user_id:
            await manager.send_agent_progress(user_id, "error", f"Agent执行失败：{str(e)}")
        raise

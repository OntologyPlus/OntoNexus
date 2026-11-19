from database import get_engine, create_tables, Base
from sqlalchemy.orm import Session
from models.ontology import OntologyObject, ObjectLink, ObjectAction, ActionParameter, ObjectEvent, TimeSeriesData
from models.domain import (
    Doctor, Hospital, Product, SalesRep, VisitRecord, SalesTarget,
    ComplianceAlert, AcademicEvent, Territory, RecoveryPlan,
    SalesFlow, MarketPotential, HospitalDevelopment,
    BudgetCategory, ExpenseClassification, ExpenseROI,
    CustomerCategory, PDCAPlan, HospitalStrategy,
    RWSProject, PatientProgram, ComplianceRule, MeetingCompliance,
)
from models.action import ActionProposal
from models.notification import Notification
from models.user import User
from models.scenario import Scenario, ScenarioParameter
from models.inference import InferenceRule
from models.reminder import Reminder
from models.agent import AgentStatus
from models.source_binding import SourceBinding
from models.learning import SkillOutcome
from models.case import DecisionCase
from models.decision import DecisionRecord
from models.effect import EffectRecord
from auth import get_password_hash
from datetime import datetime, timedelta, timezone

_seeded = False


def seed_database():
    global _seeded
    if _seeded:
        return
    _seeded = True

    create_tables()
    engine = get_engine()
    db = Session(bind=engine)
    try:
        if not db.query(OntologyObject).first():
            _seed_users(db)
            _seed_permissions(db)
            _seed_ontology_objects(db)
            _seed_domain_properties(db)
            _seed_object_links(db)
            _seed_object_actions(db)
            _seed_object_events(db)
            _seed_time_series(db)
            _seed_action_proposals(db)
            _seed_notifications(db)
            _seed_scenarios(db)
            _seed_inference_rules(db)
            _seed_reminders(db)
            _seed_agent_status(db)

        _ensure_demo_loop(db)
        _ensure_demo_story(db)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
        raise
    finally:
        db.close()


def _seed_users(db):
    db.add(User(
        id="default_user",
        username="admin",
        password_hash=get_password_hash("123456"),
        display_name="管理员",
        role="admin",
    ))
    db.add(User(
        id="user_rep",
        username="wang",
        password_hash=get_password_hash("123456"),
        display_name="王代表",
        role="rep",
    ))
    db.add(User(
        id="user_manager",
        username="manager",
        password_hash=get_password_hash("123456"),
        display_name="区域经理",
        role="manager",
    ))


def _seed_permissions(db):
    from models.permission import ObjectPermission

    perms = [
        ObjectPermission(
            id="perm_admin_all",
            user_id="default_user",
            role="admin",
            object_type="*",
            object_id="*",
            can_read=True,
            can_write=True,
            can_execute=True,
            can_admin=True,
        ),
        ObjectPermission(
            id="perm_manager_all",
            user_id="user_manager",
            role="manager",
            object_type="*",
            object_id="*",
            can_read=True,
            can_write=True,
            can_execute=True,
            can_admin=False,
        ),
        ObjectPermission(
            id="perm_rep_read",
            user_id="user_rep",
            role="rep",
            object_type="*",
            object_id="*",
            can_read=True,
            can_write=True,
            can_execute=False,
            can_admin=False,
        ),
    ]
    for perm in perms:
        db.add(perm)


def _seed_ontology_objects(db):
    objects_data = [
        ("d1", "Doctor", "张主任", "warning", "at_risk", "negative", "medium", "r1"),
        ("d2", "Doctor", "李教授", "normal", "loyal", "positive", "low", "r1"),
        ("d3", "Doctor", "王主治", "normal", "active", "neutral", None, "r1"),
        ("d4", "Doctor", "陈副主任", "normal", "active", "positive", None, "r1"),
        ("d5", "Doctor", "刘主任医师", "warning", "active", "neutral", None, "r1"),
        ("h1", "Hospital", "上海瑞金医院", "normal", None, None, None, "r1"),
        ("h2", "Hospital", "上海中山医院", "normal", None, None, None, "r1"),
        ("p1", "Product", "诺欣妥", "normal", None, None, None, "default_user"),
        ("p2", "Product", "可定", "normal", None, None, None, "default_user"),
        ("r1", "SalesRep", "王代表", "normal", None, None, None, "default_user"),
        ("r2", "SalesRep", "赵代表", "normal", None, None, None, "default_user"),
        ("r3", "SalesRep", "孙代表", "warning", None, None, "high", "default_user"),
        ("v1", "VisitRecord", "学术拜访-0318", "normal", None, None, None, "r1"),
        ("roi_d1", "ExpenseROI", "张主任费用ROI", "normal", None, None, None, "r1"),
        ("t1", "SalesTarget", "Q1 销售目标-诺欣妥", "warning", None, None, None, "default_user"),
        ("c1", "ComplianceAlert", "招待费超限预警", "critical", None, None, None, "default_user"),
        ("e1", "AcademicEvent", "心血管学术沙龙", "normal", None, None, None, "default_user"),
        ("ter1", "Territory", "华东区", "normal", None, None, None, "default_user"),
        ("rp1", "RecoveryPlan", "张主任流失挽回计划", "warning", None, None, None, "default_user"),
        ("sf1", "SalesFlow", "Q1 M1流向-诺欣妥", None, None, None, None, "default_user"),
        ("sf2", "SalesFlow", "Q1 M2流向-可定", None, None, None, None, "default_user"),
        ("mp1", "MarketPotential", "华东区市场潜力", None, None, None, None, "default_user"),
        ("hd1", "HospitalDevelopment", "上海第六人民医院开发", None, None, None, None, "default_user"),
        ("bc1", "BudgetCategory", "销售费用预算", None, None, None, None, "default_user"),
        ("bc2", "BudgetCategory", "市场费用预算", None, None, None, None, "default_user"),
        ("ec1", "ExpenseClassification", "C1费用-总部活动", None, None, None, None, "default_user"),
        ("ec2", "ExpenseClassification", "C2A费用-区域活动", None, None, None, None, "default_user"),
        ("cc1", "CustomerCategory", "A类客户", None, None, None, None, "default_user"),
        ("cc2", "CustomerCategory", "B类客户", None, None, None, None, "default_user"),
        ("pdca1", "PDCAPlan", "张主任挽回计划", None, None, None, None, "default_user"),
        ("hs1", "HospitalStrategy", "瑞金医院策略", None, None, None, None, "default_user"),
        ("rws1", "RWSProject", "心衰患者真实世界研究", None, None, None, None, "default_user"),
        ("pp1", "PatientProgram", "诺欣妥患者援助项目", None, None, None, None, "default_user"),
        ("cr1", "ComplianceRule", "会议时长限制", None, None, None, None, "default_user"),
        ("cr2", "ComplianceRule", "单次费用限制", None, None, None, None, "default_user"),
        ("mc1", "MeetingCompliance", "心血管学术沙龙合规检查", None, None, None, None, "default_user"),
    ]
    for obj_data in objects_data:
        obj = OntologyObject(
            id=obj_data[0],
            object_type=obj_data[1],
            name=obj_data[2],
            status=obj_data[3],
            lifecycle_stage=obj_data[4],
            sentiment=obj_data[5],
            compliance_risk_level=obj_data[6],
            owner_id=obj_data[7],
        )
        db.add(obj)


def _seed_domain_properties(db):
    db.add(Doctor(id="d1", title="主任医师", department="心内科", specialty="冠心病,心力衰竭", prescription_power=95, influence_score=88, prescription_volume=120, last_visit_date="2026-02-01", next_recommended_visit_date="2026-03-15"))
    db.add(Doctor(id="d2", title="副主任医师", department="神经内科", specialty="帕金森,阿尔茨海默症", prescription_power=82, influence_score=75, last_visit_date="2026-03-10", next_recommended_visit_date="2026-04-10"))
    db.add(Doctor(id="d3", title="主治医师", department="心内科", specialty="高血压", prescription_power=65, influence_score=45))
    db.add(Doctor(id="d4", title="副主任医师", department="心内科", specialty="冠心病,心律失常", prescription_power=78, influence_score=65, prescription_volume=68, last_visit_date="2026-04-01", next_recommended_visit_date="2026-04-15"))
    db.add(Doctor(id="d5", title="主任医师", department="内分泌科", specialty="糖尿病,代谢综合征", prescription_power=85, influence_score=82, prescription_volume=55, last_visit_date="2026-01-15", next_recommended_visit_date="2026-02-15"))
    db.add(Hospital(id="h1", level="三甲", location="上海", beds=2000, access_status="approved", procurement_mode="集中采购", annual_revenue=50000000))
    db.add(Hospital(id="h2", level="三甲", location="上海", beds=2500, access_status="approved", procurement_mode="招标采购"))
    db.add(Product(id="p1", category="心血管", sales=50000000, market_share=35, price=280))
    db.add(Product(id="p2", category="降脂", sales=30000000, market_share=25, price=180))
    db.add(SalesRep(id="r1", region="华东区", performance=92, quota_achievement=88, ytd_sales=4500000))
    db.add(SalesRep(id="r2", region="华东区", performance=78, quota_achievement=82))
    db.add(SalesRep(id="r3", region="华东区", performance=65, quota_achievement=70, ytd_sales=3200000))
    db.add(VisitRecord(id="v1", visit_type="face_to_face", visit_status="completed", objective="跟进处方量下降原因", actual_content="与张主任深入沟通了近期处方量下降的原因，主要是因为竞品在科室举办了学术活动。他对新临床数据感兴趣。", key_insights="竞品渗透严重,需要提供更多学术支持,医生态度担忧副作用", compliance_score=95, effectiveness_score=88))
    db.add(SalesTarget(id="t1", target_type="quarterly", dimension="product", target_value=15000000, actual_value=10800000, forecast_value=12000000, achievement_rate=72.0, risk_level="at_risk"))
    db.add(ExpenseROI(id="roi_d1", expense_amount=80000, revenue_generated=240000, roi_ratio=3.0, attribution_model="visit", calculation_period="2026-Q1"))
    db.add(ComplianceAlert(id="c1", severity="high", risk_type="expense_exceed_limit", alert_description="王代表本月招待费已达上限的95%，建议审核", alert_status="pending"))
    db.add(AcademicEvent(id="e1", event_type="学术会议", event_date="2026-03-25", participants=50, topic="心衰治疗最新进展"))
    db.add(Territory(id="ter1", region="华东", hospital_count=25, rep_count=8, target_revenue=80000000))
    db.add(RecoveryPlan(id="rp1", doctor_name="张主任", risk_reason="处方量持续下降，竞品渗透", plan_status="pending_approval", validated_by="ComplianceAgent"))
    db.add(SalesFlow(id="sf1", flow_type="M1", target_value=5000000, actual_value=4200000, achievement_rate=84, yoy_growth=15, mom_growth=5, dimension="product", period="2026-Q1"))
    db.add(SalesFlow(id="sf2", flow_type="M2", target_value=3000000, actual_value=2800000, achievement_rate=93.3, yoy_growth=8, mom_growth=3, dimension="product", period="2026-Q1"))
    db.add(MarketPotential(id="mp1", potential_value=150000000, penetration_rate=35, market_share=28, competitor_share=45, growth_opportunity=108000000))
    db.add(HospitalDevelopment(id="hd1", development_stage="negotiation", success_rate=75, resource_allocation=150000, timeline="2026-Q1-Q2"))
    db.add(BudgetCategory(id="bc1", category="sales", budget_amount=2000000, used_amount=1200000, remaining_amount=800000, execution_rate=60, budget_status="approved"))
    db.add(BudgetCategory(id="bc2", category="market", budget_amount=1500000, used_amount=900000, remaining_amount=600000, execution_rate=60, budget_status="approved"))
    db.add(ExpenseClassification(id="ec1", expense_type="C1", amount=300000, cost_center="总部市场部", approval_status="approved"))
    db.add(ExpenseClassification(id="ec2", expense_type="C2A", amount=450000, cost_center="华东区", approval_status="approved"))
    db.add(CustomerCategory(id="cc1", category="A", category_name="核心客户", prescription_potential=95, influence_level=90, cooperation_willingness=85))
    db.add(CustomerCategory(id="cc2", category="B", category_name="重点客户", prescription_potential=75, influence_level=70, cooperation_willingness=80))
    db.add(PDCAPlan(id="pdca1", plan_type="visit", plan_content="通过增加拜访频次和学术支持挽回张主任", cycle_status="doing"))
    db.add(HospitalStrategy(id="hs1", strategy_type="学术引领", sales_ratio=35, vacancy_rate=15, consumption_progress=68, overlapping_hospitals=3, flow_direction="outbound", contract_ratio=85))
    db.add(RWSProject(id="rws1", project_name="心衰患者真实世界研究", project_type="registry", project_status="multicenter", centers=15, enrolled_patients=320, budget=2000000, timeline="2025-Q3至2027-Q2"))
    db.add(PatientProgram(id="pp1", program_type="患者援助", enrolled_patients=580, active_patients=520, drug_switch_count=45, commercial_insurance_count=120, reimbursement_amount=850000))
    db.add(ComplianceRule(id="cr1", rule_name="会议时长限制", rule_type="meeting", threshold=4, severity="high", rule_description="会议时长不能超过4小时"))
    db.add(ComplianceRule(id="cr2", rule_name="单次费用限制", rule_type="expense", threshold=500, severity="high", rule_description="单次费用不能超过500元"))
    db.add(MeetingCompliance(id="mc1", meeting_duration=3.5, topic_alignment=0.85, topic_repetition=0.2, compliance_score=90))


def _seed_object_links(db):
    links_data = [
        ("d1", "WORKS_AT", "h1", "上海瑞金医院", "Hospital"),
        ("d1", "PRESCRIBES", "p1", "诺欣妥", "Product", None, "high", 120),
        ("d1", "PRESCRIBES", "p2", "可定", "Product", None, "medium", 45),
        ("d1", "MANAGED_BY", "r1", "王代表", "SalesRep"),
        ("d1", "INFLUENCES", "d2", "李教授", "Doctor"),
        ("d2", "WORKS_AT", "h1", "上海瑞金医院", "Hospital"),
        ("d2", "PRESCRIBES", "p1", "诺欣妥", "Product"),
        ("d2", "MANAGED_BY", "r1", "王代表", "SalesRep"),
        ("d3", "WORKS_AT", "h2", "上海中山医院", "Hospital"),
        ("d3", "PRESCRIBES", "p2", "可定", "Product"),
        ("d3", "MANAGED_BY", "r2", "赵代表", "SalesRep"),
        ("h1", "BELONGS_TO", "ter1", "华东区", "Territory"),
        ("h2", "BELONGS_TO", "ter1", "华东区", "Territory"),
        ("r1", "BELONGS_TO", "ter1", "华东区", "Territory"),
        ("v1", "VISIT_OF", "d1", "张主任", "Doctor"),
        ("d1", "HAS_VISIT", "v1", "学术拜访-0318", "VisitRecord"),
        ("d1", "HAS_ROI", "roi_d1", "张主任费用ROI", "ExpenseROI"),
        ("v1", "PARTICIPATES_IN", "r1", "王代表", "SalesRep"),
        ("t1", "PARTICIPATES_IN", "p1", "诺欣妥", "Product"),
        ("c1", "HAS_ALERT", "r1", "王代表", "SalesRep"),
        ("e1", "ATTENDED", "d1", "张主任", "Doctor"),
        ("e1", "ATTENDED", "d3", "王主治", "Doctor"),
        ("p1", "FLOWS_TO", "h1", "上海瑞金医院", "Hospital"),
        ("p2", "FLOWS_TO", "h2", "上海中山医院", "Hospital"),
        ("sf1", "ACHIEVES", "t1", "Q1销售目标", "SalesTarget"),
        ("mp1", "POTENTIAL_OF", "ter1", "华东区", "Territory"),
        ("ec1", "CLASSIFIED_AS", "bc2", "市场费用预算", "BudgetCategory"),
        ("ec2", "CLASSIFIED_AS", "bc2", "市场费用预算", "BudgetCategory"),
        ("hs1", "STRATEGY_FOR", "h1", "上海瑞金医院", "Hospital"),
        ("mc1", "COMPLIES_WITH", "cr1", "会议时长限制", "ComplianceRule"),
        ("e_comp1", "AFFECTS", "d1", "张主任", "Doctor"),
        ("e_comp2", "AFFECTS", "d1", "张主任", "Doctor"),
        ("t1", "IMPACTED_BY", "d1", "张主任", "Doctor"),
    ]
    for link_data in links_data:
        kwargs = {
            "source_id": link_data[0],
            "link_type": link_data[1],
            "target_id": link_data[2],
            "target_name": link_data[3],
            "target_type": link_data[4],
        }
        if len(link_data) > 5:
            kwargs["link_strength"] = link_data[5]
        if len(link_data) > 6:
            kwargs["link_frequency"] = link_data[6]
        if len(link_data) > 7:
            kwargs["link_volume"] = link_data[7]
        db.add(ObjectLink(**kwargs))


def _seed_object_actions(db):
    actions_data = [
        ("act_schedule_visit", "d1", "scheduleVisit", "安排一次拜访", False, "doctor.lifecycleStage != 'churned',visitDate > now()", "create VisitRecord,update doctor.nextRecommendedVisitDate", "CRM"),
        ("act_update_sentiment", "d1", "updateSentiment", "更新医生态度", False, "evidence.length > 10", "update doctor.sentiment,trigger InferenceEngine.recompute", "CRM"),
        ("act_flag_compliance", "d1", "flagComplianceRisk", "标记合规风险", True, "caller.role in ['compliance', 'manager', 'agent']", "create ComplianceAlert,notify doctor.managedBy", "CRM,ComplianceSystem"),
        ("act_mark_at_risk", "d1", "markAsAtRisk", "标记为流失风险", False, "", "update lifecycleStage='at_risk',trigger AtRiskAgent.handle", "CRM"),
        ("act_generate_brief", "d1", "generateVisitBrief", "生成拜访简报", False, "", "create VisitBrief", ""),
        ("act_update_access", "h1", "updateAccessStatus", "更新准入状态", True, "caller.role in ['manager', 'director']", "update hospital.accessStatus", "ERP"),
        ("act_dismiss", "c1", "dismiss", "忽略预警", True, "", "update alert.status=dismissed", ""),
        ("act_escalate", "c1", "escalate", "升级处理", False, "", "notify compliance officer,update alert.status=escalated", "ComplianceSystem"),
        ("act_approve_plan", "rp1", "approve", "批准恢复计划", True, "", "update plan.status=approved,create ActionItems", "CRM"),
        ("act_reject_plan", "rp1", "reject", "拒绝恢复计划", False, "", "update plan.status=rejected", ""),
    ]
    for a in actions_data:
        db.add(ObjectAction(
            id=a[0], object_id=a[1], name=a[2], description=a[3],
            requires_approval=a[4], preconditions=a[5], side_effects=a[6], write_back_targets=a[7],
        ))

    params_data = [
        ("act_schedule_visit", "visitDate", "date", True, None, "拜访日期"),
        ("act_schedule_visit", "purpose", "string", True, None, "拜访目的"),
        ("act_update_sentiment", "sentiment", "string", True, None, "态度类型"),
        ("act_update_sentiment", "evidence", "string", True, None, "证据"),
        ("act_flag_compliance", "riskType", "string", True, None, "风险类型"),
        ("act_flag_compliance", "description", "string", True, None, "风险描述"),
        ("act_mark_at_risk", "reason", "string", True, None, "原因"),
        ("act_update_access", "status", "string", True, None, None),
        ("act_escalate", "reason", "string", True, None, None),
        ("act_reject_plan", "reason", "string", True, None, None),
    ]
    for p in params_data:
        db.add(ActionParameter(
            action_id=p[0], name=p[1], param_type=p[2], required=p[3], default_value=p[4], description=p[5],
        ))


def _seed_object_events(db):
    events_data = [
        ("e1", "d1", "Visit", "2026-02-01 14:00", "完成学术拜访", "v1", "学术拜访-0201"),
        ("e2", "d1", "SentimentChange", "2026-02-15 10:00", "态度从中性转为关注", "d1", "张主任"),
        ("e3", "d1", "PrescriptionDrop", "2026-03-01 08:00", "处方量下降25%", "d1", "张主任"),
        ("e4", "d2", "AcademicPublication", "2026-03-08 00:00", "发表关于帕金森治疗的论文", None, None),
        ("e5", "v1", "VisitCompleted", "2026-03-18 15:00", "拜访完成", None, None),
        ("e_comp1", "h1", "CompetitorActivity", "2025-11-15 10:00", "竞品X在瑞金医院心内科举办学术沙龙，参与医生12人", None, None),
        ("e_comp2", "h1", "CompetitorActivity", "2025-12-10 14:00", "竞品X在瑞金医院开展科室会，覆盖心内科3个病区", None, None),
        ("e_visit2", "d1", "Visit", "2026-03-20 10:00", "安排紧急拜访，讨论学术支持方案", "r1", "王代表"),
        ("e_recovery", "d1", "PrescriptionRecovery", "2026-04-15 08:00", "处方量回升至85，干预效果显现", None, None),
    ]
    for e in events_data:
        db.add(ObjectEvent(
            id=e[0], object_id=e[1], event_type=e[2], timestamp=e[3],
            description=e[4], related_object_id=e[5], related_object_name=e[6],
        ))


def _seed_time_series(db):
    ts_data = [
        ("d1", "prescriptionVolume", [("2025-10", 120), ("2025-11", 115), ("2025-12", 108), ("2026-01", 95), ("2026-02", 72), ("2026-03", 78), ("2026-04", 85)]),
        ("d1", "prescription", [("2025-10", 120), ("2025-11", 115), ("2025-12", 108), ("2026-01", 95), ("2026-02", 72), ("2026-03", 78), ("2026-04", 85)]),
        ("d1", "visitFrequency", [("2025-10", 4), ("2025-11", 3), ("2025-12", 3), ("2026-01", 2), ("2026-02", 1), ("2026-03", 3), ("2026-04", 4)]),
        ("d1", "sentimentScore", [("2025-10", 75), ("2025-11", 70), ("2025-12", 65), ("2026-01", 60), ("2026-02", 45), ("2026-03", 55), ("2026-04", 65)]),
        ("d2", "prescriptionVolume", [("2025-10", 80), ("2025-11", 82), ("2025-12", 85), ("2026-01", 84), ("2026-02", 86)]),
        ("d4", "prescriptionVolume", [("2025-10", 50), ("2025-11", 45), ("2025-12", 48), ("2026-01", 55), ("2026-02", 65), ("2026-03", 72)]),
        ("d5", "prescriptionVolume", [("2025-10", 52), ("2025-11", 48), ("2025-12", 55), ("2026-01", 50), ("2026-02", 58), ("2026-03", 55)]),
        ("r1", "performance", [("2025-10", 85), ("2025-11", 88), ("2025-12", 90), ("2026-01", 91), ("2026-02", 92)]),
        ("r3", "performance", [("2025-10", 70), ("2025-11", 65), ("2025-12", 68), ("2026-01", 66), ("2026-02", 65)]),
        ("v1", "complianceScore", [("2026-03-18", 95)]),
        ("t1", "actualValue", [("2026-01", 4000000), ("2026-02", 4200000), ("2026-03", 4300000)]),
        ("t1", "forecastValue", [("2026-01", 4500000), ("2026-02", 4600000), ("2026-03", 4700000)]),
        ("sf1", "actualValue", [("2026-01", 1400000), ("2026-02", 1350000), ("2026-03", 1450000)]),
        ("mp1", "marketShare", [("2025-Q4", 26), ("2026-Q1", 28)]),
        ("bc1", "usedAmount", [("2026-01", 400000), ("2026-02", 800000), ("2026-03", 1200000)]),
        ("rws1", "enrolledPatients", [("2025-Q3", 50), ("2025-Q4", 120), ("2026-Q1", 320)]),
        ("pp1", "activePatients", [("2026-01", 480), ("2026-02", 500), ("2026-03", 520)]),
    ]
    for obj_id, series_name, points in ts_data:
        for ts, val in points:
            db.add(TimeSeriesData(object_id=obj_id, series_name=series_name, timestamp=ts, value=val))


def _seed_action_proposals(db):
    db.add(ActionProposal(
        id="ap1", title="干预处方量下滑", description="张主任近期诺欣妥处方量下降25%，建议立即安排拜访调查原因。",
        action_type="scheduleVisit", entity_id="d1", entity_name="张主任", entity_type="Doctor",
        priority="high", confidence=0.92, status="pending", proposed_by="user_rep",
        reasoning_conclusion="建议将张主任标记为流失风险",
        reasoning_confidence=0.82,
        reasoning_evidence="doctor.timeSeries.prescriptionVolume|近3个月处方量：120→95→72，下降40%|0.4,CompetitorActivity.hospital:renmin|竞品X在人民医院近期举办了2次科室会|0.3,doctor.hasVisits|最近一次拜访距今45天，超出建议频次|0.3",
        reasoning_alternative_hypotheses="可能是季节性波动|0.15,可能是医院采购政策变化|0.03",
        reasoning_suggested_actions="scheduleVisit|high|尽快恢复拜访频次,prepareCompetitorResponse|medium|准备针对竞品X的应对话术",
        action_definition_id="act_schedule_visit", action_definition_name="scheduleVisit",
        action_definition_description="安排一次拜访",
        action_definition_requires_approval=False,
        action_definition_preconditions="doctor.lifecycleStage != 'churned',visitDate > now()",
        action_definition_side_effects="create VisitRecord,update doctor.nextRecommendedVisitDate,notify SalesRep",
        action_definition_write_back_targets="CRM",
    ))
    db.add(ActionProposal(
        id="ap2", title="合规风险预警", description="王代表本月招待费已接近红线，建议审核其最新的报销申请。",
        action_type="flagComplianceRisk", entity_id="r1", entity_name="王代表", entity_type="SalesRep",
        priority="medium", confidence=0.88, status="pending", proposed_by="ComplianceAgent",
        reasoning_conclusion="建议审核王代表的招待费报销",
        reasoning_confidence=0.88,
        reasoning_evidence="rep.expenseRecord|单次餐饮费用超过￥500|0.5,rep.expenseRecord|本月招待频次高于平均水平30%|0.3",
        action_definition_id="act_flag_compliance", action_definition_name="flagComplianceRisk",
        action_definition_description="标记合规风险",
        action_definition_requires_approval=True,
        action_definition_preconditions="caller.role in ['compliance', 'manager', 'agent']",
        action_definition_side_effects="create ComplianceAlert,notify doctor.managedBy",
        action_definition_write_back_targets="CRM,ComplianceSystem",
    ))
    db.add(ActionProposal(
        id="ap3", title="邀请参加学术沙龙", description="李教授最近发表了相关论文，建议邀请其作为讲者参加下周的区域沙龙。",
        action_type="inviteToEvent", entity_id="d2", entity_name="李教授", entity_type="Doctor",
        priority="low", confidence=0.75, status="approved", proposed_by="KnowledgeAgent",
        reasoning_conclusion="建议邀请李教授参加学术沙龙",
        reasoning_confidence=0.75,
        reasoning_evidence="doctor.academicPublication|近期发表了帕金森治疗论文|0.6,product.alignment|与产品适应症高度匹配|0.4",
        action_definition_id="act_invite_event", action_definition_name="inviteToEvent",
        action_definition_description="邀请参加学术活动",
        action_definition_requires_approval=False,
        action_definition_side_effects="create ActionItem,notify doctor",
        action_definition_write_back_targets="CRM",
    ))


def _seed_notifications(db):
    db.add(Notification(id="n1", user_id="default_user", type="risk_alert", title="处方量异常下降", message="张主任处方量连续3个月下降超过40%", priority="high"))
    db.add(Notification(id="n2", user_id="default_user", type="compliance_warning", title="合规风险提示", message="王代表本月招待费已接近上限", priority="medium"))


def _seed_scenarios(db):
    scenarios_data = [
        ("s1", "resource_reallocation", "Q2 资源重新分配 - 方案A", "模拟将20%预算从一级医院转移到二级核心医院的影响", "sales_strategy",
         18000000, 16500000, 91.7, "on_track", 15500000, 17500000,
         18000000, 15000000, 83.3, "at_risk", 14000000, 16000000,
         10, "资源重新分配后，预计业绩提升10%，风险等级从at_risk改善为on_track"),
        ("s2", "product_mix_optimization", "产品组合优化", "调整新产品推广力度与老产品维持投入的平衡", "sales_strategy",
         50000000, 53000000, 106, "on_track", 48000000, 58000000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         6, "优化产品组合后，预计总销售额提升6%，新产品增长贡献显著"),
        ("s3", "price_adjustment", "价格调整模拟", "模拟产品价格调整对销量和收入的影响", "sales_strategy",
         50000000, 57500000, 115, "on_track", 52000000, 63000000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         15, "降价5%后，销量增长15%，收入增长10%，市场份额可能提升"),
        ("s4", "channel_strategy", "渠道策略调整", "调整线上渠道、线下渠道和KOL投入的分配", "sales_strategy",
         50000000, 52000000, 104, "on_track", 49000000, 55000000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         4, "优化渠道组合后，预计业绩提升4%，KOL投入带来学术影响力提升"),
        ("s5", "kol_strategy", "KOL策略调整", "调整KOL数量和单KOL投入，优化影响力传播", "customer_management",
         50000000, 54000000, 108, "on_track", 51000000, 57000000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         8, "增加KOL投入和学术活动后，预计影响力传播提升8%，处方量增长显著"),
        ("s6", "customer_churn_intervention", "客户流失干预", "对高风险客户进行干预，降低流失率", "customer_management",
         50000000, 48500000, 97, "at_risk", 46000000, 51000000,
         50000000, 45000000, 90, "critical", 42000000, 48000000,
         7.8, "干预后预计留存率提升7.8%，风险等级从critical改善为at_risk，需要持续跟进"),
        ("s7", "new_customer_development", "新客户开发优先级", "调整新医院开发策略，优化资源分配", "customer_management",
         50000000, 51000000, 102, "on_track", 48000000, 54000000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         2, "优化新客户开发策略后，预计新客户贡献提升2%，成功率提高"),
        ("s8", "compliance_risk_response", "合规风险应对", "增加合规培训投入和监控力度，降低合规风险", "risk_response",
         50000000, 49500000, 99, "on_track", 48500000, 50500000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         -1, "增加合规投入后，合规风险显著降低，但短期业绩略降1%，长期收益显著"),
        ("s9", "competitor_response", "竞品应对策略", "针对竞品活动制定应对措施和投入预算", "risk_response",
         50000000, 52500000, 105, "on_track", 50000000, 55000000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         5, "积极应对竞品活动后，预计市场份额提升5%，客户忠诚度增强"),
        ("s10", "emergency_response", "突发事件应对", "模拟产品断货、召回或负面新闻等突发事件的应对方案", "risk_response",
         50000000, 45000000, 90, "at_risk", 40000000, 50000000,
         50000000, 50000000, 100, "on_track", 48000000, 52000000,
         -10, "突发事件预计造成10%业绩损失，快速响应可将损失降至最低，需密切监控客户满意度"),
    ]
    for s in scenarios_data:
        db.add(Scenario(
            id=s[0], scenario_type=s[1], name=s[2], description=s[3], category=s[4],
            target_value=s[5], forecast_value=s[6], achievement_rate=s[7], risk_level=s[8],
            confidence_interval_low=s[9], confidence_interval_high=s[10],
            baseline_target_value=s[11], baseline_forecast_value=s[12], baseline_achievement_rate=s[13],
            baseline_risk_level=s[14], baseline_confidence_interval_low=s[15], baseline_confidence_interval_high=s[16],
            delta=s[17], impact_analysis=s[18],
        ))

    scenario_params = [
        ("s1", "budgetShift", "number", "预算转移比例", "20", None, 0, 100, 5, True, "从一级医院转移到二级医院的预算百分比"),
        ("s1", "fromHospitalLevel", "select", "来源医院等级", "tier1", "一级医院:tier1,二级医院:tier2", None, None, None, True, "预算来源的医院等级"),
        ("s1", "toHospitalLevel", "select", "目标医院等级", "tier2", "一级医院:tier1,二级医院:tier2", None, None, None, True, "预算目标的医院等级"),
        ("s1", "productId", "select", "产品", "p1", "诺欣妥:p1,可定:p2", None, None, None, True, "受影响的产品"),
        ("s2", "newProductPromotion", "number", "新产品推广力度", "70", None, 0, 100, 10, True, "新产品推广投入百分比"),
        ("s2", "oldProductMaintenance", "number", "老产品维持力度", "30", None, 0, 100, 10, True, "老产品维持投入百分比"),
        ("s3", "priceChangePercent", "number", "价格变动百分比", "-5", None, -20, 20, 1, True, "价格调整百分比，负值表示降价"),
        ("s3", "competitorResponse", "boolean", "考虑竞品响应", "true", None, None, None, None, False, "是否考虑竞品可能的响应"),
        ("s4", "onlineChannel", "number", "线上渠道投入", "40", None, 0, 100, 5, True, "线上渠道投入百分比"),
        ("s4", "offlineChannel", "number", "线下渠道投入", "40", None, 0, 100, 5, True, "线下渠道投入百分比"),
        ("s4", "kolInvestment", "number", "KOL投入", "20", None, 0, 100, 5, True, "KOL学术活动投入百分比"),
        ("s5", "kolCount", "number", "KOL数量", "8", None, 3, 20, 1, True, "重点维护的KOL数量"),
        ("s5", "perKolInvestment", "number", "单KOL投入", "50000", None, 10000, 100000, 5000, True, "每个KOL的年度投入预算"),
        ("s5", "academicFrequency", "number", "学术活动频率", "3", None, 1, 12, 1, True, "每年为每个KOL举办的学术活动次数"),
        ("s6", "interventionType", "select", "干预措施", "visit", "拜访:visit,学术活动:academic,支持项目:support", None, None, None, True, "选择干预措施类型"),
        ("s6", "interventionIntensity", "number", "干预强度", "3", None, 1, 5, 1, True, "干预强度等级"),
        ("s6", "targetCustomerId", "select", "目标客户", "d1", "张主任:d1,李教授:d2", None, None, None, True, "选择要干预的客户"),
        ("s7", "hospitalCount", "number", "开发医院数量", "5", None, 1, 15, 1, True, "同时开发的新医院数量"),
        ("s7", "perHospitalInvestment", "number", "单医院投入", "80000", None, 20000, 200000, 10000, True, "每个新医院的年度投入预算"),
        ("s7", "timeCycle", "number", "开发周期", "6", None, 3, 12, 1, True, "开发周期（月）"),
        ("s8", "complianceTraining", "number", "合规培训投入", "50000", None, 0, 200000, 10000, True, "年度合规培训预算"),
        ("s8", "monitoringIntensity", "number", "监控力度", "3", None, 1, 5, 1, True, "监控强度等级"),
        ("s8", "penaltyAssumption", "boolean", "考虑惩罚假设", "false", None, None, None, None, False, "是否考虑潜在违规的惩罚"),
        ("s9", "competitorActivity", "select", "竞品活动类型", "academic", "学术活动:academic,价格战:price,新品上市:new_product", None, None, None, True, "竞品的主要活动类型"),
        ("s9", "responseMeasure", "select", "应对措施", "counter_academic", "学术反击:counter_academic,价格调整:price_adjust,KOL支持:kol_support", None, None, None, True, "选择的应对措施"),
        ("s9", "responseBudget", "number", "应对预算", "100000", None, 20000, 500000, 20000, True, "应对活动的预算投入"),
        ("s10", "eventType", "select", "事件类型", "shortage", "断货:shortage,召回:recall,负面新闻:negative_news", None, None, None, True, "突发事件类型"),
        ("s10", "responsePlan", "select", "应对方案", "expedited_shipping", "加急发货:expedited_shipping,替代产品:substitute,危机公关:pr", None, None, None, True, "选择的应对方案"),
        ("s10", "expectedDuration", "number", "预计持续时间", "14", None, 3, 90, 1, True, "预计事件影响天数"),
    ]
    for p in scenario_params:
        db.add(ScenarioParameter(
            scenario_id=p[0], name=p[1], param_type=p[2], label=p[3], default_value=p[4],
            options=p[5], min_value=p[6], max_value=p[7], step_value=p[8], required=p[9], description=p[10],
        ))


def _seed_inference_rules(db):
    rules_data = [
        {
            "id": "R001", "name": "处方量持续下降检测", "description": "检测医生处方量连续3个月下降超过20%",
            "rule_type": "deduction", "condition_pattern": "Doctor.prescriptionVolume",
            "condition_filters": "trend=declining,duration>=3months", "condition_description": "处方量连续下降",
            "conclusion_type": "alert", "conclusion_alert_type": "prescription_decline",
            "conclusion_alert_message_template": "医生{entity}处方量连续{duration}个月下降{percent}%",
            "conclusion_alert_severity": "warning",
            "confidence_base": 0.8, "confidence_modifiers": "seasonal_pattern|-0.2,competitor_entry|-0.1",
            "author": "system", "tags": "处方量,风险检测",
        },
        {
            "id": "R002", "name": "拜访间隔过长检测", "description": "检测医生拜访间隔超过建议频次",
            "rule_type": "deduction", "condition_pattern": "Doctor.lastVisitDate",
            "condition_filters": "interval>recommendedFrequency", "condition_description": "拜访间隔超出建议频次",
            "conclusion_type": "alert", "conclusion_alert_type": "visit_gap",
            "conclusion_alert_message_template": "医生{entity}最近拜访距今{days}天，超出建议频次",
            "conclusion_alert_severity": "info",
            "confidence_base": 0.7, "confidence_modifiers": "holiday_period|-0.15",
            "author": "system", "tags": "拜访,频率",
        },
        {
            "id": "R003", "name": "竞品渗透检测", "description": "检测医院或科室出现竞品活动增加",
            "rule_type": "abduction", "condition_pattern": "Hospital.competitorActivity",
            "condition_filters": "activityCount>threshold", "condition_description": "竞品活动数量超过阈值",
            "conclusion_type": "new_link", "conclusion_source_pattern": "Hospital",
            "conclusion_target_pattern": "Doctor", "conclusion_link_type": "INFLUENCES",
            "confidence_base": 0.6, "confidence_modifiers": "market_volatility|-0.1",
            "author": "system", "tags": "竞品,渗透",
        },
        {
            "id": "R004", "name": "合规风险预测", "description": "基于费用趋势预测合规风险",
            "rule_type": "induction", "condition_pattern": "SalesRep.expenseTrend",
            "condition_filters": "trend=increasing,rate>30%", "condition_description": "费用增长趋势超过30%",
            "conclusion_type": "alert", "conclusion_alert_type": "expense_risk",
            "conclusion_alert_message_template": "代表{entity}费用增长趋势异常，建议审核",
            "conclusion_alert_severity": "warning",
            "confidence_base": 0.75, "confidence_modifiers": "budget_flexibility|0.1",
            "author": "system", "tags": "合规,费用",
        },
        {
            "id": "R005", "name": "客户流失风险", "description": "综合评估客户流失风险",
            "rule_type": "deduction", "condition_pattern": "Doctor.lifecycleStage",
            "condition_filters": "stage=at_risk", "condition_description": "客户处于流失风险阶段",
            "conclusion_type": "new_property", "conclusion_entity_pattern": "Doctor",
            "conclusion_property": "churnProbability", "conclusion_value_formula": "0.8",
            "confidence_base": 0.85, "confidence_modifiers": "recent_visit|-0.2,prescription_stable|-0.15",
            "author": "system", "tags": "流失,风险",
        },
        {
            "id": "R006", "name": "学术影响力传播", "description": "检测KOL学术影响力传播路径",
            "rule_type": "abduction", "condition_pattern": "Doctor.influenceScore",
            "condition_filters": "score>80", "condition_description": "医生影响力评分超过80",
            "conclusion_type": "new_link", "conclusion_source_pattern": "Doctor",
            "conclusion_target_pattern": "Doctor", "conclusion_link_type": "INFLUENCES",
            "conclusion_strength_formula": "influenceScore/100",
            "confidence_base": 0.65, "confidence_modifiers": "collaboration_history|0.1",
            "author": "system", "tags": "KOL,影响力",
        },
        {
            "id": "R007", "name": "预算超支预警", "description": "检测预算类别执行率超过阈值",
            "rule_type": "deduction", "condition_pattern": "BudgetCategory.executionRate",
            "condition_filters": "rate>90%", "condition_description": "预算执行率超过90%",
            "conclusion_type": "alert", "conclusion_alert_type": "budget_overrun",
            "conclusion_alert_message_template": "预算类别{entity}执行率已达{rate}%，接近超支",
            "conclusion_alert_severity": "warning",
            "confidence_base": 0.9, "confidence_modifiers": "year_end|-0.1",
            "author": "system", "tags": "预算,预警",
        },
    ]
    for r in rules_data:
        db.add(InferenceRule(**r))


def _seed_reminders(db):
    reminders_data = [
        ("rem1", "default_user", "urgent", "紧急客户拜访", "张主任处方量持续下降，需要紧急安排拜访", None, "high", "active", "d1"),
        ("rem2", "default_user", "important", "季度目标评审", "Q1销售目标达成率72%，需要评审并制定Q2计划", None, "medium", "active", "t1"),
        ("rem3", "default_user", "routine", "周报提交", "本周工作周报需在周五前提交", None, "low", "active", None),
        ("rem4", "default_user", "predictive", "预测性提醒：库存预警", "诺欣妥库存预计下月低于安全线", None, "medium", "active", "p1"),
        ("rem5", "default_user", "opportunity", "机会提醒：学术会议", "下周有心血管学术会议，建议邀请重点客户参加", None, "low", "active", "e1"),
    ]
    for r in reminders_data:
        db.add(Reminder(
            id=r[0], user_id=r[1], reminder_type=r[2], title=r[3], description=r[4],
            due_date=r[5], priority=r[6], status=r[7], entity_id=r[8],
        ))


def _seed_agent_status(db):
    db.add(AgentStatus(
        id="agent_001", agent_name="OntoNexus Agent", agent_type="CognitiveAgent",
        agent_status="idle", total_memories=156, episodic_memories=45,
        semantic_memories=78, procedural_memories=33,
        total_experiences=234, knowledge_items=45, success_rate=0.78,
        perception_ability=0.85, reasoning_ability=0.78, planning_ability=0.72, learning_ability=0.68,
    ))


def _ensure_user(db, user_id, username, display_name, role):
    existing = db.query(User).filter((User.id == user_id) | (User.username == username)).first()
    if existing:
        existing.role = existing.role or role
        existing.display_name = existing.display_name or display_name
        return
    db.add(User(
        id=user_id,
        username=username,
        password_hash=get_password_hash("123456"),
        display_name=display_name,
        role=role,
    ))


def _ensure_link(db, source_id, link_type, target_id, target_name, target_type):
    exists = (
        db.query(ObjectLink)
        .filter(
            ObjectLink.source_id == source_id,
            ObjectLink.link_type == link_type,
            ObjectLink.target_id == target_id,
        )
        .first()
    )
    if not exists:
        db.add(ObjectLink(
            source_id=source_id,
            link_type=link_type,
            target_id=target_id,
            target_name=target_name,
            target_type=target_type,
        ))


def _ensure_demo_loop(db):
    """Idempotent upgrades so an already-seeded SQLite file still has the closed-loop demo."""
    from models.permission import ObjectPermission

    _ensure_user(db, "default_user", "admin", "管理员", "admin")
    _ensure_user(db, "user_rep", "wang", "王代表", "rep")
    _ensure_user(db, "user_manager", "manager", "区域经理", "manager")

    for perm_id, user_id, role, can_execute, can_admin in (
        ("perm_admin_all", "default_user", "admin", True, True),
        ("perm_manager_all", "user_manager", "manager", True, False),
        ("perm_rep_read", "user_rep", "rep", False, False),
    ):
        if not db.query(ObjectPermission).filter(ObjectPermission.id == perm_id).first():
            db.add(ObjectPermission(
                id=perm_id,
                user_id=user_id,
                role=role,
                object_type="*",
                object_id="*",
                can_read=True,
                can_write=True,
                can_execute=can_execute,
                can_admin=can_admin,
            ))

    if not db.query(OntologyObject).filter(OntologyObject.id == "roi_d1").first():
        db.add(OntologyObject(id="roi_d1", object_type="ExpenseROI", name="张主任费用ROI", status="normal", owner_id="r1"))
    if not db.query(ExpenseROI).filter(ExpenseROI.id == "roi_d1").first():
        db.add(ExpenseROI(id="roi_d1", expense_amount=80000, revenue_generated=240000, roi_ratio=3.0, attribution_model="visit", calculation_period="2026-Q1"))

    _ensure_link(db, "d1", "HAS_VISIT", "v1", "学术拜访-0318", "VisitRecord")
    _ensure_link(db, "v1", "VISIT_OF", "d1", "张主任", "Doctor")
    _ensure_link(db, "d1", "HAS_ROI", "roi_d1", "张主任费用ROI", "ExpenseROI")
    _ensure_link(db, "p1", "FLOWS_TO", "h1", "上海瑞金医院", "Hospital")
    _ensure_link(db, "p2", "FLOWS_TO", "h2", "上海中山医院", "Hospital")

    for source_id, link_type, target_id in (
        ("v1", "HAS_VISIT", "d1"),
        ("rp1", "HAS_VISIT", "d1"),
        ("sf1", "FLOWS_TO", "p1"),
        ("sf2", "FLOWS_TO", "p2"),
        ("pdca1", "FOLLOWS", "d1"),
    ):
        db.query(ObjectLink).filter(
            ObjectLink.source_id == source_id,
            ObjectLink.link_type == link_type,
            ObjectLink.target_id == target_id,
        ).delete()

    if not db.query(TimeSeriesData).filter(TimeSeriesData.object_id == "d1", TimeSeriesData.series_name == "prescription").first():
        for ts, val in [("2025-10", 120), ("2025-11", 115), ("2025-12", 108), ("2026-01", 95), ("2026-02", 72), ("2026-03", 78), ("2026-04", 85)]:
            db.add(TimeSeriesData(object_id="d1", series_name="prescription", timestamp=ts, value=val))

    ap1 = db.query(ActionProposal).filter(ActionProposal.id == "ap1").first()
    if ap1 and ap1.status == "pending" and ap1.proposed_by in (None, "InsightAgent"):
        ap1.proposed_by = "user_rep"

    # The executive cockpit needs one coherent, idempotent business story rather
    # than disconnected demo records.
    if not db.query(DecisionCase).filter(DecisionCase.id == "case_demo_d1").first():
        db.add(DecisionCase(
            id="case_demo_d1",
            title="张主任处方下滑恢复",
            description="拜访节奏中断导致处方下滑，需要验证恢复方案并观察效果。",
            status="open",
            priority="high",
            owner_id="user_manager",
            entity_ids='["d1", "v1", "roi_d1"]',
            decision_ids='["dec_demo_d1"]',
            metadata_json='{"demo": true, "territory": "华东"}',
        ))
    if ap1:
        ap1.case_id = "case_demo_d1"
        ap1.decision_id = "dec_demo_d1"
    if not db.query(DecisionRecord).filter(DecisionRecord.id == "dec_demo_d1").first():
        db.add(DecisionRecord(
            id="dec_demo_d1",
            category="风险恢复",
            scenario="张主任近三月处方持续下滑，建议恢复学术拜访并在 24 小时后观察处方趋势。",
            reasoning="拜访后处方从 120 降至 78；费用 ROI 为 3.0，建议优先恢复覆盖。",
            outcome="recommended",
            confidence=0.86,
            decision_maker="InsightAgent",
            evidence_ids='["v1", "roi_d1"]',
            entity_ids='["d1"]',
            metadata_json='{"demo": true}',
            case_id="case_demo_d1",
        ))
    if not db.query(EffectRecord).filter(EffectRecord.id == "effect_demo_d1").first():
        db.add(EffectRecord(
            id="effect_demo_d1",
            case_id="case_demo_d1",
            decision_id="dec_demo_d1",
            action_id="ap1",
            metric="月处方量",
            baseline=120,
            target=100,
            actual=78,
            unit="张",
            status="observing",
            note="等待拜访动作执行后进入观察窗口。",
        ))

    t1 = db.query(SalesTarget).filter(SalesTarget.id == "t1").first()
    if t1 and t1.achievement_rate is not None and float(t1.achievement_rate) >= 80:
        t1.actual_value = 10800000
        t1.forecast_value = 12000000
        t1.achievement_rate = 72.0

    for source, ext, oid, otype in (
        ("crm", "CRM-D1", "d1", "Doctor"),
        ("crm", "CRM-H1", "h1", "Hospital"),
        ("crm", "CRM-R1", "r1", "SalesRep"),
        ("erp", "ERP-T1", "t1", "SalesTarget"),
    ):
        exists = (
            db.query(SourceBinding)
            .filter(SourceBinding.source_system == source, SourceBinding.external_id == ext)
            .first()
        )
        if not exists and db.query(OntologyObject).filter(OntologyObject.id == oid).first():
            db.add(SourceBinding(
                id=f"sb_{source}_{ext}",
                source_system=source,
                external_id=ext,
                object_id=oid,
                object_type=otype,
                last_status="seed",
            ))

    if not db.query(SkillOutcome).filter(SkillOutcome.id == "so_demo").first():
        db.add(SkillOutcome(
            id="so_demo",
            skill_name="recommend-and-accept",
            object_id="d1",
            status="pending",
            note="demo_due",
            evaluate_after=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1),
        ))
    if not db.query(SkillOutcome).filter(SkillOutcome.id == "so_wait").first():
        db.add(SkillOutcome(
            id="so_wait",
            skill_name="recommend-and-accept",
            object_id="d1",
            status="pending",
            note="demo_pending_24h",
            evaluate_after=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=23),
        ))


def _ensure_demo_story(db):
    """Idempotent demo storyline for the executive demo (Agent war room / OAG).

    * d6 周教授: a *hidden* risk. System status is still "normal", but prescriptions have
      fallen ~27%, visits stopped, and he influences two other doctors. The Agent should
      find him on its own (this is the "perception" highlight).
    * Historical, already-scored outcomes so "看效果" is never empty and skill weights
      visibly move (one up, one up, one down).
    All names are fictional.
    """
    from datetime import date
    from models.learning import SkillOutcome
    from decision.learning import record_outcome

    today = date.today()

    if not db.query(OntologyObject).filter(OntologyObject.id == "d6").first():
        db.add(OntologyObject(
            id="d6", object_type="Doctor", name="周教授", status="normal",
            lifecycle_stage="active", sentiment="neutral", compliance_risk_level=None, owner_id="r3",
        ))
    if not db.query(Doctor).filter(Doctor.id == "d6").first():
        db.add(Doctor(
            id="d6", title="主任医师", department="心内科", specialty="心力衰竭,高血压",
            prescription_power=90, influence_score=80, prescription_volume=58,
            last_visit_date=(today - timedelta(days=75)).isoformat(),
            next_recommended_visit_date=(today - timedelta(days=15)).isoformat(),
        ))

    _ensure_link(db, "d6", "WORKS_AT", "h2", "上海中山医院", "Hospital")
    _ensure_link(db, "d6", "MANAGED_BY", "r3", "孙代表", "SalesRep")
    _ensure_link(db, "d6", "PRESCRIBES", "p1", "诺欣妥", "Product")
    _ensure_link(db, "d6", "INFLUENCES", "d3", "王主治", "Doctor")
    _ensure_link(db, "d6", "INFLUENCES", "d4", "陈副主任", "Doctor")

    if not db.query(TimeSeriesData).filter(TimeSeriesData.object_id == "d6").first():
        months = ["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]
        for series_name, values in (
            ("prescriptionVolume", [96, 92, 85, 74, 66, 58]),
            ("visitFrequency", [4, 3, 2, 1, 0, 0]),
            ("sentimentScore", [72, 70, 66, 62, 58, 55]),
        ):
            for ts, val in zip(months, values):
                db.add(TimeSeriesData(object_id="d6", series_name=series_name, timestamp=ts, value=val))

    exists = (
        db.query(SourceBinding)
        .filter(SourceBinding.source_system == "crm", SourceBinding.external_id == "CRM-D6")
        .first()
    )
    if not exists:
        db.add(SourceBinding(id="sb_crm_CRM-D6", source_system="crm", external_id="CRM-D6", object_id="d6", object_type="Doctor", last_status="seed"))

    history = (
        ("demo_hist_1", "recommend-and-accept", "d4", 0.85, "visit_effect_up"),
        ("demo_hist_2", "recovery_plan_drafter", "d2", 0.75, "coverage_ok"),
        ("demo_hist_3", "action_operator", "d5", 0.25, "still_at_risk"),
    )
    for action_id, skill, object_id, score, note in history:
        if db.query(SkillOutcome).filter(SkillOutcome.action_id == action_id).first():
            continue
        record_outcome(db, skill_name=skill, object_id=object_id, action_id=action_id,
                       status="scored", effectiveness=score, note=note)

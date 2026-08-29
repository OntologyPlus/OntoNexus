from sqlalchemy import Column, String, Integer, Float, Boolean, Text, Date
from database import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=True)
    department = Column(String, nullable=True)
    specialty = Column(Text, nullable=True)
    prescription_power = Column(Integer, nullable=True)
    influence_score = Column(Integer, nullable=True)
    prescription_volume = Column(Integer, nullable=True)
    last_visit_date = Column(String, nullable=True)
    next_recommended_visit_date = Column(String, nullable=True)


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(String, primary_key=True)
    level = Column(String, nullable=True)
    location = Column(String, nullable=True)
    beds = Column(Integer, nullable=True)
    access_status = Column(String, nullable=True)
    procurement_mode = Column(String, nullable=True)
    annual_revenue = Column(Integer, nullable=True)


class Product(Base):
    __tablename__ = "products"

    id = Column(String, primary_key=True)
    category = Column(String, nullable=True)
    sales = Column(Integer, nullable=True)
    market_share = Column(Float, nullable=True)
    price = Column(Float, nullable=True)


class SalesRep(Base):
    __tablename__ = "sales_reps"

    id = Column(String, primary_key=True)
    region = Column(String, nullable=True)
    performance = Column(Integer, nullable=True)
    quota_achievement = Column(Integer, nullable=True)
    ytd_sales = Column(Integer, nullable=True)


class VisitRecord(Base):
    __tablename__ = "visit_records"

    id = Column(String, primary_key=True)
    visit_type = Column(String, nullable=True)
    visit_status = Column(String, nullable=True)
    objective = Column(Text, nullable=True)
    actual_content = Column(Text, nullable=True)
    key_insights = Column(Text, nullable=True)
    compliance_score = Column(Integer, nullable=True)
    effectiveness_score = Column(Integer, nullable=True)


class SalesTarget(Base):
    __tablename__ = "sales_targets"

    id = Column(String, primary_key=True)
    target_type = Column(String, nullable=True)
    dimension = Column(String, nullable=True)
    target_value = Column(Integer, nullable=True)
    actual_value = Column(Integer, nullable=True)
    forecast_value = Column(Integer, nullable=True)
    achievement_rate = Column(Float, nullable=True)
    risk_level = Column(String, nullable=True)


class ComplianceAlert(Base):
    __tablename__ = "compliance_alerts"

    id = Column(String, primary_key=True)
    severity = Column(String, nullable=True)
    risk_type = Column(String, nullable=True)
    alert_description = Column(Text, nullable=True)
    alert_status = Column(String, nullable=True)


class AcademicEvent(Base):
    __tablename__ = "academic_events"

    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=True)
    event_date = Column(String, nullable=True)
    participants = Column(Integer, nullable=True)
    topic = Column(Text, nullable=True)


class Territory(Base):
    __tablename__ = "territories"

    id = Column(String, primary_key=True)
    region = Column(String, nullable=True)
    hospital_count = Column(Integer, nullable=True)
    rep_count = Column(Integer, nullable=True)
    target_revenue = Column(Integer, nullable=True)


class RecoveryPlan(Base):
    __tablename__ = "recovery_plans"

    id = Column(String, primary_key=True)
    doctor_name = Column(String, nullable=True)
    risk_reason = Column(Text, nullable=True)
    plan_status = Column(String, nullable=True)
    validated_by = Column(String, nullable=True)


class SalesFlow(Base):
    __tablename__ = "sales_flows"

    id = Column(String, primary_key=True)
    flow_type = Column(String, nullable=True)
    target_value = Column(Integer, nullable=True)
    actual_value = Column(Integer, nullable=True)
    achievement_rate = Column(Float, nullable=True)
    yoy_growth = Column(Float, nullable=True)
    mom_growth = Column(Float, nullable=True)
    dimension = Column(String, nullable=True)
    period = Column(String, nullable=True)


class MarketPotential(Base):
    __tablename__ = "market_potentials"

    id = Column(String, primary_key=True)
    potential_value = Column(Integer, nullable=True)
    penetration_rate = Column(Float, nullable=True)
    market_share = Column(Float, nullable=True)
    competitor_share = Column(Float, nullable=True)
    growth_opportunity = Column(Integer, nullable=True)


class HospitalDevelopment(Base):
    __tablename__ = "hospital_developments"

    id = Column(String, primary_key=True)
    development_stage = Column(String, nullable=True)
    success_rate = Column(Float, nullable=True)
    resource_allocation = Column(Integer, nullable=True)
    timeline = Column(String, nullable=True)


class TerritoryPerformance(Base):
    __tablename__ = "territory_performances"

    id = Column(String, primary_key=True)
    territory_id = Column(String, nullable=True)
    hospital_count = Column(Integer, nullable=True)
    rep_count = Column(Integer, nullable=True)
    target_revenue = Column(Integer, nullable=True)
    actual_revenue = Column(Integer, nullable=True)
    performance_rank = Column(Integer, nullable=True)


class ProductFlow(Base):
    __tablename__ = "product_flows"

    id = Column(String, primary_key=True)
    product_id = Column(String, nullable=True)
    flow_direction = Column(String, nullable=True)
    flow_volume = Column(Integer, nullable=True)
    flow_value = Column(Integer, nullable=True)
    period = Column(String, nullable=True)


class BudgetCategory(Base):
    __tablename__ = "budget_categories"

    id = Column(String, primary_key=True)
    category = Column(String, nullable=True)
    budget_amount = Column(Integer, nullable=True)
    used_amount = Column(Integer, nullable=True)
    remaining_amount = Column(Integer, nullable=True)
    execution_rate = Column(Float, nullable=True)
    budget_status = Column(String, nullable=True)


class ExpenseClassification(Base):
    __tablename__ = "expense_classifications"

    id = Column(String, primary_key=True)
    expense_type = Column(String, nullable=True)
    amount = Column(Integer, nullable=True)
    cost_center = Column(String, nullable=True)
    approval_status = Column(String, nullable=True)


class CostDriver(Base):
    __tablename__ = "cost_drivers"

    id = Column(String, primary_key=True)
    driver_type = Column(String, nullable=True)
    driver_name = Column(String, nullable=True)
    impact_factor = Column(Float, nullable=True)
    related_expenses = Column(Text, nullable=True)


class LaborPayment(Base):
    __tablename__ = "labor_payments"

    id = Column(String, primary_key=True)
    payment_type = Column(String, nullable=True)
    total_persons = Column(Integer, nullable=True)
    total_amount = Column(Integer, nullable=True)
    payment_date = Column(String, nullable=True)


class ExpenseROI(Base):
    __tablename__ = "expense_rois"

    id = Column(String, primary_key=True)
    expense_amount = Column(Integer, nullable=True)
    revenue_generated = Column(Integer, nullable=True)
    roi_ratio = Column(Float, nullable=True)
    attribution_model = Column(String, nullable=True)
    calculation_period = Column(String, nullable=True)


class CustomerCategory(Base):
    __tablename__ = "customer_categories"

    id = Column(String, primary_key=True)
    category = Column(String, nullable=True)
    category_name = Column(String, nullable=True)
    prescription_potential = Column(Integer, nullable=True)
    influence_level = Column(Integer, nullable=True)
    cooperation_willingness = Column(Integer, nullable=True)


class VisitFeedback(Base):
    __tablename__ = "visit_feedbacks"

    id = Column(String, primary_key=True)
    feedback_type = Column(String, nullable=True)
    content = Column(Text, nullable=True)
    feedback_sentiment = Column(String, nullable=True)
    key_insights = Column(Text, nullable=True)
    follow_up_required = Column(Boolean, default=False)


class PDCAPlan(Base):
    __tablename__ = "pdca_plans"

    id = Column(String, primary_key=True)
    plan_type = Column(String, nullable=True)
    plan_content = Column(Text, nullable=True)
    do_actions = Column(Text, nullable=True)
    check_results = Column(Text, nullable=True)
    act_improvements = Column(Text, nullable=True)
    cycle_status = Column(String, nullable=True)


class HospitalStrategy(Base):
    __tablename__ = "hospital_strategies"

    id = Column(String, primary_key=True)
    strategy_type = Column(String, nullable=True)
    sales_ratio = Column(Float, nullable=True)
    vacancy_rate = Column(Float, nullable=True)
    consumption_progress = Column(Float, nullable=True)
    overlapping_hospitals = Column(Integer, nullable=True)
    flow_direction = Column(String, nullable=True)
    contract_ratio = Column(Float, nullable=True)


class DepartmentResearch(Base):
    __tablename__ = "department_researches"

    id = Column(String, primary_key=True)
    department_id = Column(String, nullable=True)
    bed_count = Column(Integer, nullable=True)
    outpatient_volume = Column(Integer, nullable=True)
    competitor_share = Column(Float, nullable=True)
    our_share = Column(Float, nullable=True)
    growth_potential = Column(Float, nullable=True)


class RWSProject(Base):
    __tablename__ = "rws_projects"

    id = Column(String, primary_key=True)
    project_name = Column(String, nullable=True)
    project_type = Column(String, nullable=True)
    project_status = Column(String, nullable=True)
    centers = Column(Integer, nullable=True)
    enrolled_patients = Column(Integer, nullable=True)
    budget = Column(Integer, nullable=True)
    timeline = Column(String, nullable=True)


class ClinicalTrial(Base):
    __tablename__ = "clinical_trials"

    id = Column(String, primary_key=True)
    trial_phase = Column(String, nullable=True)
    enrolled_patients = Column(Integer, nullable=True)
    follow_up_count = Column(Integer, nullable=True)
    drug_usage = Column(Integer, nullable=True)
    report_content = Column(Text, nullable=True)


class PatientProgram(Base):
    __tablename__ = "patient_programs"

    id = Column(String, primary_key=True)
    program_type = Column(String, nullable=True)
    enrolled_patients = Column(Integer, nullable=True)
    active_patients = Column(Integer, nullable=True)
    drug_switch_count = Column(Integer, nullable=True)
    commercial_insurance_count = Column(Integer, nullable=True)
    reimbursement_amount = Column(Integer, nullable=True)


class ResearchCollaboration(Base):
    __tablename__ = "research_collaborations"

    id = Column(String, primary_key=True)
    collaboration_type = Column(String, nullable=True)
    partner_institution = Column(String, nullable=True)
    research_topic = Column(String, nullable=True)
    budget = Column(Integer, nullable=True)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)


class MeetingCompliance(Base):
    __tablename__ = "meeting_compliances"

    id = Column(String, primary_key=True)
    meeting_duration = Column(Float, nullable=True)
    topic_alignment = Column(Float, nullable=True)
    topic_repetition = Column(Float, nullable=True)
    compliance_score = Column(Float, nullable=True)


class ExpenseCompliance(Base):
    __tablename__ = "expense_compliances"

    id = Column(String, primary_key=True)
    total_labor_fee = Column(Integer, nullable=True)
    total_frequency = Column(Integer, nullable=True)
    compliance_status = Column(String, nullable=True)
    risk_level = Column(String, nullable=True)


class CustomerCompliance(Base):
    __tablename__ = "customer_compliances"

    id = Column(String, primary_key=True)
    meeting_frequency = Column(Integer, nullable=True)
    real_name_verified = Column(Boolean, default=False)
    compliance_history = Column(Text, nullable=True)


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    id = Column(String, primary_key=True)
    rule_name = Column(String, nullable=True)
    rule_type = Column(String, nullable=True)
    threshold = Column(Float, nullable=True)
    severity = Column(String, nullable=True)
    rule_description = Column(Text, nullable=True)

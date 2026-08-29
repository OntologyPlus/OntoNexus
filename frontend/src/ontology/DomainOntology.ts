import {
  ObjectType,
  LinkType,
  OntologyAction,
} from '../types';

// ============================================
// 本体定义核心接口
// ============================================

export interface DomainOntology {
  domain: string;
  description: string;
  concepts: ConceptDefinition[];
  relations: RelationDefinition[];
  axioms: AxiomDefinition[];
}

export interface ConceptDefinition {
  name: string;
  objectType: ObjectType;
  description: string;
  parentConcept?: ObjectType;
  properties: PropertyDefinition[];
  interfaces: string[];
  actions?: OntologyAction[];
}

export interface PropertyDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' | 'object';
  required: boolean;
  computed?: boolean;
  enumValues?: string[];
  description?: string;
}

export interface RelationDefinition {
  name: string;
  linkType: LinkType;
  description: string;
  domain: ObjectType[];
  range: ObjectType[];
  cardinality: '1:1' | '1:N' | 'N:M';
  inverseRelation?: LinkType;
}

export interface AxiomDefinition {
  id: string;
  name: string;
  description: string;
  rule: string;
  constraintType: 'structural' | 'business' | 'compliance';
  severity: 'error' | 'warning' | 'info';
}

// ============================================
// 收入目标管理域本体
// ============================================

export const RevenueOntology: DomainOntology = {
  domain: 'RevenueManagement',
  description: '收入目标管理领域本体，涵盖销售流向、市场潜力、医院开发等核心概念',
  concepts: [
    {
      name: 'SalesFlow',
      objectType: ObjectType.SalesFlow,
      description: '销售流向数据，包含M1/M2/M3流向目标与实际完成',
      properties: [
        { name: 'flowType', type: 'enum', required: true, enumValues: ['M1', 'M2', 'M3'], description: '流向类型' },
        { name: 'targetValue', type: 'number', required: true, description: '目标值' },
        { name: 'actualValue', type: 'number', required: true, description: '实际值' },
        { name: 'achievementRate', type: 'number', required: false, computed: true, description: '达成率' },
        { name: 'yoyGrowth', type: 'number', required: false, computed: true, description: '同比增长率' },
        { name: 'momGrowth', type: 'number', required: false, computed: true, description: '环比增长率' },
        { name: 'dimension', type: 'enum', required: true, enumValues: ['region', 'province', 'city', 'hospital', 'product'], description: '统计维度' },
        { name: 'period', type: 'string', required: true, description: '统计周期' },
      ],
      interfaces: ['Auditable', 'Scorable', 'Targetable'],
    },
    {
      name: 'MarketPotential',
      objectType: ObjectType.MarketPotential,
      description: '市场潜力分析，包含渗透率、市占率等关键指标',
      properties: [
        { name: 'potentialValue', type: 'number', required: true, description: '市场潜力值' },
        { name: 'penetrationRate', type: 'number', required: true, description: '渗透率' },
        { name: 'marketShare', type: 'number', required: true, description: '市占率' },
        { name: 'competitorShare', type: 'number', required: true, description: '竞品市占率' },
        { name: 'growthOpportunity', type: 'number', required: false, computed: true, description: '增长机会' },
      ],
      interfaces: ['Auditable', 'Scorable'],
    },
    {
      name: 'HospitalDevelopment',
      objectType: ObjectType.HospitalDevelopment,
      description: '新医院开发全流程追踪',
      properties: [
        { name: 'developmentStage', type: 'enum', required: true, enumValues: ['prospect', 'contact', 'negotiation', 'contract', 'launch'], description: '开发阶段' },
        { name: 'successRate', type: 'number', required: true, description: '成功率' },
        { name: 'resourceAllocation', type: 'number', required: true, description: '资源分配' },
        { name: 'timeline', type: 'string', required: true, description: '时间线' },
      ],
      interfaces: ['Auditable', 'Targetable'],
    },
    {
      name: 'TerritoryPerformance',
      objectType: ObjectType.TerritoryPerformance,
      description: '区域绩效分析',
      properties: [
        { name: 'territoryId', type: 'string', required: true, description: '区域ID' },
        { name: 'hospitalCount', type: 'number', required: true, description: '医院数量' },
        { name: 'repCount', type: 'number', required: true, description: '代表数量' },
        { name: 'targetRevenue', type: 'number', required: true, description: '目标收入' },
        { name: 'actualRevenue', type: 'number', required: true, description: '实际收入' },
        { name: 'performanceRank', type: 'number', required: false, computed: true, description: '绩效排名' },
      ],
      interfaces: ['Auditable', 'Scorable', 'Targetable'],
    },
    {
      name: 'ProductFlow',
      objectType: ObjectType.ProductFlow,
      description: '产品流向明细',
      properties: [
        { name: 'productId', type: 'string', required: true, description: '产品ID' },
        { name: 'flowDirection', type: 'string', required: true, description: '流向方向' },
        { name: 'flowVolume', type: 'number', required: true, description: '流向数量' },
        { name: 'flowValue', type: 'number', required: true, description: '流向金额' },
        { name: 'period', type: 'string', required: true, description: '统计周期' },
      ],
      interfaces: ['Auditable'],
    },
  ],
  relations: [
    {
      name: 'FLOWS_TO',
      linkType: LinkType.FLOWS_TO,
      description: '产品流向医院或医生',
      domain: [ObjectType.Product],
      range: [ObjectType.Hospital, ObjectType.Doctor],
      cardinality: 'N:M',
    },
    {
      name: 'POTENTIAL_OF',
      linkType: LinkType.POTENTIAL_OF,
      description: '市场潜力属于某个区域、医院或产品',
      domain: [ObjectType.MarketPotential],
      range: [ObjectType.Territory, ObjectType.Hospital, ObjectType.Product],
      cardinality: '1:1',
    },
    {
      name: 'ACHIEVES',
      linkType: LinkType.ACHIEVES,
      description: '销售流向达成销售目标',
      domain: [ObjectType.SalesFlow],
      range: [ObjectType.SalesTarget],
      cardinality: '1:N',
    },
    {
      name: 'CONTAINS',
      linkType: LinkType.CONTAINS,
      description: '区域包含下级区域',
      domain: [ObjectType.Territory, ObjectType.TerritoryPerformance],
      range: [ObjectType.Territory, ObjectType.TerritoryPerformance],
      cardinality: '1:N',
    },
  ],
  axioms: [
    {
      id: 'revenue.aggregation',
      name: 'Territory Sales Aggregation',
      description: '大区的销售额等于下属省区销售额之和',
      rule: 'Territory.sales = SUM(Province.sales) WHERE Province.belongsTo = Territory',
      constraintType: 'business',
      severity: 'error',
    },
    {
      id: 'flow.balance',
      name: 'Flow Balance',
      description: 'M1+M2+M3流向之和等于总销售',
      rule: 'TotalSales = M1Flow + M2Flow + M3Flow',
      constraintType: 'structural',
      severity: 'error',
    },
    {
      id: 'achievement.calculation',
      name: 'Achievement Rate Calculation',
      description: '达成率 = 实际值 / 目标值 * 100%',
      rule: 'achievementRate = (actualValue / targetValue) * 100',
      constraintType: 'structural',
      severity: 'warning',
    },
  ],
};

// ============================================
// 客户管理域本体
// ============================================

export const CustomerOntology: DomainOntology = {
  domain: 'CustomerManagement',
  description: '客户管理领域本体，涵盖客户分级、拜访反馈、PDCA计划等',
  concepts: [
    {
      name: 'CustomerCategory',
      objectType: ObjectType.CustomerCategory,
      description: '六类客户分级体系',
      properties: [
        { name: 'category', type: 'enum', required: true, enumValues: ['A', 'B', 'C', 'D', 'E', 'F'], description: '客户等级' },
        { name: 'categoryName', type: 'string', required: true, description: '等级名称' },
        { name: 'prescriptionPotential', type: 'number', required: true, description: '处方潜力' },
        { name: 'influenceLevel', type: 'number', required: true, description: '影响力等级' },
        { name: 'cooperationWillingness', type: 'number', required: true, description: '合作意愿' },
      ],
      interfaces: ['Auditable'],
    },
    {
      name: 'VisitFeedback',
      objectType: ObjectType.VisitFeedback,
      description: '结构化拜访反馈',
      properties: [
        { name: 'feedbackType', type: 'enum', required: true, enumValues: ['positive', 'neutral', 'negative'], description: '反馈类型' },
        { name: 'content', type: 'string', required: true, description: '反馈内容' },
        { name: 'sentiment', type: 'enum', required: true, enumValues: ['positive', 'neutral', 'negative'], description: '情感倾向' },
        { name: 'keyInsights', type: 'array', required: false, description: '关键洞察' },
        { name: 'followUpRequired', type: 'boolean', required: true, description: '是否需要跟进' },
      ],
      interfaces: ['Auditable'],
    },
    {
      name: 'PDCAPlan',
      objectType: ObjectType.PDCAPlan,
      description: 'PDCA闭环管理计划',
      properties: [
        { name: 'planType', type: 'enum', required: true, enumValues: ['visit', 'academic', 'service'], description: '计划类型' },
        { name: 'planContent', type: 'string', required: true, description: '计划内容' },
        { name: 'cycleStatus', type: 'enum', required: true, enumValues: ['planning', 'doing', 'checking', 'acting', 'completed'], description: '循环状态' },
      ],
      interfaces: ['Auditable', 'Targetable'],
    },
    {
      name: 'HospitalStrategy',
      objectType: ObjectType.HospitalStrategy,
      description: '一院一策策略',
      properties: [
        { name: 'strategyType', type: 'string', required: true, description: '策略类型' },
        { name: 'salesRatio', type: 'number', required: true, description: '销量占比' },
        { name: 'vacancyRate', type: 'number', required: true, description: '空岗率' },
        { name: 'consumptionProgress', type: 'number', required: true, description: '消耗进度' },
        { name: 'overlappingHospitals', type: 'number', required: true, description: '重叠医院数' },
        { name: 'flowDirection', type: 'string', required: true, description: '流向方向' },
        { name: 'contractRatio', type: 'number', required: true, description: '签约占比' },
      ],
      interfaces: ['Auditable', 'Targetable'],
    },
    {
      name: 'DepartmentResearch',
      objectType: ObjectType.DepartmentResearch,
      description: '科室调研数据',
      properties: [
        { name: 'departmentId', type: 'string', required: true, description: '科室ID' },
        { name: 'bedCount', type: 'number', required: true, description: '床位数' },
        { name: 'outpatientVolume', type: 'number', required: true, description: '门诊量' },
        { name: 'competitorShare', type: 'number', required: true, description: '竞品份额' },
        { name: 'ourShare', type: 'number', required: true, description: '我方份额' },
        { name: 'growthPotential', type: 'number', required: false, computed: true, description: '增长潜力' },
      ],
      interfaces: ['Auditable', 'Scorable'],
    },
  ],
  relations: [
    {
      name: 'CATEGORIZED_AS',
      linkType: LinkType.CATEGORIZED_AS,
      description: '医生被分类为客户等级',
      domain: [ObjectType.Doctor],
      range: [ObjectType.CustomerCategory],
      cardinality: '1:N',
    },
    {
      name: 'FEEDS_BACK',
      linkType: LinkType.FEEDS_BACK,
      description: '拜访记录产生反馈',
      domain: [ObjectType.VisitRecord],
      range: [ObjectType.VisitFeedback],
      cardinality: '1:N',
    },
    {
      name: 'FOLLOWS',
      linkType: LinkType.FOLLOWS,
      description: '行动项遵循PDCA计划',
      domain: [ObjectType.ActionItem],
      range: [ObjectType.PDCAPlan],
      cardinality: '1:N',
    },
    {
      name: 'STRATEGY_FOR',
      linkType: LinkType.STRATEGY_FOR,
      description: '策略针对特定医院',
      domain: [ObjectType.HospitalStrategy],
      range: [ObjectType.Hospital],
      cardinality: '1:1',
    },
    {
      name: 'TRANSFORMS_TO',
      linkType: LinkType.TRANSFORMS_TO,
      description: '客户生命周期转换',
      domain: [ObjectType.Doctor],
      range: [ObjectType.Doctor],
      cardinality: '1:1',
    },
  ],
  axioms: [
    {
      id: 'customer.lifecycle',
      name: 'Customer Lifecycle',
      description: '客户生命周期转换规则：潜在客户→开发中→成熟→风险→流失',
      rule: 'prospect → developing → mature → at_risk → churned',
      constraintType: 'business',
      severity: 'warning',
    },
    {
      id: 'pdca.cycle',
      name: 'PDCA Cycle',
      description: 'PDCA循环必须按顺序执行：Plan→Do→Check→Act',
      rule: 'planning → doing → checking → acting → completed',
      constraintType: 'business',
      severity: 'error',
    },
    {
      id: 'visit.feedback',
      name: 'Visit Feedback Required',
      description: '每次拜访后必须有反馈记录',
      rule: 'VisitRecord MUST HAVE VisitFeedback',
      constraintType: 'business',
      severity: 'warning',
    },
  ],
};

// ============================================
// 费用管理域本体
// ============================================

export const ExpenseOntology: DomainOntology = {
  domain: 'ExpenseManagement',
  description: '费用管理领域本体，涵盖预算、费用分类、ROI分析等',
  concepts: [
    {
      name: 'BudgetCategory',
      objectType: ObjectType.BudgetCategory,
      description: '预算类别（六大驱动）',
      properties: [
        { name: 'category', type: 'enum', required: true, enumValues: ['sales', 'market', 'medical', 'patient', 'policy', 'development'], description: '预算类别' },
        { name: 'budgetAmount', type: 'number', required: true, description: '预算金额' },
        { name: 'usedAmount', type: 'number', required: true, description: '已用金额' },
        { name: 'remainingAmount', type: 'number', required: false, computed: true, description: '剩余金额' },
        { name: 'executionRate', type: 'number', required: false, computed: true, description: '执行率' },
        { name: 'status', type: 'enum', required: true, enumValues: ['pending', 'approved', 'rejected'], description: '状态' },
      ],
      interfaces: ['Auditable', 'Targetable'],
    },
    {
      name: 'ExpenseClassification',
      objectType: ObjectType.ExpenseClassification,
      description: '费用分类（C1/C2A/C2B/C3）',
      properties: [
        { name: 'expenseType', type: 'enum', required: true, enumValues: ['C1', 'C2A', 'C2B', 'C3'], description: '费用类型' },
        { name: 'amount', type: 'number', required: true, description: '金额' },
        { name: 'costCenter', type: 'string', required: true, description: '成本中心' },
        { name: 'approvalStatus', type: 'string', required: true, description: '审批状态' },
      ],
      interfaces: ['Auditable'],
    },
    {
      name: 'CostDriver',
      objectType: ObjectType.CostDriver,
      description: '成本驱动因素',
      properties: [
        { name: 'driverType', type: 'string', required: true, description: '驱动类型' },
        { name: 'driverName', type: 'string', required: true, description: '驱动名称' },
        { name: 'impactFactor', type: 'number', required: true, description: '影响因子' },
        { name: 'relatedExpenses', type: 'array', required: false, description: '相关费用' },
      ],
      interfaces: ['Auditable'],
    },
    {
      name: 'LaborPayment',
      objectType: ObjectType.LaborPayment,
      description: '劳务支付',
      properties: [
        { name: 'paymentType', type: 'string', required: true, description: '支付类型' },
        { name: 'totalPersons', type: 'number', required: true, description: '总人数' },
        { name: 'totalAmount', type: 'number', required: true, description: '总金额' },
        { name: 'paymentDate', type: 'string', required: true, description: '支付日期' },
      ],
      interfaces: ['Auditable'],
    },
    {
      name: 'ExpenseROI',
      objectType: ObjectType.ExpenseROI,
      description: '费用ROI分析',
      properties: [
        { name: 'expenseAmount', type: 'number', required: true, description: '费用金额' },
        { name: 'revenueGenerated', type: 'number', required: true, description: '产生收入' },
        { name: 'roiRatio', type: 'number', required: false, computed: true, description: 'ROI比率' },
        { name: 'attributionModel', type: 'string', required: true, description: '归因模型' },
        { name: 'calculationPeriod', type: 'string', required: true, description: '计算周期' },
      ],
      interfaces: ['Auditable', 'Scorable'],
    },
  ],
  relations: [
    {
      name: 'CLASSIFIED_AS',
      linkType: LinkType.CLASSIFIED_AS,
      description: '费用归类到预算类别',
      domain: [ObjectType.ExpenseClassification],
      range: [ObjectType.BudgetCategory],
      cardinality: '1:N',
    },
    {
      name: 'DRIVEN_BY',
      linkType: LinkType.DRIVEN_BY,
      description: '费用由成本驱动',
      domain: [ObjectType.ExpenseClassification],
      range: [ObjectType.CostDriver],
      cardinality: 'N:M',
    },
    {
      name: 'CONSUMES',
      linkType: LinkType.CONSUMES,
      description: '活动消耗预算',
      domain: [ObjectType.VisitRecord, ObjectType.AcademicEvent],
      range: [ObjectType.BudgetCategory],
      cardinality: '1:N',
    },
    {
      name: 'PRODUCES',
      linkType: LinkType.PRODUCES,
      description: '费用产生ROI',
      domain: [ObjectType.ExpenseClassification],
      range: [ObjectType.ExpenseROI],
      cardinality: '1:1',
    },
  ],
  axioms: [
    {
      id: 'expense.limit',
      name: 'Expense Limit',
      description: '各类费用之和不能超过预算',
      rule: 'C1 + C2A + C2B + C3 ≤ Budget',
      constraintType: 'business',
      severity: 'error',
    },
    {
      id: 'expense.roi',
      name: 'ROI Calculation',
      description: 'ROI = (收入 - 费用) / 费用',
      rule: 'roiRatio = (revenueGenerated - expenseAmount) / expenseAmount',
      constraintType: 'structural',
      severity: 'warning',
    },
    {
      id: 'budget.execution',
      name: 'Budget Execution Rate',
      description: '执行率 = 已用金额 / 预算金额',
      rule: 'executionRate = usedAmount / budgetAmount',
      constraintType: 'structural',
      severity: 'warning',
    },
  ],
};

// ============================================
// 医学事务域本体
// ============================================

export const MedicalAffairsOntology: DomainOntology = {
  domain: 'MedicalAffairs',
  description: '医学事务领域本体，涵盖RWS项目、临床试验、患者项目等',
  concepts: [
    {
      name: 'RWSProject',
      objectType: ObjectType.RWSProject,
      description: '真实世界研究项目',
      properties: [
        { name: 'projectName', type: 'string', required: true, description: '项目名称' },
        { name: 'projectType', type: 'enum', required: true, enumValues: ['registry', 'observational', 'interventional'], description: '项目类型' },
        { name: 'status', type: 'enum', required: true, enumValues: ['initiated', 'multicenter', 'gcp', 'settlement'], description: '项目状态' },
        { name: 'centers', type: 'number', required: true, description: '中心数' },
        { name: 'enrolledPatients', type: 'number', required: true, description: '入组患者数' },
        { name: 'budget', type: 'number', required: true, description: '预算' },
        { name: 'timeline', type: 'string', required: true, description: '时间线' },
      ],
      interfaces: ['Auditable', 'Targetable'],
    },
    {
      name: 'ClinicalTrial',
      objectType: ObjectType.ClinicalTrial,
      description: '临床试验',
      properties: [
        { name: 'trialPhase', type: 'string', required: true, description: '试验阶段' },
        { name: 'enrolledPatients', type: 'number', required: true, description: '入组患者数' },
        { name: 'followUpCount', type: 'number', required: true, description: '随访次数' },
        { name: 'drugUsage', type: 'number', required: true, description: '用药量' },
        { name: 'reportContent', type: 'string', required: false, description: '报告内容' },
      ],
      interfaces: ['Auditable'],
    },
    {
      name: 'PatientProgram',
      objectType: ObjectType.PatientProgram,
      description: '患者管理项目',
      properties: [
        { name: 'programType', type: 'string', required: true, description: '项目类型' },
        { name: 'enrolledPatients', type: 'number', required: true, description: '入组患者数' },
        { name: 'activePatients', type: 'number', required: true, description: '活跃患者数' },
        { name: 'drugSwitchCount', type: 'number', required: true, description: '跨药患者数' },
        { name: 'commercialInsuranceCount', type: 'number', required: true, description: '商保患者数' },
        { name: 'reimbursementAmount', type: 'number', required: true, description: '商保报销金额' },
      ],
      interfaces: ['Auditable', 'Scorable'],
    },
    {
      name: 'ResearchCollaboration',
      objectType: ObjectType.ResearchCollaboration,
      description: '科研合作',
      properties: [
        { name: 'collaborationType', type: 'string', required: true, description: '合作类型' },
        { name: 'partnerInstitution', type: 'string', required: true, description: '合作机构' },
        { name: 'researchTopic', type: 'string', required: true, description: '研究主题' },
        { name: 'budget', type: 'number', required: true, description: '预算' },
        { name: 'startDate', type: 'string', required: true, description: '开始日期' },
        { name: 'endDate', type: 'string', required: true, description: '结束日期' },
      ],
      interfaces: ['Auditable', 'Targetable'],
    },
  ],
  relations: [
    {
      name: 'MANAGES',
      linkType: LinkType.MANAGES,
      description: '代表管理项目',
      domain: [ObjectType.SalesRep],
      range: [ObjectType.RWSProject, ObjectType.PatientProgram],
      cardinality: '1:N',
    },
    {
      name: 'CONDUCTS',
      linkType: LinkType.CONDUCTS,
      description: '医院或医生开展试验',
      domain: [ObjectType.Hospital, ObjectType.Doctor],
      range: [ObjectType.ClinicalTrial],
      cardinality: '1:N',
    },
    {
      name: 'ENROLLS',
      linkType: LinkType.ENROLLS,
      description: '项目入组医生',
      domain: [ObjectType.PatientProgram],
      range: [ObjectType.Doctor],
      cardinality: 'N:M',
    },
    {
      name: 'DEPENDS_ON',
      linkType: LinkType.DEPENDS_ON,
      description: '项目依赖于合作',
      domain: [ObjectType.RWSProject],
      range: [ObjectType.ResearchCollaboration],
      cardinality: 'N:M',
    },
  ],
  axioms: [
    {
      id: 'rws.progress',
      name: 'RWS Progress',
      description: 'RWS项目必须按阶段推进：立项→多中心→GCP→结算',
      rule: 'initiated → multicenter → gcp → settlement',
      constraintType: 'business',
      severity: 'error',
    },
    {
      id: 'patient.retention',
      name: 'Patient Retention Rate',
      description: '活跃患者数不应超过入组患者数',
      rule: 'activePatients ≤ enrolledPatients',
      constraintType: 'business',
      severity: 'warning',
    },
  ],
};

// ============================================
// 合规管理域本体
// ============================================

export const ComplianceOntology: DomainOntology = {
  domain: 'ComplianceManagement',
  description: '合规管理领域本体，涵盖会议合规、费用合规、客户合规等',
  concepts: [
    {
      name: 'MeetingCompliance',
      objectType: ObjectType.MeetingCompliance,
      description: '会议合规检查',
      properties: [
        { name: 'meetingDuration', type: 'number', required: true, description: '会议时长（小时）' },
        { name: 'topicAlignment', type: 'number', required: true, description: '主题契合度' },
        { name: 'topicRepetition', type: 'number', required: true, description: '主题重复性' },
        { name: 'complianceScore', type: 'number', required: false, computed: true, description: '合规评分' },
      ],
      interfaces: ['Auditable', 'Scorable'],
    },
    {
      name: 'ExpenseCompliance',
      objectType: ObjectType.ExpenseCompliance,
      description: '费用合规检查',
      properties: [
        { name: 'totalLaborFee', type: 'number', required: true, description: '劳务费总额' },
        { name: 'totalFrequency', type: 'number', required: true, description: '总频次' },
        { name: 'complianceStatus', type: 'enum', required: true, enumValues: ['compliant', 'warning', 'violation'], description: '合规状态' },
        { name: 'riskLevel', type: 'enum', required: true, enumValues: ['low', 'medium', 'high'], description: '风险等级' },
      ],
      interfaces: ['Auditable', 'Scorable'],
    },
    {
      name: 'CustomerCompliance',
      objectType: ObjectType.CustomerCompliance,
      description: '客户合规检查',
      properties: [
        { name: 'meetingFrequency', type: 'number', required: true, description: '会议频次' },
        { name: 'realNameVerified', type: 'boolean', required: true, description: '实名验证' },
      ],
      interfaces: ['Auditable'],
    },
    {
      name: 'ComplianceRule',
      objectType: ObjectType.ComplianceRule,
      description: '合规规则定义',
      properties: [
        { name: 'ruleName', type: 'string', required: true, description: '规则名称' },
        { name: 'ruleType', type: 'enum', required: true, enumValues: ['meeting', 'expense', 'customer'], description: '规则类型' },
        { name: 'threshold', type: 'number', required: true, description: '阈值' },
        { name: 'severity', type: 'enum', required: true, enumValues: ['low', 'medium', 'high'], description: '严重等级' },
        { name: 'description', type: 'string', required: true, description: '规则描述' },
      ],
      interfaces: ['Auditable'],
    },
  ],
  relations: [
    {
      name: 'COMPLIES_WITH',
      linkType: LinkType.COMPLIES_WITH,
      description: '合规检查符合规则',
      domain: [ObjectType.MeetingCompliance, ObjectType.ExpenseCompliance, ObjectType.CustomerCompliance],
      range: [ObjectType.ComplianceRule],
      cardinality: 'N:M',
    },
    {
      name: 'GOVERNED_BY',
      linkType: LinkType.GOVERNED_BY,
      description: '活动受规则约束',
      domain: [ObjectType.AcademicEvent, ObjectType.VisitRecord],
      range: [ObjectType.ComplianceRule],
      cardinality: 'N:M',
    },
    {
      name: 'VIOLATES',
      linkType: LinkType.VIOLATES,
      description: '违反规则',
      domain: [ObjectType.MeetingCompliance, ObjectType.ExpenseCompliance, ObjectType.CustomerCompliance],
      range: [ObjectType.ComplianceRule],
      cardinality: 'N:M',
    },
  ],
  axioms: [
    {
      id: 'compliance.meeting.duration',
      name: 'Meeting Duration Limit',
      description: '会议时长不能超过4小时',
      rule: 'meetingDuration ≤ 4',
      constraintType: 'compliance',
      severity: 'error',
    },
    {
      id: 'compliance.expense.single',
      name: 'Single Expense Limit',
      description: '单次费用不能超过500元',
      rule: 'singleExpense ≤ 500',
      constraintType: 'compliance',
      severity: 'error',
    },
    {
      id: 'compliance.expense.monthly',
      name: 'Monthly Expense Limit',
      description: '月度费用不能超过预算的80%',
      rule: 'monthlyExpense ≤ budget * 0.8',
      constraintType: 'compliance',
      severity: 'warning',
    },
    {
      id: 'compliance.customer.verification',
      name: 'Customer Verification',
      description: '客户必须实名验证',
      rule: 'realNameVerified = true',
      constraintType: 'compliance',
      severity: 'error',
    },
  ],
};

// ============================================
// 本体注册表
// ============================================

export const DomainOntologies = {
  RevenueManagement: RevenueOntology,
  CustomerManagement: CustomerOntology,
  ExpenseManagement: ExpenseOntology,
  MedicalAffairs: MedicalAffairsOntology,
  ComplianceManagement: ComplianceOntology,
};

export class OntologyRegistry {
  static getDomainOntology(domain: string): DomainOntology | undefined {
    return DomainOntologies[domain as keyof typeof DomainOntologies];
  }

  static getConceptDefinition(objectType: ObjectType): ConceptDefinition | undefined {
    for (const ontology of Object.values(DomainOntologies)) {
      const concept = ontology.concepts.find(c => c.objectType === objectType);
      if (concept) return concept;
    }
    return undefined;
  }

  static getRelationDefinition(linkType: LinkType): RelationDefinition | undefined {
    for (const ontology of Object.values(DomainOntologies)) {
      const relation = ontology.relations.find(r => r.linkType === linkType);
      if (relation) return relation;
    }
    return undefined;
  }

  static getAxiomDefinitions(constraintType?: 'structural' | 'business' | 'compliance'): AxiomDefinition[] {
    const axioms: AxiomDefinition[] = [];
    for (const ontology of Object.values(DomainOntologies)) {
      if (constraintType) {
        axioms.push(...ontology.axioms.filter(a => a.constraintType === constraintType));
      } else {
        axioms.push(...ontology.axioms);
      }
    }
    return axioms;
  }

  static getAllObjectTypes(): ObjectType[] {
    const types: ObjectType[] = [];
    for (const ontology of Object.values(DomainOntologies)) {
      types.push(...ontology.concepts.map(c => c.objectType));
    }
    return types;
  }

  static getAllLinkTypes(): LinkType[] {
    const types: LinkType[] = [];
    for (const ontology of Object.values(DomainOntologies)) {
      types.push(...ontology.relations.map(r => r.linkType));
    }
    return [...new Set(types)];
  }
}

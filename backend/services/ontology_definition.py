from typing import Dict, List, Optional, Tuple

ONTOLOGY_DEFINITIONS = {
    "RevenueManagement": {
        "domain": "RevenueManagement",
        "description": "收入目标管理领域本体，涵盖销售流向、市场潜力、医院开发等核心概念",
        "concepts": [
            {
                "name": "SalesFlow",
                "objectType": "SalesFlow",
                "description": "销售流向数据，包含M1/M2/M3流向目标与实际完成",
                "properties": [
                    {"name": "flowType", "type": "enum", "required": True, "enumValues": ["M1", "M2", "M3"], "description": "流向类型"},
                    {"name": "targetValue", "type": "number", "required": True, "description": "目标值"},
                    {"name": "actualValue", "type": "number", "required": True, "description": "实际值"},
                    {"name": "achievementRate", "type": "number", "required": False, "computed": True, "description": "达成率"},
                    {"name": "yoyGrowth", "type": "number", "required": False, "computed": True, "description": "同比增长率"},
                    {"name": "momGrowth", "type": "number", "required": False, "computed": True, "description": "环比增长率"},
                    {"name": "dimension", "type": "enum", "required": True, "enumValues": ["region", "province", "city", "hospital", "product"], "description": "统计维度"},
                    {"name": "period", "type": "string", "required": True, "description": "统计周期"},
                ],
                "interfaces": ["Auditable", "Scorable", "Targetable"],
            },
            {
                "name": "MarketPotential",
                "objectType": "MarketPotential",
                "description": "市场潜力分析，包含渗透率、市占率等关键指标",
                "properties": [
                    {"name": "potentialValue", "type": "number", "required": True, "description": "市场潜力值"},
                    {"name": "penetrationRate", "type": "number", "required": True, "description": "渗透率"},
                    {"name": "marketShare", "type": "number", "required": True, "description": "市占率"},
                    {"name": "competitorShare", "type": "number", "required": True, "description": "竞品市占率"},
                    {"name": "growthOpportunity", "type": "number", "required": False, "computed": True, "description": "增长机会"},
                ],
                "interfaces": ["Auditable", "Scorable"],
            },
            {
                "name": "HospitalDevelopment",
                "objectType": "HospitalDevelopment",
                "description": "新医院开发全流程追踪",
                "properties": [
                    {"name": "developmentStage", "type": "enum", "required": True, "enumValues": ["prospect", "contact", "negotiation", "contract", "launch"], "description": "开发阶段"},
                    {"name": "successRate", "type": "number", "required": True, "description": "成功率"},
                    {"name": "resourceAllocation", "type": "number", "required": True, "description": "资源分配"},
                    {"name": "timeline", "type": "string", "required": True, "description": "时间线"},
                ],
                "interfaces": ["Auditable", "Targetable"],
            },
            {
                "name": "TerritoryPerformance",
                "objectType": "TerritoryPerformance",
                "description": "区域绩效分析",
                "properties": [
                    {"name": "territoryId", "type": "string", "required": True, "description": "区域ID"},
                    {"name": "hospitalCount", "type": "number", "required": True, "description": "医院数量"},
                    {"name": "repCount", "type": "number", "required": True, "description": "代表数量"},
                    {"name": "targetRevenue", "type": "number", "required": True, "description": "目标收入"},
                    {"name": "actualRevenue", "type": "number", "required": True, "description": "实际收入"},
                    {"name": "performanceRank", "type": "number", "required": False, "computed": True, "description": "绩效排名"},
                ],
                "interfaces": ["Auditable", "Scorable", "Targetable"],
            },
            {
                "name": "ProductFlow",
                "objectType": "ProductFlow",
                "description": "产品流向明细",
                "properties": [
                    {"name": "productId", "type": "string", "required": True, "description": "产品ID"},
                    {"name": "flowDirection", "type": "string", "required": True, "description": "流向方向"},
                    {"name": "flowVolume", "type": "number", "required": True, "description": "流向数量"},
                    {"name": "flowValue", "type": "number", "required": True, "description": "流向金额"},
                    {"name": "period", "type": "string", "required": True, "description": "统计周期"},
                ],
                "interfaces": ["Auditable"],
            },
        ],
        "relations": [
            {
                "name": "FLOWS_TO",
                "linkType": "FLOWS_TO",
                "description": "产品流向医院或医生",
                "domain": ["Product"],
                "range": ["Hospital", "Doctor"],
                "cardinality": "N:M",
            },
            {
                "name": "POTENTIAL_OF",
                "linkType": "POTENTIAL_OF",
                "description": "市场潜力属于某个区域、医院或产品",
                "domain": ["MarketPotential"],
                "range": ["Territory", "Hospital", "Product"],
                "cardinality": "1:1",
            },
            {
                "name": "ACHIEVES",
                "linkType": "ACHIEVES",
                "description": "销售流向达成销售目标",
                "domain": ["SalesFlow"],
                "range": ["SalesTarget"],
                "cardinality": "1:N",
            },
            {
                "name": "CONTAINS",
                "linkType": "CONTAINS",
                "description": "区域包含下级区域",
                "domain": ["Territory", "TerritoryPerformance"],
                "range": ["Territory", "TerritoryPerformance"],
                "cardinality": "1:N",
            },
        ],
        "axioms": [
            {
                "id": "revenue.aggregation",
                "name": "Territory Sales Aggregation",
                "description": "大区的销售额等于下属省区销售额之和",
                "rule": "Territory.sales = SUM(Province.sales) WHERE Province.belongsTo = Territory",
                "constraintType": "business",
                "severity": "error",
            },
            {
                "id": "flow.balance",
                "name": "Flow Balance",
                "description": "M1+M2+M3流向之和等于总销售",
                "rule": "TotalSales = M1Flow + M2Flow + M3Flow",
                "constraintType": "structural",
                "severity": "error",
            },
            {
                "id": "achievement.calculation",
                "name": "Achievement Rate Calculation",
                "description": "达成率 = 实际值 / 目标值 * 100%",
                "rule": "achievementRate = (actualValue / targetValue) * 100",
                "constraintType": "structural",
                "severity": "warning",
            },
        ],
    },
    "CustomerManagement": {
        "domain": "CustomerManagement",
        "description": "客户管理领域本体，涵盖客户分级、拜访反馈、PDCA计划等",
        "concepts": [
            {
                "name": "CustomerCategory",
                "objectType": "CustomerCategory",
                "description": "六类客户分级体系",
                "properties": [
                    {"name": "category", "type": "enum", "required": True, "enumValues": ["A", "B", "C", "D", "E", "F"], "description": "客户等级"},
                    {"name": "categoryName", "type": "string", "required": True, "description": "等级名称"},
                    {"name": "prescriptionPotential", "type": "number", "required": True, "description": "处方潜力"},
                    {"name": "influenceLevel", "type": "number", "required": True, "description": "影响力等级"},
                    {"name": "cooperationWillingness", "type": "number", "required": True, "description": "合作意愿"},
                ],
                "interfaces": ["Auditable"],
            },
            {
                "name": "VisitFeedback",
                "objectType": "VisitFeedback",
                "description": "结构化拜访反馈",
                "properties": [
                    {"name": "feedbackType", "type": "enum", "required": True, "enumValues": ["positive", "neutral", "negative"], "description": "反馈类型"},
                    {"name": "content", "type": "string", "required": True, "description": "反馈内容"},
                    {"name": "sentiment", "type": "enum", "required": True, "enumValues": ["positive", "neutral", "negative"], "description": "情感倾向"},
                    {"name": "keyInsights", "type": "array", "required": False, "description": "关键洞察"},
                    {"name": "followUpRequired", "type": "boolean", "required": True, "description": "是否需要跟进"},
                ],
                "interfaces": ["Auditable"],
            },
            {
                "name": "PDCAPlan",
                "objectType": "PDCAPlan",
                "description": "PDCA闭环管理计划",
                "properties": [
                    {"name": "planType", "type": "enum", "required": True, "enumValues": ["visit", "academic", "service"], "description": "计划类型"},
                    {"name": "planContent", "type": "string", "required": True, "description": "计划内容"},
                    {"name": "cycleStatus", "type": "enum", "required": True, "enumValues": ["planning", "doing", "checking", "acting", "completed"], "description": "循环状态"},
                ],
                "interfaces": ["Auditable", "Targetable"],
            },
            {
                "name": "HospitalStrategy",
                "objectType": "HospitalStrategy",
                "description": "一院一策策略",
                "properties": [
                    {"name": "strategyType", "type": "string", "required": True, "description": "策略类型"},
                    {"name": "salesRatio", "type": "number", "required": True, "description": "销量占比"},
                    {"name": "vacancyRate", "type": "number", "required": True, "description": "空岗率"},
                    {"name": "consumptionProgress", "type": "number", "required": True, "description": "消耗进度"},
                    {"name": "overlappingHospitals", "type": "number", "required": True, "description": "重叠医院数"},
                    {"name": "flowDirection", "type": "string", "required": True, "description": "流向方向"},
                    {"name": "contractRatio", "type": "number", "required": True, "description": "签约占比"},
                ],
                "interfaces": ["Auditable", "Targetable"],
            },
            {
                "name": "DepartmentResearch",
                "objectType": "DepartmentResearch",
                "description": "科室调研数据",
                "properties": [
                    {"name": "departmentId", "type": "string", "required": True, "description": "科室ID"},
                    {"name": "bedCount", "type": "number", "required": True, "description": "床位数"},
                    {"name": "outpatientVolume", "type": "number", "required": True, "description": "门诊量"},
                    {"name": "competitorShare", "type": "number", "required": True, "description": "竞品份额"},
                    {"name": "ourShare", "type": "number", "required": True, "description": "我方份额"},
                    {"name": "growthPotential", "type": "number", "required": False, "computed": True, "description": "增长潜力"},
                ],
                "interfaces": ["Auditable", "Scorable"],
            },
        ],
        "relations": [
            {
                "name": "CATEGORIZED_AS",
                "linkType": "CATEGORIZED_AS",
                "description": "医生被分类为客户等级",
                "domain": ["Doctor"],
                "range": ["CustomerCategory"],
                "cardinality": "1:N",
            },
            {
                "name": "FEEDS_BACK",
                "linkType": "FEEDS_BACK",
                "description": "拜访记录产生反馈",
                "domain": ["VisitRecord"],
                "range": ["VisitFeedback"],
                "cardinality": "1:N",
            },
            {
                "name": "FOLLOWS",
                "linkType": "FOLLOWS",
                "description": "行动项遵循PDCA计划",
                "domain": ["ActionItem"],
                "range": ["PDCAPlan"],
                "cardinality": "1:N",
            },
            {
                "name": "STRATEGY_FOR",
                "linkType": "STRATEGY_FOR",
                "description": "策略针对特定医院",
                "domain": ["HospitalStrategy"],
                "range": ["Hospital"],
                "cardinality": "1:1",
            },
            {
                "name": "TRANSFORMS_TO",
                "linkType": "TRANSFORMS_TO",
                "description": "客户生命周期转换",
                "domain": ["Doctor"],
                "range": ["Doctor"],
                "cardinality": "1:1",
            },
        ],
        "axioms": [
            {
                "id": "customer.lifecycle",
                "name": "Customer Lifecycle",
                "description": "客户生命周期转换规则：潜在客户→开发中→成熟→风险→流失",
                "rule": "prospect → developing → mature → at_risk → churned",
                "constraintType": "business",
                "severity": "warning",
            },
            {
                "id": "pdca.cycle",
                "name": "PDCA Cycle",
                "description": "PDCA循环必须按顺序执行：Plan→Do→Check→Act",
                "rule": "planning → doing → checking → acting → completed",
                "constraintType": "business",
                "severity": "error",
            },
            {
                "id": "visit.feedback",
                "name": "Visit Feedback Required",
                "description": "每次拜访后必须有反馈记录",
                "rule": "VisitRecord MUST HAVE VisitFeedback",
                "constraintType": "business",
                "severity": "warning",
            },
        ],
    },
    "ExpenseManagement": {
        "domain": "ExpenseManagement",
        "description": "费用管理领域本体，涵盖预算、费用分类、ROI分析等",
        "concepts": [
            {
                "name": "BudgetCategory",
                "objectType": "BudgetCategory",
                "description": "预算类别（六大驱动）",
                "properties": [
                    {"name": "category", "type": "enum", "required": True, "enumValues": ["sales", "market", "medical", "patient", "policy", "development"], "description": "预算类别"},
                    {"name": "budgetAmount", "type": "number", "required": True, "description": "预算金额"},
                    {"name": "usedAmount", "type": "number", "required": True, "description": "已用金额"},
                    {"name": "remainingAmount", "type": "number", "required": False, "computed": True, "description": "剩余金额"},
                    {"name": "executionRate", "type": "number", "required": False, "computed": True, "description": "执行率"},
                    {"name": "status", "type": "enum", "required": True, "enumValues": ["pending", "approved", "rejected"], "description": "状态"},
                ],
                "interfaces": ["Auditable", "Targetable"],
            },
            {
                "name": "ExpenseClassification",
                "objectType": "ExpenseClassification",
                "description": "费用分类（C1/C2A/C2B/C3）",
                "properties": [
                    {"name": "expenseType", "type": "enum", "required": True, "enumValues": ["C1", "C2A", "C2B", "C3"], "description": "费用类型"},
                    {"name": "amount", "type": "number", "required": True, "description": "金额"},
                    {"name": "costCenter", "type": "string", "required": True, "description": "成本中心"},
                    {"name": "approvalStatus", "type": "string", "required": True, "description": "审批状态"},
                ],
                "interfaces": ["Auditable"],
            },
            {
                "name": "CostDriver",
                "objectType": "CostDriver",
                "description": "成本驱动因素",
                "properties": [
                    {"name": "driverType", "type": "string", "required": True, "description": "驱动类型"},
                    {"name": "driverName", "type": "string", "required": True, "description": "驱动名称"},
                    {"name": "impactFactor", "type": "number", "required": True, "description": "影响因子"},
                    {"name": "relatedExpenses", "type": "array", "required": False, "description": "相关费用"},
                ],
                "interfaces": ["Auditable"],
            },
            {
                "name": "LaborPayment",
                "objectType": "LaborPayment",
                "description": "劳务支付",
                "properties": [
                    {"name": "paymentType", "type": "string", "required": True, "description": "支付类型"},
                    {"name": "totalPersons", "type": "number", "required": True, "description": "总人数"},
                    {"name": "totalAmount", "type": "number", "required": True, "description": "总金额"},
                    {"name": "paymentDate", "type": "string", "required": True, "description": "支付日期"},
                ],
                "interfaces": ["Auditable"],
            },
            {
                "name": "ExpenseROI",
                "objectType": "ExpenseROI",
                "description": "费用ROI分析",
                "properties": [
                    {"name": "expenseAmount", "type": "number", "required": True, "description": "费用金额"},
                    {"name": "revenueGenerated", "type": "number", "required": True, "description": "产生收入"},
                    {"name": "roiRatio", "type": "number", "required": False, "computed": True, "description": "ROI比率"},
                    {"name": "attributionModel", "type": "string", "required": True, "description": "归因模型"},
                    {"name": "calculationPeriod", "type": "string", "required": True, "description": "计算周期"},
                ],
                "interfaces": ["Auditable", "Scorable"],
            },
        ],
        "relations": [
            {
                "name": "CLASSIFIED_AS",
                "linkType": "CLASSIFIED_AS",
                "description": "费用归类到预算类别",
                "domain": ["ExpenseClassification"],
                "range": ["BudgetCategory"],
                "cardinality": "1:N",
            },
            {
                "name": "DRIVEN_BY",
                "linkType": "DRIVEN_BY",
                "description": "费用由成本驱动",
                "domain": ["ExpenseClassification"],
                "range": ["CostDriver"],
                "cardinality": "N:M",
            },
            {
                "name": "CONSUMES",
                "linkType": "CONSUMES",
                "description": "活动消耗预算",
                "domain": ["VisitRecord", "AcademicEvent"],
                "range": ["BudgetCategory"],
                "cardinality": "1:N",
            },
            {
                "name": "PRODUCES",
                "linkType": "PRODUCES",
                "description": "费用产生ROI",
                "domain": ["ExpenseClassification"],
                "range": ["ExpenseROI"],
                "cardinality": "1:1",
            },
        ],
        "axioms": [
            {
                "id": "expense.limit",
                "name": "Expense Limit",
                "description": "各类费用之和不能超过预算",
                "rule": "C1 + C2A + C2B + C3 ≤ Budget",
                "constraintType": "business",
                "severity": "error",
            },
            {
                "id": "expense.roi",
                "name": "ROI Calculation",
                "description": "ROI = (收入 - 费用) / 费用",
                "rule": "roiRatio = (revenueGenerated - expenseAmount) / expenseAmount",
                "constraintType": "structural",
                "severity": "warning",
            },
            {
                "id": "budget.execution",
                "name": "Budget Execution Rate",
                "description": "执行率 = 已用金额 / 预算金额",
                "rule": "executionRate = usedAmount / budgetAmount",
                "constraintType": "structural",
                "severity": "warning",
            },
        ],
    },
    "MedicalAffairs": {
        "domain": "MedicalAffairs",
        "description": "医学事务领域本体，涵盖RWS项目、临床试验、患者项目等",
        "concepts": [
            {
                "name": "RWSProject",
                "objectType": "RWSProject",
                "description": "真实世界研究项目",
                "properties": [
                    {"name": "projectName", "type": "string", "required": True, "description": "项目名称"},
                    {"name": "projectType", "type": "enum", "required": True, "enumValues": ["registry", "observational", "interventional"], "description": "项目类型"},
                    {"name": "status", "type": "enum", "required": True, "enumValues": ["initiated", "multicenter", "gcp", "settlement"], "description": "项目状态"},
                    {"name": "centers", "type": "number", "required": True, "description": "中心数"},
                    {"name": "enrolledPatients", "type": "number", "required": True, "description": "入组患者数"},
                    {"name": "budget", "type": "number", "required": True, "description": "预算"},
                    {"name": "timeline", "type": "string", "required": True, "description": "时间线"},
                ],
                "interfaces": ["Auditable", "Targetable"],
            },
            {
                "name": "ClinicalTrial",
                "objectType": "ClinicalTrial",
                "description": "临床试验",
                "properties": [
                    {"name": "trialPhase", "type": "string", "required": True, "description": "试验阶段"},
                    {"name": "enrolledPatients", "type": "number", "required": True, "description": "入组患者数"},
                    {"name": "followUpCount", "type": "number", "required": True, "description": "随访次数"},
                    {"name": "drugUsage", "type": "number", "required": True, "description": "用药量"},
                    {"name": "reportContent", "type": "string", "required": False, "description": "报告内容"},
                ],
                "interfaces": ["Auditable"],
            },
            {
                "name": "PatientProgram",
                "objectType": "PatientProgram",
                "description": "患者管理项目",
                "properties": [
                    {"name": "programType", "type": "string", "required": True, "description": "项目类型"},
                    {"name": "enrolledPatients", "type": "number", "required": True, "description": "入组患者数"},
                    {"name": "activePatients", "type": "number", "required": True, "description": "活跃患者数"},
                    {"name": "drugSwitchCount", "type": "number", "required": True, "description": "跨药患者数"},
                    {"name": "commercialInsuranceCount", "type": "number", "required": True, "description": "商保患者数"},
                    {"name": "reimbursementAmount", "type": "number", "required": True, "description": "商保报销金额"},
                ],
                "interfaces": ["Auditable", "Scorable"],
            },
            {
                "name": "ResearchCollaboration",
                "objectType": "ResearchCollaboration",
                "description": "科研合作",
                "properties": [
                    {"name": "collaborationType", "type": "string", "required": True, "description": "合作类型"},
                    {"name": "partnerInstitution", "type": "string", "required": True, "description": "合作机构"},
                    {"name": "researchTopic", "type": "string", "required": True, "description": "研究主题"},
                    {"name": "budget", "type": "number", "required": True, "description": "预算"},
                    {"name": "startDate", "type": "string", "required": True, "description": "开始日期"},
                    {"name": "endDate", "type": "string", "required": True, "description": "结束日期"},
                ],
                "interfaces": ["Auditable", "Targetable"],
            },
        ],
        "relations": [
            {
                "name": "MANAGES",
                "linkType": "MANAGES",
                "description": "代表管理项目",
                "domain": ["SalesRep"],
                "range": ["RWSProject", "PatientProgram"],
                "cardinality": "1:N",
            },
            {
                "name": "CONDUCTS",
                "linkType": "CONDUCTS",
                "description": "医院或医生开展试验",
                "domain": ["Hospital", "Doctor"],
                "range": ["ClinicalTrial"],
                "cardinality": "1:N",
            },
            {
                "name": "ENROLLS",
                "linkType": "ENROLLS",
                "description": "项目入组医生",
                "domain": ["PatientProgram"],
                "range": ["Doctor"],
                "cardinality": "N:M",
            },
            {
                "name": "DEPENDS_ON",
                "linkType": "DEPENDS_ON",
                "description": "项目依赖于合作",
                "domain": ["RWSProject"],
                "range": ["ResearchCollaboration"],
                "cardinality": "N:M",
            },
        ],
        "axioms": [
            {
                "id": "rws.progress",
                "name": "RWS Progress",
                "description": "RWS项目必须按阶段推进：立项→多中心→GCP→结算",
                "rule": "initiated → multicenter → gcp → settlement",
                "constraintType": "business",
                "severity": "error",
            },
            {
                "id": "patient.retention",
                "name": "Patient Retention Rate",
                "description": "活跃患者数不应超过入组患者数",
                "rule": "activePatients ≤ enrolledPatients",
                "constraintType": "business",
                "severity": "warning",
            },
        ],
    },
    "ComplianceManagement": {
        "domain": "ComplianceManagement",
        "description": "合规管理领域本体，涵盖会议合规、费用合规、客户合规等",
        "concepts": [
            {
                "name": "MeetingCompliance",
                "objectType": "MeetingCompliance",
                "description": "会议合规检查",
                "properties": [
                    {"name": "meetingDuration", "type": "number", "required": True, "description": "会议时长（小时）"},
                    {"name": "topicAlignment", "type": "number", "required": True, "description": "主题契合度"},
                    {"name": "topicRepetition", "type": "number", "required": True, "description": "主题重复性"},
                    {"name": "complianceScore", "type": "number", "required": False, "computed": True, "description": "合规评分"},
                ],
                "interfaces": ["Auditable", "Scorable"],
            },
            {
                "name": "ExpenseCompliance",
                "objectType": "ExpenseCompliance",
                "description": "费用合规检查",
                "properties": [
                    {"name": "totalLaborFee", "type": "number", "required": True, "description": "劳务费总额"},
                    {"name": "totalFrequency", "type": "number", "required": True, "description": "总频次"},
                    {"name": "complianceStatus", "type": "enum", "required": True, "enumValues": ["compliant", "warning", "violation"], "description": "合规状态"},
                    {"name": "riskLevel", "type": "enum", "required": True, "enumValues": ["low", "medium", "high"], "description": "风险等级"},
                ],
                "interfaces": ["Auditable", "Scorable"],
            },
            {
                "name": "CustomerCompliance",
                "objectType": "CustomerCompliance",
                "description": "客户合规检查",
                "properties": [
                    {"name": "meetingFrequency", "type": "number", "required": True, "description": "会议频次"},
                    {"name": "realNameVerified", "type": "boolean", "required": True, "description": "实名验证"},
                ],
                "interfaces": ["Auditable"],
            },
            {
                "name": "ComplianceRule",
                "objectType": "ComplianceRule",
                "description": "合规规则定义",
                "properties": [
                    {"name": "ruleName", "type": "string", "required": True, "description": "规则名称"},
                    {"name": "ruleType", "type": "enum", "required": True, "enumValues": ["meeting", "expense", "customer"], "description": "规则类型"},
                    {"name": "threshold", "type": "number", "required": True, "description": "阈值"},
                    {"name": "severity", "type": "enum", "required": True, "enumValues": ["low", "medium", "high"], "description": "严重等级"},
                    {"name": "description", "type": "string", "required": True, "description": "规则描述"},
                ],
                "interfaces": ["Auditable"],
            },
        ],
        "relations": [
            {
                "name": "COMPLIES_WITH",
                "linkType": "COMPLIES_WITH",
                "description": "合规检查符合规则",
                "domain": ["MeetingCompliance", "ExpenseCompliance", "CustomerCompliance"],
                "range": ["ComplianceRule"],
                "cardinality": "N:M",
            },
            {
                "name": "GOVERNED_BY",
                "linkType": "GOVERNED_BY",
                "description": "活动受规则约束",
                "domain": ["AcademicEvent", "VisitRecord"],
                "range": ["ComplianceRule"],
                "cardinality": "N:M",
            },
            {
                "name": "VIOLATES",
                "linkType": "VIOLATES",
                "description": "违反规则",
                "domain": ["MeetingCompliance", "ExpenseCompliance", "CustomerCompliance"],
                "range": ["ComplianceRule"],
                "cardinality": "N:M",
            },
        ],
        "axioms": [
            {
                "id": "compliance.meeting.duration",
                "name": "Meeting Duration Limit",
                "description": "会议时长不能超过4小时",
                "rule": "meetingDuration ≤ 4",
                "constraintType": "compliance",
                "severity": "error",
            },
            {
                "id": "compliance.expense.single",
                "name": "Single Expense Limit",
                "description": "单次费用不能超过500元",
                "rule": "singleExpense ≤ 500",
                "constraintType": "compliance",
                "severity": "error",
            },
            {
                "id": "compliance.expense.monthly",
                "name": "Monthly Expense Limit",
                "description": "月度费用不能超过预算的80%",
                "rule": "monthlyExpense ≤ budget * 0.8",
                "constraintType": "compliance",
                "severity": "warning",
            },
            {
                "id": "compliance.customer.verification",
                "name": "Customer Verification",
                "description": "客户必须实名验证",
                "rule": "realNameVerified = true",
                "constraintType": "compliance",
                "severity": "error",
            },
        ],
    },
}

_INVERSE_RELATIONS = {
    "FLOWS_TO": None,
    "POTENTIAL_OF": None,
    "ACHIEVES": None,
    "CONTAINS": None,
    "CATEGORIZED_AS": None,
    "FEEDS_BACK": None,
    "FOLLOWS": None,
    "STRATEGY_FOR": None,
    "TRANSFORMS_TO": "TRANSFORMS_TO",
    "CLASSIFIED_AS": None,
    "DRIVEN_BY": None,
    "CONSUMES": None,
    "PRODUCES": None,
    "MANAGES": None,
    "CONDUCTS": None,
    "ENROLLS": None,
    "DEPENDS_ON": None,
    "COMPLIES_WITH": "VIOLATES",
    "VIOLATES": "COMPLIES_WITH",
    "GOVERNED_BY": None,
    "WORKS_AT": None,
    "PRESCRIBES": None,
    "MANAGED_BY": None,
    "INFLUENCES": "INFLUENCES",
    "ATTENDED": None,
    "HAS_VISIT": None,
    "HAS_ALERT": None,
    "COVERS": None,
    "BELONGS_TO": None,
    "PARTICIPATES_IN": None,
    "CAUSES": None,
    "IMPACTS": None,
    "IMPACTED_BY": "IMPACTS",
}

_SENSITIVE_FIELDS = {
    "Doctor": ["prescription_volume", "prescription_power", "influence_score"],
    "Hospital": ["annual_revenue", "procurement_mode"],
    "SalesRep": ["performance", "quota_achievement", "ytd_sales"],
    "BudgetCategory": ["budget_amount", "used_amount", "remaining_amount"],
    "ExpenseClassification": ["amount"],
    "ExpenseROI": ["expense_amount", "revenue_generated", "roi_ratio"],
    "RWSProject": ["budget"],
    "ResearchCollaboration": ["budget"],
}


def get_concept_definition(object_type: str) -> Optional[Dict]:
    for domain_def in ONTOLOGY_DEFINITIONS.values():
        for concept in domain_def["concepts"]:
            if concept["objectType"] == object_type:
                return concept
    return None


def get_relation_definition(link_type: str) -> Optional[Dict]:
    for domain_def in ONTOLOGY_DEFINITIONS.values():
        for relation in domain_def["relations"]:
            if relation["linkType"] == link_type:
                return relation
    return None


def get_inverse_link_type(link_type: str) -> Optional[str]:
    return _INVERSE_RELATIONS.get(link_type)


def get_link_cardinality(link_type: str) -> Optional[str]:
    rel = get_relation_definition(link_type)
    if rel:
        return rel.get("cardinality")
    return None


def get_axiom_definitions(constraint_type: Optional[str] = None) -> List[Dict]:
    axioms = []
    for domain_def in ONTOLOGY_DEFINITIONS.values():
        if constraint_type:
            axioms.extend([a for a in domain_def["axioms"] if a["constraintType"] == constraint_type])
        else:
            axioms.extend(domain_def["axioms"])
    return axioms


def get_sensitive_fields(object_type: str) -> List[str]:
    return _SENSITIVE_FIELDS.get(object_type, [])


def validate_object_properties(object_type: str, properties: Dict) -> Tuple[bool, List[str]]:
    from semantic.ontology import validate_object
    return validate_object(object_type, properties)


def validate_link(link_type: str, source_type: str, target_type: str) -> Tuple[bool, str]:
    from semantic.ontology import validate_link as _validate_link
    return _validate_link(link_type, source_type, target_type)

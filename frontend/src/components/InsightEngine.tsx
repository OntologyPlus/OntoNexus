import React, { useState, useMemo } from 'react';
import { useOntologyContext } from '../contexts/OntologyContext';
import { Sparkles, AlertTriangle, TrendingUp, Link2, Clock, ChevronRight, CheckCircle, XCircle, Filter, RefreshCw, Lightbulb, Target, Users, DollarSign, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Insight, InsightType } from '../types';
import { DecisionScenario, DecisionDomain, DecisionType, TimeHorizon, DecisionStatus, SpatialScope } from '../decision/DecisionOntology';
import { DecisionRecommendationEngine } from '../decision/DecisionRecommendationEngine';
import { ConsistencyValidationEngine, ImplicitRelationMiner, ImplicitRelation, AssociationRule, NetworkMetrics, AnomalyPattern } from '../inference';

// 决策洞察卡片组件
interface DecisionInsightCardProps {
  scenario: DecisionScenario;
  onDismiss: () => void;
  onExecute: () => void;
  onViewDetails: () => void;
}

const DecisionInsightCard: React.FC<DecisionInsightCardProps> = ({
  scenario,
  onDismiss,
  onExecute,
  onViewDetails,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const engine = useMemo(() => new DecisionRecommendationEngine(), []);

  const generateRecommendation = async () => {
    setLoading(true);
    const rec = engine.generateRecommendation(scenario);
    setRecommendation(rec);
    setLoading(false);
  };

  const getDomainIcon = () => {
    switch (scenario.context.domain) {
      case DecisionDomain.REVENUE:
        return <TrendingUp className="w-5 h-5 text-gray-800" />;
      case DecisionDomain.CUSTOMER:
        return <Users className="w-5 h-5 text-gray-800" />;
      case DecisionDomain.EXPENSE:
        return <DollarSign className="w-5 h-5 text-gray-800" />;
      case DecisionDomain.COMPLIANCE:
        return <Shield className="w-5 h-5 text-gray-800" />;
      default:
        return <Lightbulb className="w-5 h-5 text-gray-800" />;
    }
  };

  const getDomainClass = () => {
    switch (scenario.context.domain) {
      case DecisionDomain.REVENUE:
        return 'glass-card border-l-4 border-l-brand-500 hover:shadow-glow hover:-translate-y-1';
      case DecisionDomain.CUSTOMER:
        return 'glass-card border-l-4 border-l-emerald-500 hover:shadow-glow-green hover:-translate-y-1';
      case DecisionDomain.EXPENSE:
        return 'glass-card border-l-4 border-l-orange-500 hover:shadow-glow-orange hover:-translate-y-1';
      case DecisionDomain.COMPLIANCE:
        return 'glass-card border-l-4 border-l-rose-500 hover:shadow-glow-red hover:-translate-y-1';
      default:
        return 'glass-card border-l-4 border-l-purple-500 hover:shadow-glow-purple hover:-translate-y-1';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-emerald-400 bg-white0/15 border border-emerald-500/25';
    if (confidence >= 0.6) return 'text-amber-700 bg-white0/15 border border-amber-200';
    return 'text-rose-700 bg-white border border-rose-200';
  };

  const getUrgencyIndicator = () => {
    const urgency = scenario.context.metadata.urgency;
    if (urgency >= 80) return <span className="text-xs text-rose-700 font-medium px-2 py-0.5 bg-white rounded-full">紧急</span>;
    if (urgency >= 60) return <span className="text-xs text-amber-700 font-medium px-2 py-0.5 bg-white0/10 rounded-full">重要</span>;
    return <span className="text-xs text-brand-400 font-medium px-2 py-0.5 bg-brand-500/10 rounded-full">建议</span>;
  };

  return (
    <div className={`p-4 transition-all duration-300 ${getDomainClass()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-lg shadow-sm">
            {getDomainIcon()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-700">{scenario.name}</h3>
              {getUrgencyIndicator()}
            </div>
            <p className="text-sm text-gray-800">{scenario.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-800">
              <span>置信度:
                <span className={`inline-block px-2 py-0.5 rounded-full ml-1 ${getConfidenceColor(scenario.confidence)}`}>
                  {(scenario.confidence * 100).toFixed(0)}%
                </span>
              </span>
              <span>替代方案: {scenario.alternatives.length}</span>
              <span>评估准则: {scenario.evaluationCriteria.length}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-800 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
          >
            {expanded ? <ChevronRight size={18} className="rotate-90" /> : <ChevronRight size={18} />}
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 text-gray-800 hover:text-rose-700 hover:bg-white rounded transition-colors"
          >
            <XCircle size={18} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {!recommendation ? (
            <div className="text-center py-4">
              <button
                onClick={generateRecommendation}
                disabled={loading}
                className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 disabled:opacity-50 transition-colors flex items-center gap-2 mx-auto"
              >
                <Lightbulb size={18} />
                {loading ? '生成中...' : '生成智能推荐'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-700">推荐方案</h4>
                  <span className={`text-sm px-2 py-1 rounded-full ${getConfidenceColor(recommendation.confidence)}`}>
                    置信度 {(recommendation.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-gray-600 font-medium">{recommendation.recommendedAlternative.name}</p>
                <p className="text-sm text-gray-800 mt-1">{recommendation.recommendedAlternative.description}</p>

                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-white0/10 rounded p-2 text-center">
                    <div className="text-xs text-emerald-400">预期收益</div>
                    <div className="text-lg font-bold text-emerald-400">
                      ¥{(recommendation.expectedImpact.financial.revenue / 10000).toFixed(0)}万
                    </div>
                  </div>
                  <div className="bg-brand-500/10 rounded p-2 text-center">
                    <div className="text-xs text-brand-400">ROI</div>
                    <div className="text-lg font-bold text-brand-400">
                      {(recommendation.expectedImpact.financial.roi * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div className="bg-white0/10 rounded p-2 text-center">
                    <div className="text-xs text-amber-700">实施周期</div>
                    <div className="text-lg font-bold text-amber-700">
                      {recommendation.implementationPlan.reduce((sum: number, s: any) => sum + s.duration, 0)}天
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <h5 className="text-sm font-medium text-gray-600 mb-2">关键行动</h5>
                  <div className="space-y-1">
                    {recommendation.recommendedAlternative.actions.slice(0, 3).map((action: any) => (
                      <div key={action.id} className="flex items-center gap-2 text-sm">
                        <CheckCircle size={14} className="text-green-500" />
                        <span className="text-gray-600">{action.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {recommendation.recommendedAlternative.risks.length > 0 && (
                  <div className="mt-3 bg-rose-500/8 rounded p-2 border border-rose-500/20">
                    <div className="flex items-center gap-1 text-rose-700 text-sm">
                      <AlertTriangle size={14} />
                      <span className="font-medium">主要风险</span>
                    </div>
                    <p className="text-xs text-rose-700/80 mt-1">
                      {recommendation.recommendedAlternative.risks[0].description}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onExecute}
                  className="flex-1 px-4 py-2 bg-white0 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Target size={18} />
                  立即执行
                </button>
                <button
                  onClick={onViewDetails}
                  className="px-4 py-2 bg-white/10 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
                >
                  <Clock size={18} />
                  稍后查看
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const InsightEngine: React.FC = () => {
  const { state } = useOntologyContext();
  const [selectedType, setSelectedType] = useState<InsightType | 'all' | 'decision'>('all');
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [dismissedDecisions, setDismissedDecisions] = useState<Set<string>>(new Set());

  // 自动检测决策场景
  const detectDecisionScenarios = (): DecisionScenario[] => {
    const scenarios: DecisionScenario[] = [];

    // 1. 检测销售目标达成风险
    const salesTargets = state.objects.filter(obj => obj.objectType === 'SalesTarget');
    const atRiskTargets = salesTargets.filter(target => {
      const achievementRate = target.properties.achievementRate || 0;
      return achievementRate < 80 && achievementRate > 0;
    });

    if (atRiskTargets.length > 0) {
      const totalGap = atRiskTargets.reduce((sum, t) => {
        const gap = (t.properties.targetValue || 0) - (t.properties.actualValue || 0);
        return sum + Math.max(0, gap);
      }, 0);

      scenarios.push({
        id: `decision_revenue_${Date.now()}`,
        name: '销售目标达成风险决策',
        description: `检测到 ${atRiskTargets.length} 个销售目标达成率低于80%，预计缺口 ¥${(totalGap / 10000).toFixed(0)}万，需要制定追赶策略`,
        context: {
          id: `ctx_revenue_${Date.now()}`,
          type: DecisionType.TACTICAL,
          domain: DecisionDomain.REVENUE,
          timeHorizon: TimeHorizon.SHORT_TERM,
          spatialScope: SpatialScope.TERRITORY,
          stakeholders: [],
          constraints: [],
          objectives: [
            {
              id: 'obj1',
              name: '目标达成率',
              description: '提升销售目标达成率至90%以上',
              target: 90,
              current: Math.min(...atRiskTargets.map(t => t.properties.achievementRate || 0)),
              weight: 0.4,
              priority: 'high',
              metrics: ['achievementRate', 'gapAmount']
            }
          ],
          relatedEntities: atRiskTargets,
          historicalDecisions: [],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system',
            urgency: 75,
            importance: 85,
            tags: ['revenue', 'target', 'risk']
          }
        },
        alternatives: [
          {
            id: 'alt1',
            name: '资源再分配策略',
            description: '将资源从达成率高的区域调配至风险区域',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          },
          {
            id: 'alt2',
            name: '促销活动策略',
            description: '在风险区域启动针对性促销活动',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          }
        ],
        evaluationCriteria: [],
        confidence: 0.82,
        status: DecisionStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 2. 检测客户流失风险
    const atRiskDoctors = state.objects.filter(obj =>
      obj.objectType === 'Doctor' && obj.status === 'critical'
    );

    if (atRiskDoctors.length > 0) {
      scenarios.push({
        id: `decision_customer_${Date.now()}`,
        name: '高风险客户挽留决策',
        description: `检测到 ${atRiskDoctors.length} 位关键客户存在流失风险，需要立即制定干预策略`,
        context: {
          id: `ctx_customer_${Date.now()}`,
          type: DecisionType.OPERATIONAL,
          domain: DecisionDomain.CUSTOMER,
          timeHorizon: TimeHorizon.IMMEDIATE,
          spatialScope: SpatialScope.INDIVIDUAL,
          stakeholders: [],
          constraints: [],
          objectives: [
            {
              id: 'obj1',
              name: '客户留存率',
              description: '挽留高风险客户',
              target: 80,
              weight: 0.5,
              priority: 'high',
              metrics: ['retentionRate', 'satisfactionScore']
            }
          ],
          relatedEntities: atRiskDoctors,
          historicalDecisions: [],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system',
            urgency: 90,
            importance: 95,
            tags: ['customer', 'churn', 'retention']
          }
        },
        alternatives: [
          {
            id: 'alt1',
            name: '紧急拜访计划',
            description: '安排高层拜访，了解客户需求',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          },
          {
            id: 'alt2',
            name: '学术活动邀请',
            description: '邀请参加高端学术会议',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          }
        ],
        evaluationCriteria: [],
        confidence: 0.88,
        status: DecisionStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 3. 检测费用超预算风险
    const expenseCategories = state.objects.filter(obj => obj.objectType === 'ExpenseClassification');
    const overBudgetExpenses = expenseCategories.filter(exp => {
      const budget = exp.properties.budget || 0;
      const actual = exp.properties.actualSpend || 0;
      return budget > 0 && actual / budget > 0.9;
    });

    if (overBudgetExpenses.length > 0) {
      scenarios.push({
        id: `decision_expense_${Date.now()}`,
        name: '费用预算控制决策',
        description: `检测到 ${overBudgetExpenses.length} 项费用接近或超过预算，需要优化费用结构`,
        context: {
          id: `ctx_expense_${Date.now()}`,
          type: DecisionType.TACTICAL,
          domain: DecisionDomain.EXPENSE,
          timeHorizon: TimeHorizon.MEDIUM_TERM,
          spatialScope: SpatialScope.TERRITORY,
          stakeholders: [],
          constraints: [],
          objectives: [
            {
              id: 'obj1',
              name: '预算控制',
              description: '将费用控制在预算范围内',
              target: 100,
              weight: 0.4,
              priority: 'high',
              metrics: ['budgetUtilization', 'costEfficiency']
            }
          ],
          relatedEntities: overBudgetExpenses,
          historicalDecisions: [],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system',
            urgency: 70,
            importance: 75,
            tags: ['expense', 'budget', 'control']
          }
        },
        alternatives: [
          {
            id: 'alt1',
            name: '费用削减计划',
            description: '削减非必要费用支出',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          },
          {
            id: 'alt2',
            name: '预算调整申请',
            description: '申请增加关键领域预算',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          }
        ],
        evaluationCriteria: [],
        confidence: 0.75,
        status: DecisionStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // 4. 检测合规风险
    const complianceAlerts = state.objects.filter(obj =>
      obj.objectType === 'ComplianceAlert' && obj.properties.severity === 'high'
    );

    if (complianceAlerts.length > 0) {
      scenarios.push({
        id: `decision_compliance_${Date.now()}`,
        name: '合规风险应对决策',
        description: `检测到 ${complianceAlerts.length} 项高风险合规问题，涉及金额 ¥${(complianceAlerts.reduce((sum, a) => sum + (a.properties.impactAmount || 0), 0) / 10000).toFixed(0)}万，需要立即制定应对措施`,
        context: {
          id: `ctx_compliance_${Date.now()}`,
          type: DecisionType.OPERATIONAL,
          domain: DecisionDomain.COMPLIANCE,
          timeHorizon: TimeHorizon.IMMEDIATE,
          spatialScope: SpatialScope.TERRITORY,
          stakeholders: [],
          constraints: [],
          objectives: [
            {
              id: 'obj1',
              name: '合规达标率',
              description: '消除合规风险，确保合规达标率100%',
              target: 100,
              current: 0,
              weight: 0.6,
              priority: 'high',
              metrics: ['complianceScore', 'riskLevel']
            },
            {
              id: 'obj2',
              name: '风险消除时效',
              description: '在规定时间内完成风险整改',
              target: 7,
              current: 0,
              weight: 0.3,
              priority: 'high',
              metrics: ['resolutionDays', 'completionRate']
            }
          ],
          relatedEntities: complianceAlerts,
          historicalDecisions: [],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system',
            urgency: 95,
            importance: 100,
            tags: ['compliance', 'risk', 'urgent']
          }
        },
        alternatives: [
          {
            id: 'alt1',
            name: '快速整改策略',
            description: '立即启动整改流程，消除合规风险点',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          },
          {
            id: 'alt2',
            name: '流程优化策略',
            description: '优化业务流程，从根源消除合规隐患',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          },
          {
            id: 'alt3',
            name: '培训强化策略',
            description: '加强合规培训，提升团队合规意识',
            actions: [],
            expectedOutcomes: [],
            risks: [],
            resourceRequirements: []
          }
        ],
        evaluationCriteria: [],
        confidence: 0.9,
        status: DecisionStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return scenarios;
  };

  // 生成传统洞察 - 集成真实推理引擎
  const generateInsights = (): Insight[] => {
    const insights: Insight[] = [];
    const now = new Date();

    // 1. 使用ConsistencyValidationEngine进行一致性验证
    const validationEngine = new ConsistencyValidationEngine(state.objects);
    const validationReport = validationEngine.validateAll();

    if (validationReport.failedAxioms > 0) {
      const errorItems = validationReport.errors.slice(0, 2);
      if (errorItems.length > 0) {
        insights.push({
          id: 'insight_validation',
          type: 'risk',
          title: '本体一致性风险',
          description: `检测到 ${validationReport.failedAxioms} 项一致性违规，${errorItems[0].message}`,
          reasoningChain: {
            conclusion: '本体数据存在一致性问题',
            evidence: errorItems.map(e => ({
              source: e.constraintType === 'business' ? '业务规则' : e.constraintType === 'compliance' ? '合规检查' : '结构验证',
              observation: e.message,
              weight: e.severity === 'error' ? 0.9 : 0.6,
            })),
            confidence: validationReport.overallScore / 100,
            alternativeHypotheses: [],
            suggestedActions: errorItems[0].suggestion ? [
              { actionName: '检查数据来源', priority: 'high', reason: errorItems[0].suggestion },
            ] : [],
          },
          confidence: validationReport.overallScore / 100,
          impact: {
            entities: errorItems.flatMap(e => e.affectedEntities),
            metrics: [
              { name: '一致性得分', change: validationReport.overallScore - 100 },
            ],
          },
          suggestedActions: [],
          createdAt: now,
          status: 'new',
        });
      }
    }

    // 2. 使用ImplicitRelationMiner发现隐含关系
    const relationMiner = new ImplicitRelationMiner(state.objects);
    const miningResult = relationMiner.mineAll();

    // 发现高影响力节点
    const highInfluenceNodes = miningResult.networkMetrics
      .filter((n: NetworkMetrics) => n.influence > 0.7)
      .slice(0, 2);

    for (const node of highInfluenceNodes) {
      const degreePercent = Math.min(100, Math.round(node.degree * 100));
      const eigenvectorPercent = Math.min(100, Math.round(node.eigenvector * 100));
      const confidence = Math.min(1, node.influence);
      
      insights.push({
        id: `insight_influence_${node.nodeId}`,
        type: 'relationship',
        title: `${node.nodeName} - 关键影响节点`,
        description: `该节点度中心性 ${degreePercent}%，特征向量 ${eigenvectorPercent}%，是关键影响节点`,
        reasoningChain: {
          conclusion: `${node.nodeName}是网络中的关键枢纽`,
          evidence: [
            { source: '网络分析', observation: `度中心性 ${Math.min(1, node.degree).toFixed(2)}`, weight: 0.85 },
            { source: '特征向量', observation: `特征向量 ${Math.min(1, node.eigenvector).toFixed(2)}`, weight: 0.8 },
            { source: '介数中心性', observation: `介数中心性 ${Math.min(1, node.betweenness).toFixed(2)}`, weight: 0.75 },
          ],
          confidence: confidence,
          alternativeHypotheses: [],
          suggestedActions: [
            { actionName: '纳入核心KOL管理', priority: 'high', reason: '高影响力节点' },
          ],
        },
        confidence: confidence,
        impact: {
          entities: [node.nodeId],
          metrics: [
            { name: '影响力覆盖', change: Math.min(100, Math.round(node.influence * 100)) },
          ],
        },
        suggestedActions: [],
        createdAt: new Date(now.getTime() - 86400000),
        status: 'new',
      });
    }

    // 发现异常模式
    const highSeverityAnomalies = miningResult.anomalies
      .filter((a: AnomalyPattern) => a.severity === 'high')
      .slice(0, 1);

    for (const anomaly of highSeverityAnomalies) {
      insights.push({
        id: `insight_anomaly_${anomaly.id}`,
        type: 'anomaly',
        title: `${anomaly.type === 'outlier' ? '离群点' : anomaly.type === 'change_point' ? '变化点' : '罕见模式'}检测`,
        description: anomaly.description,
        reasoningChain: {
          conclusion: '检测到异常模式',
          evidence: [
            { source: '异常检测', observation: `类型: ${anomaly.type}`, weight: 0.9 },
            { source: '影响实体', observation: `${anomaly.affectedEntities.length} 个实体受影响`, weight: 0.7 },
          ],
          confidence: 0.85,
          alternativeHypotheses: [
            { hypothesis: '可能是数据录入错误', confidence: 0.2 },
          ],
          suggestedActions: [
            { actionName: '核实数据来源', priority: 'high', reason: '高严重性异常' },
          ],
        },
        confidence: 0.85,
        impact: {
          entities: anomaly.affectedEntities,
          metrics: [],
        },
        suggestedActions: [],
        createdAt: new Date(anomaly.detectedAt),
        status: 'new',
      });
    }

    // 3. 基于真实对象数据生成洞察
    const atRiskDoctors = state.objects.filter(obj =>
      obj.objectType === 'Doctor' && obj.status === 'critical'
    );

    if (atRiskDoctors.length > 0) {
      insights.push({
        id: 'insight_1',
        type: 'risk',
        title: '高风险客户流失预警',
        description: `检测到 ${atRiskDoctors.length} 位关键客户存在流失风险，处方量持续下降`,
        reasoningChain: {
          conclusion: '客户流失风险需要立即干预',
          evidence: [
            { source: '处方数据', observation: `${atRiskDoctors.length} 位医生处方量下降超过20%`, weight: 0.9 },
            { source: '行为分析', observation: '拜访频率不足，关系维护缺失', weight: 0.7 },
          ],
          confidence: 0.92,
          alternativeHypotheses: [
            { hypothesis: '可能是季节性波动', confidence: 0.15 },
          ],
          suggestedActions: [
            { actionName: '安排紧急拜访', priority: 'high', reason: '直接沟通了解问题' },
            { actionName: '启动学术活动', priority: 'medium', reason: '增强学术影响力' },
          ],
        },
        confidence: 0.92,
        impact: {
          entities: atRiskDoctors.slice(0, 3).map(d => d.id),
          metrics: [
            { name: '预计销售损失', change: -15 },
            { name: '客户留存率', change: -8 },
          ],
        },
        suggestedActions: [],
        createdAt: now,
        status: 'new',
      });
    }

    const lowPerformingReps = state.objects.filter(obj =>
      obj.objectType === 'SalesRep' && obj.properties.achievementRate < 80
    );

    if (lowPerformingReps.length > 0) {
      insights.push({
        id: 'insight_2',
        type: 'opportunity',
        title: '销售代表效能优化机会',
        description: `发现 ${lowPerformingReps.length} 位销售代表业绩低于预期，存在资源优化空间`,
        reasoningChain: {
          conclusion: '资源重新分配可提升整体业绩',
          evidence: [
            { source: '业绩数据', observation: '部分代表管理区域过多', weight: 0.85 },
            { source: '时间分析', observation: '高价值客户拜访时间不足', weight: 0.75 },
          ],
          confidence: 0.78,
          alternativeHypotheses: [],
          suggestedActions: [
            { actionName: '重新分配区域', priority: 'high', reason: '优化资源配置' },
          ],
        },
        confidence: 0.78,
        impact: {
          entities: lowPerformingReps.map(r => r.id),
          metrics: [
            { name: '预计业绩提升', change: 12 },
            { name: '资源利用率', change: 20 },
          ],
        },
        suggestedActions: [],
        createdAt: new Date(now.getTime() - 3600000),
        status: 'new',
      });
    }

    // 4. 趋势洞察 - 基于关联规则
    const strongRules = miningResult.associationRules
      .filter((r: AssociationRule) => r.confidence > 0.8 && r.lift > 1.5)
      .slice(0, 1);

    for (const rule of strongRules) {
      const ruleConfidence = Math.min(1, rule.confidence);
      insights.push({
        id: `insight_rule_${rule.id}`,
        type: 'trend',
        title: '业务关联规则发现',
        description: rule.description,
        reasoningChain: {
          conclusion: '存在强关联业务模式',
          evidence: [
            { source: '关联分析', observation: `置信度 ${(ruleConfidence * 100).toFixed(0)}%`, weight: 0.9 },
            { source: '提升度', observation: `Lift = ${rule.lift.toFixed(2)}`, weight: 0.85 },
            { source: '支持度', observation: `Support = ${(rule.support * 100).toFixed(1)}%`, weight: 0.7 },
          ],
          confidence: ruleConfidence,
          alternativeHypotheses: [],
          suggestedActions: [
            { actionName: '验证关联假设', priority: 'medium', reason: '高置信度关联' },
          ],
        },
        confidence: ruleConfidence,
        impact: {
          entities: [],
          metrics: [
            { name: '预测准确度', change: Math.min(50, Math.round(ruleConfidence * 100 - 50)) },
          ],
        },
        suggestedActions: [],
        createdAt: new Date(now.getTime() - 7200000),
        status: 'viewed',
      });
    }

    // 5. 隐藏关系洞察
    const unconfirmedRelations = miningResult.implicitRelations
      .filter((r: ImplicitRelation) => !r.confirmed)
      .slice(0, 1);

    for (const relation of unconfirmedRelations) {
      const relationConfidence = Math.min(1, relation.confidence);
      insights.push({
        id: `insight_hidden_${relation.id}`,
        type: 'relationship',
        title: `${relation.sourceName} → ${relation.targetName}`,
        description: `发现隐含${relation.relationType}关系，置信度 ${(relationConfidence * 100).toFixed(0)}%`,
        reasoningChain: {
          conclusion: `存在隐含的${relation.relationType}关系`,
          evidence: relation.evidence.map((e: string) => ({
            source: '隐关系挖掘',
            observation: e,
            weight: relationConfidence,
          })),
          confidence: relationConfidence,
          alternativeHypotheses: [
            { hypothesis: '可能是虚假关联', confidence: 1 - relationConfidence },
          ],
          suggestedActions: [
            { actionName: '验证关联真实性', priority: 'medium', reason: '未确认的隐含关系' },
          ],
        },
        confidence: relationConfidence,
        impact: {
          entities: [relation.sourceId, relation.targetId],
          metrics: [],
        },
        suggestedActions: [],
        createdAt: new Date(relation.createdAt),
        status: 'new',
      });
    }

    return insights;
  };

  const insights = generateInsights();
  const decisionScenarios = detectDecisionScenarios().filter(s => !dismissedDecisions.has(s.id));

  const filteredInsights = selectedType === 'all'
    ? insights
    : selectedType === 'decision'
    ? []
    : insights.filter(i => i.type === selectedType);

  const getTypeIcon = (type: InsightType) => {
    switch (type) {
      case 'risk': return <AlertTriangle className="text-red-500" size={20} />;
      case 'opportunity': return <TrendingUp className="text-green-500" size={20} />;
      case 'anomaly': return <AlertTriangle className="text-orange-500" size={20} />;
      case 'trend': return <TrendingUp className="text-blue-500" size={20} />;
      case 'relationship': return <Link2 className="text-purple-500" size={20} />;
    }
  };

  const getTypeColor = (type: InsightType, isSelected: boolean) => {
    switch (type) {
      case 'risk': return `glass-card border-l-4 border-rose-500 ${isSelected ? 'shadow-glow-red ring-1 ring-rose-500/30' : 'hover:shadow-glow-red'}`;
      case 'opportunity': return `glass-card border-l-4 border-emerald-500 ${isSelected ? 'shadow-glow-green ring-1 ring-emerald-500/30' : 'hover:shadow-glow-green'}`;
      case 'anomaly': return `glass-card border-l-4 border-orange-500 ${isSelected ? 'shadow-glow-orange ring-1 ring-orange-500/30' : 'hover:shadow-glow-orange'}`;
      case 'trend': return `glass-card border-l-4 border-brand-500 ${isSelected ? 'shadow-glow ring-1 ring-brand-500/30' : 'hover:shadow-glow'}`;
      case 'relationship': return `glass-card border-l-4 border-purple-500 ${isSelected ? 'shadow-glow-purple ring-1 ring-purple-500/30' : 'hover:shadow-glow-purple'}`;
    }
  };

  const getTypeLabel = (type: InsightType | 'decision') => {
    switch (type) {
      case 'risk': return '风险';
      case 'opportunity': return '机会';
      case 'anomaly': return '异常';
      case 'trend': return '趋势';
      case 'relationship': return '关系';
      case 'decision': return '决策';
      default: return type;
    }
  };

  const getStatusBadge = (status: Insight['status']) => {
    switch (status) {
      case 'new': return <span className="text-xs px-2 py-0.5 rounded bg-brand-500/10 text-brand-400">新</span>;
      case 'viewed': return <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-800">已查看</span>;
      case 'acted': return <span className="text-xs px-2 py-0.5 rounded bg-white0/10 text-emerald-400">已行动</span>;
      case 'dismissed': return <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-800">已忽略</span>;
    }
  };

  const handleDismissDecision = (id: string) => {
    setDismissedDecisions(prev => new Set([...prev, id]));
  };

  const handleExecuteDecision = (_scenario: DecisionScenario) => {
    handleDismissDecision(_scenario.id);
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-700 flex items-center">
            <Sparkles className="mr-3 text-brand-600" />
            智能洞察
          </h2>
          <p className="text-gray-800 mt-1">AI自动发现的业务洞察和智能推荐</p>
        </div>
        <div className="flex items-center space-x-2">
          <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors" title="刷新">
            <RefreshCw size={18} className="text-gray-800" />
          </button>
          <button className="p-2 hover:bg-gray-50 rounded-lg transition-colors" title="筛选">
            <Filter size={18} className="text-gray-800" />
          </button>
        </div>
      </div>

      <div className="flex space-x-2 flex-wrap gap-2">
        {(['all', 'risk', 'opportunity', 'trend', 'relationship', 'decision'] as const).map(type => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedType === type
                ? 'bg-brand-500 text-white shadow-md'
                : 'bg-white text-gray-800 hover:bg-gray-50 border border-gray-100'
            }`}
          >
            {type === 'all' ? '全部' : getTypeLabel(type)}
            <span className="ml-2 text-xs opacity-75">
              ({type === 'all'
                ? insights.length + decisionScenarios.length
                : type === 'decision'
                ? decisionScenarios.length
                : insights.filter(i => i.type === type).length
              })
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex space-x-4">
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          <AnimatePresence>
            {/* 决策洞察卡片 - 主动推送 */}
            {(selectedType === 'all' || selectedType === 'decision') && decisionScenarios.map((scenario, index) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
              >
                <DecisionInsightCard
                  scenario={scenario}
                  onDismiss={() => handleDismissDecision(scenario.id)}
                  onExecute={() => handleExecuteDecision(scenario)}
                  onViewDetails={() => {}}
                />
              </motion.div>
            ))}

            {/* 传统洞察 */}
            {filteredInsights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: (decisionScenarios.length + index) * 0.05 }}
                onClick={() => setSelectedInsight(insight)}
                className={`p-4 rounded-xl cursor-pointer transition-all ${getTypeColor(insight.type, selectedInsight?.id === insight.id)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getTypeIcon(insight.type)}
                    <span className="text-xs font-medium text-gray-800 uppercase">
                      {getTypeLabel(insight.type)}洞察
                    </span>
                    {getStatusBadge(insight.status)}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-800">
                      置信度: {(insight.confidence * 100).toFixed(0)}%
                    </span>
                    <ChevronRight size={16} className="text-gray-800" />
                  </div>
                </div>
                <h3 className="text-base font-bold text-gray-700 mb-1">{insight.title}</h3>
                <p className="text-sm text-gray-800">{insight.description}</p>
                <div className="flex items-center mt-3 text-xs text-gray-800">
                  <Clock size={12} className="mr-1" />
                  {insight.createdAt.toLocaleString('zh-CN')}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredInsights.length === 0 && decisionScenarios.length === 0 && (
            <div className="text-center py-12 text-gray-800">
              <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
              <p>暂无相关洞察</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {selectedInsight && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden flex-shrink-0"
            >
              <div className="p-6 h-full overflow-y-auto">
                <div className="flex items-center space-x-2 mb-4">
                  {getTypeIcon(selectedInsight.type)}
                  <span className="text-xs font-medium text-gray-800 uppercase">
                    {getTypeLabel(selectedInsight.type)}洞察详情
                  </span>
                </div>

                <h3 className="text-lg font-bold text-gray-700 mb-2">{selectedInsight.title}</h3>
                <p className="text-sm text-gray-800 mb-6">{selectedInsight.description}</p>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">推理链</h4>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">{selectedInsight.reasoningChain.conclusion}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">证据</h4>
                    <div className="space-y-2">
                      {selectedInsight.reasoningChain.evidence.map((evidence, idx) => (
                        <div key={idx} className="flex items-start space-x-2 p-2 bg-gray-50 rounded">
                          <div className="w-5 h-5 rounded-full bg-brand-500/10 text-brand-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="text-xs text-gray-800">{evidence.source}</div>
                            <div className="text-sm text-gray-600">{evidence.observation}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">预期影响</h4>
                    <div className="space-y-2">
                      {selectedInsight.impact.metrics.map((metric, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm text-gray-600">{metric.name}</span>
                          <span className={`text-sm font-bold ${metric.change > 0 ? 'text-emerald-400' : 'text-rose-700'}`}>
                            {metric.change > 0 ? '+' : ''}{metric.change}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-800 uppercase mb-2">建议行动</h4>
                    <div className="space-y-2">
                      {selectedInsight.reasoningChain.suggestedActions.map((action, idx) => (
                        <div key={idx} className="p-3 bg-brand-500/5 rounded-lg border border-brand-600/20">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{action.actionName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              action.priority === 'high' ? 'bg-white text-rose-700' : 'bg-white/5 text-gray-800'
                            }`}>
                              {action.priority === 'high' ? '高' : '中'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-800">{action.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 mt-6">
                  <button className="flex-1 px-4 py-2 bg-white/5 text-gray-600 text-sm font-medium rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center space-x-1">
                    <XCircle size={16} />
                    <span>忽略</span>
                  </button>
                  <button className="flex-1 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition-colors flex items-center justify-center space-x-1">
                    <CheckCircle size={16} />
                    <span>立即行动</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InsightEngine;

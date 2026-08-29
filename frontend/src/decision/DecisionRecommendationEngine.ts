import {
  DecisionContext,
  DecisionScenario,
  DecisionAlternative,
  DecisionRecommendation,
  Criterion,
  Explanation,
  ImpactAssessment,
  ImplementationStep,
  DecisionDomain,
  DecisionStatus,
} from './DecisionOntology';
import { TemporalReasoningEngine, SpatialReasoningEngine } from '../inference';
import { CausalReasoningEngine } from '../inference';
import { AnalogicalReasoningEngine } from '../inference';
import { ReasoningChain } from '../types';

// ============================================
// 评估结果
// ============================================

export interface EvaluationResult {
  alternativeId: string;
  scores: { [criterionId: string]: number };
  overallScore: number;
  ranking: number;
  strengths: string[];
  weaknesses: string[];
}

// Reasoning step for building reasoning chain
interface ReasoningStep {
  step: number;
  type: 'deduction' | 'induction' | 'abduction';
  description: string;
  premise: string;
  conclusion: string;
  confidence: number;
}

// ============================================
// 决策推荐引擎
// ============================================

export class DecisionRecommendationEngine {
  // Inference engines for decision support - initialized for future use
  private _inferenceEngines: {
    temporal: TemporalReasoningEngine;
    spatial: SpatialReasoningEngine;
    causal: CausalReasoningEngine;
    analogical: AnalogicalReasoningEngine;
  };

  constructor() {
    this._inferenceEngines = {
      temporal: new TemporalReasoningEngine(),
      spatial: new SpatialReasoningEngine(),
      causal: new CausalReasoningEngine(),
      analogical: new AnalogicalReasoningEngine(),
    };
  }

  /**
   * Get inference engines for advanced decision analysis
   */
  getInferenceEngines() {
    return this._inferenceEngines;
  }

  /**
   * 生成决策场景
   */
  generateDecisionScenarios(context: DecisionContext): DecisionScenario[] {
    const scenarios: DecisionScenario[] = [];

    // 根据决策域生成特定场景
    switch (context.domain) {
      case DecisionDomain.REVENUE:
        scenarios.push(...this.generateRevenueScenarios(context));
        break;
      case DecisionDomain.CUSTOMER:
        scenarios.push(...this.generateCustomerScenarios(context));
        break;
      case DecisionDomain.EXPENSE:
        scenarios.push(...this.generateExpenseScenarios(context));
        break;
      case DecisionDomain.MEDICAL_AFFAIRS:
        scenarios.push(...this.generateMedicalAffairsScenarios(context));
        break;
      case DecisionDomain.COMPLIANCE:
        scenarios.push(...this.generateComplianceScenarios(context));
        break;
    }

    return scenarios;
  }

  /**
   * 生成收入管理决策场景
   */
  private generateRevenueScenarios(context: DecisionContext): DecisionScenario[] {
    const scenarios: DecisionScenario[] = [];

    // 场景1: 目标达成策略
    scenarios.push({
      id: `scenario_${Date.now()}_1`,
      name: '销售目标达成策略',
      description: '针对当前销售目标达成情况，制定提升策略',
      context,
      alternatives: this.generateRevenueAlternatives(context),
      evaluationCriteria: this.generateRevenueCriteria(),
      confidence: 0.85,
      status: DecisionStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 场景2: 资源分配优化
    scenarios.push({
      id: `scenario_${Date.now()}_2`,
      name: '销售资源分配优化',
      description: '优化销售资源在不同区域/产品间的分配',
      context,
      alternatives: this.generateResourceAllocationAlternatives(context),
      evaluationCriteria: this.generateResourceCriteria(),
      confidence: 0.80,
      status: DecisionStatus.PENDING,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return scenarios;
  }

  /**
   * 生成收入管理替代方案
   */
  private generateRevenueAlternatives(_context: DecisionContext): DecisionAlternative[] {
    return [
      {
        id: `alt_${Date.now()}_1`,
        name: '加强重点客户拜访',
        description: '增加A/B类客户的拜访频次，提升客户满意度',
        actions: [
          {
            id: 'action_1',
            name: '增加拜访频次',
            description: '将A类客户拜访频次提升至每周2次',
            actionType: 'visit_increase',
            parameters: { targetCategory: 'A', frequency: 2 },
            expectedImpact: '提升客户满意度和处方量',
            timeline: '1个月',
            dependencies: [],
          },
        ],
        expectedOutcomes: [
          {
            metric: 'prescription_volume',
            currentValue: 100,
            predictedValue: 120,
            confidenceInterval: [115, 125],
            probability: 0.8,
          },
        ],
        risks: [
          {
            id: 'risk_1',
            description: '客户时间冲突导致拜访效果不佳',
            probability: 0.3,
            impact: 30,
            mitigation: ['提前预约', '灵活安排时间'],
            contingency: '转为线上沟通',
          },
        ],
        resourceRequirements: [
          { type: 'time', amount: 20, unit: 'hours', availability: 'available' },
        ],
      },
      {
        id: `alt_${Date.now()}_2`,
        name: '学术活动推广',
        description: '组织学术会议提升产品认知度',
        actions: [
          {
            id: 'action_2',
            name: '组织学术会议',
            description: '举办区域性学术研讨会',
            actionType: 'academic_event',
            parameters: { scale: 'regional', topic: 'clinical_application' },
            expectedImpact: '提升产品知名度和医生认可度',
            timeline: '2个月',
            dependencies: ['action_1'],
          },
        ],
        expectedOutcomes: [
          {
            metric: 'market_awareness',
            currentValue: 60,
            predictedValue: 75,
            confidenceInterval: [70, 80],
            probability: 0.75,
          },
        ],
        risks: [
          {
            id: 'risk_2',
            description: '参会人数不达预期',
            probability: 0.4,
            impact: 40,
            mitigation: ['提前邀请', '提供 incentives'],
            contingency: '改为线上会议',
          },
        ],
        resourceRequirements: [
          { type: 'budget', amount: 50000, unit: 'CNY', availability: 'limited' },
        ],
      },
    ];
  }

  /**
   * 生成资源分配替代方案
   */
  private generateResourceAllocationAlternatives(context: DecisionContext): DecisionAlternative[] {
    const targets = context.relatedEntities?.filter(e => e.objectType === 'SalesTarget') || [];
    const underperforming = targets.filter(t => {
      const rate = t.properties?.achievement_rate;
      return rate != null && rate < 90;
    });

    if (underperforming.length === 0) return [];

    return [
      {
        id: 'ra_alt1',
        name: '重点区域资源倾斜',
        description: '将资源从高达成率区域调配至低达成率区域',
        actions: [],
        expectedOutcomes: underperforming.slice(0, 3).map((t: any, i: number) => ({
          metric: t.name || `目标${i + 1}`,
          currentValue: t.properties?.achievement_rate || 0,
          predictedValue: (t.properties?.target_value || 0) * 0.15,
          confidenceInterval: [0.1, 0.2] as [number, number],
          probability: 0.7,
        })),
        risks: [{ id: 'r1', description: '高达成率区域可能下滑', probability: 0.3, impact: 40, mitigation: ['设定监控阈值'], contingency: '恢复原分配' }],
        resourceRequirements: [{ type: 'budget' as const, amount: 500000, unit: 'CNY', availability: 'available' as const }],
      },
      {
        id: 'ra_alt2',
        name: '增量资源投入',
        description: '在不减少现有资源分配的基础上，增加对低达成率区域的投入',
        actions: [],
        expectedOutcomes: underperforming.slice(0, 2).map((t: any, i: number) => ({
          metric: t.name || `目标${i + 1}`,
          currentValue: t.properties?.achievement_rate || 0,
          predictedValue: (t.properties?.target_value || 0) * 0.08,
          confidenceInterval: [0.05, 0.12] as [number, number],
          probability: 0.6,
        })),
        risks: [{ id: 'r2', description: '总预算超支', probability: 0.4, impact: 30, mitigation: ['分阶段投入'], contingency: '削减非核心支出' }],
        resourceRequirements: [{ type: 'budget' as const, amount: 800000, unit: 'CNY', availability: 'limited' as const }],
      },
    ];
  }

  /**
   * 生成收入管理评估标准
   */
  private generateRevenueCriteria(): Criterion[] {
    return [
      { id: 'c1', name: '预期收益', description: '预计带来的收入增长', weight: 0.4, type: 'benefit', scale: 'numeric', minValue: 0, maxValue: 100 },
      { id: 'c2', name: '实施成本', description: '实施所需资源投入', weight: 0.2, type: 'cost', scale: 'numeric', minValue: 0, maxValue: 100 },
      { id: 'c3', name: '实施难度', description: '实施的复杂程度', weight: 0.15, type: 'cost', scale: 'numeric', minValue: 0, maxValue: 100 },
      { id: 'c4', name: '风险水平', description: '实施风险大小', weight: 0.15, type: 'risk', scale: 'numeric', minValue: 0, maxValue: 100 },
      { id: 'c5', name: '时间周期', description: '见效所需时间', weight: 0.1, type: 'cost', scale: 'numeric', minValue: 0, maxValue: 100 },
    ];
  }

  /**
   * 生成资源评估标准
   */
  private generateResourceCriteria(): Criterion[] {
    return [
      { id: 'r1', name: 'ROI', description: '投资回报率', weight: 0.35, type: 'benefit', scale: 'numeric' },
      { id: 'r2', name: '资源效率', description: '资源利用效率', weight: 0.25, type: 'benefit', scale: 'numeric' },
      { id: 'r3', name: '公平性', description: '分配公平程度', weight: 0.2, type: 'benefit', scale: 'numeric' },
      { id: 'r4', name: '灵活性', description: '调整灵活性', weight: 0.2, type: 'benefit', scale: 'numeric' },
    ];
  }

  /**
   * 生成客户管理决策场景
   */
  private generateCustomerScenarios(context: DecisionContext): DecisionScenario[] {
    const doctors = context.relatedEntities?.filter((e: any) => e.objectType === 'Doctor') || [];
    const atRisk = doctors.filter((d: any) => d.lifecycleStage === 'at_risk' || d.status === 'warning');

    if (atRisk.length === 0) return [];

    return [{
      id: 'cs_customer_retention',
      name: '客户挽留策略',
      description: `${atRisk.length} 位医生处于风险状态，需要制定挽留策略`,
      context,
      alternatives: [
        {
          id: 'cs_alt1',
          name: '加强拜访频次',
          description: '增加对风险医生的拜访频率，提供个性化学术支持',
          actions: [],
          expectedOutcomes: [{ metric: '客户留存率', currentValue: 0.6, predictedValue: 0.85, confidenceInterval: [0.75, 0.95] as [number, number], probability: 0.75 }],
          risks: [{ id: 'csr1', description: '拜访效果不佳', probability: 0.25, impact: 30, mitigation: ['调整拜访策略'], contingency: '更换拜访方式' }],
          resourceRequirements: [{ type: 'budget' as const, amount: 200000, unit: 'CNY', availability: 'available' as const }],
        },
        {
          id: 'cs_alt2',
          name: '学术活动深化',
          description: '邀请风险医生参与学术会议和研讨，增强粘性',
          actions: [],
          expectedOutcomes: [{ metric: '客户满意度', currentValue: 0.7, predictedValue: 0.9, confidenceInterval: [0.8, 1.0] as [number, number], probability: 0.65 }],
          risks: [{ id: 'csr2', description: '学术活动参与度低', probability: 0.35, impact: 25, mitigation: ['个性化邀请策略'], contingency: '缩小活动规模' }],
          resourceRequirements: [{ type: 'budget' as const, amount: 350000, unit: 'CNY', availability: 'limited' as const }],
        },
      ],
      evaluationCriteria: [
        { id: 'cc1', name: '客户留存率提升', description: '挽留成功率', weight: 0.4, type: 'benefit', scale: 'numeric' },
        { id: 'cc2', name: '实施成本', description: '策略实施成本', weight: 0.3, type: 'cost', scale: 'numeric' },
        { id: 'cc3', name: '见效速度', description: '策略见效时间', weight: 0.3, type: 'benefit', scale: 'numeric' },
      ],
      confidence: 0.7,
      status: 'pending' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }

  private generateExpenseScenarios(context: DecisionContext): DecisionScenario[] {
    const budgets = context.relatedEntities?.filter((e: any) => e.objectType === 'BudgetCategory') || [];

    return [{
      id: 'cs_expense_optimization',
      name: '费用结构优化',
      description: `当前 ${budgets.length} 个预算分类，需要优化费用结构`,
      context,
      alternatives: [
        {
          id: 'ex_alt1',
          name: '高ROI项目优先',
          description: '优先投入高投资回报率的项目，削减低效支出',
          actions: [],
          expectedOutcomes: [{ metric: '整体ROI', currentValue: 0.15, predictedValue: 0.25, confidenceInterval: [0.2, 0.3] as [number, number], probability: 0.7 }],
          risks: [{ id: 'exr1', description: '部分项目短期受影响', probability: 0.3, impact: 20, mitigation: ['渐进式调整'], contingency: '恢复原预算' }],
          resourceRequirements: [{ type: 'budget' as const, amount: 0, unit: 'CNY', availability: 'available' as const }],
        },
      ],
      evaluationCriteria: [
        { id: 'ec1', name: 'ROI提升', description: '投资回报率提升幅度', weight: 0.5, type: 'benefit', scale: 'numeric' },
        { id: 'ec2', name: '业务影响', description: '对核心业务的影响', weight: 0.3, type: 'risk', scale: 'numeric' },
        { id: 'ec3', name: '实施难度', description: '调整实施难度', weight: 0.2, type: 'cost', scale: 'numeric' },
      ],
      confidence: 0.65,
      status: 'pending' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }

  private generateMedicalAffairsScenarios(context: DecisionContext): DecisionScenario[] {
    const events = context.relatedEntities?.filter((e: any) => e.objectType === 'AcademicEvent') || [];
    const projects = context.relatedEntities?.filter((e: any) => e.objectType === 'RWSProject') || [];

    return [{
      id: 'cs_medical_strategy',
      name: '医学事务策略优化',
      description: `${events.length} 个学术活动，${projects.length} 个RWS项目，需要优化医学事务投入`,
      context,
      alternatives: [
        {
          id: 'ma_alt1',
          name: '聚焦核心KOL',
          description: '集中资源服务核心意见领袖，提升学术影响力',
          actions: [],
          expectedOutcomes: [{ metric: 'KOL参与度', currentValue: 0.5, predictedValue: 0.9, confidenceInterval: [0.7, 1.0] as [number, number], probability: 0.7 }],
          risks: [{ id: 'mar1', description: '覆盖面缩小', probability: 0.35, impact: 25, mitigation: ['保持基础覆盖'], contingency: '扩大覆盖范围' }],
          resourceRequirements: [{ type: 'budget' as const, amount: 300000, unit: 'CNY', availability: 'limited' as const }],
        },
      ],
      evaluationCriteria: [
        { id: 'mc1', name: '学术影响力', description: 'KOL学术影响力提升', weight: 0.4, type: 'benefit', scale: 'numeric' },
        { id: 'mc2', name: '投入产出比', description: '医学事务投入产出', weight: 0.35, type: 'benefit', scale: 'numeric' },
        { id: 'mc3', name: '合规风险', description: '医学活动合规风险', weight: 0.25, type: 'risk', scale: 'numeric' },
      ],
      confidence: 0.6,
      status: 'pending' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }

  private generateComplianceScenarios(context: DecisionContext): DecisionScenario[] {
    const alerts = context.relatedEntities?.filter((e: any) => e.objectType === 'ComplianceAlert') || [];

    return [{
      id: 'cs_compliance_enhancement',
      name: '合规风险管控',
      description: `当前 ${alerts.length} 条合规告警，需要加强合规管控`,
      context,
      alternatives: [
        {
          id: 'co_alt1',
          name: '主动合规审查',
          description: '对所有费用和活动进行主动合规审查',
          actions: [],
          expectedOutcomes: [{ metric: '合规违规率', currentValue: 0.3, predictedValue: -0.5, confidenceInterval: [-0.7, -0.3] as [number, number], probability: 0.8 }],
          risks: [{ id: 'cor1', description: '业务流程变慢', probability: 0.4, impact: 20, mitigation: ['优化审查流程'], contingency: '简化流程' }],
          resourceRequirements: [{ type: 'budget' as const, amount: 150000, unit: 'CNY', availability: 'available' as const }],
        },
        {
          id: 'co_alt2',
          name: '合规培训强化',
          description: '加强全员合规培训，提升合规意识',
          actions: [],
          expectedOutcomes: [{ metric: '合规知晓率', currentValue: 0.6, predictedValue: 0.95, confidenceInterval: [0.85, 1.0] as [number, number], probability: 0.75 }],
          risks: [{ id: 'cor2', description: '培训效果有限', probability: 0.2, impact: 15, mitigation: ['考核机制'], contingency: '加强实操演练' }],
          resourceRequirements: [{ type: 'budget' as const, amount: 80000, unit: 'CNY', availability: 'available' as const }],
        },
      ],
      evaluationCriteria: [
        { id: 'coc1', name: '合规风险降低', description: '违规事件减少率', weight: 0.45, type: 'benefit', scale: 'numeric' },
        { id: 'coc2', name: '实施成本', description: '合规措施成本', weight: 0.25, type: 'cost', scale: 'numeric' },
        { id: 'coc3', name: '业务影响', description: '对业务效率的影响', weight: 0.3, type: 'risk', scale: 'numeric' },
      ],
      confidence: 0.75,
      status: 'pending' as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }];
  }

  /**
   * 评估替代方案
   */
  evaluateAlternatives(
    alternatives: DecisionAlternative[],
    criteria: Criterion[]
  ): EvaluationResult[] {
    const results: EvaluationResult[] = [];

    alternatives.forEach(alt => {
      const scores: { [criterionId: string]: number } = {};
      let overallScore = 0;
      const strengths: string[] = [];
      const weaknesses: string[] = [];

      criteria.forEach(criterion => {
        const score = this.evaluateCriterion(alt, criterion);
        scores[criterion.id] = score;

        // 根据准则类型调整权重影响
        const weight = criterion.type === 'cost' || criterion.type === 'risk' ? -criterion.weight : criterion.weight;
        overallScore += score * weight;

        // 识别优势和劣势
        if (score >= 0.8) {
          strengths.push(`${criterion.name}: 表现优秀 (${(score * 100).toFixed(0)}%)`);
        } else if (score <= 0.4) {
          weaknesses.push(`${criterion.name}: 需要改进 (${(score * 100).toFixed(0)}%)`);
        }
      });

      results.push({
        alternativeId: alt.id,
        scores,
        overallScore: Math.max(0, overallScore),
        ranking: 0, // 稍后计算
        strengths,
        weaknesses,
      });
    });

    // 计算排名
    results.sort((a, b) => b.overallScore - a.overallScore);
    results.forEach((result, index) => {
      result.ranking = index + 1;
    });

    return results;
  }

  /**
   * 评估单个准则
   */
  private evaluateCriterion(alternative: DecisionAlternative, criterion: Criterion): number {
    // 简化的评估逻辑，实际应用中可以根据具体准则设计更复杂的评估
    switch (criterion.name) {
      case '预期收益':
        return this.calculateExpectedBenefit(alternative);
      case '实施成本':
        return this.calculateImplementationCost(alternative);
      case '风险水平':
        return this.calculateRiskLevel(alternative);
      case '时间周期':
        return this.calculateTimeEfficiency(alternative);
      default:
        return 0.5;
    }
  }

  /**
   * 计算预期收益
   */
  private calculateExpectedBenefit(alternative: DecisionAlternative): number {
    if (!alternative.expectedOutcomes || alternative.expectedOutcomes.length === 0) {
      return 0.5;
    }

    const avgImprovement = alternative.expectedOutcomes.reduce((sum, outcome) => {
      const improvement = outcome.currentValue > 0
        ? (outcome.predictedValue - outcome.currentValue) / outcome.currentValue
        : 0;
      return sum + improvement;
    }, 0) / alternative.expectedOutcomes.length;

    return Math.min(1, Math.max(0, 0.5 + avgImprovement));
  }

  /**
   * 计算实施成本
   */
  private calculateImplementationCost(alternative: DecisionAlternative): number {
    if (!alternative.resourceRequirements || alternative.resourceRequirements.length === 0) {
      return 0.5;
    }

    const totalCost = alternative.resourceRequirements.reduce((sum, req) => {
      return sum + (req.type === 'budget' ? req.amount : 0);
    }, 0);

    // 归一化成本评分（假设最大成本为100000）
    return Math.max(0, 1 - totalCost / 100000);
  }

  /**
   * 计算风险水平
   */
  private calculateRiskLevel(alternative: DecisionAlternative): number {
    if (!alternative.risks || alternative.risks.length === 0) {
      return 0.8; // 无风险视为低风险
    }

    const avgRisk = alternative.risks.reduce((sum, risk) => {
      return sum + risk.probability * (risk.impact / 100);
    }, 0) / alternative.risks.length;

    return Math.max(0, 1 - avgRisk);
  }

  /**
   * 计算时间效率
   */
  private calculateTimeEfficiency(alternative: DecisionAlternative): number {
    const actionCount = alternative.actions?.length || 1;
    const hasDependencies = alternative.actions?.some(a => a.dependencies?.length > 0);
    const baseEfficiency = 0.8;
    const actionPenalty = Math.min(0.3, actionCount * 0.05);
    const dependencyPenalty = hasDependencies ? 0.1 : 0;
    return Math.max(0.3, baseEfficiency - actionPenalty - dependencyPenalty);
  }

  /**
   * 生成推荐
   */
  generateRecommendation(scenario: DecisionScenario): DecisionRecommendation {
    // 评估所有替代方案
    const evaluationResults = this.evaluateAlternatives(
      scenario.alternatives,
      scenario.evaluationCriteria
    );

    // 找到最佳替代方案
    const bestResult = evaluationResults[0];
    const recommendedAlternative = scenario.alternatives.find(
      alt => alt.id === bestResult.alternativeId
    )!;

    // 构建推理链
    const reasoningChain = this.buildReasoningChain(scenario, bestResult);

    // 评估影响
    const expectedImpact = this.assessImpact(recommendedAlternative);

    // 生成实施计划
    const implementationPlan = this.generateImplementationPlan(recommendedAlternative);

    return {
      id: `rec_${Date.now()}`,
      scenario,
      recommendedAlternative,
      confidence: scenario.confidence * bestResult.overallScore,
      reasoningChain,
      expectedImpact,
      implementationPlan,
      createdAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天有效期
    };
  }

  /**
   * 构建推理链
   */
  private buildReasoningChain(scenario: DecisionScenario, bestResult: EvaluationResult): ReasoningChain {
    const reasoningSteps: ReasoningStep[] = [
      {
        step: 1,
        type: 'deduction',
        description: '分析决策上下文',
        premise: `决策类型: ${scenario.context.type}, 领域: ${scenario.context.domain}`,
        conclusion: `识别出 ${scenario.alternatives.length} 个可行方案`,
        confidence: 0.9,
      },
      {
        step: 2,
        type: 'induction',
        description: '评估各方案',
        premise: `基于 ${scenario.evaluationCriteria.length} 个评估准则`,
        conclusion: `方案 ${bestResult.alternativeId} 综合得分最高: ${(bestResult.overallScore * 100).toFixed(1)}%`,
        confidence: bestResult.overallScore,
      },
      {
        step: 3,
        type: 'abduction',
        description: '生成推荐',
        premise: `方案 ${bestResult.alternativeId} 在 ${bestResult.strengths.length} 个方面表现优秀`,
        conclusion: '推荐该方案作为最优选择',
        confidence: scenario.confidence,
      },
    ];

    // Build reasoning chain evidence
    const evidence = reasoningSteps.map(s => ({
      source: s.type,
      observation: s.description,
      weight: s.confidence,
    }));

    // Build suggested actions from the best alternative
    const suggestedActions = scenario.alternatives
      .find(a => a.id === bestResult.alternativeId)
      ?.actions.map(a => ({
        actionName: a.name,
        priority: 'high' as const,
        reason: a.expectedImpact,
      })) || [];

    return {
      conclusion: `推荐方案: ${bestResult.alternativeId}`,
      evidence,
      confidence: reasoningSteps.reduce((sum, s) => sum + s.confidence, 0) / reasoningSteps.length,
      alternativeHypotheses: scenario.alternatives
        .filter(a => a.id !== bestResult.alternativeId)
        .map(a => ({ hypothesis: a.name, confidence: 0.5 })),
      suggestedActions,
    };
  }

  /**
   * 评估影响
   */
  private assessImpact(alternative: DecisionAlternative): ImpactAssessment {
    const revenue = alternative.expectedOutcomes?.reduce((sum, o) => sum + o.predictedValue, 0) || 0;
    const cost = alternative.resourceRequirements?.reduce((sum, r) => sum + (r.type === 'budget' ? r.amount : 0), 0) || 0;
    const roi = cost > 0 ? (revenue - cost) / cost : 0;
    const riskTotal = alternative.risks?.reduce((sum, r) => sum + r.probability * r.impact, 0) || 0;

    return {
      financial: {
        revenue,
        cost,
        roi,
        paybackPeriod: roi > 0 ? Math.ceil(cost / (revenue / 12)) : 999,
        npv: revenue - cost * 1.1,
      },
      operational: {
        efficiency: Math.min(0.3, alternative.expectedOutcomes?.length ? alternative.expectedOutcomes.reduce((s, o) => s + o.probability, 0) / alternative.expectedOutcomes.length * 0.3 : 0.1),
        quality: Math.min(0.25, (1 - riskTotal / 100) * 0.25),
        speed: alternative.expectedOutcomes?.[0]?.confidenceInterval?.[1] != null ? (alternative.expectedOutcomes[0].confidenceInterval[1] > 0.8 ? 0.3 : 0.2) : 0.1,
        resourceUtilization: cost > 0 ? Math.min(0.3, revenue / cost * 0.1) : 0.05,
      },
      strategic: {
        marketPosition: alternative.expectedOutcomes?.some(o => o.metric?.includes('市场份额')) ? 0.15 : 0.05,
        competitiveAdvantage: alternative.risks?.length ? Math.max(0.05, 0.2 - alternative.risks.length * 0.03) : 0.1,
        capabilityBuilding: alternative.actions?.length ? Math.min(0.2, alternative.actions.length * 0.05) : 0.08,
        alignment: alternative.expectedOutcomes?.some(o => o.probability > 0.7) ? 0.85 : 0.6,
      },
      risk: {
        overallRisk: riskTotal,
        riskBreakdown: (alternative.risks || []).reduce((acc, r, i) => ({ ...acc, [`risk_${i}`]: r.probability * r.impact }), {}),
        mitigationEffectiveness: alternative.risks?.length ? Math.max(0.4, 1 - alternative.risks.reduce((s, r) => s + r.probability, 0) / alternative.risks.length) : 0.9,
      },
    };
  }

  /**
   * 生成实施计划
   */
  private generateImplementationPlan(alternative: DecisionAlternative): ImplementationStep[] {
    return alternative.actions.map((action, index) => ({
      step: index + 1,
      name: action.name,
      description: action.description,
      duration: action.dependencies?.length ? 14 : 7,
      dependencies: action.dependencies.map(d => parseInt(d.split('_')[1])),
      responsible: '待分配',
      deliverables: [`${action.name}完成报告`],
      milestones: [
        {
          name: `${action.name}启动`,
          targetDate: new Date(Date.now() + index * 7 * 24 * 60 * 60 * 1000).toISOString(),
          criteria: ['资源到位', '团队准备就绪'],
        },
      ],
    }));
  }

  /**
   * 解释推荐
   */
  explainRecommendation(recommendation: DecisionRecommendation): Explanation {
    const reasoning = recommendation.reasoningChain.evidence.map((evidenceItem, index) => ({
      step: index + 1,
      description: evidenceItem.observation || '推理步骤',
      premise: evidenceItem.source,
      conclusion: recommendation.recommendedAlternative.name,
      confidence: evidenceItem.weight || recommendation.confidence,
    }));

    const evidence = [
      {
        type: 'data' as const,
        source: '历史数据分析',
        content: `基于 ${recommendation.scenario.context.historicalDecisions.length} 个历史决策`,
        reliability: 0.85,
      },
      {
        type: 'model' as const,
        source: '多准则决策模型',
        content: `综合评估了 ${recommendation.scenario.evaluationCriteria.length} 个准则`,
        reliability: 0.8,
      },
    ];

    return {
      summary: `推荐方案: ${recommendation.recommendedAlternative.name}，置信度: ${(recommendation.confidence * 100).toFixed(1)}%`,
      reasoning,
      evidence,
      confidence: recommendation.confidence,
    };
  }
}

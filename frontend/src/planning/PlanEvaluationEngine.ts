import { ActionSequence } from './ActionSequenceGenerator';

export interface SuccessRateEstimate {
  overall: number;
  byFactor: Record<string, number>;
  confidence: number;
  riskFactors: RiskFactor[];
  improvementSuggestions: string[];
}

export interface RiskFactor {
  id: string;
  name: string;
  description: string;
  probability: number;
  impact: number;
  riskScore: number;
  mitigation: string;
  category: 'internal' | 'external' | 'resource' | 'dependency';
}

export interface RiskAssessment {
  overallRisk: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: RiskFactor[];
  riskMatrix: RiskMatrix;
  mitigationPlan: MitigationPlan;
}

export interface RiskMatrix {
  lowImpact: { lowProb: number; medProb: number; highProb: number };
  mediumImpact: { lowProb: number; medProb: number; highProb: number };
  highImpact: { lowProb: number; medProb: number; highProb: number };
}

export interface MitigationPlan {
  strategies: MitigationStrategy[];
  contingencyPlans: ContingencyPlan[];
  monitoringPoints: MonitoringPoint[];
}

export interface MitigationStrategy {
  riskId: string;
  strategy: string;
  cost: number;
  effectiveness: number;
  implementation: string[];
}

export interface ContingencyPlan {
  trigger: string;
  actions: string[];
  responsible: string;
  estimatedRecoveryTime: number;
}

export interface MonitoringPoint {
  metric: string;
  threshold: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  action: string;
}

export interface PlanComparison {
  planId: string;
  comparisonMetrics: ComparisonMetric[];
  overallScore: number;
  ranking: number;
  strengths: string[];
  weaknesses: string[];
}

export interface ComparisonMetric {
  name: string;
  value: number;
  normalizedValue: number;
  weight: number;
  weightedScore: number;
}

export interface PlanEvaluationResult {
  planId: string;
  successRate: SuccessRateEstimate;
  riskAssessment: RiskAssessment;
  resourceUtilization: ResourceUtilization;
  timelineFeasibility: TimelineFeasibility;
  overallScore: number;
  recommendation: string;
}

export interface ResourceUtilization {
  totalHours: number;
  availableHours: number;
  utilizationRate: number;
  bottlenecks: string[];
  recommendations: string[];
}

export interface TimelineFeasibility {
  feasible: boolean;
  slack: number;
  criticalPathDuration: number;
  bufferNeeded: number;
  risks: string[];
}

const SUCCESS_FACTORS: Record<string, { weight: number; baseRate: number }> = {
  resource_availability: { weight: 0.2, baseRate: 0.85 },
  goal_clarity: { weight: 0.15, baseRate: 0.9 },
  stakeholder_commitment: { weight: 0.15, baseRate: 0.8 },
  execution_capability: { weight: 0.2, baseRate: 0.85 },
  external_environment: { weight: 0.1, baseRate: 0.75 },
  dependency_management: { weight: 0.1, baseRate: 0.8 },
  risk_mitigation: { weight: 0.1, baseRate: 0.85 },
};

export class PlanEvaluationEngine {
  evaluateSuccessRate(plan: ActionSequence, _context?: any): SuccessRateEstimate {
    const byFactor: Record<string, number> = {};
    const riskFactors: RiskFactor[] = [];

    for (const [factorName, factorConfig] of Object.entries(SUCCESS_FACTORS)) {
      const adjustedRate = this.adjustFactorRate(factorName, factorConfig.baseRate, plan);
      byFactor[factorName] = adjustedRate;
    }

    const overall = this.calculateOverallSuccessRate(byFactor);
    const confidence = this.calculateConfidence(plan, byFactor);
    const improvementSuggestions = this.generateImprovementSuggestions(byFactor, riskFactors);

    return {
      overall,
      byFactor,
      confidence,
      riskFactors,
      improvementSuggestions,
    };
  }

  assessRisks(plan: ActionSequence): RiskAssessment {
    const riskFactors = this.identifyRisks(plan);
    const overallRisk = this.calculateOverallRisk(riskFactors);
    const riskLevel = this.determineRiskLevel(overallRisk);
    const riskMatrix = this.buildRiskMatrix(riskFactors);
    const mitigationPlan = this.createMitigationPlan(riskFactors);

    return {
      overallRisk,
      riskLevel,
      riskFactors,
      riskMatrix,
      mitigationPlan,
    };
  }

  comparePlans(plans: ActionSequence[]): PlanComparison[] {
    const comparisons: PlanComparison[] = [];

    for (const plan of plans) {
      const comparisonMetrics = this.calculateComparisonMetrics(plan);
      const overallScore = this.calculateOverallComparisonScore(comparisonMetrics);
      const { strengths, weaknesses } = this.identifyStrengthsWeaknesses(comparisonMetrics);

      comparisons.push({
        planId: plan.id,
        comparisonMetrics,
        overallScore,
        ranking: 0,
        strengths,
        weaknesses,
      });
    }

    comparisons.sort((a, b) => b.overallScore - a.overallScore);
    comparisons.forEach((c, index) => {
      c.ranking = index + 1;
    });

    return comparisons;
  }

  selectOptimalPlan(plans: ActionSequence[]): ActionSequence | null {
    if (plans.length === 0) return null;

    const comparisons = this.comparePlans(plans);
    const bestPlanId = comparisons[0].planId;

    return plans.find(p => p.id === bestPlanId) || null;
  }

  evaluatePlan(plan: ActionSequence, context?: any): PlanEvaluationResult {
    const successRate = this.evaluateSuccessRate(plan, context);
    const riskAssessment = this.assessRisks(plan);
    const resourceUtilization = this.evaluateResourceUtilization(plan);
    const timelineFeasibility = this.evaluateTimelineFeasibility(plan);

    const overallScore = this.calculateOverallPlanScore(
      successRate,
      riskAssessment,
      resourceUtilization,
      timelineFeasibility
    );

    const recommendation = this.generateRecommendation(
      overallScore,
      successRate,
      riskAssessment,
      resourceUtilization,
      timelineFeasibility
    );

    return {
      planId: plan.id,
      successRate,
      riskAssessment,
      resourceUtilization,
      timelineFeasibility,
      overallScore,
      recommendation,
    };
  }

  private adjustFactorRate(factorName: string, baseRate: number, plan: ActionSequence): number {
    let adjustment = 0;

    switch (factorName) {
      case 'resource_availability':
        if (plan.totalEffort > 100) adjustment -= 0.1;
        if (plan.actions.length > 20) adjustment -= 0.05;
        break;
      case 'goal_clarity':
        if (plan.description.length > 50) adjustment += 0.05;
        break;
      case 'stakeholder_commitment':
        const uniqueEntities = new Set(plan.actions.map(a => a.targetEntity).filter(Boolean));
        if (uniqueEntities.size > 10) adjustment -= 0.1;
        break;
      case 'execution_capability':
        if (plan.actions.filter(a => a.priority === 'high').length > 5) adjustment -= 0.05;
        break;
      case 'dependency_management':
        if (plan.dependencies.length > plan.actions.length * 0.5) adjustment -= 0.1;
        break;
      case 'risk_mitigation':
        const actionsWithRisks = plan.actions.filter(a => a.risks.length > 0);
        if (actionsWithRisks.length > plan.actions.length * 0.5) adjustment -= 0.05;
        break;
    }

    return Math.max(0.1, Math.min(1, baseRate + adjustment));
  }

  private calculateOverallSuccessRate(byFactor: Record<string, number>): number {
    let weightedSum = 0;
    let totalWeight = 0;

    for (const [factorName, rate] of Object.entries(byFactor)) {
      const config = SUCCESS_FACTORS[factorName];
      if (config) {
        weightedSum += rate * config.weight;
        totalWeight += config.weight;
      }
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }

  private calculateConfidence(plan: ActionSequence, byFactor: Record<string, number>): number {
    const factorCount = Object.keys(byFactor).length;
    const actionCount = plan.actions.length;
    
    let confidence = 0.6;
    
    if (factorCount >= 5) confidence += 0.1;
    if (actionCount >= 5 && actionCount <= 15) confidence += 0.1;
    if (actionCount > 15) confidence -= 0.05;
    
    const rateVariance = this.calculateVariance(Object.values(byFactor));
    if (rateVariance < 0.05) confidence += 0.1;
    
    return Math.max(0.4, Math.min(0.95, confidence));
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private generateImprovementSuggestions(
    byFactor: Record<string, number>,
    _riskFactors: RiskFactor[]
  ): string[] {
    const suggestions: string[] = [];

    for (const [factor, rate] of Object.entries(byFactor)) {
      if (rate < 0.7) {
        switch (factor) {
          case 'resource_availability':
            suggestions.push('增加资源投入或优化资源配置');
            break;
          case 'goal_clarity':
            suggestions.push('进一步明确目标和成功标准');
            break;
          case 'stakeholder_commitment':
            suggestions.push('加强与关键利益相关者的沟通');
            break;
          case 'execution_capability':
            suggestions.push('提升执行团队能力或增加培训');
            break;
          case 'dependency_management':
            suggestions.push('简化依赖关系或增加缓冲');
            break;
          case 'risk_mitigation':
            suggestions.push('完善风险应对措施');
            break;
        }
      }
    }

    return suggestions;
  }

  private identifyRisks(plan: ActionSequence): RiskFactor[] {
    const risks: RiskFactor[] = [];

    if (plan.totalDuration > 30) {
      risks.push({
        id: 'risk_duration',
        name: '项目周期过长',
        description: `项目总周期 ${plan.totalDuration} 天，存在延期风险`,
        probability: 0.4,
        impact: 0.6,
        riskScore: 0.24,
        mitigation: '设置阶段性里程碑，定期检查进度',
        category: 'internal',
      });
    }

    const highPriorityActions = plan.actions.filter(a => a.priority === 'high');
    if (highPriorityActions.length > 5) {
      risks.push({
        id: 'risk_priority',
        name: '高优先级任务过多',
        description: `有 ${highPriorityActions.length} 个高优先级任务，资源可能分散`,
        probability: 0.5,
        impact: 0.5,
        riskScore: 0.25,
        mitigation: '重新评估优先级，确保关键任务优先',
        category: 'resource',
      });
    }

    const dependencyRatio = plan.dependencies.length / Math.max(1, plan.actions.length);
    if (dependencyRatio > 0.8) {
      risks.push({
        id: 'risk_dependency',
        name: '依赖关系复杂',
        description: '任务间依赖关系较多，可能影响执行效率',
        probability: 0.6,
        impact: 0.4,
        riskScore: 0.24,
        mitigation: '优化任务顺序，并行执行独立任务',
        category: 'dependency',
      });
    }

    const actionsWithRisks = plan.actions.filter(a => a.risks.length > 2);
    if (actionsWithRisks.length > 0) {
      risks.push({
        id: 'risk_action',
        name: '高风险任务',
        description: `${actionsWithRisks.length} 个任务存在多个风险因素`,
        probability: 0.5,
        impact: 0.7,
        riskScore: 0.35,
        mitigation: '为高风险任务制定详细应对计划',
        category: 'internal',
      });
    }

    return risks;
  }

  private calculateOverallRisk(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0;
    
    return riskFactors.reduce((sum, r) => sum + r.riskScore, 0) / riskFactors.length;
  }

  private determineRiskLevel(overallRisk: number): 'low' | 'medium' | 'high' | 'critical' {
    if (overallRisk < 0.2) return 'low';
    if (overallRisk < 0.4) return 'medium';
    if (overallRisk < 0.6) return 'high';
    return 'critical';
  }

  private buildRiskMatrix(riskFactors: RiskFactor[]): RiskMatrix {
    const matrix: RiskMatrix = {
      lowImpact: { lowProb: 0, medProb: 0, highProb: 0 },
      mediumImpact: { lowProb: 0, medProb: 0, highProb: 0 },
      highImpact: { lowProb: 0, medProb: 0, highProb: 0 },
    };

    for (const risk of riskFactors) {
      const impactLevel = risk.impact < 0.33 ? 'lowImpact' : risk.impact < 0.66 ? 'mediumImpact' : 'highImpact';
      const probLevel = risk.probability < 0.33 ? 'lowProb' : risk.probability < 0.66 ? 'medProb' : 'highProb';
      matrix[impactLevel][probLevel]++;
    }

    return matrix;
  }

  private createMitigationPlan(riskFactors: RiskFactor[]): MitigationPlan {
    const strategies: MitigationStrategy[] = riskFactors.map(risk => ({
      riskId: risk.id,
      strategy: risk.mitigation,
      cost: risk.riskScore * 1000,
      effectiveness: 0.7,
      implementation: [
        `识别 ${risk.name} 的具体表现`,
        `制定应对措施`,
        `监控风险指标`,
      ],
    }));

    const contingencyPlans: ContingencyPlan[] = riskFactors
      .filter(r => r.riskScore > 0.3)
      .map(risk => ({
        trigger: `${risk.name} 风险发生`,
        actions: [
          `暂停相关任务`,
          `评估影响范围`,
          `启动应急措施`,
        ],
        responsible: '项目负责人',
        estimatedRecoveryTime: Math.ceil(risk.impact * 10),
      }));

    const monitoringPoints: MonitoringPoint[] = [
      { metric: '任务完成率', threshold: 80, frequency: 'weekly', action: '检查进度并调整' },
      { metric: '资源利用率', threshold: 90, frequency: 'weekly', action: '优化资源分配' },
      { metric: '风险事件数', threshold: 3, frequency: 'daily', action: '启动应急预案' },
    ];

    return {
      strategies,
      contingencyPlans,
      monitoringPoints,
    };
  }

  private calculateComparisonMetrics(plan: ActionSequence): ComparisonMetric[] {
    const metrics: ComparisonMetric[] = [
      {
        name: '成功率',
        value: this.evaluateSuccessRate(plan).overall,
        normalizedValue: 0,
        weight: 0.3,
        weightedScore: 0,
      },
      {
        name: '风险水平',
        value: 1 - this.calculateOverallRisk(this.identifyRisks(plan)),
        normalizedValue: 0,
        weight: 0.25,
        weightedScore: 0,
      },
      {
        name: '效率',
        value: plan.totalEffort > 0 ? plan.actions.length / plan.totalEffort : 0,
        normalizedValue: 0,
        weight: 0.2,
        weightedScore: 0,
      },
      {
        name: '简洁性',
        value: 1 / Math.max(1, plan.actions.length),
        normalizedValue: 0,
        weight: 0.15,
        weightedScore: 0,
      },
      {
        name: '可控性',
        value: 1 - plan.dependencies.length / Math.max(1, plan.actions.length),
        normalizedValue: 0,
        weight: 0.1,
        weightedScore: 0,
      },
    ];

    const maxValue = Math.max(...metrics.map(m => m.value));
    metrics.forEach(m => {
      m.normalizedValue = maxValue > 0 ? m.value / maxValue : 0;
      m.weightedScore = m.normalizedValue * m.weight;
    });

    return metrics;
  }

  private calculateOverallComparisonScore(metrics: ComparisonMetric[]): number {
    return metrics.reduce((sum, m) => sum + m.weightedScore, 0);
  }

  private identifyStrengthsWeaknesses(metrics: ComparisonMetric[]): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    for (const metric of metrics) {
      if (metric.normalizedValue > 0.7) {
        strengths.push(`${metric.name} 优秀 (${(metric.value * 100).toFixed(0)}%)`);
      } else if (metric.normalizedValue < 0.4) {
        weaknesses.push(`${metric.name} 不足 (${(metric.value * 100).toFixed(0)}%)`);
      }
    }

    return { strengths, weaknesses };
  }

  private evaluateResourceUtilization(plan: ActionSequence): ResourceUtilization {
    const totalHours = plan.totalEffort;
    const availableHours = 160;
    const utilizationRate = totalHours / availableHours;

    const bottlenecks: string[] = [];
    if (utilizationRate > 0.9) {
      bottlenecks.push('资源利用率过高，可能导致延期');
    }

    const recommendations: string[] = [];
    if (utilizationRate > 0.8) {
      recommendations.push('考虑增加资源或延长工期');
    }

    return {
      totalHours,
      availableHours,
      utilizationRate,
      bottlenecks,
      recommendations,
    };
  }

  private evaluateTimelineFeasibility(plan: ActionSequence): TimelineFeasibility {
    const criticalPathDuration = plan.totalDuration;
    const bufferNeeded = criticalPathDuration * 0.2;
    const slack = 30 - criticalPathDuration;

    const risks: string[] = [];
    if (slack < 0) {
      risks.push('工期紧张，缺乏缓冲时间');
    }
    if (criticalPathDuration > 60) {
      risks.push('项目周期较长，不确定性增加');
    }

    return {
      feasible: slack >= 0,
      slack: Math.max(0, slack),
      criticalPathDuration,
      bufferNeeded,
      risks,
    };
  }

  private calculateOverallPlanScore(
    successRate: SuccessRateEstimate,
    riskAssessment: RiskAssessment,
    resourceUtilization: ResourceUtilization,
    timelineFeasibility: TimelineFeasibility
  ): number {
    const successScore = successRate.overall;
    const riskScore = 1 - riskAssessment.overallRisk;
    const resourceScore = 1 - resourceUtilization.utilizationRate;
    const timelineScore = timelineFeasibility.feasible ? 1 : 0.5;

    return (
      successScore * 0.35 +
      riskScore * 0.25 +
      resourceScore * 0.2 +
      timelineScore * 0.2
    );
  }

  private generateRecommendation(
    overallScore: number,
    _successRate: SuccessRateEstimate,
    riskAssessment: RiskAssessment,
    resourceUtilization: ResourceUtilization,
    timelineFeasibility: TimelineFeasibility
  ): string {
    if (overallScore >= 0.8) {
      return '计划可行，建议按计划执行';
    } else if (overallScore >= 0.6) {
      return '计划基本可行，建议关注以下方面：' + 
        (riskAssessment.riskLevel !== 'low' ? '风险管理；' : '') +
        (!timelineFeasibility.feasible ? '时间安排；' : '') +
        (resourceUtilization.utilizationRate > 0.8 ? '资源配置；' : '');
    } else if (overallScore >= 0.4) {
      return '计划存在较大风险，建议优化后重新评估';
    } else {
      return '计划不可行，建议重新制定';
    }
  }
}

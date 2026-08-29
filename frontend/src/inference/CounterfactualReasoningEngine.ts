import { CausalGraph } from './CausalReasoningEngine';

export interface WhatIfScenario {
  id: string;
  name: string;
  description: string;
  intervention: Intervention;
  baselineConditions: Record<string, any>;
  assumptions: string[];
}

export interface Intervention {
  type: 'increase' | 'decrease' | 'set' | 'remove' | 'add';
  targetEntity: string;
  targetProperty: string;
  value: any;
  duration?: number;
}

export interface CounterfactualResult {
  scenarioId: string;
  predictedOutcome: PredictedOutcome;
  confidence: number;
  causalPath: CausalPath[];
  sideEffects: SideEffect[];
  assumptions: string[];
  limitations: string[];
}

export interface PredictedOutcome {
  metric: string;
  baselineValue: number;
  predictedValue: number;
  change: number;
  changePercent: number;
  confidenceInterval: [number, number];
}

export interface CausalPath {
  steps: { entityId: string; property: string; change: number }[];
  totalEffect: number;
  confidence: number;
}

export interface SideEffect {
  description: string;
  affectedEntity: string;
  affectedProperty: string;
  magnitude: number;
  desirability: 'positive' | 'negative' | 'neutral';
}

export interface EffectPrediction {
  intervention: Intervention;
  directEffects: PredictedOutcome[];
  indirectEffects: PredictedOutcome[];
  totalEffect: number;
  confidence: number;
  timeToEffect: number;
  duration: number;
}

export interface Alternative {
  id: string;
  name: string;
  description: string;
  interventions: Intervention[];
  expectedOutcome: PredictedOutcome[];
  costs: { type: string; amount: number }[];
  risks: { description: string; probability: number; impact: number }[];
}

export interface ComparisonResult {
  baseline: Alternative;
  alternatives: { alternative: Alternative; comparison: AlternativeComparison }[];
  recommendation: string;
  ranking: string[];
}

export interface AlternativeComparison {
  outcomeDifference: number;
  costDifference: number;
  riskDifference: number;
  netBenefit: number;
  advantages: string[];
  disadvantages: string[];
}

export interface Parameter {
  name: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  step: number;
}

export interface SensitivityResult {
  parameter: string;
  impactOnOutcome: { value: number; outcome: number }[];
  elasticity: number;
  criticalValue?: number;
  recommendation: string;
}

const INTERVENTION_EFFECTS: Record<string, Record<string, { directEffect: number; confidence: number }>> = {
  visit_frequency: {
    prescription_volume: { directEffect: 0.15, confidence: 0.75 },
    satisfaction: { directEffect: 0.1, confidence: 0.7 },
    relationship_strength: { directEffect: 0.2, confidence: 0.8 },
  },
  price: {
    sales_volume: { directEffect: -0.3, confidence: 0.8 },
    market_share: { directEffect: -0.15, confidence: 0.7 },
    revenue: { directEffect: 0.1, confidence: 0.6 },
  },
  marketing_budget: {
    awareness: { directEffect: 0.25, confidence: 0.7 },
    leads: { directEffect: 0.3, confidence: 0.75 },
    sales: { directEffect: 0.15, confidence: 0.65 },
  },
  training_hours: {
    productivity: { directEffect: 0.2, confidence: 0.75 },
    quality: { directEffect: 0.15, confidence: 0.7 },
    satisfaction: { directEffect: 0.1, confidence: 0.65 },
  },
  service_level: {
    satisfaction: { directEffect: 0.25, confidence: 0.8 },
    retention: { directEffect: 0.2, confidence: 0.75 },
    referrals: { directEffect: 0.15, confidence: 0.7 },
  },
};

export class CounterfactualReasoningEngine {
  private causalGraph: CausalGraph | null = null;

  setCausalGraph(graph: CausalGraph): void {
    this.causalGraph = graph;
  }

  getCausalGraph(): CausalGraph | null {
    return this.causalGraph;
  }

  whatIfAnalysis(scenario: WhatIfScenario): CounterfactualResult {
    const predictedOutcome = this.predictOutcome(scenario);
    const causalPath = this.traceCausalPath(scenario.intervention);
    const sideEffects = this.identifySideEffects(scenario.intervention);
    const confidence = this.calculateConfidence(scenario, predictedOutcome);

    return {
      scenarioId: scenario.id,
      predictedOutcome,
      confidence,
      causalPath,
      sideEffects,
      assumptions: scenario.assumptions,
      limitations: this.identifyLimitations(scenario),
    };
  }

  predictInterventionEffect(intervention: Intervention): EffectPrediction {
    const directEffects = this.predictDirectEffects(intervention);
    const indirectEffects = this.predictIndirectEffects(intervention, directEffects);
    const totalEffect = this.calculateTotalEffect(directEffects, indirectEffects);
    const confidence = this.calculateEffectConfidence(directEffects, indirectEffects);

    return {
      intervention,
      directEffects,
      indirectEffects,
      totalEffect,
      confidence,
      timeToEffect: this.estimateTimeToEffect(intervention),
      duration: this.estimateDuration(intervention),
    };
  }

  compareAlternatives(alternatives: Alternative[]): ComparisonResult {
    if (alternatives.length < 2) {
      throw new Error('需要至少两个替代方案进行比较');
    }

    const baseline = alternatives[0];
    const comparisons: { alternative: Alternative; comparison: AlternativeComparison }[] = [];

    for (let i = 1; i < alternatives.length; i++) {
      const alt = alternatives[i];
      const comparison = this.compareWithBaseline(baseline, alt);
      comparisons.push({ alternative: alt, comparison });
    }

    const ranking = this.rankAlternatives(baseline, comparisons);
    const recommendation = this.generateRecommendation(baseline, comparisons, ranking);

    return {
      baseline,
      alternatives: comparisons,
      recommendation,
      ranking,
    };
  }

  sensitivityAnalysis(parameters: Parameter[]): SensitivityResult[] {
    return parameters.map(param => this.analyzeParameter(param));
  }

  private predictOutcome(scenario: WhatIfScenario): PredictedOutcome {
    const intervention = scenario.intervention;
    const effectKey = this.getEffectKey(intervention.targetProperty);
    const effects = INTERVENTION_EFFECTS[effectKey];

    if (!effects) {
      return {
        metric: intervention.targetProperty,
        baselineValue: scenario.baselineConditions[intervention.targetProperty] || 0,
        predictedValue: scenario.baselineConditions[intervention.targetProperty] || 0,
        change: 0,
        changePercent: 0,
        confidenceInterval: [0, 0],
      };
    }

    const baselineValue = scenario.baselineConditions[intervention.targetProperty] || 100;
    const effect = Object.values(effects)[0];
    const changeMultiplier = this.calculateChangeMultiplier(intervention);
    const change = effect.directEffect * changeMultiplier;
    const predictedValue = baselineValue * (1 + change);

    return {
      metric: intervention.targetProperty,
      baselineValue,
      predictedValue,
      change: predictedValue - baselineValue,
      changePercent: change * 100,
      confidenceInterval: [
        predictedValue * (1 - (1 - effect.confidence) * 0.5),
        predictedValue * (1 + (1 - effect.confidence) * 0.5),
      ],
    };
  }

  private traceCausalPath(intervention: Intervention): CausalPath[] {
    const paths: CausalPath[] = [];
    const effectKey = this.getEffectKey(intervention.targetProperty);
    const effects = INTERVENTION_EFFECTS[effectKey];

    if (!effects) return paths;

    for (const [targetMetric, effect] of Object.entries(effects)) {
      paths.push({
        steps: [
          { entityId: intervention.targetEntity, property: intervention.targetProperty, change: 1 },
          { entityId: intervention.targetEntity, property: targetMetric, change: effect.directEffect },
        ],
        totalEffect: effect.directEffect,
        confidence: effect.confidence,
      });
    }

    return paths;
  }

  private identifySideEffects(intervention: Intervention): SideEffect[] {
    const sideEffects: SideEffect[] = [];
    const effectKey = this.getEffectKey(intervention.targetProperty);
    const effects = INTERVENTION_EFFECTS[effectKey];

    if (!effects) return sideEffects;

    for (const [targetMetric, effect] of Object.entries(effects)) {
      if (targetMetric !== intervention.targetProperty) {
        sideEffects.push({
          description: `${intervention.targetProperty} 变化导致 ${targetMetric} 变化 ${(effect.directEffect * 100).toFixed(1)}%`,
          affectedEntity: intervention.targetEntity,
          affectedProperty: targetMetric,
          magnitude: Math.abs(effect.directEffect),
          desirability: effect.directEffect > 0 ? 'positive' : 'negative',
        });
      }
    }

    if (intervention.type === 'increase') {
      sideEffects.push({
        description: '资源投入增加',
        affectedEntity: intervention.targetEntity,
        affectedProperty: 'resource_consumption',
        magnitude: Math.abs(intervention.value) * 0.1,
        desirability: 'negative',
      });
    }

    return sideEffects;
  }

  private calculateConfidence(scenario: WhatIfScenario, _outcome: PredictedOutcome): number {
    let confidence = 0.6;

    if (scenario.assumptions.length > 0) {
      confidence -= scenario.assumptions.length * 0.05;
    }

    const effectKey = this.getEffectKey(scenario.intervention.targetProperty);
    const effects = INTERVENTION_EFFECTS[effectKey];
    if (effects) {
      const avgEffectConfidence = Object.values(effects).reduce((sum, e) => sum + e.confidence, 0) / Object.keys(effects).length;
      confidence = (confidence + avgEffectConfidence) / 2;
    }

    return Math.max(0.3, Math.min(0.95, confidence));
  }

  private identifyLimitations(scenario: WhatIfScenario): string[] {
    const limitations: string[] = [];

    limitations.push('预测基于历史模式，实际情况可能有所不同');

    if (scenario.assumptions.length > 3) {
      limitations.push('假设较多，预测不确定性增加');
    }

    const effectKey = this.getEffectKey(scenario.intervention.targetProperty);
    if (!INTERVENTION_EFFECTS[effectKey]) {
      limitations.push('该类型干预的历史数据不足');
    }

    return limitations;
  }

  private predictDirectEffects(intervention: Intervention): PredictedOutcome[] {
    const effects: PredictedOutcome[] = [];
    const effectKey = this.getEffectKey(intervention.targetProperty);
    const effectPatterns = INTERVENTION_EFFECTS[effectKey];

    if (!effectPatterns) return effects;

    for (const [metric, effect] of Object.entries(effectPatterns)) {
      const changeMultiplier = this.calculateChangeMultiplier(intervention);
      effects.push({
        metric,
        baselineValue: 100,
        predictedValue: 100 * (1 + effect.directEffect * changeMultiplier),
        change: effect.directEffect * changeMultiplier * 100,
        changePercent: effect.directEffect * changeMultiplier * 100,
        confidenceInterval: [
          100 * (1 + effect.directEffect * changeMultiplier * 0.8),
          100 * (1 + effect.directEffect * changeMultiplier * 1.2),
        ],
      });
    }

    return effects;
  }

  private predictIndirectEffects(_intervention: Intervention, directEffects: PredictedOutcome[]): PredictedOutcome[] {
    const indirectEffects: PredictedOutcome[] = [];

    for (const direct of directEffects) {
      const secondaryKey = this.getEffectKey(direct.metric);
      const secondaryEffects = INTERVENTION_EFFECTS[secondaryKey];

      if (secondaryEffects) {
        for (const [metric, effect] of Object.entries(secondaryEffects)) {
          if (!directEffects.some(d => d.metric === metric)) {
            indirectEffects.push({
              metric,
              baselineValue: direct.baselineValue,
              predictedValue: direct.predictedValue * (1 + effect.directEffect * 0.5),
              change: effect.directEffect * 0.5 * direct.predictedValue,
              changePercent: effect.directEffect * 50,
              confidenceInterval: [
                direct.predictedValue * (1 + effect.directEffect * 0.3),
                direct.predictedValue * (1 + effect.directEffect * 0.7),
              ],
            });
          }
        }
      }
    }

    return indirectEffects;
  }

  private calculateTotalEffect(directEffects: PredictedOutcome[], indirectEffects: PredictedOutcome[]): number {
    const directTotal = directEffects.reduce((sum, e) => sum + e.changePercent, 0);
    const indirectTotal = indirectEffects.reduce((sum, e) => sum + e.changePercent * 0.5, 0);
    return directTotal + indirectTotal;
  }

  private calculateEffectConfidence(directEffects: PredictedOutcome[], indirectEffects: PredictedOutcome[]): number {
    if (directEffects.length === 0) return 0.5;
    
    const directConfidence = 0.75;
    const indirectPenalty = indirectEffects.length * 0.05;
    
    return Math.max(0.4, directConfidence - indirectPenalty);
  }

  private estimateTimeToEffect(intervention: Intervention): number {
    const timeToEffectMap: Record<string, number> = {
      visit_frequency: 14,
      price: 7,
      marketing_budget: 30,
      training_hours: 60,
      service_level: 21,
    };

    const effectKey = this.getEffectKey(intervention.targetProperty);
    return timeToEffectMap[effectKey] || 30;
  }

  private estimateDuration(intervention: Intervention): number {
    if (intervention.duration) return intervention.duration;
    return 90;
  }

  private compareWithBaseline(baseline: Alternative, alternative: Alternative): AlternativeComparison {
    const baselineOutcome = this.sumOutcomes(baseline.expectedOutcome);
    const altOutcome = this.sumOutcomes(alternative.expectedOutcome);
    const outcomeDifference = altOutcome - baselineOutcome;

    const baselineCost = this.sumCosts(baseline.costs);
    const altCost = this.sumCosts(alternative.costs);
    const costDifference = altCost - baselineCost;

    const baselineRisk = this.sumRisks(baseline.risks);
    const altRisk = this.sumRisks(alternative.risks);
    const riskDifference = altRisk - baselineRisk;

    const netBenefit = outcomeDifference - costDifference * 0.01 - riskDifference * 0.5;

    return {
      outcomeDifference,
      costDifference,
      riskDifference,
      netBenefit,
      advantages: this.identifyAdvantages(baseline, alternative),
      disadvantages: this.identifyDisadvantages(baseline, alternative),
    };
  }

  private sumOutcomes(outcomes: PredictedOutcome[]): number {
    return outcomes.reduce((sum, o) => sum + o.changePercent, 0);
  }

  private sumCosts(costs: { type: string; amount: number }[]): number {
    return costs.reduce((sum, c) => sum + c.amount, 0);
  }

  private sumRisks(risks: { description: string; probability: number; impact: number }[]): number {
    return risks.reduce((sum, r) => sum + r.probability * r.impact, 0);
  }

  private identifyAdvantages(baseline: Alternative, alternative: Alternative): string[] {
    const advantages: string[] = [];
    
    if (this.sumOutcomes(alternative.expectedOutcome) > this.sumOutcomes(baseline.expectedOutcome)) {
      advantages.push('预期效果更好');
    }
    if (this.sumCosts(alternative.costs) < this.sumCosts(baseline.costs)) {
      advantages.push('成本更低');
    }
    if (this.sumRisks(alternative.risks) < this.sumRisks(baseline.risks)) {
      advantages.push('风险更小');
    }
    
    return advantages;
  }

  private identifyDisadvantages(baseline: Alternative, alternative: Alternative): string[] {
    const disadvantages: string[] = [];
    
    if (this.sumOutcomes(alternative.expectedOutcome) < this.sumOutcomes(baseline.expectedOutcome)) {
      disadvantages.push('预期效果较差');
    }
    if (this.sumCosts(alternative.costs) > this.sumCosts(baseline.costs)) {
      disadvantages.push('成本更高');
    }
    if (this.sumRisks(alternative.risks) > this.sumRisks(baseline.risks)) {
      disadvantages.push('风险更大');
    }
    
    return disadvantages;
  }

  private rankAlternatives(baseline: Alternative, comparisons: { alternative: Alternative; comparison: AlternativeComparison }[]): string[] {
    const allAlternatives = [
      { id: baseline.id, score: 0 },
      ...comparisons.map(c => ({ id: c.alternative.id, score: c.comparison.netBenefit })),
    ];

    allAlternatives.sort((a, b) => b.score - a.score);
    return allAlternatives.map(a => a.id);
  }

  private generateRecommendation(baseline: Alternative, comparisons: { alternative: Alternative; comparison: AlternativeComparison }[], ranking: string[]): string {
    const bestId = ranking[0];
    
    if (bestId === baseline.id) {
      return '建议维持基准方案';
    }

    const bestComparison = comparisons.find(c => c.alternative.id === bestId);
    if (bestComparison) {
      return `建议采用方案 ${bestId}，净收益为 ${bestComparison.comparison.netBenefit.toFixed(2)}`;
    }

    return '建议进一步分析后决策';
  }

  private analyzeParameter(param: Parameter): SensitivityResult {
    const impactOnOutcome: { value: number; outcome: number }[] = [];
    
    for (let v = param.minValue; v <= param.maxValue; v += param.step) {
      const normalizedChange = (v - param.currentValue) / param.currentValue;
      const outcomeChange = normalizedChange * 0.5;
      impactOnOutcome.push({
        value: v,
        outcome: 100 * (1 + outcomeChange),
      });
    }

    const elasticity = this.calculateElasticity(impactOnOutcome, param);
    const criticalValue = this.findCriticalValue(impactOnOutcome);
    const recommendation = this.generateSensitivityRecommendation(param, elasticity, criticalValue);

    return {
      parameter: param.name,
      impactOnOutcome,
      elasticity,
      criticalValue,
      recommendation,
    };
  }

  private calculateElasticity(data: { value: number; outcome: number }[], param: Parameter): number {
    if (data.length < 2) return 0;

    const currentValue = param.currentValue;
    const currentOutcome = data.find(d => d.value === currentValue)?.outcome || 100;
    
    const higherPoint = data.find(d => d.value > currentValue);
    if (!higherPoint) return 0;

    const valueChange = (higherPoint.value - currentValue) / currentValue;
    const outcomeChange = (higherPoint.outcome - currentOutcome) / currentOutcome;

    return valueChange !== 0 ? outcomeChange / valueChange : 0;
  }

  private findCriticalValue(data: { value: number; outcome: number }[]): number | undefined {
    for (let i = 1; i < data.length; i++) {
      if ((data[i].outcome < 80 && data[i - 1].outcome >= 80) ||
          (data[i].outcome > 120 && data[i - 1].outcome <= 120)) {
        return data[i].value;
      }
    }
    return undefined;
  }

  private generateSensitivityRecommendation(param: Parameter, elasticity: number, criticalValue?: number): string {
    if (Math.abs(elasticity) > 1) {
      return `${param.name} 对结果影响较大，需要谨慎调整`;
    }
    if (criticalValue !== undefined) {
      return `注意避免 ${param.name} 达到临界值 ${criticalValue.toFixed(2)}`;
    }
    return `${param.name} 对结果影响适中，可在合理范围内调整`;
  }

  private getEffectKey(property: string): string {
    const keyMap: Record<string, string> = {
      visitFrequency: 'visit_frequency',
      visit_frequency: 'visit_frequency',
      price: 'price',
      marketingBudget: 'marketing_budget',
      marketing_budget: 'marketing_budget',
      trainingHours: 'training_hours',
      training_hours: 'training_hours',
      serviceLevel: 'service_level',
      service_level: 'service_level',
    };
    return keyMap[property] || property;
  }

  private calculateChangeMultiplier(intervention: Intervention): number {
    if (intervention.type === 'increase') return Math.min(1, Math.abs(intervention.value) / 10);
    if (intervention.type === 'decrease') return -Math.min(1, Math.abs(intervention.value) / 10);
    if (intervention.type === 'set') return 0.5;
    return 0.3;
  }
}

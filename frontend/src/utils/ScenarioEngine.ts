import { OntologyObject, EnhancedScenario, ForecastResult, ComparisonResult, RiskLevel, ObjectType } from '../types';

export interface SimulationContext {
  objects: OntologyObject[];
  baselineForecast: ForecastResult;
}

export interface SimulationResult {
  scenarioId: string;
  scenarioName: string;
  forecastResult: ForecastResult;
  comparisonWithBaseline: ComparisonResult;
  confidence: number;
  affectedEntities: string[];
  propagationPath: string[];
}

export class ScenarioEngine {
  private context: SimulationContext;

  constructor(context: SimulationContext) {
    this.context = context;
  }

  public simulateScenario(scenario: EnhancedScenario): SimulationResult {
    const scenarioForecast = this.calculateScenarioForecast(scenario);
    const comparison = this.compareWithBaseline(scenarioForecast);
    const affectedEntities = this.identifyAffectedEntities(scenario);
    const propagationPath = this.calculatePropagationPath(scenario);

    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      forecastResult: scenarioForecast,
      comparisonWithBaseline: comparison,
      confidence: this.calculateConfidence(scenario),
      affectedEntities,
      propagationPath,
    };
  }

  private calculateScenarioForecast(scenario: EnhancedScenario): ForecastResult {
    const baseline = this.context.baselineForecast;
    const impactFactor = this.calculateImpactFactor(scenario);

    const forecastValue = baseline.forecastValue * (1 + impactFactor);
    const achievementRate = (forecastValue / baseline.targetValue) * 100;
    const riskLevel = this.determineRiskLevel(achievementRate);

    const confidenceInterval = this.calculateConfidenceInterval(
      forecastValue,
      impactFactor
    );

    return {
      targetValue: baseline.targetValue,
      forecastValue,
      achievementRate,
      riskLevel,
      confidenceInterval,
    };
  }

  private calculateImpactFactor(scenario: EnhancedScenario): number {
    const parameters = scenario.parameters;
    let totalImpact = 0;

    switch (scenario.type) {
      case 'resource_reallocation':
        const budgetShift = parameters.find(p => p.name === 'budgetShift')?.defaultValue as number || 0;
        totalImpact = (budgetShift / 100) * 0.15;
        break;

      case 'product_mix_optimization':
        const newProductPromotion = parameters.find(p => p.name === 'newProductPromotion')?.defaultValue as number || 0;
        totalImpact = (newProductPromotion / 100) * 0.12;
        break;

      case 'price_adjustment':
        const priceChange = parameters.find(p => p.name === 'priceChangePercent')?.defaultValue as number || 0;
        totalImpact = (priceChange / 100) * 0.2;
        break;

      case 'channel_strategy':
        const onlineChannel = parameters.find(p => p.name === 'onlineChannel')?.defaultValue as number || 0;
        totalImpact = (onlineChannel / 100) * 0.08;
        break;

      case 'kol_strategy':
        const kolCount = parameters.find(p => p.name === 'kolCount')?.defaultValue as number || 0;
        totalImpact = (kolCount / 10) * 0.1;
        break;

      case 'customer_churn_intervention':
        const interventionIntensity = parameters.find(p => p.name === 'interventionIntensity')?.defaultValue as number || 0;
        totalImpact = (interventionIntensity / 5) * 0.12;
        break;

      case 'new_customer_development':
        const hospitalCount = parameters.find(p => p.name === 'hospitalCount')?.defaultValue as number || 0;
        totalImpact = (hospitalCount / 10) * 0.06;
        break;

      case 'compliance_risk_response':
        const complianceTraining = parameters.find(p => p.name === 'complianceTraining')?.defaultValue as number || 0;
        totalImpact = -(complianceTraining / 200000) * 0.05;
        break;

      case 'competitor_response':
        const responseBudget = parameters.find(p => p.name === 'responseBudget')?.defaultValue as number || 0;
        totalImpact = (responseBudget / 200000) * 0.08;
        break;

      case 'emergency_response':
        const expectedDuration = parameters.find(p => p.name === 'expectedDuration')?.defaultValue as number || 0;
        totalImpact = -(expectedDuration / 30) * 0.15;
        break;

      default:
        totalImpact = 0;
    }

    return totalImpact;
  }

  private compareWithBaseline(scenarioForecast: ForecastResult): ComparisonResult {
    const baseline = this.context.baselineForecast;
    const delta = ((scenarioForecast.forecastValue - baseline.forecastValue) / baseline.forecastValue) * 100;

    let impactAnalysis = '';
    if (delta > 10) {
      impactAnalysis = '该场景预计将带来显著的正面影响，建议优先考虑实施。';
    } else if (delta > 0) {
      impactAnalysis = '该场景预计将带来适度的正面影响，可以考虑实施。';
    } else if (delta > -10) {
      impactAnalysis = '该场景预计将带来轻微的负面影响，需要权衡利弊。';
    } else {
      impactAnalysis = '该场景预计将带来显著的负面影响，需要谨慎评估。';
    }

    return {
      baseline,
      scenario: scenarioForecast,
      delta,
      impactAnalysis,
    };
  }

  private determineRiskLevel(achievementRate: number): RiskLevel {
    if (achievementRate >= 90) {
      return RiskLevel.on_track;
    } else if (achievementRate >= 70) {
      return RiskLevel.at_risk;
    } else {
      return RiskLevel.critical;
    }
  }

  private calculateConfidenceInterval(
    forecastValue: number,
    impactFactor: number
  ): [number, number] {
    const variance = Math.abs(impactFactor) * 0.3;
    const lowerBound = forecastValue * (1 - variance);
    const upperBound = forecastValue * (1 + variance);

    return [lowerBound, upperBound];
  }

  private calculateConfidence(scenario: EnhancedScenario): number {
    let baseConfidence = 0.85;

    const parameterCount = scenario.parameters.length;
    if (parameterCount > 4) {
      baseConfidence -= 0.05;
    }

    if (scenario.category === 'risk_response') {
      baseConfidence -= 0.1;
    }

    return Math.max(0.5, Math.min(0.95, baseConfidence));
  }

  private identifyAffectedEntities(scenario: EnhancedScenario): string[] {
    const affected: string[] = [];

    switch (scenario.type) {
      case 'resource_reallocation':
      case 'channel_strategy':
        this.context.objects
          .filter(obj => obj.objectType === ObjectType.Hospital)
          .forEach(hospital => affected.push(hospital.id));
        break;

      case 'kol_strategy':
        this.context.objects
          .filter(obj => obj.objectType === ObjectType.Doctor)
          .forEach(doctor => affected.push(doctor.id));
        break;

      case 'customer_churn_intervention':
        const targetCustomerId = scenario.parameters.find(p => p.name === 'targetCustomerId')?.defaultValue as string;
        if (targetCustomerId) {
          affected.push(targetCustomerId);
        }
        break;

      default:
        this.context.objects
          .filter(obj => obj.objectType === ObjectType.Product)
          .forEach(product => affected.push(product.id));
    }

    return affected;
  }

  private calculatePropagationPath(scenario: EnhancedScenario): string[] {
    const path: string[] = [];

    switch (scenario.type) {
      case 'resource_reallocation':
        path.push('资源重新分配');
        path.push('医院预算调整');
        path.push('代表拜访频率变化');
        path.push('医生处方量影响');
        path.push('销售额变化');
        break;

      case 'kol_strategy':
        path.push('KOL策略调整');
        path.push('学术活动投入');
        path.push('KOL影响力传播');
        path.push('其他医生处方影响');
        path.push('整体销售额变化');
        break;

      case 'customer_churn_intervention':
        path.push('客户流失干预');
        path.push('拜访/学术活动');
        path.push('客户关系改善');
        path.push('处方量恢复');
        path.push('销售目标达成');
        break;

      default:
        path.push('场景执行');
        path.push('实体影响');
        path.push('关系传播');
        path.push('结果显现');
    }

    return path;
  }

  public batchSimulate(scenarios: EnhancedScenario[]): SimulationResult[] {
    return scenarios.map(scenario => this.simulateScenario(scenario));
  }

  public compareScenarios(scenario1: EnhancedScenario, scenario2: EnhancedScenario): {
    scenario1: SimulationResult;
    scenario2: SimulationResult;
    recommendation: string;
  } {
    const result1 = this.simulateScenario(scenario1);
    const result2 = this.simulateScenario(scenario2);

    let recommendation = '';
    if (result1.forecastResult.forecastValue > result2.forecastResult.forecastValue) {
      recommendation = `建议选择 ${scenario1.name}，预计收益更高。`;
    } else if (result2.forecastResult.forecastValue > result1.forecastResult.forecastValue) {
      recommendation = `建议选择 ${scenario2.name}，预计收益更高。`;
    } else {
      recommendation = '两个场景预计收益相近，建议综合考虑其他因素。';
    }

    return {
      scenario1: result1,
      scenario2: result2,
      recommendation,
    };
  }
}

export function createScenarioEngine(context: SimulationContext): ScenarioEngine {
  return new ScenarioEngine(context);
}
import { OntologyObject, ObjectType, LinkType } from '../types';

export interface ImportanceScore {
  overall: number;
  dimensions: {
    financial: number;
    strategic: number;
    relational: number;
    risk: number;
    growth: number;
  };
  factors: ImportanceFactor[];
  recommendation: string;
}

export interface ImportanceFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface ImportanceConfig {
  weights: {
    financial: number;
    strategic: number;
    relational: number;
    risk: number;
    growth: number;
  };
  thresholds: {
    highImportance: number;
    mediumImportance: number;
  };
}

const DEFAULT_CONFIG: ImportanceConfig = {
  weights: {
    financial: 0.3,
    strategic: 0.25,
    relational: 0.2,
    risk: 0.15,
    growth: 0.1,
  },
  thresholds: {
    highImportance: 0.75,
    mediumImportance: 0.5,
  },
};

const ENTITY_TYPE_WEIGHTS: Record<ObjectType, number> = {
  [ObjectType.Doctor]: 0.9,
  [ObjectType.Hospital]: 0.85,
  [ObjectType.Product]: 0.8,
  [ObjectType.SalesRep]: 0.7,
  [ObjectType.SalesTarget]: 0.75,
  [ObjectType.Territory]: 0.65,
  [ObjectType.VisitRecord]: 0.4,
  [ObjectType.AcademicEvent]: 0.5,
  [ObjectType.ComplianceAlert]: 0.6,
  [ObjectType.RecoveryPlan]: 0.55,
  [ObjectType.ActionItem]: 0.45,
  [ObjectType.VisitBrief]: 0.35,
  [ObjectType.CoachingNote]: 0.3,
  [ObjectType.SalesFlow]: 0.7,
  [ObjectType.MarketPotential]: 0.65,
  [ObjectType.HospitalDevelopment]: 0.6,
  [ObjectType.TerritoryPerformance]: 0.55,
  [ObjectType.ProductFlow]: 0.5,
  [ObjectType.BudgetCategory]: 0.6,
  [ObjectType.ExpenseClassification]: 0.45,
  [ObjectType.CostDriver]: 0.4,
  [ObjectType.LaborPayment]: 0.35,
  [ObjectType.ExpenseROI]: 0.5,
  [ObjectType.CustomerCategory]: 0.7,
  [ObjectType.VisitFeedback]: 0.4,
  [ObjectType.PDCAPlan]: 0.55,
  [ObjectType.HospitalStrategy]: 0.65,
  [ObjectType.DepartmentResearch]: 0.5,
  [ObjectType.RWSProject]: 0.6,
  [ObjectType.ClinicalTrial]: 0.55,
  [ObjectType.PatientProgram]: 0.5,
  [ObjectType.ResearchCollaboration]: 0.45,
  [ObjectType.MeetingCompliance]: 0.5,
  [ObjectType.ExpenseCompliance]: 0.55,
  [ObjectType.CustomerCompliance]: 0.5,
  [ObjectType.ComplianceRule]: 0.4,
};

export class ImportanceScorer {
  private config: ImportanceConfig;

  constructor(config?: Partial<ImportanceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  score(entity: OntologyObject): ImportanceScore {
    const dimensions = {
      financial: this.scoreFinancialImportance(entity),
      strategic: this.scoreStrategicImportance(entity),
      relational: this.scoreRelationalImportance(entity),
      risk: this.scoreRiskImportance(entity),
      growth: this.scoreGrowthImportance(entity),
    };

    const overall = this.calculateOverallScore(dimensions);
    const factors = this.generateFactors(entity, dimensions);
    const recommendation = this.generateRecommendation(overall, dimensions);

    return {
      overall,
      dimensions,
      factors,
      recommendation,
    };
  }

  private scoreFinancialImportance(entity: OntologyObject): number {
    let score = 0;
    const props = entity.properties;

    const revenue = props.revenue || props.actualRevenue || props.actualValue || props.salesAmount || 0;
    if (revenue > 1000000) score += 0.4;
    else if (revenue > 500000) score += 0.3;
    else if (revenue > 100000) score += 0.2;
    else if (revenue > 0) score += 0.1;

    const target = props.target || props.targetValue || props.targetRevenue || 0;
    const achievementRate = target > 0 ? (revenue / target) : 0;
    if (achievementRate > 1.2) score += 0.3;
    else if (achievementRate > 1) score += 0.2;
    else if (achievementRate > 0.8) score += 0.1;

    const budget = props.budget || props.budgetAmount || 0;
    if (budget > 500000) score += 0.2;
    else if (budget > 100000) score += 0.1;

    const roi = props.roi || props.roiRatio || 0;
    if (roi > 0.5) score += 0.1;

    return Math.min(1, score);
  }

  private scoreStrategicImportance(entity: OntologyObject): number {
    let score = 0;

    const entityTypeWeight = ENTITY_TYPE_WEIGHTS[entity.objectType] || 0.5;
    score += entityTypeWeight * 0.3;

    const category = entity.properties.category || entity.properties.customerCategory;
    if (category === 'A' || category === 'B') {
      score += 0.3;
    } else if (category === 'C') {
      score += 0.15;
    }

    const influenceLevel = entity.properties.influenceLevel || entity.properties.influence || 0;
    if (influenceLevel >= 8) score += 0.2;
    else if (influenceLevel >= 5) score += 0.1;

    const isKOL = entity.properties.isKOL || entity.properties.kol || false;
    if (isKOL) score += 0.2;

    return Math.min(1, score);
  }

  private scoreRelationalImportance(entity: OntologyObject): number {
    let score = 0;

    const linkCount = entity.links.length;
    if (linkCount > 20) score += 0.4;
    else if (linkCount > 10) score += 0.3;
    else if (linkCount > 5) score += 0.2;
    else if (linkCount > 0) score += 0.1;

    const influenceLinks = entity.links.filter(l => l.linkType === LinkType.INFLUENCES);
    if (influenceLinks.length > 5) score += 0.3;
    else if (influenceLinks.length > 0) score += 0.15;

    const worksAtLinks = entity.links.filter(l => l.linkType === LinkType.WORKS_AT);
    const hospitalLinks = entity.links.filter(l => l.targetType === ObjectType.Hospital);
    if (worksAtLinks.length > 0 || hospitalLinks.length > 0) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  private scoreRiskImportance(entity: OntologyObject): number {
    let score = 0;

    if (entity.status === 'critical') {
      score += 0.5;
    } else if (entity.status === 'warning') {
      score += 0.3;
    }

    const riskLevel = entity.properties.riskLevel || entity.properties.risk_level;
    if (riskLevel === 'high' || riskLevel === 'critical') {
      score += 0.3;
    } else if (riskLevel === 'medium') {
      score += 0.15;
    }

    const complianceRisk = entity.properties.complianceRiskLevel;
    if (complianceRisk === 'high') {
      score += 0.2;
    } else if (complianceRisk === 'medium') {
      score += 0.1;
    }

    const achievementRate = entity.properties.achievementRate || 0;
    if (achievementRate < 50) {
      score += 0.2;
    } else if (achievementRate < 70) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private scoreGrowthImportance(entity: OntologyObject): number {
    let score = 0;
    const props = entity.properties;

    const growthRate = props.growthRate || props.yoyGrowth || props.momGrowth || 0;
    if (growthRate > 50) {
      score += 0.4;
    } else if (growthRate > 20) {
      score += 0.3;
    } else if (growthRate > 0) {
      score += 0.2;
    }

    const potential = props.potential || props.potentialValue || props.growthPotential || 0;
    if (potential > 500000) {
      score += 0.3;
    } else if (potential > 100000) {
      score += 0.2;
    }

    const marketShare = props.marketShare || 0;
    const competitorShare = props.competitorShare || 0;
    if (marketShare < competitorShare) {
      score += 0.2;
    }

    const developmentStage = props.developmentStage || props.stage;
    if (developmentStage === 'prospect' || developmentStage === 'contact') {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private calculateOverallScore(dimensions: ImportanceScore['dimensions']): number {
    const weights = this.config.weights;
    return (
      dimensions.financial * weights.financial +
      dimensions.strategic * weights.strategic +
      dimensions.relational * weights.relational +
      dimensions.risk * weights.risk +
      dimensions.growth * weights.growth
    );
  }

  private generateFactors(entity: OntologyObject, dimensions: ImportanceScore['dimensions']): ImportanceFactor[] {
    const factors: ImportanceFactor[] = [];

    if (dimensions.financial > 0.5) {
      factors.push({
        name: '财务价值',
        weight: this.config.weights.financial,
        score: dimensions.financial,
        description: `${entity.name} 具有较高的财务贡献`,
      });
    }

    if (dimensions.strategic > 0.5) {
      factors.push({
        name: '战略价值',
        weight: this.config.weights.strategic,
        score: dimensions.strategic,
        description: `${entity.name} 对战略目标有重要影响`,
      });
    }

    if (dimensions.relational > 0.5) {
      factors.push({
        name: '关系网络',
        weight: this.config.weights.relational,
        score: dimensions.relational,
        description: `${entity.name} 在关系网络中处于关键位置`,
      });
    }

    if (dimensions.risk > 0.5) {
      factors.push({
        name: '风险因素',
        weight: this.config.weights.risk,
        score: dimensions.risk,
        description: `${entity.name} 存在需要关注的风险`,
      });
    }

    if (dimensions.growth > 0.5) {
      factors.push({
        name: '增长潜力',
        weight: this.config.weights.growth,
        score: dimensions.growth,
        description: `${entity.name} 具有良好的增长潜力`,
      });
    }

    return factors.sort((a, b) => b.score - a.score);
  }

  private generateRecommendation(overall: number, dimensions: ImportanceScore['dimensions']): string {
    if (overall >= this.config.thresholds.highImportance) {
      const topDimension = Object.entries(dimensions)
        .sort(([, a], [, b]) => b - a)[0];
      return `高优先级实体，建议重点关注${this.getDimensionLabel(topDimension[0])}方面`;
    } else if (overall >= this.config.thresholds.mediumImportance) {
      return '中等优先级实体，建议定期关注';
    } else {
      return '一般优先级实体，可按常规流程处理';
    }
  }

  private getDimensionLabel(dimension: string): string {
    const labels: Record<string, string> = {
      financial: '财务',
      strategic: '战略',
      relational: '关系',
      risk: '风险',
      growth: '增长',
    };
    return labels[dimension] || dimension;
  }

  updateConfig(newConfig: Partial<ImportanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): ImportanceConfig {
    return { ...this.config };
  }

  getTopEntities(entities: OntologyObject[], topN: number = 10): { entity: OntologyObject; score: ImportanceScore }[] {
    return entities
      .map(entity => ({ entity, score: this.score(entity) }))
      .sort((a, b) => b.score.overall - a.score.overall)
      .slice(0, topN);
  }
}

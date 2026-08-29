export interface AttributionFactor {
  factor: string;
  factorLabel: string;
  contribution: number;
  contributionPercent: number;
  direction: 'positive' | 'negative' | 'neutral';
  confidence: number;
  evidence: string;
  standardizedCoefficient?: number;
}

export interface AttributionResult {
  targetId: string;
  targetName: string;
  targetMetric: string;
  period: string;
  method: string;
  totalChange: number;
  attributionFactors: AttributionFactor[];
  unexplained: number;
  modelFit: number;
  computedAt: string;
  message?: string;
}

export interface DimensionAnalysis {
  [key: string]: {
    title: string;
    attributes?: Record<string, any>;
    metrics?: Record<string, any>;
    insights: string[];
    trends?: Record<string, any>;
    recent_events?: any[];
  };
}

export interface MultiDimensionAttribution {
  targetId: string;
  targetName: string;
  period: string;
  dimensions: DimensionAnalysis;
  computedAt: string;
}

export interface ValidationResults {
  targetId: string;
  targetName: string;
  targetMetric: string;
  period: string;
  validationStatus: string;
  overallConfidence: number;
  backtestAccuracy: number;
  stabilityScore: number;
  sensitivityAnalysis: {
    sensitivities: any[];
    avg_sensitivity: number;
    high_sensitivity_factors: string[];
  };
  confidenceInterval: {
    lower: number;
    upper: number;
  };
  recommendations: string[];
  computedAt: string;
}

export interface AttributionReport {
  reportId: string;
  generatedAt: string;
  targetInfo: {
    id: string;
    name: string;
    type: string;
    metric: string;
    period: string;
  };
  executiveSummary: string;
  attributionDetails: AttributionResult;
  dimensionAnalysis: MultiDimensionAttribution;
  validationResults: ValidationResults;
  recommendations: any[];
}

export type AttributionMethod = 'shapley' | 'regression' | 'decomposition' | 'comparison';
export type AttributionPeriod = '30d' | '90d' | '180d' | '1y';
export type AttributionMetric = 'prescription_volume' | 'achievement_rate' | 'churn_risk';

export class AttributionEngine {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  async fetchAttribution(
    targetId: string,
    targetMetric: AttributionMetric = 'prescription_volume',
    period: AttributionPeriod = '90d',
    method: AttributionMethod = 'shapley',
    token?: string
  ): Promise<AttributionResult> {
    const params = new URLSearchParams({
      target_id: targetId,
      target_metric: targetMetric,
      period,
      method,
    });

    const response = await fetch(`${this.baseUrl}/reasoning/attribution?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`归因分析请求失败: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchMultiDimension(
    targetId: string,
    targetMetric: AttributionMetric = 'prescription_volume',
    period: AttributionPeriod = '90d',
    dimensions?: string[],
    token?: string
  ): Promise<MultiDimensionAttribution> {
    const params = new URLSearchParams({
      target_id: targetId,
      target_metric: targetMetric,
      period,
    });

    if (dimensions && dimensions.length > 0) {
      params.set('dimensions', dimensions.join(','));
    }

    const response = await fetch(`${this.baseUrl}/reasoning/attribution/dimensions?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`多维度归因分析请求失败: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchValidation(
    targetId: string,
    targetMetric: AttributionMetric = 'prescription_volume',
    period: AttributionPeriod = '90d',
    token?: string
  ): Promise<ValidationResults> {
    const params = new URLSearchParams({
      target_id: targetId,
      target_metric: targetMetric,
      period,
    });

    const response = await fetch(`${this.baseUrl}/reasoning/attribution/validate?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`归因验证请求失败: ${response.statusText}`);
    }

    return response.json();
  }

  async fetchReport(
    targetId: string,
    targetMetric: AttributionMetric = 'prescription_volume',
    period: AttributionPeriod = '90d',
    format: string = 'json',
    token?: string
  ): Promise<AttributionReport> {
    const params = new URLSearchParams({
      target_id: targetId,
      target_metric: targetMetric,
      period,
      format,
    });

    const response = await fetch(`${this.baseUrl}/reasoning/attribution/report?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`归因报告请求失败: ${response.statusText}`);
    }

    return response.json();
  }

  calculateWaterfallData(factors: AttributionFactor[]): Array<{ label: string; value: number; type: string }> {
    const data: Array<{ label: string; value: number; type: string }> = [];

    for (const factor of factors) {
      data.push({
        label: factor.factorLabel,
        value: factor.contribution,
        type: factor.direction === 'positive' ? 'positive' : factor.direction === 'negative' ? 'negative' : 'neutral',
      });
    }

    return data;
  }

  sortFactorsByContribution(factors: AttributionFactor[]): AttributionFactor[] {
    return [...factors].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }

  getTopFactors(factors: AttributionFactor[], count: number = 3): AttributionFactor[] {
    return this.sortFactorsByContribution(factors).slice(0, count);
  }

  calculateConfidenceScore(attributionResult: AttributionResult): number {
    if (attributionResult.attributionFactors.length === 0) {
      return 0;
    }

    const avgConfidence = attributionResult.attributionFactors.reduce(
      (sum, f) => sum + f.confidence,
      0
    ) / attributionResult.attributionFactors.length;

    const modelFitWeight = attributionResult.modelFit * 0.3;
    const confidenceWeight = avgConfidence * 0.7;

    return modelFitWeight + confidenceWeight;
  }

  formatMetricValue(metric: string, value: number): string {
    switch (metric) {
      case 'prescription_volume':
        return `${value.toFixed(0)} 处方`;
      case 'achievement_rate':
        return `${value.toFixed(1)}%`;
      case 'churn_risk':
        return `${(value * 100).toFixed(1)}%`;
      default:
        return value.toFixed(2);
    }
  }

  getMetricLabel(metric: string): string {
    const labels: Record<string, string> = {
      prescription_volume: '处方量',
      achievement_rate: '达成率',
      churn_risk: '流失风险',
    };
    return labels[metric] || metric;
  }

  getMethodLabel(method: string): string {
    const labels: Record<string, string> = {
      shapley: 'Shapley 值归因',
      regression: '回归系数归因',
      decomposition: '时间序列分解',
      comparison: '对比分析归因',
    };
    return labels[method] || method;
  }

  getPeriodLabel(period: string): string {
    const labels: Record<string, string> = {
      '30d': '近 30 天',
      '90d': '近 90 天',
      '180d': '近 180 天',
      '1y': '近 1 年',
    };
    return labels[period] || period;
  }
}

export const attributionEngine = new AttributionEngine();

import { OntologyObject, TimeSeriesDataPoint } from '../types';

export enum AnomalyType {
  SUDDEN_DROP = 'sudden_drop',
  SUDDEN_RISE = 'sudden_rise',
  TREND_REVERSAL = 'trend_reversal',
  VOLATILITY_SPIKE = 'volatility_spike',
  PATTERN_BREAK = 'pattern_break',
  OUTLIER = 'outlier',
}

export interface AnomalyDetectionResult {
  type: AnomalyType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedMetrics: string[];
  detectedAt: string;
  confidence: number;
  value?: number;
  expectedValue?: number;
  deviation?: number;
  suggestedActions: string[];
}

export interface AnomalyConfig {
  sensitivity: number;
  minDataPoints: number;
  windowSize: number;
  thresholds: {
    suddenChange: number;
    volatilityMultiplier: number;
    patternBreakThreshold: number;
  };
}

const DEFAULT_CONFIG: AnomalyConfig = {
  sensitivity: 3,
  minDataPoints: 3,
  windowSize: 7,
  thresholds: {
    suddenChange: 0.3,
    volatilityMultiplier: 2.5,
    patternBreakThreshold: 0.2,
  },
};

export class AnomalyDetector {
  private config: AnomalyConfig;

  constructor(config?: Partial<AnomalyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  detectAll(entity: OntologyObject): AnomalyDetectionResult[] {
    const anomalies: AnomalyDetectionResult[] = [];
    const timestamp = new Date().toISOString();

    for (const [metricName, timeSeries] of Object.entries(entity.timeSeries)) {
      if (timeSeries.length < this.config.minDataPoints) continue;

      const suddenDrop = this.detectSuddenDrop(timeSeries, metricName);
      if (suddenDrop) anomalies.push({ ...suddenDrop, detectedAt: timestamp });

      const suddenRise = this.detectSuddenRise(timeSeries, metricName);
      if (suddenRise) anomalies.push({ ...suddenRise, detectedAt: timestamp });

      const trendReversal = this.detectTrendReversal(timeSeries, metricName);
      if (trendReversal) anomalies.push({ ...trendReversal, detectedAt: timestamp });

      const volatilitySpike = this.detectVolatilitySpike(timeSeries, metricName);
      if (volatilitySpike) anomalies.push({ ...volatilitySpike, detectedAt: timestamp });

      const patternBreak = this.detectPatternBreak(timeSeries, metricName);
      if (patternBreak) anomalies.push({ ...patternBreak, detectedAt: timestamp });

      const outliers = this.detectOutliers(timeSeries, metricName);
      anomalies.push(...outliers.map(o => ({ ...o, detectedAt: timestamp })));
    }

    const propertyAnomalies = this.detectPropertyAnomalies(entity);
    anomalies.push(...propertyAnomalies.map(a => ({ ...a, detectedAt: timestamp })));

    return anomalies.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private detectSuddenDrop(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): AnomalyDetectionResult | null {
    if (timeSeries.length < 2) return null;

    const values = timeSeries.map(d => d.value);
    const lastValue = values[values.length - 1];
    const prevValue = values[values.length - 2];
    
    if (prevValue <= 0) return null;

    const changeRate = (prevValue - lastValue) / prevValue;
    
    if (changeRate >= this.config.thresholds.suddenChange) {
      const severity = this.determineSeverity(changeRate, 0.3, 0.5, 0.7);
      
      return {
        type: AnomalyType.SUDDEN_DROP,
        severity,
        description: `${metricName} 突然下降 ${(changeRate * 100).toFixed(1)}%`,
        affectedMetrics: [metricName],
        confidence: Math.min(0.95, 0.6 + changeRate),
        value: lastValue,
        expectedValue: prevValue,
        deviation: changeRate,
        suggestedActions: [
          '立即调查下降原因',
          '检查数据准确性',
          '评估业务影响',
          '制定恢复策略',
        ],
        detectedAt: '',
      };
    }

    return null;
  }

  private detectSuddenRise(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): AnomalyDetectionResult | null {
    if (timeSeries.length < 2) return null;

    const values = timeSeries.map(d => d.value);
    const lastValue = values[values.length - 1];
    const prevValue = values[values.length - 2];
    
    if (prevValue <= 0) return null;

    const changeRate = (lastValue - prevValue) / prevValue;
    
    if (changeRate >= this.config.thresholds.suddenChange) {
      const severity = this.determineSeverity(changeRate, 0.3, 0.5, 0.7);
      
      return {
        type: AnomalyType.SUDDEN_RISE,
        severity,
        description: `${metricName} 突然上升 ${(changeRate * 100).toFixed(1)}%`,
        affectedMetrics: [metricName],
        confidence: Math.min(0.9, 0.5 + changeRate * 0.5),
        value: lastValue,
        expectedValue: prevValue,
        deviation: changeRate,
        suggestedActions: [
          '验证数据准确性',
          '分析上升原因',
          '评估可持续性',
        ],
        detectedAt: '',
      };
    }

    return null;
  }

  private detectTrendReversal(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): AnomalyDetectionResult | null {
    if (timeSeries.length < 5) return null;

    const values = timeSeries.map(d => d.value);
    const midPoint = Math.floor(values.length / 2);
    
    const firstHalf = values.slice(0, midPoint);
    const secondHalf = values.slice(midPoint);
    
    const firstTrend = this.calculateTrend(firstHalf);
    const secondTrend = this.calculateTrend(secondHalf);
    
    if ((firstTrend > 0 && secondTrend < -0.01) || (firstTrend < -0.01 && secondTrend > 0)) {
      const trendChange = Math.abs(secondTrend - firstTrend);
      const severity = this.determineSeverity(trendChange, 0.02, 0.05, 0.1);
      
      return {
        type: AnomalyType.TREND_REVERSAL,
        severity,
        description: `${metricName} 趋势发生反转，从${firstTrend > 0 ? '上升' : '下降'}转为${secondTrend > 0 ? '上升' : '下降'}`,
        affectedMetrics: [metricName],
        confidence: Math.min(0.85, 0.5 + trendChange * 5),
        suggestedActions: [
          '分析趋势反转原因',
          '评估对业务的影响',
          '调整策略应对新趋势',
        ],
        detectedAt: '',
      };
    }

    return null;
  }

  private detectVolatilitySpike(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): AnomalyDetectionResult | null {
    if (timeSeries.length < this.config.windowSize * 2) return null;

    const values = timeSeries.map(d => d.value);
    const windowSize = this.config.windowSize;
    
    const recentValues = values.slice(-windowSize);
    const historicalValues = values.slice(0, -windowSize);
    
    const recentVolatility = this.calculateVolatility(recentValues);
    const historicalVolatility = this.calculateVolatility(historicalValues);
    
    if (historicalVolatility > 0) {
      const volatilityRatio = recentVolatility / historicalVolatility;
      
      if (volatilityRatio > this.config.thresholds.volatilityMultiplier) {
        const severity = this.determineSeverity(volatilityRatio, 2.5, 4, 6);
        
        return {
          type: AnomalyType.VOLATILITY_SPIKE,
          severity,
          description: `${metricName} 波动率激增 ${((volatilityRatio - 1) * 100).toFixed(0)}%`,
          affectedMetrics: [metricName],
          confidence: Math.min(0.9, 0.5 + volatilityRatio * 0.1),
          value: recentVolatility,
          expectedValue: historicalVolatility,
          deviation: volatilityRatio,
          suggestedActions: [
            '调查波动原因',
            '评估风险敞口',
            '建立稳定机制',
          ],
          detectedAt: '',
        };
      }
    }

    return null;
  }

  private detectPatternBreak(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): AnomalyDetectionResult | null {
    if (timeSeries.length < 10) return null;

    const values = timeSeries.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const recentValues = values.slice(-3);
    const historicalMean = values.slice(0, -3).reduce((a, b) => a + b, 0) / (values.length - 3);
    
    const recentDeviation = recentValues.reduce((sum, v) => {
      return sum + Math.abs(v - historicalMean);
    }, 0) / recentValues.length;
    
    const normalizedDeviation = stdDev > 0 ? recentDeviation / stdDev : 0;
    
    if (normalizedDeviation > this.config.thresholds.patternBreakThreshold * 10) {
      const severity = this.determineSeverity(normalizedDeviation, 2, 3, 4);
      
      return {
        type: AnomalyType.PATTERN_BREAK,
        severity,
        description: `${metricName} 打破历史模式，偏离正常范围`,
        affectedMetrics: [metricName],
        confidence: Math.min(0.85, 0.5 + normalizedDeviation * 0.1),
        suggestedActions: [
          '分析模式打破原因',
          '评估是否为结构性变化',
          '调整预测模型',
        ],
        detectedAt: '',
      };
    }

    return null;
  }

  private detectOutliers(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): AnomalyDetectionResult[] {
    if (timeSeries.length < 3) return [];

    const values = timeSeries.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return [];

    const outliers: AnomalyDetectionResult[] = [];
    const recentPoints = timeSeries.slice(-5);

    for (const point of recentPoints) {
      const zScore = Math.abs(point.value - mean) / stdDev;
      
      if (zScore > this.config.sensitivity) {
        const severity = this.determineSeverity(zScore, 3, 4, 5);
        
        outliers.push({
          type: AnomalyType.OUTLIER,
          severity,
          description: `${metricName} 在 ${point.timestamp} 出现离群值`,
          affectedMetrics: [metricName],
          confidence: Math.min(0.95, 0.6 + zScore * 0.05),
          value: point.value,
          expectedValue: mean,
          deviation: zScore,
          suggestedActions: [
            '验证数据准确性',
            '调查异常原因',
          ],
          detectedAt: '',
        });
      }
    }

    return outliers;
  }

  private detectPropertyAnomalies(entity: OntologyObject): AnomalyDetectionResult[] {
    const anomalies: AnomalyDetectionResult[] = [];

    if (entity.status === 'critical') {
      anomalies.push({
        type: AnomalyType.PATTERN_BREAK,
        severity: 'high',
        description: `${entity.name} 处于危急状态`,
        affectedMetrics: ['status'],
        confidence: 0.95,
        suggestedActions: [
          '立即关注',
          '制定干预措施',
        ],
        detectedAt: '',
      });
    }

    const achievementRate = entity.properties.achievementRate || entity.properties.achievement_rate;
    if (achievementRate !== undefined && achievementRate < 70) {
      anomalies.push({
        type: AnomalyType.SUDDEN_DROP,
        severity: achievementRate < 50 ? 'high' : 'medium',
        description: `${entity.name} 目标达成率仅 ${achievementRate.toFixed(1)}%`,
        affectedMetrics: ['achievementRate'],
        confidence: 0.9,
        value: achievementRate,
        expectedValue: 100,
        deviation: (100 - achievementRate) / 100,
        suggestedActions: [
          '分析达成率低的原因',
          '制定追赶计划',
          '调整资源配置',
        ],
        detectedAt: '',
      });
    }

    return anomalies;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = values.map((_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * values[i], 0);
    const sumXX = x.reduce((total, xi) => total + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgValue = sumY / n;
    
    return avgValue > 0 ? slope / avgValue : 0;
  }

  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private determineSeverity(
    value: number,
    _lowThreshold: number,
    mediumThreshold: number,
    highThreshold: number
  ): 'low' | 'medium' | 'high' {
    if (value >= highThreshold) return 'high';
    if (value >= mediumThreshold) return 'medium';
    return 'low';
  }

  updateConfig(newConfig: Partial<AnomalyConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): AnomalyConfig {
    return { ...this.config };
  }
}

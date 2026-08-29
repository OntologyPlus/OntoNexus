import { TimeSeriesDataPoint, OntologyObject } from '../types';
import { TrendPrediction } from '../inference';

export enum PatternType {
  GROWING = 'growing',
  DECLINING = 'declining',
  STABLE = 'stable',
  SEASONAL = 'seasonal',
  CYCLICAL = 'cyclical',
  UNSTABLE = 'unstable',
}

export interface PatternResult {
  type: PatternType;
  confidence: number;
  description: string;
  relatedMetrics: string[];
  parameters?: {
    growthRate?: number;
    period?: number;
    amplitude?: number;
    stability?: number;
    volatility?: number;
  };
  detectedAt: string;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  strength: number;
  confidence: number;
  slope: number;
  r2: number;
}

export interface SeasonalityAnalysis {
  hasSeasonality: boolean;
  period: number;
  amplitude: number;
  phase: number;
  confidence: number;
}

export interface StabilityAnalysis {
  isStable: boolean;
  coefficient: number;
  volatility: number;
  confidence: number;
}

export class PatternRecognizer {
  private minDataPoints: number = 4;
  private seasonalityThreshold: number = 0.6;
  private stabilityThreshold: number = 0.15;

  recognizeAll(entity: OntologyObject): PatternResult[] {
    const patterns: PatternResult[] = [];
    const timestamp = new Date().toISOString();

    for (const [metricName, timeSeries] of Object.entries(entity.timeSeries)) {
      if (timeSeries.length < this.minDataPoints) continue;

      const trendPattern = this.recognizeTrendPattern(timeSeries, metricName);
      if (trendPattern) patterns.push({ ...trendPattern, detectedAt: timestamp });

      const seasonalityPattern = this.recognizeSeasonalityPattern(timeSeries, metricName);
      if (seasonalityPattern) patterns.push({ ...seasonalityPattern, detectedAt: timestamp });

      const stabilityPattern = this.recognizeStabilityPattern(timeSeries, metricName);
      if (stabilityPattern) patterns.push({ ...stabilityPattern, detectedAt: timestamp });
    }

    return patterns;
  }

  recognizeTrendPattern(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): PatternResult | null {
    if (timeSeries.length < this.minDataPoints) return null;

    const trend = this.analyzeTrend(timeSeries);
    
    let patternType: PatternType;
    let description: string;
    
    if (trend.direction === 'up' && trend.strength > 0.3) {
      patternType = PatternType.GROWING;
      description = `${metricName} 呈现上升趋势，增长率 ${(trend.slope * 100).toFixed(1)}%`;
    } else if (trend.direction === 'down' && trend.strength > 0.3) {
      patternType = PatternType.DECLINING;
      description = `${metricName} 呈现下降趋势，下降率 ${(Math.abs(trend.slope) * 100).toFixed(1)}%`;
    } else {
      patternType = PatternType.STABLE;
      description = `${metricName} 趋势稳定`;
    }

    return {
      type: patternType,
      confidence: trend.confidence,
      description,
      relatedMetrics: [metricName],
      parameters: {
        growthRate: trend.slope,
        stability: trend.r2,
      },
      detectedAt: '',
    };
  }

  recognizeSeasonalityPattern(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): PatternResult | null {
    if (timeSeries.length < 8) return null;

    const seasonality = this.analyzeSeasonality(timeSeries);
    
    if (!seasonality.hasSeasonality || seasonality.confidence < this.seasonalityThreshold) {
      return null;
    }

    return {
      type: PatternType.SEASONAL,
      confidence: seasonality.confidence,
      description: `${metricName} 存在周期性模式，周期约 ${seasonality.period} 个时间单位`,
      relatedMetrics: [metricName],
      parameters: {
        period: seasonality.period,
        amplitude: seasonality.amplitude,
      },
      detectedAt: '',
    };
  }

  recognizeStabilityPattern(
    timeSeries: TimeSeriesDataPoint[],
    metricName: string
  ): PatternResult | null {
    if (timeSeries.length < this.minDataPoints) return null;

    const stability = this.analyzeStability(timeSeries);
    
    if (stability.isStable) {
      return {
        type: PatternType.STABLE,
        confidence: stability.confidence,
        description: `${metricName} 数据稳定，变异系数 ${(stability.coefficient * 100).toFixed(1)}%`,
        relatedMetrics: [metricName],
        parameters: {
          stability: stability.coefficient,
          volatility: stability.volatility,
        },
        detectedAt: '',
      };
    } else {
      return {
        type: PatternType.UNSTABLE,
        confidence: stability.confidence,
        description: `${metricName} 数据波动较大，变异系数 ${(stability.coefficient * 100).toFixed(1)}%`,
        relatedMetrics: [metricName],
        parameters: {
          stability: stability.coefficient,
          volatility: stability.volatility,
        },
        detectedAt: '',
      };
    }
  }

  analyzeTrend(timeSeries: TimeSeriesDataPoint[]): TrendAnalysis {
    const values = timeSeries.map(d => d.value);
    const n = values.length;
    
    const x = values.map((_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * values[i], 0);
    const sumXX = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const meanY = sumY / n;
    const ssTotal = values.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
    const ssResidual = values.reduce((sum, yi, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const r2 = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    
    let direction: 'up' | 'down' | 'stable' = 'stable';
    const avgValue = meanY || 1;
    const normalizedSlope = slope / avgValue;
    
    if (normalizedSlope > 0.01) direction = 'up';
    else if (normalizedSlope < -0.01) direction = 'down';
    
    const strength = Math.min(1, Math.abs(normalizedSlope) * 10);
    const confidence = Math.min(0.95, 0.5 + r2 * 0.45);

    return {
      direction,
      strength,
      confidence,
      slope: normalizedSlope,
      r2,
    };
  }

  analyzeSeasonality(timeSeries: TimeSeriesDataPoint[]): SeasonalityAnalysis {
    const values = timeSeries.map(d => d.value);
    const n = values.length;
    
    if (n < 4) {
      return {
        hasSeasonality: false,
        period: 0,
        amplitude: 0,
        phase: 0,
        confidence: 0,
      };
    }

    const mean = values.reduce((a, b) => a + b, 0) / n;
    
    let maxCorrelation = 0;
    let bestPeriod = 0;
    
    for (let lag = 2; lag <= Math.floor(n / 2); lag++) {
      let correlation = 0;
      let variance1 = 0;
      let variance2 = 0;
      
      for (let i = 0; i < n - lag; i++) {
        const diff1 = values[i] - mean;
        const diff2 = values[i + lag] - mean;
        correlation += diff1 * diff2;
        variance1 += diff1 * diff1;
        variance2 += diff2 * diff2;
      }
      
      if (variance1 > 0 && variance2 > 0) {
        correlation /= Math.sqrt(variance1 * variance2);
        if (correlation > maxCorrelation) {
          maxCorrelation = correlation;
          bestPeriod = lag;
        }
      }
    }
    
    const amplitude = Math.max(...values) - Math.min(...values);
    const phase = values.indexOf(Math.max(...values)) % (bestPeriod || 1);
    
    return {
      hasSeasonality: maxCorrelation > this.seasonalityThreshold,
      period: bestPeriod,
      amplitude,
      phase,
      confidence: maxCorrelation,
    };
  }

  analyzeStability(timeSeries: TimeSeriesDataPoint[]): StabilityAnalysis {
    const values = timeSeries.map(d => d.value);
    const n = values.length;
    
    if (n < 2) {
      return {
        isStable: true,
        coefficient: 0,
        volatility: 0,
        confidence: 1,
      };
    }

    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    
    const coefficient = mean > 0 ? stdDev / mean : 0;
    
    const differences: number[] = [];
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        differences.push(Math.abs(values[i] - values[i - 1]) / Math.abs(values[i - 1]));
      }
    }
    
    const volatility = differences.length > 0 
      ? differences.reduce((a, b) => a + b, 0) / differences.length 
      : 0;
    
    const isStable = coefficient < this.stabilityThreshold;
    const confidence = isStable 
      ? Math.max(0.5, 1 - coefficient * 2)
      : Math.min(0.95, 0.5 + coefficient);

    return {
      isStable,
      coefficient,
      volatility,
      confidence,
    };
  }

  predictTrend(timeSeries: TimeSeriesDataPoint[], horizon: number): TrendPrediction {
    if (timeSeries.length < 2) {
      return {
        forecast: [],
        confidenceInterval: [],
        trendDirection: 'stable',
        growthRate: 0,
        seasonalityDetected: false,
      };
    }

    const values = timeSeries.map(d => d.value);
    const n = values.length;
    
    const x = values.map((_, i) => i);
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * values[i], 0);
    const sumXX = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    const residuals = values.map((yi, i) => yi - (slope * i + intercept));
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const stdError = Math.sqrt(mse);
    
    const forecast: TimeSeriesDataPoint[] = [];
    const confidenceInterval: [number, number][] = [];
    
    const lastTimestamp = timeSeries[timeSeries.length - 1].timestamp;
    
    for (let i = 0; i < horizon; i++) {
      const xNew = n + i;
      const predictedValue = slope * xNew + intercept;
      const timestamp = this.generateFutureTimestamp(lastTimestamp, i + 1);
      
      forecast.push({
        timestamp,
        value: Math.max(0, predictedValue),
      });
      
      const margin = 1.96 * stdError * Math.sqrt(1 + 1/n + Math.pow(xNew - sumX/n, 2) / (sumXX - sumX * sumX / n));
      confidenceInterval.push([
        Math.max(0, predictedValue - margin),
        predictedValue + margin,
      ]);
    }
    
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    const avgValue = sumY / n || 1;
    const normalizedSlope = slope / avgValue;
    
    if (normalizedSlope > 0.01) trendDirection = 'up';
    else if (normalizedSlope < -0.01) trendDirection = 'down';
    
    const firstValue = values[0];
    const lastValue = values[values.length - 1];
    const growthRate = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    
    const seasonality = this.analyzeSeasonality(timeSeries);

    return {
      forecast,
      confidenceInterval,
      trendDirection,
      growthRate,
      seasonalityDetected: seasonality.hasSeasonality,
    };
  }

  private generateFutureTimestamp(lastTimestamp: string, steps: number): string {
    if (lastTimestamp.includes('Q')) {
      const [year, quarter] = lastTimestamp.split('-Q');
      let q = parseInt(quarter) + steps;
      let y = parseInt(year);
      while (q > 4) {
        q -= 4;
        y++;
      }
      return `${y}-Q${q}`;
    } else if (lastTimestamp.includes('-')) {
      const parts = lastTimestamp.split('-');
      if (parts.length === 2) {
        const [year, month] = parts.map(Number);
        let m = month + steps;
        let y = year;
        while (m > 12) {
          m -= 12;
          y++;
        }
        return `${y}-${m.toString().padStart(2, '0')}`;
      }
    }
    
    return `${lastTimestamp}+${steps}`;
  }
}

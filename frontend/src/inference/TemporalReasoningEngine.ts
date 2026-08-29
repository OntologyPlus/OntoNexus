import { TimeSeriesDataPoint, OntologyObject, ObjectType } from '../types';

// ============================================
// 时间推理引擎
// ============================================

export interface TrendPrediction {
  forecast: TimeSeriesDataPoint[];
  confidenceInterval: [number, number][];
  trendDirection: 'up' | 'down' | 'stable';
  growthRate: number;
  seasonalityDetected: boolean;
}

export interface SeasonalityPattern {
  period: number;
  amplitude: number;
  phase: number;
  confidence: number;
}

export interface AnomalyPoint {
  timestamp: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: 'low' | 'medium' | 'high';
}

export class TemporalReasoningEngine {
  /**
   * 趋势预测 - 使用简单线性回归
   */
  predictTrend(
    timeSeries: TimeSeriesDataPoint[],
    horizon: number
  ): TrendPrediction {
    if (timeSeries.length < 2) {
      return {
        forecast: [],
        confidenceInterval: [],
        trendDirection: 'stable',
        growthRate: 0,
        seasonalityDetected: false,
      };
    }

    // 计算线性回归参数
    const n = timeSeries.length;
    const x = timeSeries.map((_, i) => i);
    const y = timeSeries.map(d => d.value);
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumXX = x.reduce((total, xi) => total + xi * xi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // 计算标准误差
    const residuals = y.map((yi, i) => yi - (slope * x[i] + intercept));
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const stdError = Math.sqrt(mse);
    
    // 生成预测
    const forecast: TimeSeriesDataPoint[] = [];
    const confidenceInterval: [number, number][] = [];
    
    for (let i = 0; i < horizon; i++) {
      const xNew = n + i;
      const predictedValue = slope * xNew + intercept;
      const timestamp = this.generateFutureTimestamp(
        timeSeries[timeSeries.length - 1].timestamp,
        i + 1
      );
      
      forecast.push({
        timestamp,
        value: Math.max(0, predictedValue),
      });
      
      // 95% 置信区间
      const margin = 1.96 * stdError * Math.sqrt(1 + 1/n + Math.pow(xNew - sumX/n, 2) / (sumXX - sumX * sumX / n));
      confidenceInterval.push([
        Math.max(0, predictedValue - margin),
        predictedValue + margin,
      ]);
    }
    
    // 判断趋势方向
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (slope > 0.01) trendDirection = 'up';
    else if (slope < -0.01) trendDirection = 'down';
    
    // 计算增长率
    const firstValue = timeSeries[0].value;
    const lastValue = timeSeries[timeSeries.length - 1].value;
    const growthRate = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    
    return {
      forecast,
      confidenceInterval,
      trendDirection,
      growthRate,
      seasonalityDetected: this.detectSeasonality(timeSeries).confidence > 0.7,
    };
  }
  
  /**
   * 周期性检测 - 使用自相关分析
   */
  detectSeasonality(timeSeries: TimeSeriesDataPoint[]): SeasonalityPattern {
    if (timeSeries.length < 4) {
      return { period: 0, amplitude: 0, phase: 0, confidence: 0 };
    }
    
    const values = timeSeries.map(d => d.value);
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    
    // 计算自相关
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
    
    // 计算振幅
    const amplitude = Math.max(...values) - Math.min(...values);
    
    // 计算相位
    const phase = values.indexOf(Math.max(...values)) % (bestPeriod || 1);
    
    return {
      period: bestPeriod,
      amplitude,
      phase,
      confidence: maxCorrelation,
    };
  }
  
  /**
   * 异常检测 - 使用3-sigma法则
   */
  detectAnomalies(
    timeSeries: TimeSeriesDataPoint[],
    sensitivity: number = 3
  ): AnomalyPoint[] {
    if (timeSeries.length < 3) return [];
    
    const values = timeSeries.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    const anomalies: AnomalyPoint[] = [];
    
    timeSeries.forEach((point) => {
      const deviation = Math.abs(point.value - mean);
      const zScore = deviation / stdDev;
      
      if (zScore > sensitivity) {
        let severity: 'low' | 'medium' | 'high' = 'low';
        if (zScore > sensitivity * 1.5) severity = 'high';
        else if (zScore > sensitivity * 1.2) severity = 'medium';
        
        anomalies.push({
          timestamp: point.timestamp,
          value: point.value,
          expectedValue: mean,
          deviation: zScore,
          severity,
        });
      }
    });
    
    return anomalies;
  }
  
  /**
   * 时间聚合
   */
  aggregateByTime(
    data: TimeSeriesDataPoint[],
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year'
  ): TimeSeriesDataPoint[] {
    const groups: { [key: string]: number[] } = {};
    
    data.forEach(point => {
      const key = this.getGranularityKey(point.timestamp, granularity);
      if (!groups[key]) groups[key] = [];
      groups[key].push(point.value);
    });
    
    return Object.entries(groups).map(([timestamp, values]) => ({
      timestamp,
      value: values.reduce((a, b) => a + b, 0) / values.length,
    })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  
  /**
   * 计算同比/环比
   */
  calculateGrowthRate(
    timeSeries: TimeSeriesDataPoint[],
    type: 'yoy' | 'mom'
  ): { timestamp: string; growthRate: number }[] {
    const period = type === 'yoy' ? 4 : 1; // 假设季度数据
    const result: { timestamp: string; growthRate: number }[] = [];
    
    for (let i = period; i < timeSeries.length; i++) {
      const current = timeSeries[i].value;
      const previous = timeSeries[i - period].value;
      const growthRate = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      
      result.push({
        timestamp: timeSeries[i].timestamp,
        growthRate,
      });
    }
    
    return result;
  }
  
  /**
   * 生成未来时间戳
   */
  private generateFutureTimestamp(lastTimestamp: string, steps: number): string {
    // 支持多种时间格式
    if (lastTimestamp.includes('Q')) {
      // 季度格式: 2026-Q1
      const [year, quarter] = lastTimestamp.split('-Q');
      let q = parseInt(quarter) + steps;
      let y = parseInt(year);
      while (q > 4) {
        q -= 4;
        y++;
      }
      return `${y}-Q${q}`;
    } else if (lastTimestamp.includes('-')) {
      // 月份格式: 2026-01
      const [year, month] = lastTimestamp.split('-').map(Number);
      let m = month + steps;
      let y = year;
      while (m > 12) {
        m -= 12;
        y++;
      }
      return `${y}-${m.toString().padStart(2, '0')}`;
    }
    
    return `${lastTimestamp}+${steps}`;
  }
  
  /**
   * 获取粒度键
   */
  private getGranularityKey(
    timestamp: string,
    granularity: 'day' | 'week' | 'month' | 'quarter' | 'year'
  ): string {
    const date = new Date(timestamp);
    
    switch (granularity) {
      case 'day':
        return timestamp;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
      case 'month':
        return timestamp.substring(0, 7);
      case 'quarter':
        const quarter = Math.floor((date.getMonth() + 3) / 3);
        return `${date.getFullYear()}-Q${quarter}`;
      case 'year':
        return timestamp.substring(0, 4);
      default:
        return timestamp;
    }
  }
}

// ============================================
// 空间推理引擎
// ============================================

export interface AggregationResult {
  aggregatedValue: number;
  breakdown: { [key: string]: number };
  contribution: { [key: string]: number };
  trend: 'up' | 'down' | 'stable';
}

export interface SpatialCorrelation {
  correlation: number;
  significance: number;
  direction: 'positive' | 'negative' | 'none';
}

export interface CoverageAnalysis {
  coverage: number;
  gaps: string[];
  overlaps: string[];
  recommendations: string[];
}

export class SpatialReasoningEngine {
  /**
   * 层级聚合
   */
  aggregateByHierarchy(
    data: OntologyObject[],
    propertyName: string,
    _hierarchyType: 'territory' | 'organization' | 'product'
  ): AggregationResult {
    const breakdown: { [key: string]: number } = {};
    let totalValue = 0;
    
    data.forEach(obj => {
      const value = obj.properties[propertyName] || 0;
      const key = obj.name || obj.id;
      breakdown[key] = value;
      totalValue += value;
    });
    
    // 计算贡献度
    const contribution: { [key: string]: number } = {};
    Object.entries(breakdown).forEach(([key, value]) => {
      contribution[key] = totalValue > 0 ? (value / totalValue) * 100 : 0;
    });
    
    // 判断趋势
    let trend: 'up' | 'down' | 'stable' = 'stable';
    const values = Object.values(breakdown);
    if (values.length >= 2) {
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.05) trend = 'up';
      else if (secondAvg < firstAvg * 0.95) trend = 'down';
    }
    
    return {
      aggregatedValue: totalValue,
      breakdown,
      contribution,
      trend,
    };
  }
  
  /**
   * 空间关联分析
   */
  analyzeSpatialCorrelation(
    entityA: OntologyObject,
    entityB: OntologyObject,
    propertyName: string = 'value'
  ): SpatialCorrelation {
    const valueA = entityA.properties[propertyName] || 0;
    const valueB = entityB.properties[propertyName] || 0;
    
    // 简单的相关性计算
    const correlation = this.calculateCorrelation(valueA, valueB);
    
    let direction: 'positive' | 'negative' | 'none' = 'none';
    if (correlation > 0.3) direction = 'positive';
    else if (correlation < -0.3) direction = 'negative';
    
    return {
      correlation,
      significance: Math.abs(correlation),
      direction,
    };
  }
  
  /**
   * 覆盖分析
   */
  analyzeCoverage(
    territory: OntologyObject,
    targetObjects: OntologyObject[],
    targetType: ObjectType
  ): CoverageAnalysis {
    const covered = new Set<string>();
    const gaps: string[] = [];
    const overlaps: string[] = [];
    
    // 分析覆盖情况
    targetObjects.forEach(obj => {
      if (obj.objectType === targetType) {
        const isLinked = obj.links.some(link => 
          link.targetId === territory.id || link.targetType === territory.objectType
        );
        
        if (isLinked) {
          if (covered.has(obj.id)) {
            overlaps.push(obj.name || obj.id);
          } else {
            covered.add(obj.id);
          }
        } else {
          gaps.push(obj.name || obj.id);
        }
      }
    });
    
    const coverage = targetObjects.length > 0 
      ? (covered.size / targetObjects.length) * 100 
      : 0;
    
    // 生成建议
    const recommendations: string[] = [];
    if (coverage < 80) {
      recommendations.push(`覆盖率仅${coverage.toFixed(1)}%，建议加强对${gaps.slice(0, 3).join('、')}的覆盖`);
    }
    if (overlaps.length > 0) {
      recommendations.push(`发现${overlaps.length}个重叠对象，建议优化资源配置`);
    }
    
    return {
      coverage,
      gaps,
      overlaps,
      recommendations,
    };
  }
  
  /**
   * 区域对比分析
   */
  compareTerritories(
    territories: OntologyObject[],
    metric: string
  ): { territory: string; value: number; rank: number; vsAverage: number }[] {
    const values = territories.map(t => ({
      territory: t.name || t.id,
      value: t.properties[metric] || 0,
    }));
    
    const average = values.reduce((sum, v) => sum + v.value, 0) / values.length;
    
    // 排序并计算排名
    const sorted = values.sort((a, b) => b.value - a.value);
    
    return sorted.map((item, index) => ({
      territory: item.territory,
      value: item.value,
      rank: index + 1,
      vsAverage: average > 0 ? ((item.value - average) / average) * 100 : 0,
    }));
  }
  
  /**
   * 计算相关性
   */
  private calculateCorrelation(a: number, b: number): number {
    // 简化的相关性计算
    const maxVal = Math.max(Math.abs(a), Math.abs(b), 1);
    return (a * b) / (maxVal * maxVal);
  }
}

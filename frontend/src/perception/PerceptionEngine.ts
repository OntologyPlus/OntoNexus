import { OntologyObject, ObjectType } from '../types';
import { AnomalyDetector, AnomalyDetectionResult, AnomalyType } from './AnomalyDetector';
import { PatternRecognizer, PatternResult, PatternType } from './PatternRecognizer';
import { ImportanceScorer, ImportanceScore } from './ImportanceScorer';
import { TrendPrediction } from '../inference';

export type EntityState = 'normal' | 'warning' | 'critical';

export interface EntityPerception {
  entityId: string;
  entityName: string;
  entityType: ObjectType;
  state: EntityState;
  anomalies: AnomalyDetectionResult[];
  patterns: PatternResult[];
  trendPrediction?: TrendPrediction;
  importance: ImportanceScore;
  lastUpdated: string;
  alerts: PerceptionAlert[];
}

export interface PerceptionAlert {
  id: string;
  type: 'risk' | 'opportunity' | 'anomaly' | 'trend';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  relatedMetrics: string[];
  suggestedActions: string[];
  confidence: number;
  timestamp: string;
}

export interface PerceptionResult {
  entities: EntityPerception[];
  summary: {
    totalEntities: number;
    normalCount: number;
    warningCount: number;
    criticalCount: number;
    totalAnomalies: number;
    totalAlerts: number;
  };
  topAlerts: PerceptionAlert[];
  timestamp: string;
}

export class PerceptionEngine {
  private anomalyDetector: AnomalyDetector;
  private patternRecognizer: PatternRecognizer;
  private importanceScorer: ImportanceScorer;
  private perceptionHistory: Map<string, EntityPerception[]> = new Map();

  constructor() {
    this.anomalyDetector = new AnomalyDetector();
    this.patternRecognizer = new PatternRecognizer();
    this.importanceScorer = new ImportanceScorer();
  }

  perceiveEntity(entity: OntologyObject): EntityPerception {
    const anomalies = this.detectAnomalies(entity);
    const patterns = this.recognizePatterns(entity);
    const trendPrediction = this.predictTrend(entity, 7);
    const importance = this.calculateImportance(entity);
    const state = this.determineEntityState(anomalies, patterns);
    const alerts = this.generateAlerts(entity, anomalies, patterns, trendPrediction);

    const perception: EntityPerception = {
      entityId: entity.id,
      entityName: entity.name,
      entityType: entity.objectType,
      state,
      anomalies,
      patterns,
      trendPrediction,
      importance,
      lastUpdated: new Date().toISOString(),
      alerts,
    };

    this.updatePerceptionHistory(entity.id, perception);

    return perception;
  }

  perceiveAll(entities: OntologyObject[]): PerceptionResult {
    const entityPerceptions = entities.map(entity => this.perceiveEntity(entity));
    
    const summary = {
      totalEntities: entityPerceptions.length,
      normalCount: entityPerceptions.filter(p => p.state === 'normal').length,
      warningCount: entityPerceptions.filter(p => p.state === 'warning').length,
      criticalCount: entityPerceptions.filter(p => p.state === 'critical').length,
      totalAnomalies: entityPerceptions.reduce((sum, p) => sum + p.anomalies.length, 0),
      totalAlerts: entityPerceptions.reduce((sum, p) => sum + p.alerts.length, 0),
    };

    const allAlerts = entityPerceptions.flatMap(p => p.alerts);
    const topAlerts = allAlerts
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 10);

    return {
      entities: entityPerceptions,
      summary,
      topAlerts,
      timestamp: new Date().toISOString(),
    };
  }

  monitorEntityState(entity: OntologyObject): EntityState {
    const anomalies = this.anomalyDetector.detectAll(entity);
    const patterns = this.patternRecognizer.recognizeAll(entity);
    return this.determineEntityState(anomalies, patterns);
  }

  private detectAnomalies(entity: OntologyObject): AnomalyDetectionResult[] {
    return this.anomalyDetector.detectAll(entity);
  }

  private recognizePatterns(entity: OntologyObject): PatternResult[] {
    return this.patternRecognizer.recognizeAll(entity);
  }

  private predictTrend(entity: OntologyObject, horizon: number): TrendPrediction | undefined {
    const timeSeriesKeys = Object.keys(entity.timeSeries);
    if (timeSeriesKeys.length === 0) return undefined;

    const primarySeries = entity.timeSeries[timeSeriesKeys[0]];
    if (!primarySeries || primarySeries.length < 3) return undefined;

    return this.patternRecognizer.predictTrend(primarySeries, horizon);
  }

  private calculateImportance(entity: OntologyObject): ImportanceScore {
    return this.importanceScorer.score(entity);
  }

  private determineEntityState(
    anomalies: AnomalyDetectionResult[],
    patterns: PatternResult[]
  ): EntityState {
    const criticalAnomalies = anomalies.filter(a => a.severity === 'high');
    const warningAnomalies = anomalies.filter(a => a.severity === 'medium');
    
    const negativePatterns = patterns.filter(p => 
      p.type === PatternType.DECLINING || 
      p.type === PatternType.UNSTABLE
    );

    if (criticalAnomalies.length > 0) {
      return 'critical';
    }

    if (warningAnomalies.length >= 2 || negativePatterns.length >= 2) {
      return 'warning';
    }

    return 'normal';
  }

  private generateAlerts(
    entity: OntologyObject,
    anomalies: AnomalyDetectionResult[],
    patterns: PatternResult[],
    trendPrediction?: TrendPrediction
  ): PerceptionAlert[] {
    const alerts: PerceptionAlert[] = [];
    const timestamp = new Date().toISOString();

    for (const anomaly of anomalies) {
      alerts.push({
        id: `alert_${entity.id}_${anomaly.type}_${Date.now()}`,
        type: 'anomaly',
        severity: anomaly.severity === 'high' ? 'critical' : 
                  anomaly.severity === 'medium' ? 'high' : 'medium',
        title: this.getAnomalyAlertTitle(anomaly.type),
        description: anomaly.description,
        relatedMetrics: anomaly.affectedMetrics,
        suggestedActions: anomaly.suggestedActions,
        confidence: anomaly.confidence,
        timestamp,
      });
    }

    for (const pattern of patterns) {
      if (pattern.type === PatternType.DECLINING && pattern.confidence > 0.7) {
        alerts.push({
          id: `alert_${entity.id}_declining_${Date.now()}`,
          type: 'risk',
          severity: 'high',
          title: '下降趋势风险',
          description: `${entity.name} 呈现持续下降趋势，置信度 ${(pattern.confidence * 100).toFixed(0)}%`,
          relatedMetrics: pattern.relatedMetrics,
          suggestedActions: [
            '分析下降原因',
            '制定干预策略',
            '加强客户关系维护',
          ],
          confidence: pattern.confidence,
          timestamp,
        });
      }

      if (pattern.type === PatternType.UNSTABLE && pattern.confidence > 0.6) {
        alerts.push({
          id: `alert_${entity.id}_unstable_${Date.now()}`,
          type: 'risk',
          severity: 'medium',
          title: '波动性风险',
          description: `${entity.name} 数据波动较大，稳定性不足`,
          relatedMetrics: pattern.relatedMetrics,
          suggestedActions: [
            '调查波动原因',
            '建立稳定机制',
          ],
          confidence: pattern.confidence,
          timestamp,
        });
      }

      if (pattern.type === PatternType.GROWING && pattern.confidence > 0.7) {
        alerts.push({
          id: `alert_${entity.id}_growing_${Date.now()}`,
          type: 'opportunity',
          severity: 'low',
          title: '增长机会',
          description: `${entity.name} 呈现良好增长趋势`,
          relatedMetrics: pattern.relatedMetrics,
          suggestedActions: [
            '加大资源投入',
            '复制成功经验',
          ],
          confidence: pattern.confidence,
          timestamp,
        });
      }
    }

    if (trendPrediction && trendPrediction.trendDirection === 'down') {
      const predictedDrop = trendPrediction.growthRate < -10;
      alerts.push({
        id: `alert_${entity.id}_trend_${Date.now()}`,
        type: 'trend',
        severity: predictedDrop ? 'high' : 'medium',
        title: '趋势预测预警',
        description: `预测未来7天${entity.name}将下降 ${Math.abs(trendPrediction.growthRate).toFixed(1)}%`,
        relatedMetrics: [],
        suggestedActions: [
          '提前制定应对措施',
          '关注关键指标变化',
        ],
        confidence: 1 - (trendPrediction.confidenceInterval[0]?.[1] || 0.5),
        timestamp,
      });
    }

    return alerts;
  }

  private getAnomalyAlertTitle(type: AnomalyType): string {
    const titles: Record<AnomalyType, string> = {
      [AnomalyType.SUDDEN_DROP]: '突然下降异常',
      [AnomalyType.SUDDEN_RISE]: '突然上升异常',
      [AnomalyType.TREND_REVERSAL]: '趋势反转异常',
      [AnomalyType.VOLATILITY_SPIKE]: '波动率激增',
      [AnomalyType.PATTERN_BREAK]: '模式打破异常',
      [AnomalyType.OUTLIER]: '离群值异常',
    };
    return titles[type] || '未知异常';
  }

  private updatePerceptionHistory(entityId: string, perception: EntityPerception): void {
    if (!this.perceptionHistory.has(entityId)) {
      this.perceptionHistory.set(entityId, []);
    }
    const history = this.perceptionHistory.get(entityId)!;
    history.push(perception);
    if (history.length > 30) {
      history.shift();
    }
  }

  getPerceptionHistory(entityId: string): EntityPerception[] {
    return this.perceptionHistory.get(entityId) || [];
  }

  getStateTransitions(entityId: string): { from: EntityState; to: EntityState; timestamp: string }[] {
    const history = this.perceptionHistory.get(entityId) || [];
    const transitions: { from: EntityState; to: EntityState; timestamp: string }[] = [];

    for (let i = 1; i < history.length; i++) {
      if (history[i - 1].state !== history[i].state) {
        transitions.push({
          from: history[i - 1].state,
          to: history[i].state,
          timestamp: history[i].lastUpdated,
        });
      }
    }

    return transitions;
  }
}

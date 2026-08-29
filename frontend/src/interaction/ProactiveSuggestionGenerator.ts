import { OntologyObject, ObjectType, ReasoningChain } from '../types';
import { EntityPerception, PerceptionAlert } from '../perception/PerceptionEngine';
import { AnomalyDetectionResult } from '../perception/AnomalyDetector';

export interface ProactiveSuggestion {
  id: string;
  type: SuggestionType;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  targetEntities: string[];
  reasoningChain: ReasoningChain;
  suggestedActions: SuggestedAction[];
  expectedImpact: ExpectedImpact;
  validUntil: string;
  createdAt: string;
  status: 'active' | 'acknowledged' | 'dismissed' | 'expired';
}

export type SuggestionType = 
  | 'risk_alert' 
  | 'churn_warning' 
  | 'loyalty_opportunity' 
  | 'predictive_warning' 
  | 'urgent_notification' 
  | 'insight_notification'
  | 'optimization_suggestion'
  | 'resource_recommendation';

export interface SuggestedAction {
  id: string;
  type: string;
  name: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: number;
  expectedOutcome: string;
}

export interface ExpectedImpact {
  metric: string;
  currentValue: number;
  projectedValue: number;
  changePercent: number;
  confidence: number;
}

export interface EntityAlert {
  entityId: string;
  entityName: string;
  entityType: ObjectType;
  alertType: 'risk' | 'churn' | 'loyalty' | 'opportunity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  indicators: string[];
  suggestedActions: string[];
  confidence: number;
  timestamp: string;
}

export interface PredictiveWarning {
  id: string;
  type: 'revenue_drop' | 'market_share_loss' | 'compliance_risk' | 'resource_shortage';
  description: string;
  probability: number;
  timeHorizon: string;
  affectedEntities: string[];
  mitigationActions: string[];
  confidence: number;
}

export interface UrgentNotification {
  id: string;
  type: 'anomaly' | 'threshold_breach' | 'pattern_break' | 'system_alert';
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium';
  relatedEntities: string[];
  immediateActions: string[];
  timestamp: string;
}

export interface InsightNotification {
  id: string;
  type: 'trend' | 'correlation' | 'opportunity' | 'best_practice';
  title: string;
  description: string;
  relevance: number;
  applicability: string[];
  actions: string[];
}

const RISK_INDICATORS = {
  high: {
    achievementRate: 50,
    growthRate: -20,
    visitFrequency: 0.5,
    satisfactionScore: 60,
  },
  medium: {
    achievementRate: 70,
    growthRate: -10,
    visitFrequency: 1,
    satisfactionScore: 70,
  },
};

const CHURN_INDICATORS = {
  critical: {
    activityDrop: 50,
    engagementScore: 30,
    recentInteraction: 30,
  },
  warning: {
    activityDrop: 30,
    engagementScore: 50,
    recentInteraction: 60,
  },
};

export class ProactiveSuggestionGenerator {
  generateEntityAlerts(entities: OntologyObject[]): EntityAlert[] {
    const alerts: EntityAlert[] = [];
    const timestamp = new Date().toISOString();

    for (const entity of entities) {
      const riskAlert = this.checkRiskAlert(entity, timestamp);
      if (riskAlert) alerts.push(riskAlert);

      const churnAlert = this.checkChurnWarning(entity, timestamp);
      if (churnAlert) alerts.push(churnAlert);

      const loyaltyAlert = this.checkLoyaltyOpportunity(entity, timestamp);
      if (loyaltyAlert) alerts.push(loyaltyAlert);
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  generatePredictiveWarnings(
    predictions: { type: string; probability: number; entities: OntologyObject[] }[]
  ): PredictiveWarning[] {
    const warnings: PredictiveWarning[] = [];

    for (const pred of predictions) {
      if (pred.probability > 0.6) {
        warnings.push({
          id: `pred_warn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: this.mapPredictionType(pred.type),
          description: this.generatePredictionDescription(pred),
          probability: pred.probability,
          timeHorizon: '30天',
          affectedEntities: pred.entities.map(e => e.id),
          mitigationActions: this.generateMitigationActions(pred.type),
          confidence: pred.probability * 0.9,
        });
      }
    }

    return warnings;
  }

  generateUrgentNotifications(anomalies: AnomalyDetectionResult[]): UrgentNotification[] {
    const notifications: UrgentNotification[] = [];
    const timestamp = new Date().toISOString();

    for (const anomaly of anomalies) {
      if (anomaly.severity === 'high') {
        notifications.push({
          id: `urgent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'anomaly',
          title: `紧急异常: ${anomaly.description}`,
          message: anomaly.description,
          severity: 'critical',
          relatedEntities: anomaly.affectedMetrics,
          immediateActions: anomaly.suggestedActions,
          timestamp,
        });
      }
    }

    return notifications;
  }

  generateInsightNotifications(insights: { type: string; description: string; confidence: number }[]): InsightNotification[] {
    return insights
      .filter(i => i.confidence > 0.7)
      .map(insight => ({
        id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: this.mapInsightType(insight.type),
        title: insight.description,
        description: insight.description,
        relevance: insight.confidence,
        applicability: ['销售团队', '市场团队'],
        actions: ['深入了解', '制定行动计划'],
      }));
  }

  generateProactiveSuggestions(
    perceptions: EntityPerception[],
    _entities: OntologyObject[]
  ): ProactiveSuggestion[] {
    const suggestions: ProactiveSuggestion[] = [];
    const timestamp = new Date().toISOString();

    for (const perception of perceptions) {
      if (perception.state === 'critical') {
        suggestions.push(this.createCriticalSuggestion(perception, _entities, timestamp));
      } else if (perception.state === 'warning') {
        suggestions.push(this.createWarningSuggestion(perception, _entities, timestamp));
      }

      for (const alert of perception.alerts) {
        if (alert.severity === 'critical' || alert.severity === 'high') {
          suggestions.push(this.createAlertBasedSuggestion(perception, alert, timestamp));
        }
      }
    }

    return this.deduplicateAndPrioritize(suggestions);
  }

  private checkRiskAlert(entity: OntologyObject, timestamp: string): EntityAlert | null {
    const achievementRate = entity.properties.achievementRate || entity.properties.achievement_rate || 100;
    const growthRate = entity.properties.growthRate || entity.properties.yoyGrowth || 0;

    let severity: 'critical' | 'high' | 'medium' | 'low' | null = null;
    const indicators: string[] = [];

    if (achievementRate < RISK_INDICATORS.high.achievementRate) {
      severity = 'critical';
      indicators.push(`达成率仅 ${achievementRate.toFixed(1)}%`);
    } else if (achievementRate < RISK_INDICATORS.medium.achievementRate) {
      severity = severity || 'high';
      indicators.push(`达成率 ${achievementRate.toFixed(1)}%`);
    }

    if (growthRate < RISK_INDICATORS.high.growthRate) {
      severity = severity || 'critical';
      indicators.push(`增长率 ${growthRate.toFixed(1)}%`);
    } else if (growthRate < RISK_INDICATORS.medium.growthRate) {
      severity = severity || 'high';
      indicators.push(`增长率 ${growthRate.toFixed(1)}%`);
    }

    if (!severity) return null;

    return {
      entityId: entity.id,
      entityName: entity.name,
      entityType: entity.objectType,
      alertType: 'risk',
      severity,
      title: `${entity.name} 存在风险`,
      description: `${entity.name} 当前存在 ${indicators.length} 个风险指标`,
      indicators,
      suggestedActions: this.generateRiskActions(entity, severity),
      confidence: 0.85,
      timestamp,
    };
  }

  private checkChurnWarning(entity: OntologyObject, timestamp: string): EntityAlert | null {
    if (entity.objectType !== ObjectType.Doctor && entity.objectType !== ObjectType.Hospital) {
      return null;
    }

    const activityLevel = entity.properties.activityLevel || entity.properties.engagementScore || 100;
    const recentInteractions = entity.properties.recentInteractions || entity.properties.visitCount || 0;

    let severity: 'critical' | 'high' | 'medium' | 'low' | null = null;
    const indicators: string[] = [];

    if (activityLevel < CHURN_INDICATORS.critical.engagementScore) {
      severity = 'critical';
      indicators.push(`活跃度 ${activityLevel.toFixed(1)}%`);
    } else if (activityLevel < CHURN_INDICATORS.warning.engagementScore) {
      severity = 'high';
      indicators.push(`活跃度 ${activityLevel.toFixed(1)}%`);
    }

    if (recentInteractions < CHURN_INDICATORS.critical.recentInteraction) {
      severity = severity || 'critical';
      indicators.push(`近期互动 ${recentInteractions} 次`);
    } else if (recentInteractions < CHURN_INDICATORS.warning.recentInteraction) {
      severity = severity || 'high';
      indicators.push(`近期互动 ${recentInteractions} 次`);
    }

    if (!severity) return null;

    return {
      entityId: entity.id,
      entityName: entity.name,
      entityType: entity.objectType,
      alertType: 'churn',
      severity,
      title: `${entity.name} 流失风险`,
      description: `${entity.name} 存在流失风险，需要关注`,
      indicators,
      suggestedActions: this.generateChurnActions(entity, severity),
      confidence: 0.8,
      timestamp,
    };
  }

  private checkLoyaltyOpportunity(entity: OntologyObject, timestamp: string): EntityAlert | null {
    const satisfactionScore = entity.properties.satisfactionScore || entity.properties.satisfaction || 0;
    const growthRate = entity.properties.growthRate || 0;

    if (satisfactionScore < 80 || growthRate < 0) {
      return null;
    }

    return {
      entityId: entity.id,
      entityName: entity.name,
      entityType: entity.objectType,
      alertType: 'loyalty',
      severity: 'medium',
      title: `${entity.name} 忠诚度机会`,
      description: `${entity.name} 满意度高且增长良好，可深化合作`,
      indicators: [
        `满意度 ${satisfactionScore.toFixed(1)}%`,
        `增长率 ${growthRate.toFixed(1)}%`,
      ],
      suggestedActions: [
        '探讨深度合作机会',
        '邀请参与战略项目',
        '建立长期合作关系',
      ],
      confidence: 0.75,
      timestamp,
    };
  }

  private generateRiskActions(entity: OntologyObject, severity: string): string[] {
    const actions: string[] = [];

    actions.push('立即分析风险原因');
    
    if (severity === 'critical') {
      actions.push('安排紧急沟通');
      actions.push('制定恢复计划');
    } else {
      actions.push('加强日常关注');
    }

    if (entity.objectType === ObjectType.Doctor) {
      actions.push('安排拜访了解情况');
    } else if (entity.objectType === ObjectType.Hospital) {
      actions.push('与关键决策者沟通');
    }

    return actions;
  }

  private generateChurnActions(_entity: OntologyObject, severity: string): string[] {
    const actions: string[] = [];

    actions.push('分析流失原因');
    
    if (severity === 'critical') {
      actions.push('启动挽留程序');
      actions.push('提供专属优惠');
    } else {
      actions.push('增加互动频次');
      actions.push('了解需求变化');
    }

    return actions;
  }

  private mapPredictionType(type: string): 'revenue_drop' | 'market_share_loss' | 'compliance_risk' | 'resource_shortage' {
    const typeMap: Record<string, 'revenue_drop' | 'market_share_loss' | 'compliance_risk' | 'resource_shortage'> = {
      revenue: 'revenue_drop',
      market: 'market_share_loss',
      compliance: 'compliance_risk',
      resource: 'resource_shortage',
    };
    return typeMap[type] || 'revenue_drop';
  }

  private generatePredictionDescription(pred: { type: string; probability: number; entities: OntologyObject[] }): string {
    const entityNames = pred.entities.slice(0, 3).map(e => e.name).join('、');
    return `预测 ${pred.type} 类型风险，概率 ${(pred.probability * 100).toFixed(0)}%，涉及 ${entityNames}`;
  }

  private generateMitigationActions(type: string): string[] {
    const actions: Record<string, string[]> = {
      revenue: ['分析收入下降原因', '制定增收策略', '优化资源配置'],
      market: ['分析竞争态势', '强化差异化优势', '调整市场策略'],
      compliance: ['审查合规流程', '加强培训', '完善监控'],
      resource: ['评估资源需求', '优化资源分配', '增加资源投入'],
    };
    return actions[type] || ['分析原因', '制定应对措施'];
  }

  private mapInsightType(type: string): 'trend' | 'correlation' | 'opportunity' | 'best_practice' {
    const typeMap: Record<string, 'trend' | 'correlation' | 'opportunity' | 'best_practice'> = {
      trend: 'trend',
      correlation: 'correlation',
      opportunity: 'opportunity',
      best_practice: 'best_practice',
    };
    return typeMap[type] || 'opportunity';
  }

  private createCriticalSuggestion(
    perception: EntityPerception,
    _entities: OntologyObject[],
    timestamp: string
  ): ProactiveSuggestion {

    return {
      id: `sugg_crit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'risk_alert',
      priority: 'critical',
      title: `紧急关注: ${perception.entityName}`,
      description: `${perception.entityName} 处于危急状态，需要立即关注`,
      targetEntities: [perception.entityId],
      reasoningChain: {
        conclusion: `${perception.entityName} 需要紧急干预`,
        evidence: perception.anomalies.map(a => ({
          source: a.type,
          observation: a.description,
          weight: a.confidence,
        })),
        confidence: 0.9,
        alternativeHypotheses: [],
        suggestedActions: perception.alerts.flatMap(a => a.suggestedActions).slice(0, 3).map(action => ({
          actionName: action,
          priority: 'high' as const,
          reason: '危急状态需要立即行动',
        })),
      },
      suggestedActions: perception.alerts.flatMap(a => a.suggestedActions).slice(0, 3).map((action, i) => ({
        id: `action_${i}`,
        type: 'immediate',
        name: action,
        description: action,
        priority: 'high',
        estimatedEffort: 2,
        expectedOutcome: '改善实体状态',
      })),
      expectedImpact: {
        metric: '状态改善',
        currentValue: 0,
        projectedValue: 50,
        changePercent: 50,
        confidence: 0.8,
      },
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: timestamp,
      status: 'active',
    };
  }

  private createWarningSuggestion(
    perception: EntityPerception,
    _entities: OntologyObject[],
    timestamp: string
  ): ProactiveSuggestion {
    return {
      id: `sugg_warn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'predictive_warning',
      priority: 'high',
      title: `预警: ${perception.entityName}`,
      description: `${perception.entityName} 存在潜在风险，建议关注`,
      targetEntities: [perception.entityId],
      reasoningChain: {
        conclusion: `${perception.entityName} 需要关注`,
        evidence: perception.patterns.map(p => ({
          source: p.type,
          observation: p.description,
          weight: p.confidence,
        })),
        confidence: 0.75,
        alternativeHypotheses: [],
        suggestedActions: [],
      },
      suggestedActions: perception.alerts.flatMap(a => a.suggestedActions).slice(0, 2).map((action, i) => ({
        id: `action_${i}`,
        type: 'preventive',
        name: action,
        description: action,
        priority: 'medium',
        estimatedEffort: 1,
        expectedOutcome: '预防风险发生',
      })),
      expectedImpact: {
        metric: '风险预防',
        currentValue: 50,
        projectedValue: 80,
        changePercent: 30,
        confidence: 0.7,
      },
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: timestamp,
      status: 'active',
    };
  }

  private createAlertBasedSuggestion(
    perception: EntityPerception,
    alert: PerceptionAlert,
    timestamp: string
  ): ProactiveSuggestion {
    return {
      id: `sugg_alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: alert.type === 'risk' ? 'risk_alert' : 
            alert.type === 'opportunity' ? 'loyalty_opportunity' : 'urgent_notification',
      priority: alert.severity === 'critical' ? 'critical' : 
                alert.severity === 'high' ? 'high' : 'medium',
      title: alert.title,
      description: alert.description,
      targetEntities: [perception.entityId],
      reasoningChain: {
        conclusion: alert.description,
        evidence: [{
          source: alert.type,
          observation: alert.description,
          weight: alert.confidence,
        }],
        confidence: alert.confidence,
        alternativeHypotheses: [],
        suggestedActions: alert.suggestedActions.map(a => ({
          actionName: a,
          priority: 'high' as const,
          reason: alert.title,
        })),
      },
      suggestedActions: alert.suggestedActions.map((action, i) => ({
        id: `action_${i}`,
        type: 'recommended',
        name: action,
        description: action,
        priority: 'high',
        estimatedEffort: 1,
        expectedOutcome: '解决问题',
      })),
      expectedImpact: {
        metric: alert.relatedMetrics[0] || '状态',
        currentValue: 50,
        projectedValue: 80,
        changePercent: 30,
        confidence: alert.confidence,
      },
      validUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: timestamp,
      status: 'active',
    };
  }

  private deduplicateAndPrioritize(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
    const seen = new Set<string>();
    const unique: ProactiveSuggestion[] = [];

    for (const suggestion of suggestions) {
      const key = `${suggestion.type}_${suggestion.targetEntities.join('_')}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(suggestion);
      }
    }

    return unique.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }
}

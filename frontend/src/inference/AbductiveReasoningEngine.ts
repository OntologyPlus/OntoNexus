import { OntologyObject, ReasoningEvidence, ObjectType } from '../types';

export interface Observation {
  id: string;
  type: 'anomaly' | 'pattern' | 'event' | 'metric_change';
  description: string;
  entityId: string;
  entityName: string;
  entityType: ObjectType;
  timestamp: string;
  properties: Record<string, any>;
  severity: 'low' | 'medium' | 'high';
}

export interface Hypothesis {
  id: string;
  description: string;
  causes: string[];
  evidence: ReasoningEvidence[];
  confidence: number;
  testablePredictions: string[];
  requiredData: string[];
  status: 'proposed' | 'testing' | 'confirmed' | 'rejected';
}

export interface VerificationResult {
  hypothesisId: string;
  verified: boolean;
  supportingEvidence: ReasoningEvidence[];
  contradictingEvidence: ReasoningEvidence[];
  confidence: number;
  recommendation: string;
}

export interface RankedHypothesis extends Hypothesis {
  rank: number;
  score: number;
  explanation: string;
}

export interface AbductiveContext {
  observations: Observation[];
  entities: OntologyObject[];
  historicalPatterns: HistoricalPattern[];
}

export interface HistoricalPattern {
  pattern: string;
  cause: string;
  frequency: number;
  successRate: number;
}

const CAUSAL_PATTERNS: { observation: string; possibleCauses: string[] }[] = [
  {
    observation: 'prescription_drop',
    possibleCauses: [
      'competitor_activity',
      'doctor_attitude_change',
      'supply_issue',
      'price_change',
      'relationship_deterioration',
      'academic_influence_shift',
    ],
  },
  {
    observation: 'market_share_decline',
    possibleCauses: [
      'competitor_launch',
      'price_competition',
      'policy_change',
      'product_quality_issue',
      'marketing_effectiveness_drop',
    ],
  },
  {
    observation: 'visit_effectiveness_drop',
    possibleCauses: [
      'doctor_availability',
      'topic_fatigue',
      'relationship_issue',
      'timing_problem',
      'messaging_mismatch',
    ],
  },
  {
    observation: 'compliance_alert',
    possibleCauses: [
      'frequency_increase',
      'amount_increase',
      'pattern_change',
      'new_regulation',
      'data_entry_error',
    ],
  },
  {
    observation: 'customer_churn_risk',
    possibleCauses: [
      'service_quality_issue',
      'competitor_attraction',
      'personal_circumstances',
      'product_dissatisfaction',
      'communication_gap',
    ],
  },
  {
    observation: 'revenue_target_miss',
    possibleCauses: [
      'market_contraction',
      'resource_shortage',
      'execution_gap',
      'forecast_error',
      'external_factors',
    ],
  },
];

export class AbductiveReasoningEngine {
  private historicalPatterns: HistoricalPattern[] = [];

  inferBestExplanation(observation: Observation, context: AbductiveContext): Hypothesis[] {
    const hypotheses = this.generateHypotheses(observation, context);
    const rankedHypotheses = this.rankHypotheses(hypotheses);
    
    return rankedHypotheses.slice(0, 5);
  }

  generateTestableHypotheses(observation: Observation, context: AbductiveContext): Hypothesis[] {
    const hypotheses = this.generateHypotheses(observation, context);
    
    return hypotheses.map(h => ({
      ...h,
      testablePredictions: this.generatePredictions(h, observation),
      requiredData: this.identifyRequiredData(h, observation),
    }));
  }

  verifyHypothesis(
    hypothesis: Hypothesis,
    evidence: ReasoningEvidence[]
  ): VerificationResult {
    const supportingEvidence: ReasoningEvidence[] = [];
    const contradictingEvidence: ReasoningEvidence[] = [];
    
    for (const e of evidence) {
      const isSupporting = this.evidenceSupportsHypothesis(e, hypothesis);
      if (isSupporting > 0.5) {
        supportingEvidence.push(e);
      } else if (isSupporting < -0.3) {
        contradictingEvidence.push(e);
      }
    }
    
    const supportScore = supportingEvidence.reduce((sum, e) => sum + e.weight, 0);
    const contradictScore = contradictingEvidence.reduce((sum, e) => sum + e.weight, 0);
    
    const verified = supportScore > 0.5 && contradictScore < 0.3;
    const confidence = Math.max(0, Math.min(1, supportScore - contradictScore * 0.5));
    
    return {
      hypothesisId: hypothesis.id,
      verified,
      supportingEvidence,
      contradictingEvidence,
      confidence,
      recommendation: this.generateVerificationRecommendation(verified, confidence, supportingEvidence, contradictingEvidence),
    };
  }

  rankHypotheses(hypotheses: Hypothesis[]): RankedHypothesis[] {
    const scored = hypotheses.map(h => ({
      ...h,
      score: this.calculateHypothesisScore(h),
      explanation: this.generateExplanation(h),
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    return scored.map((h, index) => ({
      ...h,
      rank: index + 1,
    }));
  }

  private generateHypotheses(observation: Observation, context: AbductiveContext): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    
    const patterns = CAUSAL_PATTERNS.filter(p => 
      observation.type === 'anomaly' || 
      observation.description.toLowerCase().includes(p.observation.toLowerCase())
    );
    
    for (const pattern of patterns) {
      for (const cause of pattern.possibleCauses) {
        const hypothesis = this.createHypothesis(cause, observation, context);
        if (hypothesis) {
          hypotheses.push(hypothesis);
        }
      }
    }
    
    const entitySpecificHypotheses = this.generateEntitySpecificHypotheses(observation, context);
    hypotheses.push(...entitySpecificHypotheses);
    
    const historicalHypotheses = this.generateHistoricalHypotheses(observation, context);
    hypotheses.push(...historicalHypotheses);
    
    return this.deduplicateHypotheses(hypotheses);
  }

  private createHypothesis(
    cause: string,
    observation: Observation,
    context: AbductiveContext
  ): Hypothesis | null {
    const entity = context.entities.find(e => e.id === observation.entityId);
    if (!entity) return null;
    
    const evidence = this.gatherEvidence(cause, entity, context);
    const confidence = this.calculateInitialConfidence(cause, observation, evidence);
    
    return {
      id: `hyp_${observation.id}_${cause}_${Date.now()}`,
      description: this.generateHypothesisDescription(cause, observation, entity),
      causes: [cause],
      evidence,
      confidence,
      testablePredictions: [],
      requiredData: [],
      status: 'proposed',
    };
  }

  private generateHypothesisDescription(
    cause: string,
    observation: Observation,
    entity: OntologyObject
  ): string {
    const causeDescriptions: Record<string, string> = {
      competitor_activity: '竞品活动影响',
      doctor_attitude_change: '医生态度变化',
      supply_issue: '供应问题',
      price_change: '价格变动',
      relationship_deterioration: '关系恶化',
      academic_influence_shift: '学术影响力转移',
      competitor_launch: '竞品上市',
      price_competition: '价格竞争',
      policy_change: '政策变化',
      product_quality_issue: '产品质量问题',
      marketing_effectiveness_drop: '营销效果下降',
      doctor_availability: '医生时间受限',
      topic_fatigue: '话题疲劳',
      relationship_issue: '关系问题',
      timing_problem: '时机问题',
      messaging_mismatch: '信息不匹配',
      frequency_increase: '频次增加',
      amount_increase: '金额增加',
      pattern_change: '模式变化',
      new_regulation: '新规出台',
      data_entry_error: '数据录入错误',
      service_quality_issue: '服务质量问题',
      competitor_attraction: '竞品吸引',
      personal_circumstances: '个人情况变化',
      product_dissatisfaction: '产品不满意',
      communication_gap: '沟通缺失',
      market_contraction: '市场收缩',
      resource_shortage: '资源不足',
      execution_gap: '执行差距',
      forecast_error: '预测偏差',
      external_factors: '外部因素',
    };
    
    const causeDesc = causeDescriptions[cause] || cause;
    return `${entity.name} 的 ${observation.description} 可能是由 ${causeDesc} 导致的`;
  }

  private gatherEvidence(
    cause: string,
    entity: OntologyObject,
    context: AbductiveContext
  ): ReasoningEvidence[] {
    const evidence: ReasoningEvidence[] = [];
    
    switch (cause) {
      case 'competitor_activity':
        const competitorLinks = entity.links.filter(l => 
          l.properties?.competitor === true
        );
        if (competitorLinks.length > 0) {
          evidence.push({
            source: '关系分析',
            observation: `发现 ${competitorLinks.length} 个竞品关联`,
            weight: 0.7,
          });
        }
        break;
        
      case 'relationship_deterioration':
        const visitRecords = context.entities.filter(e => 
          e.objectType === ObjectType.VisitRecord && 
          e.links.some(l => l.targetId === entity.id)
        );
        const recentVisits = visitRecords.filter(v => {
          const visitDate = new Date(v.properties.visitDate || v.properties.date || 0);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return visitDate > thirtyDaysAgo;
        });
        if (recentVisits.length < 2) {
          evidence.push({
            source: '拜访记录',
            observation: '近30天拜访次数不足',
            weight: 0.6,
          });
        }
        break;
        
      case 'price_change':
        if (entity.properties.priceChange || entity.properties.price_change) {
          evidence.push({
            source: '价格数据',
            observation: '检测到价格变动',
            weight: 0.8,
          });
        }
        break;
        
      case 'supply_issue':
        if (entity.properties.stockLevel !== undefined && entity.properties.stockLevel < 0.3) {
          evidence.push({
            source: '库存数据',
            observation: '库存水平偏低',
            weight: 0.75,
          });
        }
        break;
    }
    
    if (entity.status === 'critical') {
      evidence.push({
        source: '状态检查',
        observation: '实体处于危急状态',
        weight: 0.5,
      });
    }
    
    return evidence;
  }

  private calculateInitialConfidence(
    cause: string,
    observation: Observation,
    evidence: ReasoningEvidence[]
  ): number {
    let confidence = 0.3;
    
    const evidenceBoost = evidence.reduce((sum, e) => sum + e.weight * 0.3, 0);
    confidence += evidenceBoost;
    
    const historicalMatch = this.historicalPatterns.find(p => p.cause === cause);
    if (historicalMatch) {
      confidence += historicalMatch.successRate * 0.2;
    }
    
    if (observation.severity === 'high') {
      confidence += 0.1;
    }
    
    return Math.min(0.95, Math.max(0.1, confidence));
  }

  private generateEntitySpecificHypotheses(
    observation: Observation,
    context: AbductiveContext
  ): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    const entity = context.entities.find(e => e.id === observation.entityId);
    
    if (!entity) return hypotheses;
    
    if (entity.objectType === ObjectType.Doctor) {
      const prescriptionTrend = entity.properties.prescriptionTrend || entity.properties.trend;
      if (prescriptionTrend === 'down') {
        hypotheses.push({
          id: `hyp_${observation.id}_doctor_prescription_${Date.now()}`,
          description: `${entity.name} 处方量下降可能与学术观点变化有关`,
          causes: ['academic_view_change'],
          evidence: [{
            source: '处方趋势',
            observation: '处方量呈下降趋势',
            weight: 0.6,
          }],
          confidence: 0.55,
          testablePredictions: [],
          requiredData: [],
          status: 'proposed',
        });
      }
    }
    
    if (entity.objectType === ObjectType.Hospital) {
      const developmentStage = entity.properties.developmentStage;
      if (developmentStage === 'prospect' || developmentStage === 'contact') {
        hypotheses.push({
          id: `hyp_${observation.id}_hospital_dev_${Date.now()}`,
          description: `${entity.name} 的观察可能与开发阶段进展有关`,
          causes: ['development_stage_issue'],
          evidence: [{
            source: '开发阶段',
            observation: `当前阶段: ${developmentStage}`,
            weight: 0.5,
          }],
          confidence: 0.45,
          testablePredictions: [],
          requiredData: [],
          status: 'proposed',
        });
      }
    }
    
    return hypotheses;
  }

  private generateHistoricalHypotheses(
    observation: Observation,
    _context: AbductiveContext
  ): Hypothesis[] {
    const hypotheses: Hypothesis[] = [];
    
    for (const pattern of this.historicalPatterns) {
      if (observation.description.toLowerCase().includes(pattern.pattern.toLowerCase())) {
        hypotheses.push({
          id: `hyp_${observation.id}_hist_${pattern.cause}_${Date.now()}`,
          description: `基于历史模式，${observation.description} 可能由 ${pattern.cause} 导致`,
          causes: [pattern.cause],
          evidence: [{
            source: '历史模式',
            observation: `该模式在历史中出现 ${pattern.frequency} 次，成功率 ${(pattern.successRate * 100).toFixed(0)}%`,
            weight: pattern.successRate,
          }],
          confidence: pattern.successRate * 0.8,
          testablePredictions: [],
          requiredData: [],
          status: 'proposed',
        });
      }
    }
    
    return hypotheses;
  }

  private generatePredictions(hypothesis: Hypothesis, _observation: Observation): string[] {
    const predictions: string[] = [];
    
    for (const cause of hypothesis.causes) {
      switch (cause) {
        case 'competitor_activity':
          predictions.push('应该能观察到竞品活动增加');
          predictions.push('竞品市场份额应该上升');
          break;
        case 'relationship_deterioration':
          predictions.push('拜访反馈应该显示负面情绪');
          predictions.push('沟通频次应该下降');
          break;
        case 'price_change':
          predictions.push('价格数据应该显示变动');
          predictions.push('竞品价格对比应该有差异');
          break;
        default:
          predictions.push(`应该能观察到与 ${cause} 相关的数据变化`);
      }
    }
    
    return predictions;
  }

  private identifyRequiredData(hypothesis: Hypothesis, _observation: Observation): string[] {
    const requiredData: string[] = [];
    
    for (const cause of hypothesis.causes) {
      switch (cause) {
        case 'competitor_activity':
          requiredData.push('竞品活动记录');
          requiredData.push('市场份额数据');
          break;
        case 'relationship_deterioration':
          requiredData.push('拜访记录');
          requiredData.push('沟通频次统计');
          break;
        case 'price_change':
          requiredData.push('价格历史数据');
          requiredData.push('竞品价格数据');
          break;
        default:
          requiredData.push(`${cause} 相关数据`);
      }
    }
    
    return requiredData;
  }

  private evidenceSupportsHypothesis(evidence: ReasoningEvidence, hypothesis: Hypothesis): number {
    const evidenceText = evidence.observation.toLowerCase();
    const hypothesisText = hypothesis.description.toLowerCase();
    
    let supportScore = 0;
    
    for (const cause of hypothesis.causes) {
      if (evidenceText.includes(cause.toLowerCase())) {
        supportScore += 0.5;
      }
    }
    
    if (evidenceText.includes('下降') && hypothesisText.includes('下降')) {
      supportScore += 0.3;
    }
    if (evidenceText.includes('风险') && hypothesisText.includes('风险')) {
      supportScore += 0.3;
    }
    
    supportScore += evidence.weight * 0.3;
    
    return supportScore;
  }

  private calculateHypothesisScore(hypothesis: Hypothesis): number {
    let score = hypothesis.confidence;
    
    const evidenceScore = hypothesis.evidence.reduce((sum, e) => sum + e.weight, 0);
    score += evidenceScore * 0.2;
    
    const historicalMatch = this.historicalPatterns.find(p => 
      hypothesis.causes.includes(p.cause)
    );
    if (historicalMatch) {
      score += historicalMatch.successRate * 0.15;
    }
    
    return Math.min(1, score);
  }

  private generateExplanation(hypothesis: Hypothesis): string {
    const evidenceCount = hypothesis.evidence.length;
    const topEvidence = hypothesis.evidence.slice(0, 2);
    
    let explanation = `置信度: ${(hypothesis.confidence * 100).toFixed(0)}%`;
    
    if (evidenceCount > 0) {
      explanation += `，有 ${evidenceCount} 条证据支持`;
      if (topEvidence.length > 0) {
        explanation += `，包括: ${topEvidence[0].observation}`;
      }
    }
    
    return explanation;
  }

  private generateVerificationRecommendation(
    verified: boolean,
    confidence: number,
    supporting: ReasoningEvidence[],
    contradicting: ReasoningEvidence[]
  ): string {
    if (verified && confidence > 0.7) {
      return '假设得到充分验证，建议采取相应行动';
    } else if (verified) {
      return '假设部分验证，建议收集更多证据';
    } else if (contradicting.length > supporting.length) {
      return '存在较多矛盾证据，建议考虑其他假设';
    } else {
      return '证据不足，需要进一步调查';
    }
  }

  private deduplicateHypotheses(hypotheses: Hypothesis[]): Hypothesis[] {
    const seen = new Set<string>();
    return hypotheses.filter(h => {
      const key = h.causes.sort().join('_');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  addHistoricalPattern(pattern: HistoricalPattern): void {
    this.historicalPatterns.push(pattern);
  }

  setHistoricalPatterns(patterns: HistoricalPattern[]): void {
    this.historicalPatterns = patterns;
  }

  getHistoricalPatterns(): HistoricalPattern[] {
    return [...this.historicalPatterns];
  }
}

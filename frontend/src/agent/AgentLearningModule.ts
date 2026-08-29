
export interface LearningExperience {
  type: 'success' | 'failure' | 'feedback' | 'observation';
  context: {
    goal?: string;
    actions?: string[];
    entities?: string[];
    environment?: Record<string, any>;
  };
  outcome: {
    result: string;
    success: boolean;
    metrics?: Record<string, number>;
  };
  feedback?: {
    source: string;
    rating: number;
    comments: string;
  };
  timestamp: string;
}

export interface LearningResult {
  learned: boolean;
  knowledge: LearnedKnowledge[];
  adjustments: Adjustment[];
  recommendations: string[];
  confidence: number;
}

export interface LearnedKnowledge {
  type: 'rule' | 'pattern' | 'preference' | 'heuristic';
  description: string;
  conditions: string[];
  applicability: string[];
  confidence: number;
  source: string;
}

export interface Adjustment {
  target: string;
  previousValue: any;
  newValue: any;
  reason: string;
}

export interface DecisionModel {
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  preferences: Record<string, number>;
}

export interface FeedbackRecord {
  experienceId: string;
  feedback: LearningExperience['feedback'];
  incorporated: boolean;
  timestamp: string;
}

export class AgentLearningModule {
  private knowledgeBase: LearnedKnowledge[] = [];
  private decisionModel: DecisionModel;
  private feedbackHistory: FeedbackRecord[] = [];

  constructor() {
    this.decisionModel = {
      weights: {
        importance: 0.3,
        urgency: 0.25,
        feasibility: 0.2,
        impact: 0.15,
        risk: 0.1,
      },
      thresholds: {
        highPriority: 0.7,
        mediumPriority: 0.4,
        actionTrigger: 0.6,
      },
      preferences: {},
    };
  }

  learn(experience: LearningExperience): LearningResult {
    const knowledge: LearnedKnowledge[] = [];
    const adjustments: Adjustment[] = [];
    const recommendations: string[] = [];

    switch (experience.type) {
      case 'success':
        const successKnowledge = this.learnFromSuccess(experience);
        knowledge.push(...successKnowledge);
        break;
      case 'failure':
        const failureKnowledge = this.learnFromFailure(experience);
        knowledge.push(...failureKnowledge);
        break;
      case 'feedback':
        const feedbackAdjustments = this.learnFromFeedback(experience);
        adjustments.push(...feedbackAdjustments);
        break;
      case 'observation':
        const observationKnowledge = this.learnFromObservation(experience);
        knowledge.push(...observationKnowledge);
        break;
    }

    for (const k of knowledge) {
      this.addKnowledge(k);
    }

    for (const adj of adjustments) {
      this.applyAdjustment(adj);
    }

    const newRecommendations = this.generateRecommendations(experience, knowledge, adjustments);
    recommendations.push(...newRecommendations);

    const confidence = this.calculateLearningConfidence(experience, knowledge, adjustments);

    return {
      learned: knowledge.length > 0 || adjustments.length > 0,
      knowledge,
      adjustments,
      recommendations,
      confidence,
    };
  }

  getKnowledge(): LearnedKnowledge[] {
    return [...this.knowledgeBase];
  }

  getKnowledgeByType(type: LearnedKnowledge['type']): LearnedKnowledge[] {
    return this.knowledgeBase.filter(k => k.type === type);
  }

  getApplicableKnowledge(context: { goal?: string; entities?: string[] }): LearnedKnowledge[] {
    return this.knowledgeBase.filter(k => {
      const goalMatch = !context.goal || k.applicability.some(a => 
        a.toLowerCase().includes(context.goal!.toLowerCase())
      );
      const entityMatch = !context.entities || context.entities.some(e =>
        k.conditions.some(c => c.toLowerCase().includes(e.toLowerCase()))
      );
      return goalMatch && entityMatch;
    });
  }

  getDecisionModel(): DecisionModel {
    return { ...this.decisionModel };
  }

  updateDecisionModel(updates: Partial<DecisionModel>): void {
    if (updates.weights) {
      this.decisionModel.weights = { ...this.decisionModel.weights, ...updates.weights };
    }
    if (updates.thresholds) {
      this.decisionModel.thresholds = { ...this.decisionModel.thresholds, ...updates.thresholds };
    }
    if (updates.preferences) {
      this.decisionModel.preferences = { ...this.decisionModel.preferences, ...updates.preferences };
    }
  }

  getFeedbackHistory(): FeedbackRecord[] {
    return [...this.feedbackHistory];
  }

  private learnFromSuccess(experience: LearningExperience): LearnedKnowledge[] {
    const knowledge: LearnedKnowledge[] = [];

    if (experience.context.actions && experience.context.actions.length > 0) {
      knowledge.push({
        type: 'pattern',
        description: `成功模式: ${experience.context.actions.join(' -> ')}`,
        conditions: experience.context.actions,
        applicability: experience.context.entities || [],
        confidence: 0.7,
        source: 'success_experience',
      });
    }

    if (experience.outcome.metrics) {
      for (const [metric, value] of Object.entries(experience.outcome.metrics)) {
        if (value > 0.8) {
          knowledge.push({
            type: 'heuristic',
            description: `${metric} 高值与成功相关`,
            conditions: [`${metric} > 0.8`],
            applicability: ['decision_making'],
            confidence: 0.6,
            source: 'success_experience',
          });
        }
      }
    }

    return knowledge;
  }

  private learnFromFailure(experience: LearningExperience): LearnedKnowledge[] {
    const knowledge: LearnedKnowledge[] = [];

    if (experience.context.actions && experience.context.actions.length > 0) {
      knowledge.push({
        type: 'rule',
        description: `避免模式: ${experience.context.actions.join(' -> ')}`,
        conditions: experience.context.actions.map(a => `NOT ${a}`),
        applicability: experience.context.entities || [],
        confidence: 0.6,
        source: 'failure_experience',
      });
    }

    if (experience.outcome.metrics) {
      for (const [metric, value] of Object.entries(experience.outcome.metrics)) {
        if (value < 0.3) {
          knowledge.push({
            type: 'heuristic',
            description: `${metric} 低值与失败相关`,
            conditions: [`${metric} < 0.3`],
            applicability: ['risk_assessment'],
            confidence: 0.7,
            source: 'failure_experience',
          });
        }
      }
    }

    return knowledge;
  }

  private learnFromFeedback(experience: LearningExperience): Adjustment[] {
    const adjustments: Adjustment[] = [];

    if (!experience.feedback) return adjustments;

    this.feedbackHistory.push({
      experienceId: `exp_${Date.now()}`,
      feedback: experience.feedback,
      incorporated: true,
      timestamp: new Date().toISOString(),
    });

    const rating = experience.feedback.rating;
    
    if (rating < 3) {
      adjustments.push({
        target: 'decision_weights',
        previousValue: { ...this.decisionModel.weights },
        newValue: 'decrease_confidence',
        reason: `负面反馈 (评分: ${rating})`,
      });
    } else if (rating > 4) {
      adjustments.push({
        target: 'decision_weights',
        previousValue: { ...this.decisionModel.weights },
        newValue: 'increase_confidence',
        reason: `正面反馈 (评分: ${rating})`,
      });
    }

    if (experience.feedback.comments) {
      const keywords = this.extractKeywords(experience.feedback.comments);
      for (const keyword of keywords) {
        if (!this.decisionModel.preferences[keyword]) {
          this.decisionModel.preferences[keyword] = 0.5;
        }
        
        const adjustment = rating > 3 ? 0.1 : -0.1;
        const previousValue = this.decisionModel.preferences[keyword];
        this.decisionModel.preferences[keyword] = Math.max(0, Math.min(1, previousValue + adjustment));
        
        adjustments.push({
          target: `preference_${keyword}`,
          previousValue,
          newValue: this.decisionModel.preferences[keyword],
          reason: `基于反馈调整偏好`,
        });
      }
    }

    return adjustments;
  }

  private learnFromObservation(experience: LearningExperience): LearnedKnowledge[] {
    const knowledge: LearnedKnowledge[] = [];

    if (experience.context.entities && experience.context.entities.length > 0) {
      knowledge.push({
        type: 'pattern',
        description: `观察到实体: ${experience.context.entities.join(', ')}`,
        conditions: experience.context.entities,
        applicability: ['monitoring'],
        confidence: 0.5,
        source: 'observation',
      });
    }

    if (experience.outcome.metrics) {
      for (const [metric, value] of Object.entries(experience.outcome.metrics)) {
        knowledge.push({
          type: 'heuristic',
          description: `${metric} 观察值为 ${value.toFixed(2)}`,
          conditions: [`${metric} = ${value.toFixed(2)}`],
          applicability: ['baseline'],
          confidence: 0.4,
          source: 'observation',
        });
      }
    }

    return knowledge;
  }

  private addKnowledge(knowledge: LearnedKnowledge): void {
    const existing = this.knowledgeBase.find(k => 
      k.description === knowledge.description && k.type === knowledge.type
    );

    if (existing) {
      existing.confidence = Math.min(0.95, existing.confidence + knowledge.confidence * 0.2);
    } else {
      this.knowledgeBase.push(knowledge);
    }
  }

  private applyAdjustment(adjustment: Adjustment): void {
    if (adjustment.target === 'decision_weights' && typeof adjustment.newValue === 'string') {
      const factor = adjustment.newValue === 'increase_confidence' ? 1.1 : 0.9;
      for (const key of Object.keys(this.decisionModel.weights)) {
        this.decisionModel.weights[key] = Math.max(0.05, Math.min(0.5, 
          this.decisionModel.weights[key] * factor
        ));
      }
      
      const total = Object.values(this.decisionModel.weights).reduce((a, b) => a + b, 0);
      for (const key of Object.keys(this.decisionModel.weights)) {
        this.decisionModel.weights[key] /= total;
      }
    }
  }

  private generateRecommendations(
    experience: LearningExperience,
    knowledge: LearnedKnowledge[],
    adjustments: Adjustment[]
  ): string[] {
    const recommendations: string[] = [];

    if (experience.type === 'failure') {
      recommendations.push('建议分析失败原因并调整策略');
    }

    if (knowledge.length > 3) {
      recommendations.push('获得了较多新知识，建议进行知识整合');
    }

    if (adjustments.length > 2) {
      recommendations.push('决策模型有较大调整，建议验证效果');
    }

    if (experience.feedback && experience.feedback.rating < 3) {
      recommendations.push('收到负面反馈，建议重点关注改进');
    }

    return recommendations;
  }

  private calculateLearningConfidence(
    experience: LearningExperience,
    knowledge: LearnedKnowledge[],
    adjustments: Adjustment[]
  ): number {
    let confidence = 0.5;

    if (experience.type === 'success' || experience.type === 'failure') {
      confidence += 0.2;
    }

    if (experience.feedback) {
      confidence += 0.15;
    }

    confidence += Math.min(0.2, knowledge.length * 0.05);
    confidence += Math.min(0.1, adjustments.length * 0.02);

    return Math.min(0.95, confidence);
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['的', '是', '在', '有', '和', '了', '不', '这', '我', '你', '他', '她', '它', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once']);
    
    const words = text.toLowerCase().split(/\s+|[,，。！？、；：""''（）【】]/);
    
    return words
      .filter(w => w.length > 1 && !stopWords.has(w))
      .slice(0, 5);
  }
}

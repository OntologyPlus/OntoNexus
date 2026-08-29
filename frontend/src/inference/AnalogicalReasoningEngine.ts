import { OntologyObject } from '../types';

// ============================================
// 类比推理引擎
// ============================================

export interface Case {
  id: string;
  name: string;
  context: CaseContext;
  features: CaseFeature[];
  outcome: CaseOutcome;
  metadata: CaseMetadata;
}

export interface CaseContext {
  domain: string;
  timeRange: { start: string; end: string };
  location: string;
  participants: string[];
}

export interface CaseFeature {
  name: string;
  value: number | string | boolean;
  weight: number;
  type: 'numeric' | 'categorical' | 'boolean';
}

export interface CaseOutcome {
  success: boolean;
  metrics: { [key: string]: number };
  lessons: string[];
}

export interface CaseMetadata {
  createdAt: string;
  updatedAt: string;
  tags: string[];
  confidence: number;
}

export interface SimilarityScore {
  overall: number;
  byFeature: { [featureName: string]: number };
  weighted: number;
}

export interface SimilarCase {
  case: Case;
  similarity: SimilarityScore;
  rank: number;
}

export interface AdaptedRecommendation {
  originalCase: Case;
  adaptations: Adaptation[];
  confidence: number;
  rationale: string;
  suggestedActions: string[];
}

export interface Adaptation {
  aspect: string;
  original: string;
  adapted: string;
  reason: string;
}

export class AnalogicalReasoningEngine {
  private caseLibrary: Case[] = [];

  /**
   * 添加案例到库
   */
  addCase(caseItem: Case): void {
    this.caseLibrary.push(caseItem);
  }

  /**
   * 计算相似度
   */
  calculateSimilarity(caseA: Case, caseB: Case): SimilarityScore {
    const byFeature: { [featureName: string]: number } = {};
    let totalWeight = 0;
    let weightedSum = 0;

    // 计算每个特征的相似度
    caseA.features.forEach(featureA => {
      const featureB = caseB.features.find(f => f.name === featureA.name);
      
      if (featureB) {
        const similarity = this.calculateFeatureSimilarity(featureA, featureB);
        byFeature[featureA.name] = similarity;
        weightedSum += similarity * featureA.weight;
        totalWeight += featureA.weight;
      }
    });

    // 计算整体相似度
    const overall = Object.keys(byFeature).length > 0
      ? Object.values(byFeature).reduce((sum, s) => sum + s, 0) / Object.values(byFeature).length
      : 0;

    const weighted = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return {
      overall,
      byFeature,
      weighted,
    };
  }

  /**
   * 计算特征相似度
   */
  private calculateFeatureSimilarity(
    featureA: CaseFeature,
    featureB: CaseFeature
  ): number {
    if (featureA.type !== featureB.type) {
      return 0;
    }

    switch (featureA.type) {
      case 'numeric':
        const valA = featureA.value as number;
        const valB = featureB.value as number;
        const maxVal = Math.max(Math.abs(valA), Math.abs(valB), 1);
        return 1 - Math.abs(valA - valB) / maxVal;

      case 'categorical':
        return featureA.value === featureB.value ? 1 : 0;

      case 'boolean':
        return featureA.value === featureB.value ? 1 : 0;

      default:
        return 0;
    }
  }

  /**
   * 查找相似案例
   */
  findSimilarCases(
    targetCase: Case,
    topK: number = 5,
    minSimilarity: number = 0.5
  ): SimilarCase[] {
    const similarities: SimilarCase[] = [];

    this.caseLibrary.forEach(caseItem => {
      if (caseItem.id !== targetCase.id) {
        const similarity = this.calculateSimilarity(targetCase, caseItem);
        
        if (similarity.overall >= minSimilarity) {
          similarities.push({
            case: caseItem,
            similarity,
            rank: 0, // 稍后计算
          });
        }
      }
    });

    // 排序并计算排名
    similarities.sort((a, b) => b.similarity.overall - a.similarity.overall);
    similarities.forEach((item, index) => {
      item.rank = index + 1;
    });

    return similarities.slice(0, topK);
  }

  /**
   * 案例适配
   */
  adaptCase(
    sourceCase: Case,
    targetContext: Partial<CaseContext>
  ): AdaptedRecommendation {
    const adaptations: Adaptation[] = [];
    const suggestedActions: string[] = [];

    // 1. 时间适配
    if (targetContext.timeRange && sourceCase.context.timeRange) {
      const sourceDuration = this.calculateDuration(sourceCase.context.timeRange);
      const targetDuration = this.calculateDuration(targetContext.timeRange);
      
      if (Math.abs(sourceDuration - targetDuration) > 30) {
        adaptations.push({
          aspect: '时间范围',
          original: `${sourceDuration}天`,
          adapted: `${targetDuration}天`,
          reason: '根据目标上下文调整时间范围',
        });
      }
    }

    // 2. 地点适配
    if (targetContext.location && targetContext.location !== sourceCase.context.location) {
      adaptations.push({
        aspect: '地点',
        original: sourceCase.context.location,
        adapted: targetContext.location,
        reason: '根据目标地点调整策略',
      });
    }

    // 3. 参与者适配
    if (targetContext.participants) {
      const commonParticipants = sourceCase.context.participants.filter(p =>
        targetContext.participants!.includes(p)
      );
      
      if (commonParticipants.length === 0) {
        adaptations.push({
          aspect: '参与者',
          original: sourceCase.context.participants.join(', '),
          adapted: targetContext.participants.join(', '),
          reason: '根据目标参与者调整沟通策略',
        });
      }
    }

    // 4. 生成建议动作
    if (sourceCase.outcome.success) {
      suggestedActions.push(...sourceCase.outcome.lessons);
    } else {
      // 从失败案例中提取教训
      suggestedActions.push(...sourceCase.outcome.lessons.map(lesson => `避免: ${lesson}`));
    }

    // 5. 计算置信度
    const confidence = this.calculateAdaptationConfidence(sourceCase, adaptations);

    // 6. 生成理由
    const rationale = this.generateRationale(sourceCase, adaptations, confidence);

    return {
      originalCase: sourceCase,
      adaptations,
      confidence,
      rationale,
      suggestedActions,
    };
  }

  /**
   * 计算持续时间
   */
  private calculateDuration(timeRange: { start: string; end: string }): number {
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  /**
   * 计算适配置信度
   */
  private calculateAdaptationConfidence(sourceCase: Case, adaptations: Adaptation[]): number {
    // 基础置信度
    let confidence = sourceCase.metadata.confidence;

    // 根据适配数量调整
    const adaptationPenalty = adaptations.length * 0.05;
    confidence -= adaptationPenalty;

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 生成理由
   */
  private generateRationale(
    sourceCase: Case,
    adaptations: Adaptation[],
    confidence: number
  ): string {
    let rationale = `基于成功案例"${sourceCase.name}"进行适配。`;
    
    if (adaptations.length > 0) {
      rationale += `根据当前上下文进行了${adaptations.length}项调整：`;
      adaptations.forEach((adapt, index) => {
        rationale += `${index + 1}. ${adapt.aspect}: ${adapt.reason}; `;
      });
    }

    rationale += `适配置信度为${(confidence * 100).toFixed(1)}%。`;

    return rationale;
  }

  /**
   * 从本体对象创建案例
   */
  createCaseFromOntology(
    obj: OntologyObject,
    outcome: CaseOutcome,
    context: Partial<CaseContext> = {}
  ): Case {
    const features: CaseFeature[] = [];

    // 从属性中提取特征
    Object.entries(obj.properties).forEach(([key, value]) => {
      let type: 'numeric' | 'categorical' | 'boolean' = 'categorical';
      
      if (typeof value === 'number') {
        type = 'numeric';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
      }

      features.push({
        name: key,
        value,
        weight: 1,
        type,
      });
    });

    // 从链接中提取特征
    obj.links.forEach(link => {
      features.push({
        name: `link_${link.linkType}`,
        value: link.targetName,
        weight: 0.5,
        type: 'categorical',
      });
    });

    return {
      id: obj.id,
      name: obj.name,
      context: {
        domain: obj.objectType,
        timeRange: { start: new Date().toISOString(), end: new Date().toISOString() },
        location: 'unknown',
        participants: [],
        ...context,
      },
      features,
      outcome,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [obj.objectType],
        confidence: 0.8,
      },
    };
  }

  /**
   * 获取案例库
   */
  getCaseLibrary(): Case[] {
    return [...this.caseLibrary];
  }

  /**
   * 清空案例库
   */
  clearCaseLibrary(): void {
    this.caseLibrary = [];
  }

  /**
   * 根据领域筛选案例
   */
  getCasesByDomain(domain: string): Case[] {
    return this.caseLibrary.filter(c => c.context.domain === domain);
  }

  /**
   * 根据标签筛选案例
   */
  getCasesByTags(tags: string[]): Case[] {
    return this.caseLibrary.filter(c =>
      tags.some(tag => c.metadata.tags.includes(tag))
    );
  }
}

import { OntologyObject } from '../types';

export type AggregationStrategy = 'weighted' | 'voting' | 'cascade';

export interface EngineResult {
  engineName: string;
  conclusion: string;
  confidence: number;
  evidence: Array<{
    source: string;
    observation: string;
    weight: number;
  }>;
  metadata?: Record<string, unknown>;
}

export interface ConflictInfo {
  id: string;
  type: 'contradiction' | 'uncertainty' | 'incomplete';
  engines: string[];
  description: string;
  resolution: 'highest_confidence' | 'voting' | 'human_review' | 'merged';
  resolved: boolean;
}

export interface CoordinatedResult {
  finalConclusion: string;
  overallConfidence: number;
  engineResults: EngineResult[];
  conflicts: ConflictInfo[];
  reasoningChain: Array<{
    step: number;
    description: string;
    engines: string[];
    intermediateConclusion: string;
  }>;
  metadata: {
    strategy: AggregationStrategy;
    executionTime: number;
    enginesUsed: number;
    conflictsDetected: number;
  };
}

export class CoordinatedReasoningEngine {
  private engineWeights: Record<string, number> = {
    temporal: 0.2,
    spatial: 0.15,
    causal: 0.25,
    analogical: 0.15,
    hierarchical: 0.15,
    constraint: 0.1,
  };

  reason(
    objects: OntologyObject[],
    strategy: AggregationStrategy = 'weighted'
  ): CoordinatedResult {
    const startTime = Date.now();
    const engineResults: EngineResult[] = [];
    const conflicts: ConflictInfo[] = [];
    const reasoningChain: CoordinatedResult['reasoningChain'] = [];

    engineResults.push(this.runTemporalAnalysis(objects));
    engineResults.push(this.runSpatialAnalysis(objects));
    engineResults.push(this.runCausalAnalysis(objects));
    engineResults.push(this.runAnalogicalAnalysis(objects));
    engineResults.push(this.runHierarchicalAnalysis(objects));
    engineResults.push(this.runConstraintAnalysis(objects));

    const detectedConflicts = this.detectConflicts(engineResults);
    conflicts.push(...detectedConflicts);

    const resolvedResults = this.resolveConflicts(engineResults, conflicts);

    let finalConclusion: string;
    let overallConfidence: number;

    switch (strategy) {
      case 'weighted':
        ({ finalConclusion, overallConfidence } = this.weightedAggregation(resolvedResults));
        break;
      case 'voting':
        ({ finalConclusion, overallConfidence } = this.votingAggregation(resolvedResults));
        break;
      case 'cascade':
        ({ finalConclusion, overallConfidence } = this.cascadeAggregation(resolvedResults));
        break;
    }

    reasoningChain.push({
      step: 1,
      description: '数据预处理与特征提取',
      engines: ['all'],
      intermediateConclusion: `处理了 ${objects.length} 个本体对象`,
    });

    reasoningChain.push({
      step: 2,
      description: '多引擎并行推理',
      engines: engineResults.map(r => r.engineName),
      intermediateConclusion: `生成 ${engineResults.length} 个独立推理结果`,
    });

    reasoningChain.push({
      step: 3,
      description: '冲突检测与解决',
      engines: conflicts.flatMap(c => c.engines),
      intermediateConclusion: `检测到 ${conflicts.length} 个冲突，已解决 ${conflicts.filter(c => c.resolved).length} 个`,
    });

    reasoningChain.push({
      step: 4,
      description: '结果聚合',
      engines: [strategy],
      intermediateConclusion: `使用${strategy === 'weighted' ? '加权' : strategy === 'voting' ? '投票' : '级联'}策略聚合`,
    });

    return {
      finalConclusion,
      overallConfidence,
      engineResults: resolvedResults,
      conflicts,
      reasoningChain,
      metadata: {
        strategy,
        executionTime: Date.now() - startTime,
        enginesUsed: engineResults.length,
        conflictsDetected: conflicts.length,
      },
    };
  }

  private runTemporalAnalysis(objects: OntologyObject[]): EngineResult {
    const trends = objects.filter(o => o.properties.trend !== undefined);
    const conclusion = trends.length > 0
      ? `检测到 ${trends.length} 个对象存在趋势变化`
      : '时序分析未发现显著模式';

    return {
      engineName: '时序推理引擎',
      conclusion,
      confidence: trends.length > 0 ? 0.75 : 0.5,
      evidence: [
        { source: '趋势分析', observation: `分析了 ${objects.length} 个对象`, weight: 0.4 },
      ],
      metadata: { trendCount: trends.length },
    };
  }

  private runSpatialAnalysis(objects: OntologyObject[]): EngineResult {
    const grouped = new Map<string, number>();
    for (const obj of objects) {
      grouped.set(obj.objectType, (grouped.get(obj.objectType) || 0) + 1);
    }

    const conclusion = `完成 ${grouped.size} 种类型的空间聚合分析`;

    return {
      engineName: '空间推理引擎',
      conclusion,
      confidence: 0.7,
      evidence: [
        { source: '层级聚合', observation: `聚合了 ${grouped.size} 个类型`, weight: 0.5 },
      ],
      metadata: { typeCount: grouped.size },
    };
  }

  private runCausalAnalysis(objects: OntologyObject[]): EngineResult {
    const linkedObjects = objects.filter(o => o.links.length > 0);
    const conclusion = linkedObjects.length > 0
      ? `识别 ${linkedObjects.length} 个存在因果关系的对象`
      : '因果分析未发现明确关系';

    return {
      engineName: '因果推理引擎',
      conclusion,
      confidence: linkedObjects.length > 0 ? 0.8 : 0.5,
      evidence: [
        { source: '因果图构建', observation: `分析了 ${objects.length} 个对象的关系`, weight: 0.3 },
      ],
      metadata: { linkedCount: linkedObjects.length },
    };
  }

  private runAnalogicalAnalysis(objects: OntologyObject[]): EngineResult {
    const similarObjects = objects.filter(o => 
      objects.some(other => other.id !== o.id && other.objectType === o.objectType)
    );

    const conclusion = similarObjects.length > 0
      ? `找到 ${similarObjects.length} 个相似对象`
      : '类比推理未找到相似案例';

    return {
      engineName: '类比推理引擎',
      conclusion,
      confidence: similarObjects.length > 0 ? 0.65 : 0.3,
      evidence: [
        { source: '案例检索', observation: `检索了 ${objects.length} 个对象`, weight: 0.4 },
      ],
      metadata: { similarCount: similarObjects.length },
    };
  }

  private runHierarchicalAnalysis(objects: OntologyObject[]): EngineResult {
    const inheritedCount = objects.filter(o => o.links.length > 2).length;
    const conclusion = inheritedCount > 0
      ? `推断 ${inheritedCount} 个继承属性`
      : '层次推理完成';

    return {
      engineName: '层次推理引擎',
      conclusion,
      confidence: 0.65,
      evidence: [
        { source: '属性继承', observation: `分析了 ${objects.length} 个对象`, weight: 0.5 },
      ],
      metadata: { inheritedCount },
    };
  }

  private runConstraintAnalysis(objects: OntologyObject[]): EngineResult {
    const violations = objects.filter(o => o.status === 'critical');
    const conclusion = violations.length > 0
      ? `发现 ${violations.length} 个约束违规`
      : '所有约束检查通过';

    return {
      engineName: '约束检查引擎',
      conclusion,
      confidence: violations.length === 0 ? 0.9 : 0.6,
      evidence: violations.slice(0, 3).map(v => ({
        source: '约束检查',
        observation: `${v.name} 状态异常`,
        weight: 0.3,
      })),
      metadata: { violationCount: violations.length },
    };
  }

  private detectConflicts(results: EngineResult[]): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    const highConfidenceResults = results.filter(r => r.confidence > 0.7);
    const lowConfidenceResults = results.filter(r => r.confidence <= 0.5);

    if (highConfidenceResults.length > 1) {
      const maxDiff = Math.max(...highConfidenceResults.map(r => r.confidence)) -
        Math.min(...highConfidenceResults.map(r => r.confidence));

      if (maxDiff > 0.3) {
        conflicts.push({
          id: `conflict_${Date.now()}_1`,
          type: 'uncertainty',
          engines: highConfidenceResults.map(r => r.engineName),
          description: '高置信度引擎之间存在结论差异',
          resolution: 'highest_confidence',
          resolved: false,
        });
      }
    }

    if (lowConfidenceResults.length > results.length / 2) {
      conflicts.push({
        id: `conflict_${Date.now()}_2`,
        type: 'incomplete',
        engines: lowConfidenceResults.map(r => r.engineName),
        description: '多数引擎置信度较低，推理结果可能不完整',
        resolution: 'human_review',
        resolved: false,
      });
    }

    return conflicts;
  }

  private resolveConflicts(
    results: EngineResult[],
    conflicts: ConflictInfo[]
  ): EngineResult[] {
    const resolvedResults = [...results];

    for (const conflict of conflicts) {
      if (conflict.resolution === 'highest_confidence') {
        const highestConfidence = Math.max(
          ...resolvedResults
            .filter(r => conflict.engines.includes(r.engineName))
            .map(r => r.confidence)
        );
        resolvedResults.forEach(r => {
          if (conflict.engines.includes(r.engineName)) {
            r.confidence = r.confidence === highestConfidence ? r.confidence : r.confidence * 0.8;
          }
        });
        conflict.resolved = true;
      }
    }

    return resolvedResults;
  }

  private weightedAggregation(
    results: EngineResult[]
  ): { finalConclusion: string; overallConfidence: number } {
    let totalWeight = 0;
    let weightedConfidence = 0;
    const conclusionParts: string[] = [];

    for (const result of results) {
      const weight = this.engineWeights[result.engineName.split(' ')[0]] || 0.1;
      totalWeight += weight;
      weightedConfidence += result.confidence * weight;

      if (result.confidence > 0.6) {
        conclusionParts.push(result.conclusion);
      }
    }

    const overallConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0.5;
    const finalConclusion = conclusionParts.length > 0
      ? conclusionParts.slice(0, 3).join('；')
      : '综合分析完成，建议人工复核';

    return { finalConclusion, overallConfidence };
  }

  private votingAggregation(
    results: EngineResult[]
  ): { finalConclusion: string; overallConfidence: number } {
    const positiveVotes = results.filter(r => r.confidence > 0.5).length;
    const totalVotes = results.length;
    const overallConfidence = positiveVotes / totalVotes;

    const majorityResults = results.filter(r => r.confidence > 0.5);
    const finalConclusion = majorityResults.length > 0
      ? majorityResults[0].conclusion
      : '投票结果不明确，建议人工复核';

    return { finalConclusion, overallConfidence };
  }

  private cascadeAggregation(
    results: EngineResult[]
  ): { finalConclusion: string; overallConfidence: number } {
    const cascadeOrder = ['因果推理引擎', '时序推理引擎', '空间推理引擎', '类比推理引擎', '层次推理引擎', '约束检查引擎'];

    for (const engineName of cascadeOrder) {
      const result = results.find(r => r.engineName === engineName);
      if (result && result.confidence > 0.7) {
        return {
          finalConclusion: result.conclusion,
          overallConfidence: result.confidence,
        };
      }
    }

    const highestResult = results.reduce((prev, curr) =>
      curr.confidence > prev.confidence ? curr : prev
    );

    return {
      finalConclusion: highestResult.conclusion,
      overallConfidence: highestResult.confidence * 0.8,
    };
  }

  setEngineWeight(engineName: string, weight: number): void {
    this.engineWeights[engineName] = Math.max(0, Math.min(1, weight));
  }

  getEngineWeights(): Record<string, number> {
    return { ...this.engineWeights };
  }
}

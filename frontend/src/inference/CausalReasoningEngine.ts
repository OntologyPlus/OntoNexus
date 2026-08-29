import { OntologyObject, OntologyEvent, LinkType } from '../types';

// ============================================
// 因果推理引擎
// ============================================

export interface CausalNode {
  id: string;
  relatedObjectId?: string;
  eventType: string;
  timestamp: string;
  description: string;
}

export interface CausalEdge {
  source: string;
  target: string;
  causalStrength: number;
  causalType: 'direct' | 'indirect' | 'common_cause' | 'confounding';
  evidence: string[];
}

export interface CausalGraph {
  nodes: CausalNode[];
  edges: CausalEdge[];
  rootCauses: string[];
  effects: string[];
}

export interface RootCause {
  nodeId: string;
  entityName: string;
  causeType: string;
  confidence: number;
  impact: number;
  evidence: string[];
}

export interface ImpactPath {
  path: string[];
  totalStrength: number;
  steps: { from: string; to: string; strength: number }[];
}

export class CausalReasoningEngine {
  private eventHistory: OntologyEvent[] = [];
  private causalGraph: CausalGraph = { nodes: [], edges: [], rootCauses: [], effects: [] };

  /**
   * 构建因果图
   */
  buildCausalGraph(
    events: OntologyEvent[],
    entities: OntologyObject[]
  ): CausalGraph {
    this.eventHistory = events;
    
    // 创建节点
    const nodes: CausalNode[] = events.map(event => ({
      id: event.id,
      relatedObjectId: event.relatedObjectId,
      eventType: event.eventType,
      timestamp: event.timestamp,
      description: event.description,
    }));

    // 创建边 - 基于时间顺序和实体关联
    const edges: CausalEdge[] = [];
    
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const eventA = events[i];
        const eventB = events[j];
        
        // 检查因果关系
        const causalRelation = this.inferCausalRelation(eventA, eventB, entities);
        
        if (causalRelation.strength > 0.3) {
          edges.push({
            source: eventA.id,
            target: eventB.id,
            causalStrength: causalRelation.strength,
            causalType: causalRelation.type,
            evidence: causalRelation.evidence,
          });
        }
      }
    }

    // 识别根因和结果
    const rootCauses = this.identifyRootCauses(nodes, edges);
    const effects = this.identifyEffects(nodes, edges);

    this.causalGraph = {
      nodes,
      edges,
      rootCauses,
      effects,
    };

    return this.causalGraph;
  }

  /**
   * 推断两个事件之间的因果关系
   */
  private inferCausalRelation(
    eventA: OntologyEvent,
    eventB: OntologyEvent,
    entities: OntologyObject[]
  ): { strength: number; type: 'direct' | 'indirect' | 'common_cause' | 'confounding'; evidence: string[] } {
    const evidence: string[] = [];
    let strength = 0;
    let type: 'direct' | 'indirect' | 'common_cause' | 'confounding' = 'direct';

    // 1. 时间顺序检查（原因必须在结果之前）
    const timeA = new Date(eventA.timestamp).getTime();
    const timeB = new Date(eventB.timestamp).getTime();
    
    if (timeA >= timeB) {
      return { strength: 0, type: 'direct', evidence: [] };
    }

    // 2. 实体关联检查
    const entityA = entities.find(e => e.id === eventA.relatedObjectId);
    const entityB = entities.find(e => e.id === eventB.relatedObjectId);
    
    if (entityA && entityB) {
      // 检查是否有直接关系
      const hasDirectLink = entityA.links.some(link => 
        link.targetId === entityB.id || 
        (link.targetType === entityB.objectType && link.linkType === LinkType.INFLUENCES)
      );
      
      if (hasDirectLink) {
        strength += 0.4;
        evidence.push('实体间存在直接影响关系');
      }

      // 检查共同关联
      const commonLinks = entityA.links.filter(linkA => 
        entityB.links.some(linkB => linkA.targetId === linkB.targetId)
      );
      
      if (commonLinks.length > 0) {
        strength += 0.2;
        evidence.push('实体有共同关联对象');
        type = 'common_cause';
      }
    }

    // 3. 事件类型关联
    const causalPatterns: { [key: string]: string[] } = {
      'prescription_drop': ['competitor_activity', 'doctor_attitude_change', 'supply_issue'],
      'market_share_decline': ['competitor_launch', 'price_change', 'policy_change'],
      'visit_effectiveness_drop': ['doctor_availability', 'topic_fatigue', 'relationship_issue'],
      'compliance_alert': ['frequency_increase', 'amount_increase', 'pattern_change'],
    };

    const possibleEffects = causalPatterns[eventA.eventType] || [];
    if (possibleEffects.includes(eventB.eventType)) {
      strength += 0.3;
      evidence.push(`事件类型匹配已知因果模式: ${eventA.eventType} → ${eventB.eventType}`);
    }

    // 5. 时间 proximity
    const timeDiff = timeB - timeA;
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    
    if (daysDiff < 7) {
      strength += 0.1;
      evidence.push('事件发生时间接近');
    } else if (daysDiff > 90) {
      strength -= 0.1;
      evidence.push('事件发生时间间隔较长');
    }

    return { strength: Math.min(1, Math.max(0, strength)), type, evidence };
  }

  /**
   * 识别根因
   */
  private identifyRootCauses(nodes: CausalNode[], edges: CausalEdge[]): string[] {
    // 根因是没有入边的节点
    const nodesWithIncoming = new Set(edges.map(e => e.target));
    return nodes.filter(n => !nodesWithIncoming.has(n.id)).map(n => n.id);
  }

  /**
   * 识别结果
   */
  private identifyEffects(nodes: CausalNode[], edges: CausalEdge[]): string[] {
    // 结果是没有出边的节点
    const nodesWithOutgoing = new Set(edges.map(e => e.source));
    return nodes.filter(n => !nodesWithOutgoing.has(n.id)).map(n => n.id);
  }

  /**
   * 根因分析
   */
  rootCauseAnalysis(
    effect: OntologyEvent,
    causalGraph?: CausalGraph
  ): RootCause[] {
    const graph = causalGraph || this.causalGraph;
    const rootCauses: RootCause[] = [];

    // 找到所有到该效果的路径
    const paths = this.findAllPaths(graph, effect.id);
    
    paths.forEach(path => {
      if (path.length > 0) {
        const rootNodeId = path[0];
        const rootNode = graph.nodes.find(n => n.id === rootNodeId);
        
        if (rootNode) {
          // 计算影响程度
          const impact = this.calculatePathImpact(graph, path);
          
          // 获取证据
          const evidence = this.collectEvidence(graph, path);
          
          rootCauses.push({
            nodeId: rootNode.id,
            entityName: rootNode.relatedObjectId || rootNode.id,
            causeType: rootNode.eventType,
            confidence: impact.totalStrength,
            impact: impact.totalImpact,
            evidence,
          });
        }
      }
    });

    // 按置信度排序
    return rootCauses.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 影响传播模拟
   */
  simulateImpactPropagation(
    cause: OntologyEvent,
    depth: number = 3
  ): ImpactPath[] {
    const paths: ImpactPath[] = [];
    const visited = new Set<string>();

    const dfs = (currentId: string, currentPath: string[], currentStrength: number, currentDepth: number) => {
      if (currentDepth >= depth || visited.has(currentId)) {
        if (currentPath.length > 1) {
          paths.push({
            path: [...currentPath],
            totalStrength: currentStrength,
            steps: this.extractSteps(currentPath, this.causalGraph),
          });
        }
        return;
      }

      visited.add(currentId);
      
      const outgoingEdges = this.causalGraph.edges.filter(e => e.source === currentId);
      
      if (outgoingEdges.length === 0 && currentPath.length > 1) {
        paths.push({
          path: [...currentPath],
          totalStrength: currentStrength,
          steps: this.extractSteps(currentPath, this.causalGraph),
        });
      } else {
        outgoingEdges.forEach(edge => {
          dfs(
            edge.target,
            [...currentPath, edge.target],
            currentStrength * edge.causalStrength,
            currentDepth + 1
          );
        });
      }

      visited.delete(currentId);
    };

    dfs(cause.id, [cause.id], 1, 0);

    // 按总强度排序
    return paths.sort((a, b) => b.totalStrength - a.totalStrength);
  }

  /**
   * 查找所有路径
   */
  private findAllPaths(graph: CausalGraph, targetId: string): string[][] {
    const paths: string[][] = [];
    
    const dfs = (currentId: string, currentPath: string[]) => {
      const incomingEdges = graph.edges.filter(e => e.target === currentId);
      
      if (incomingEdges.length === 0) {
        paths.push([...currentPath].reverse());
        return;
      }
      
      incomingEdges.forEach(edge => {
        dfs(edge.source, [...currentPath, edge.source]);
      });
    };
    
    dfs(targetId, [targetId]);
    return paths;
  }

  /**
   * 计算路径影响
   */
  private calculatePathImpact(graph: CausalGraph, path: string[]): { totalStrength: number; totalImpact: number } {
    let totalStrength = 1;
    let totalImpact = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.edges.find(e => e.source === path[i] && e.target === path[i + 1]);
      if (edge) {
        totalStrength *= edge.causalStrength;
        totalImpact += edge.causalStrength;
      }
    }
    
    return { totalStrength, totalImpact };
  }

  /**
   * 收集证据
   */
  private collectEvidence(graph: CausalGraph, path: string[]): string[] {
    const evidence: string[] = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.edges.find(e => e.source === path[i] && e.target === path[i + 1]);
      if (edge) {
        evidence.push(...edge.evidence);
      }
    }
    
    return [...new Set(evidence)];
  }

  /**
   * 提取步骤
   */
  private extractSteps(path: string[], graph: CausalGraph): { from: string; to: string; strength: number }[] {
    const steps: { from: string; to: string; strength: number }[] = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const edge = graph.edges.find(e => e.source === path[i] && e.target === path[i + 1]);
      if (edge) {
        steps.push({
          from: path[i],
          to: path[i + 1],
          strength: edge.causalStrength,
        });
      }
    }
    
    return steps;
  }

  /**
   * 添加事件到历史
   */
  addEvent(event: OntologyEvent): void {
    this.eventHistory.push(event);
  }

  /**
   * 获取事件历史
   */
  getEventHistory(): OntologyEvent[] {
    return [...this.eventHistory];
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.eventHistory = [];
    this.causalGraph = { nodes: [], edges: [], rootCauses: [], effects: [] };
  }
}

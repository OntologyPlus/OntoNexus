import { OntologyObject, ObjectType } from '../types';

export interface ImplicitRelation {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  relationType: string;
  confidence: number;
  evidence: string[];
  discoveryMethod: 'association' | 'network' | 'anomaly' | 'path';
  createdAt: Date;
  confirmed: boolean;
}

export interface AssociationRule {
  id: string;
  antecedent: string[];
  consequent: string[];
  support: number;
  confidence: number;
  lift: number;
  description: string;
}

export interface NetworkMetrics {
  nodeId: string;
  nodeName: string;
  degree: number;
  betweenness: number;
  closeness: number;
  eigenvector: number;
  influence: number;
}

export interface AnomalyPattern {
  id: string;
  type: 'outlier' | 'change_point' | 'cluster' | 'rare_pattern';
  description: string;
  affectedEntities: string[];
  severity: 'low' | 'medium' | 'high';
  detectedAt: Date;
}

export class ImplicitRelationMiner {
  private objects: OntologyObject[];
  private implicitRelations: ImplicitRelation[] = [];
  private associationRules: AssociationRule[] = [];
  private networkMetrics: Map<string, NetworkMetrics> = new Map();
  private anomalies: AnomalyPattern[] = [];

  private minSupport = 0.1;
  private minConfidence = 0.6;
  private minLift = 1.2;

  constructor(objects: OntologyObject[]) {
    this.objects = objects;
  }

  mineAll(): {
    implicitRelations: ImplicitRelation[];
    associationRules: AssociationRule[];
    networkMetrics: NetworkMetrics[];
    anomalies: AnomalyPattern[];
  } {
    this.mineAssociationRules();
    this.analyzeNetwork();
    this.detectAnomalies();
    this.discoverImplicitPaths();

    return {
      implicitRelations: this.implicitRelations,
      associationRules: this.associationRules,
      networkMetrics: Array.from(this.networkMetrics.values()),
      anomalies: this.anomalies,
    };
  }

  private mineAssociationRules(): void {
    const transactions = this.buildTransactions();
    const frequentItemsets = this.findFrequentItemsets(transactions);
    
    for (const itemset of frequentItemsets) {
      if (itemset.length >= 2) {
        for (let i = 1; i < itemset.length; i++) {
          const antecedent = itemset.slice(0, i);
          const consequent = itemset.slice(i);
          
          const rule = this.calculateRuleMetrics(transactions, antecedent, consequent);
          
          if (rule.confidence >= this.minConfidence && rule.lift >= this.minLift) {
            this.associationRules.push(rule);

            const sourceObj = this.objects.find(o => 
              antecedent.some(a => o.objectType === a || o.id === a)
            );
            const targetObj = this.objects.find(o => 
              consequent.some(c => o.objectType === c || o.id === c)
            );

            if (sourceObj && targetObj) {
              this.implicitRelations.push({
                id: `impl_assoc_${Date.now()}_${this.implicitRelations.length}`,
                sourceId: sourceObj.id,
                sourceName: sourceObj.name,
                targetId: targetObj.id,
                targetName: targetObj.name,
                relationType: '关联',
                confidence: rule.confidence,
                evidence: [
                  `支持度: ${(rule.support * 100).toFixed(1)}%`,
                  `置信度: ${(rule.confidence * 100).toFixed(1)}%`,
                  `提升度: ${rule.lift.toFixed(2)}`,
                ],
                discoveryMethod: 'association',
                createdAt: new Date(),
                confirmed: false,
              });
            }
          }
        }
      }
    }
  }

  private buildTransactions(): string[][] {
    const transactions: string[][] = [];

    for (const obj of this.objects) {
      const transaction: string[] = [obj.objectType, obj.id];

      for (const link of obj.links) {
        transaction.push(link.linkType);
        transaction.push(link.targetId);
      }

      if (obj.properties) {
        for (const [key, value] of Object.entries(obj.properties)) {
          if (typeof value === 'string' || typeof value === 'number') {
            transaction.push(`${key}=${value}`);
          }
        }
      }

      if (obj.lifecycleStage) {
        transaction.push(`lifecycle=${obj.lifecycleStage}`);
      }

      transactions.push(transaction);
    }

    return transactions;
  }

  private findFrequentItemsets(transactions: string[][]): string[][] {
    const itemCounts = new Map<string, number>();
    const totalTransactions = transactions.length;

    for (const transaction of transactions) {
      for (const item of transaction) {
        itemCounts.set(item, (itemCounts.get(item) || 0) + 1);
      }
    }

    const frequentItems = Array.from(itemCounts.entries())
      .filter(([_, count]) => count / totalTransactions >= this.minSupport)
      .map(([item]) => item);

    const frequentItemsets: string[][] = frequentItems.map(item => [item]);

    for (let size = 2; size <= 3; size++) {
      const candidates = this.generateCandidates(frequentItemsets, size);
      
      for (const candidate of candidates) {
        const count = transactions.filter(t => 
          candidate.every(item => t.includes(item))
        ).length;
        
        if (count / totalTransactions >= this.minSupport) {
          frequentItemsets.push(candidate);
        }
      }
    }

    return frequentItemsets;
  }

  private generateCandidates(itemsets: string[][], size: number): string[][] {
    const candidates: string[][] = [];

    for (let i = 0; i < itemsets.length; i++) {
      for (let j = i + 1; j < itemsets.length; j++) {
        const combined = [...new Set([...itemsets[i], ...itemsets[j]])];
        if (combined.length === size) {
          candidates.push(combined);
        }
      }
    }

    return candidates;
  }

  private calculateRuleMetrics(
    transactions: string[][],
    antecedent: string[],
    consequent: string[]
  ): AssociationRule {
    const total = transactions.length;
    
    const antecedentCount = transactions.filter(t => 
      antecedent.every(a => t.includes(a))
    ).length;
    
    const bothCount = transactions.filter(t => 
      [...antecedent, ...consequent].every(item => t.includes(item))
    ).length;
    
    const consequentCount = transactions.filter(t => 
      consequent.every(c => t.includes(c))
    ).length;

    const support = bothCount / total;
    const confidence = antecedentCount > 0 ? bothCount / antecedentCount : 0;
    const expectedConfidence = consequentCount / total;
    const lift = expectedConfidence > 0 ? confidence / expectedConfidence : 0;

    return {
      id: `rule_${Date.now()}_${this.associationRules.length}`,
      antecedent,
      consequent,
      support,
      confidence,
      lift,
      description: `${antecedent.join(' + ')} → ${consequent.join(' + ')}`,
    };
  }

  private analyzeNetwork(): void {
    const adjacencyList = this.buildAdjacencyList();

    for (const [nodeId, neighbors] of adjacencyList) {
      const node = this.objects.find(o => o.id === nodeId);
      if (!node) continue;

      const degree = neighbors.length;
      const betweenness = this.calculateBetweenness(nodeId, adjacencyList);
      const closeness = this.calculateCloseness(nodeId, adjacencyList);
      const eigenvector = this.calculateEigenvector(nodeId, adjacencyList);
      const influence = (degree * 0.3 + betweenness * 0.3 + closeness * 0.2 + eigenvector * 0.2);

      this.networkMetrics.set(nodeId, {
        nodeId,
        nodeName: node.name,
        degree,
        betweenness,
        closeness,
        eigenvector,
        influence,
      });

      if (influence > 0.7 && degree > 5) {
        const highInfluenceNeighbors = neighbors.filter(n => {
          const neighborMetrics = this.networkMetrics.get(n.id);
          return neighborMetrics && neighborMetrics.influence > 0.5;
        });

        if (highInfluenceNeighbors.length >= 3) {
          for (const neighbor of highInfluenceNeighbors) {
            const neighborObj = this.objects.find(o => o.id === neighbor.id);
            if (neighborObj) {
              this.implicitRelations.push({
                id: `impl_network_${Date.now()}_${this.implicitRelations.length}`,
                sourceId: nodeId,
                sourceName: node.name,
                targetId: neighbor.id,
                targetName: neighborObj.name,
                relationType: '隐含影响',
                confidence: influence * 0.8,
                evidence: [
                  `节点影响力: ${(influence * 100).toFixed(0)}%`,
                  `中介中心性: ${betweenness.toFixed(2)}`,
                  `连接高影响力节点: ${highInfluenceNeighbors.length}个`,
                ],
                discoveryMethod: 'network',
                createdAt: new Date(),
                confirmed: false,
              });
            }
          }
        }
      }
    }
  }

  private buildAdjacencyList(): Map<string, Array<{ id: string; type: string }>> {
    const adjacencyList = new Map<string, Array<{ id: string; type: string }>>();

    for (const obj of this.objects) {
      if (!adjacencyList.has(obj.id)) {
        adjacencyList.set(obj.id, []);
      }

      for (const link of obj.links) {
        adjacencyList.get(obj.id)!.push({ id: link.targetId, type: link.linkType });

        if (!adjacencyList.has(link.targetId)) {
          adjacencyList.set(link.targetId, []);
        }
        adjacencyList.get(link.targetId)!.push({ id: obj.id, type: link.linkType });
      }
    }

    return adjacencyList;
  }

  private calculateBetweenness(nodeId: string, adjacencyList: Map<string, Array<{ id: string; type: string }>>): number {
    let betweenness = 0;
    const nodes = Array.from(adjacencyList.keys()).filter(id => id !== nodeId);

    for (let i = 0; i < Math.min(nodes.length, 10); i++) {
      for (let j = i + 1; j < Math.min(nodes.length, 10); j++) {
        const path = this.findShortestPath(nodes[i], nodes[j], adjacencyList);
        if (path && path.includes(nodeId)) {
          betweenness += 1;
        }
      }
    }

    return betweenness / (Math.min(nodes.length, 10) * (Math.min(nodes.length, 10) - 1) / 2);
  }

  private calculateCloseness(nodeId: string, adjacencyList: Map<string, Array<{ id: string; type: string }>>): number {
    const distances = this.calculateDistances(nodeId, adjacencyList);
    const totalDistance = Array.from(distances.values()).reduce((sum, d) => sum + d, 0);
    const reachableNodes = distances.size;

    return reachableNodes > 0 ? reachableNodes / totalDistance : 0;
  }

  private calculateEigenvector(nodeId: string, adjacencyList: Map<string, Array<{ id: string; type: string }>>): number {
    const neighbors = adjacencyList.get(nodeId) || [];
    if (neighbors.length === 0) return 0;

    let sum = 0;
    for (const neighbor of neighbors) {
      const neighborMetrics = this.networkMetrics.get(neighbor.id);
      if (neighborMetrics) {
        sum += neighborMetrics.degree;
      }
    }

    return sum / neighbors.length / (adjacencyList.size || 1);
  }

  private findShortestPath(
    start: string,
    end: string,
    adjacencyList: Map<string, Array<{ id: string; type: string }>>
  ): string[] | null {
    const queue: Array<{ node: string; path: string[] }> = [{ node: start, path: [start] }];
    const visited = new Set<string>([start]);

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;

      if (node === end) {
        return path;
      }

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ node: neighbor.id, path: [...path, neighbor.id] });
        }
      }
    }

    return null;
  }

  private calculateDistances(
    start: string,
    adjacencyList: Map<string, Array<{ id: string; type: string }>>
  ): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: Array<{ node: string; distance: number }> = [{ node: start, distance: 0 }];
    const visited = new Set<string>([start]);

    while (queue.length > 0) {
      const { node, distance } = queue.shift()!;
      distances.set(node, distance);

      const neighbors = adjacencyList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id);
          queue.push({ node: neighbor.id, distance: distance + 1 });
        }
      }
    }

    return distances;
  }

  private detectAnomalies(): void {
    const propertyValues = new Map<string, number[]>();

    for (const obj of this.objects) {
      for (const [key, value] of Object.entries(obj.properties)) {
        if (typeof value === 'number') {
          if (!propertyValues.has(key)) {
            propertyValues.set(key, []);
          }
          propertyValues.get(key)!.push(value);
        }
      }
    }

    for (const [property, values] of propertyValues) {
      if (values.length < 5) continue;

      const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
      const std = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

      if (std === 0) continue;

      for (const obj of this.objects) {
        const value = obj.properties[property];
        if (typeof value === 'number') {
          const zScore = Math.abs((value - mean) / std);

          if (zScore > 2.5) {
            this.anomalies.push({
              id: `anomaly_${Date.now()}_${this.anomalies.length}`,
              type: 'outlier',
              description: `${obj.name} 的 ${property} 值 (${value}) 显著偏离平均值 (${mean.toFixed(2)})`,
              affectedEntities: [obj.id],
              severity: zScore > 3 ? 'high' : 'medium',
              detectedAt: new Date(),
            });
          }
        }
      }
    }

    const typeCounts = new Map<ObjectType, number>();
    for (const obj of this.objects) {
      typeCounts.set(obj.objectType, (typeCounts.get(obj.objectType) || 0) + 1);
    }

    for (const [type, count] of typeCounts) {
      const avgCount = this.objects.length / typeCounts.size;
      if (count > avgCount * 3) {
        this.anomalies.push({
          id: `anomaly_${Date.now()}_${this.anomalies.length}`,
          type: 'cluster',
          description: `${type} 类型对象数量 (${count}) 显著高于平均水平`,
          affectedEntities: this.objects.filter(o => o.objectType === type).map(o => o.id),
          severity: 'low',
          detectedAt: new Date(),
        });
      }
    }
  }

  private discoverImplicitPaths(): void {
    for (const obj of this.objects) {
      const directConnections = new Set(obj.links.map(l => l.targetId));

      const twoHopConnections = new Map<string, string[]>();
      for (const link of obj.links) {
        const neighbor = this.objects.find(o => o.id === link.targetId);
        if (neighbor) {
          for (const neighborLink of neighbor.links) {
            if (!directConnections.has(neighborLink.targetId) && neighborLink.targetId !== obj.id) {
              if (!twoHopConnections.has(neighborLink.targetId)) {
                twoHopConnections.set(neighborLink.targetId, []);
              }
              twoHopConnections.get(neighborLink.targetId)!.push(neighbor.id);
            }
          }
        }
      }

      for (const [targetId, intermediaries] of twoHopConnections) {
        if (intermediaries.length >= 2) {
          const targetObj = this.objects.find(o => o.id === targetId);
          if (targetObj) {
            this.implicitRelations.push({
              id: `impl_path_${Date.now()}_${this.implicitRelations.length}`,
              sourceId: obj.id,
              sourceName: obj.name,
              targetId,
              targetName: targetObj.name,
              relationType: '潜在关联',
              confidence: Math.min(0.9, 0.5 + intermediaries.length * 0.1),
              evidence: [
                `通过 ${intermediaries.length} 条路径可达`,
                `中间节点: ${intermediaries.slice(0, 3).join(', ')}${intermediaries.length > 3 ? '...' : ''}`,
              ],
              discoveryMethod: 'path',
              createdAt: new Date(),
              confirmed: false,
            });
          }
        }
      }
    }
  }

  getImplicitRelations(): ImplicitRelation[] {
    return this.implicitRelations;
  }

  getAssociationRules(): AssociationRule[] {
    return this.associationRules;
  }

  getNetworkMetrics(): NetworkMetrics[] {
    return Array.from(this.networkMetrics.values());
  }

  getAnomalies(): AnomalyPattern[] {
    return this.anomalies;
  }

  confirmRelation(relationId: string): boolean {
    const relation = this.implicitRelations.find(r => r.id === relationId);
    if (relation) {
      relation.confirmed = true;
      return true;
    }
    return false;
  }
}

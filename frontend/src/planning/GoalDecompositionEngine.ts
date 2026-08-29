
export interface Goal {
  id: string;
  name: string;
  description: string;
  type: GoalType;
  priority: 'high' | 'medium' | 'low';
  targetValue: number;
  currentValue: number;
  deadline?: string;
  constraints: Constraint[];
  metadata: Record<string, any>;
}

export interface SubGoal extends Goal {
  parentId: string;
  dependencies: string[];
  order: number;
  estimatedEffort: number;
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface Constraint {
  id: string;
  type: 'resource' | 'time' | 'budget' | 'dependency' | 'compliance';
  description: string;
  value: any;
  isHard: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  levels: string[][];
  criticalPath: string[];
}

export interface GraphNode {
  id: string;
  name: string;
  type: 'goal' | 'subgoal' | 'action';
  level: number;
  dependencies: string[];
  dependents: string[];
  estimatedDuration: number;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'dependency' | 'sequence' | 'parallel';
  strength: number;
}

export interface CriticalPath {
  path: string[];
  totalDuration: number;
  totalEffort: number;
  bottlenecks: string[];
  riskFactors: string[];
}

export interface ResourceEstimate {
  totalHours: number;
  totalBudget: number;
  requiredRoles: { role: string; count: number; hours: number }[];
  timeline: { phase: string; startWeek: number; endWeek: number; resources: number }[];
  constraints: string[];
}

export type GoalType = 
  | 'revenue' 
  | 'customer' 
  | 'market' 
  | 'compliance' 
  | 'development' 
  | 'efficiency';

const GOAL_DECOMPOSITION_TEMPLATES: Record<GoalType, { subGoalTypes: string[]; weights: number[] }> = {
  revenue: {
    subGoalTypes: ['acquisition', 'retention', 'expansion', 'efficiency'],
    weights: [0.3, 0.25, 0.25, 0.2],
  },
  customer: {
    subGoalTypes: ['satisfaction', 'engagement', 'loyalty', 'advocacy'],
    weights: [0.3, 0.25, 0.25, 0.2],
  },
  market: {
    subGoalTypes: ['penetration', 'share', 'awareness', 'positioning'],
    weights: [0.3, 0.3, 0.2, 0.2],
  },
  compliance: {
    subGoalTypes: ['training', 'monitoring', 'documentation', 'improvement'],
    weights: [0.25, 0.3, 0.25, 0.2],
  },
  development: {
    subGoalTypes: ['planning', 'execution', 'monitoring', 'optimization'],
    weights: [0.2, 0.35, 0.25, 0.2],
  },
  efficiency: {
    subGoalTypes: ['process', 'automation', 'training', 'measurement'],
    weights: [0.3, 0.25, 0.25, 0.2],
  },
};

export class GoalDecompositionEngine {
  decomposeGoal(goal: Goal): SubGoal[] {
    const template = GOAL_DECOMPOSITION_TEMPLATES[goal.type];
    if (!template) {
      return this.defaultDecomposition(goal);
    }

    const subGoals: SubGoal[] = [];
    const gap = goal.targetValue - goal.currentValue;

    template.subGoalTypes.forEach((subGoalType, index) => {
      const weight = template.weights[index];
      const subGoalTarget = gap * weight;
      
      const subGoal: SubGoal = {
        id: `${goal.id}_sub_${index + 1}`,
        name: this.generateSubGoalName(goal.name, subGoalType),
        description: this.generateSubGoalDescription(goal.description, subGoalType, subGoalTarget),
        type: goal.type,
        priority: this.determineSubGoalPriority(weight, goal.priority),
        targetValue: subGoalTarget,
        currentValue: 0,
        deadline: goal.deadline,
        constraints: this.extractRelevantConstraints(goal.constraints, subGoalType),
        metadata: {
          ...goal.metadata,
          subGoalType,
          weight,
        },
        parentId: goal.id,
        dependencies: index > 0 ? [`${goal.id}_sub_${index}`] : [],
        order: index + 1,
        estimatedEffort: this.estimateEffort(subGoalTarget, subGoalType),
        status: 'pending',
      };

      subGoals.push(subGoal);
    });

    return subGoals;
  }

  buildDependencyGraph(subGoals: SubGoal[]): DependencyGraph {
    const nodes: GraphNode[] = subGoals.map((sg, _index) => ({
      id: sg.id,
      name: sg.name,
      type: 'subgoal' as const,
      level: this.calculateLevel(sg, subGoals),
      dependencies: sg.dependencies,
      dependents: this.findDependents(sg.id, subGoals),
      estimatedDuration: this.estimateDuration(sg),
      status: sg.status,
    }));

    const edges: GraphEdge[] = [];
    subGoals.forEach(sg => {
      sg.dependencies.forEach(depId => {
        edges.push({
          id: `edge_${depId}_${sg.id}`,
          source: depId,
          target: sg.id,
          type: 'dependency',
          strength: 1,
        });
      });
    });

    const levels = this.calculateLevels(nodes, edges);
    const criticalPath = this.findCriticalPath(nodes, edges);

    return {
      nodes,
      edges,
      levels,
      criticalPath,
    };
  }

  analyzeCriticalPath(graph: DependencyGraph): CriticalPath {
    const path = graph.criticalPath;
    const pathNodes = path.map(id => graph.nodes.find(n => n.id === id)!).filter(Boolean);
    
    const totalDuration = pathNodes.reduce((sum, n) => sum + n.estimatedDuration, 0);
    const totalEffort = pathNodes.reduce((sum, n) => {
      const sg = this.findSubGoalById(n.id);
      return sum + (sg?.estimatedEffort || 0);
    }, 0);

    const bottlenecks = this.identifyBottlenecks(graph);
    const riskFactors = this.identifyRiskFactors(graph, pathNodes);

    return {
      path,
      totalDuration,
      totalEffort,
      bottlenecks,
      riskFactors,
    };
  }

  estimateResourceNeeds(subGoals: SubGoal[]): ResourceEstimate {
    const totalHours = subGoals.reduce((sum, sg) => sum + sg.estimatedEffort, 0);
    const totalBudget = this.estimateBudget(subGoals);
    const requiredRoles = this.determineRequiredRoles(subGoals);
    const timeline = this.generateTimeline(subGoals);
    const constraints = this.identifyResourceConstraints(subGoals);

    return {
      totalHours,
      totalBudget,
      requiredRoles,
      timeline,
      constraints,
    };
  }

  private defaultDecomposition(goal: Goal): SubGoal[] {
    const subGoals: SubGoal[] = [];
    const gap = goal.targetValue - goal.currentValue;
    const subTarget = gap / 3;

    for (let i = 1; i <= 3; i++) {
      subGoals.push({
        id: `${goal.id}_sub_${i}`,
        name: `${goal.name} - 阶段${i}`,
        description: `${goal.description} 的第${i}阶段`,
        type: goal.type,
        priority: goal.priority,
        targetValue: subTarget,
        currentValue: 0,
        deadline: goal.deadline,
        constraints: goal.constraints,
        metadata: goal.metadata,
        parentId: goal.id,
        dependencies: i > 1 ? [`${goal.id}_sub_${i - 1}`] : [],
        order: i,
        estimatedEffort: subTarget * 0.1,
        status: 'pending',
      });
    }

    return subGoals;
  }

  private generateSubGoalName(parentName: string, subGoalType: string): string {
    const typeNames: Record<string, string> = {
      acquisition: '客户获取',
      retention: '客户保留',
      expansion: '业务扩展',
      efficiency: '效率提升',
      satisfaction: '满意度提升',
      engagement: '参与度提升',
      loyalty: '忠诚度建设',
      advocacy: '口碑传播',
      penetration: '市场渗透',
      share: '市场份额',
      awareness: '品牌认知',
      positioning: '市场定位',
      training: '培训教育',
      monitoring: '监控检查',
      documentation: '文档管理',
      improvement: '持续改进',
      planning: '规划阶段',
      execution: '执行阶段',
      optimization: '优化阶段',
      process: '流程优化',
      automation: '自动化',
      measurement: '度量体系',
    };

    return `${parentName} - ${typeNames[subGoalType] || subGoalType}`;
  }

  private generateSubGoalDescription(parentDesc: string, subGoalType: string, target: number): string {
    return `${parentDesc}，通过${subGoalType}实现目标增量 ${target.toFixed(2)}`;
  }

  private determineSubGoalPriority(weight: number, parentPriority: 'high' | 'medium' | 'low'): 'high' | 'medium' | 'low' {
    if (weight >= 0.3 && parentPriority === 'high') return 'high';
    if (weight >= 0.25) return parentPriority;
    if (parentPriority === 'high') return 'medium';
    return 'low';
  }

  private extractRelevantConstraints(constraints: Constraint[], subGoalType: string): Constraint[] {
    return constraints.filter(c => {
      if (c.type === 'resource') return true;
      if (c.type === 'time') return true;
      if (c.type === 'budget' && ['acquisition', 'expansion', 'penetration'].includes(subGoalType)) {
        return true;
      }
      if (c.type === 'compliance' && ['training', 'documentation', 'monitoring'].includes(subGoalType)) {
        return true;
      }
      return false;
    });
  }

  private estimateEffort(target: number, subGoalType: string): number {
    const baseEffort = Math.abs(target) * 0.1;
    
    const effortMultipliers: Record<string, number> = {
      acquisition: 1.2,
      retention: 0.8,
      expansion: 1.1,
      efficiency: 0.9,
      satisfaction: 0.7,
      engagement: 0.8,
      loyalty: 0.9,
      advocacy: 0.6,
      penetration: 1.3,
      share: 1.4,
      awareness: 1.0,
      positioning: 1.1,
      training: 0.6,
      monitoring: 0.5,
      documentation: 0.4,
      improvement: 0.8,
      planning: 0.5,
      execution: 1.2,
      optimization: 0.7,
      process: 0.8,
      automation: 1.0,
      measurement: 0.6,
    };

    return baseEffort * (effortMultipliers[subGoalType] || 1.0);
  }

  private calculateLevel(subGoal: SubGoal, allSubGoals: SubGoal[]): number {
    if (subGoal.dependencies.length === 0) return 0;
    
    const maxDepLevel = Math.max(
      ...subGoal.dependencies.map(depId => {
        const dep = allSubGoals.find(sg => sg.id === depId);
        return dep ? this.calculateLevel(dep, allSubGoals) : 0;
      })
    );
    
    return maxDepLevel + 1;
  }

  private findDependents(subGoalId: string, allSubGoals: SubGoal[]): string[] {
    return allSubGoals
      .filter(sg => sg.dependencies.includes(subGoalId))
      .map(sg => sg.id);
  }

  private estimateDuration(subGoal: SubGoal): number {
    return Math.ceil(subGoal.estimatedEffort / 40);
  }

  private calculateLevels(nodes: GraphNode[], _edges: GraphEdge[]): string[][] {
    const levels: string[][] = [];
    const assigned = new Set<string>();
    
    let currentLevel = nodes.filter(n => n.dependencies.length === 0);
    
    while (currentLevel.length > 0) {
      levels.push(currentLevel.map(n => n.id));
      currentLevel.forEach(n => assigned.add(n.id));
      
      currentLevel = nodes.filter(n => 
        !assigned.has(n.id) &&
        n.dependencies.every(depId => assigned.has(depId))
      );
    }
    
    return levels;
  }

  private findCriticalPath(nodes: GraphNode[], edges: GraphEdge[]): string[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const endNodes = nodes.filter(n => n.dependents.length === 0);
    
    if (endNodes.length === 0) {
      return nodes.length > 0 ? [nodes[0].id] : [];
    }
    
    let longestPath: string[] = [];
    let maxDuration = 0;
    
    for (const endNode of endNodes) {
      const path = this.findLongestPathToNode(endNode.id, nodeMap, edges);
      const duration = path.reduce((sum, id) => {
        const node = nodeMap.get(id);
        return sum + (node?.estimatedDuration || 0);
      }, 0);
      
      if (duration > maxDuration) {
        maxDuration = duration;
        longestPath = path;
      }
    }
    
    return longestPath;
  }

  private findLongestPathToNode(
    nodeId: string,
    nodeMap: Map<string, GraphNode>,
    edges: GraphEdge[]
  ): string[] {
    const node = nodeMap.get(nodeId);
    if (!node || node.dependencies.length === 0) {
      return [nodeId];
    }
    
    let longestPath: string[] = [];
    let maxDuration = 0;
    
    for (const depId of node.dependencies) {
      const depPath = this.findLongestPathToNode(depId, nodeMap, edges);
      const duration = depPath.reduce((sum, id) => {
        const n = nodeMap.get(id);
        return sum + (n?.estimatedDuration || 0);
      }, 0);
      
      if (duration > maxDuration) {
        maxDuration = duration;
        longestPath = depPath;
      }
    }
    
    return [...longestPath, nodeId];
  }

  private identifyBottlenecks(graph: DependencyGraph): string[] {
    const bottlenecks: string[] = [];
    
    for (const node of graph.nodes) {
      if (node.dependents.length > 3) {
        bottlenecks.push(node.id);
      }
      
      if (node.status === 'blocked') {
        bottlenecks.push(node.id);
      }
    }
    
    return bottlenecks;
  }

  private identifyRiskFactors(graph: DependencyGraph, pathNodes: GraphNode[]): string[] {
    const risks: string[] = [];
    
    const blockedNodes = pathNodes.filter(n => n.status === 'blocked');
    if (blockedNodes.length > 0) {
      risks.push(`关键路径上有 ${blockedNodes.length} 个阻塞节点`);
    }
    
    const longDurationNodes = pathNodes.filter(n => n.estimatedDuration > 4);
    if (longDurationNodes.length > 0) {
      risks.push('关键路径上存在长周期任务');
    }
    
    if (graph.edges.filter(e => e.type === 'dependency').length > pathNodes.length * 2) {
      risks.push('依赖关系过于复杂');
    }
    
    return risks;
  }

  private estimateBudget(subGoals: SubGoal[]): number {
    return subGoals.reduce((sum, sg) => {
      const baseCost = sg.estimatedEffort * 200;
      const typeMultiplier = this.getBudgetMultiplier(sg.metadata.subGoalType);
      return sum + baseCost * typeMultiplier;
    }, 0);
  }

  private getBudgetMultiplier(subGoalType: string): number {
    const multipliers: Record<string, number> = {
      acquisition: 1.5,
      expansion: 1.4,
      penetration: 1.3,
      awareness: 1.2,
      training: 0.8,
      documentation: 0.6,
      automation: 1.3,
    };
    return multipliers[subGoalType] || 1.0;
  }

  private determineRequiredRoles(subGoals: SubGoal[]): { role: string; count: number; hours: number }[] {
    const roleHours: Record<string, number> = {};
    
    for (const sg of subGoals) {
      const roles = this.getRequiredRolesForType(sg.metadata.subGoalType);
      for (const role of roles) {
        roleHours[role] = (roleHours[role] || 0) + sg.estimatedEffort / roles.length;
      }
    }
    
    return Object.entries(roleHours).map(([role, hours]) => ({
      role,
      count: Math.ceil(hours / 160),
      hours: Math.round(hours),
    }));
  }

  private getRequiredRolesForType(subGoalType: string): string[] {
    const roleMap: Record<string, string[]> = {
      acquisition: ['销售代表', '市场专员'],
      retention: ['客户经理', '服务专员'],
      expansion: ['销售代表', '产品经理'],
      efficiency: ['运营专员', '数据分析师'],
      satisfaction: ['客户经理', '服务专员'],
      training: ['培训专员', 'HR'],
      monitoring: ['数据分析师', '运营专员'],
      automation: ['技术工程师', '产品经理'],
    };
    return roleMap[subGoalType] || ['执行人员'];
  }

  private generateTimeline(subGoals: SubGoal[]): { phase: string; startWeek: number; endWeek: number; resources: number }[] {
    const phases: { phase: string; startWeek: number; endWeek: number; resources: number }[] = [];
    let currentWeek = 0;
    
    const sortedSubGoals = [...subGoals].sort((a, b) => a.order - b.order);
    
    for (const sg of sortedSubGoals) {
      const duration = Math.ceil(sg.estimatedEffort / 40);
      phases.push({
        phase: sg.name,
        startWeek: currentWeek,
        endWeek: currentWeek + duration,
        resources: Math.ceil(sg.estimatedEffort / duration / 40),
      });
      currentWeek += duration;
    }
    
    return phases;
  }

  private identifyResourceConstraints(subGoals: SubGoal[]): string[] {
    const constraints: string[] = [];
    
    const totalEffort = subGoals.reduce((sum, sg) => sum + sg.estimatedEffort, 0);
    if (totalEffort > 2000) {
      constraints.push('总工作量较大，建议分阶段实施');
    }
    
    const hardConstraints = subGoals.flatMap(sg => sg.constraints.filter(c => c.isHard));
    if (hardConstraints.length > 0) {
      constraints.push(`存在 ${hardConstraints.length} 个硬性约束需要满足`);
    }
    
    return constraints;
  }

  private findSubGoalById(_id: string): SubGoal | undefined {
    return undefined;
  }
}

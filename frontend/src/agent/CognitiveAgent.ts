import { OntologyObject, ReasoningChain } from '../types';
import { PerceptionEngine, EntityPerception, PerceptionResult } from '../perception/PerceptionEngine';
import { AbductiveReasoningEngine, Observation, Hypothesis } from '../inference/AbductiveReasoningEngine';
import { GoalDecompositionEngine, Goal, SubGoal, DependencyGraph } from '../planning/GoalDecompositionEngine';
import { ActionSequenceGenerator, ActionSequence, Action } from '../planning/ActionSequenceGenerator';
import { PlanEvaluationEngine, PlanEvaluationResult } from '../planning/PlanEvaluationEngine';
import { AgentMemorySystem, Memory, MemoryType, MemoryQuery } from './AgentMemorySystem';
import { AgentLearningModule, LearningExperience, LearningResult } from './AgentLearningModule';

export interface Environment {
  entities: OntologyObject[];
  timestamp: string;
  context: Record<string, any>;
}

export interface Perception {
  entities: EntityPerception[];
  summary: PerceptionResult['summary'];
  anomalies: { entityId: string; anomalies: any[] }[];
  patterns: { entityId: string; patterns: any[] }[];
}

export interface ReasoningResult {
  observations: Observation[];
  hypotheses: Hypothesis[];
  conclusions: { description: string; confidence: number }[];
  reasoningChain: ReasoningChain;
}

export interface Plan {
  id: string;
  goal: Goal;
  subGoals: SubGoal[];
  dependencyGraph: DependencyGraph;
  actionSequence: ActionSequence;
  evaluation: PlanEvaluationResult;
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionResult {
  planId: string;
  actions: { action: Action; status: 'success' | 'partial' | 'failed'; result: string }[];
  overallStatus: 'success' | 'partial' | 'failed';
  lessons: string[];
  timestamp: string;
}

export interface AgentState {
  id: string;
  name: string;
  status: 'idle' | 'perceiving' | 'reasoning' | 'planning' | 'executing' | 'learning';
  currentGoal?: Goal;
  currentPlan?: Plan;
  perception?: Perception;
  reasoning?: ReasoningResult;
  lastActivity: string;
}

export interface CognitiveAgentConfig {
  name: string;
  perceptionEngine?: PerceptionEngine;
  memorySystem?: AgentMemorySystem;
  learningModule?: AgentLearningModule;
}

export class CognitiveAgent {
  private id: string;
  private name: string;
  private state: AgentState;
  private perceptionEngine: PerceptionEngine;
  private abductiveEngine: AbductiveReasoningEngine;
  private goalDecompositionEngine: GoalDecompositionEngine;
  private actionSequenceGenerator: ActionSequenceGenerator;
  private planEvaluationEngine: PlanEvaluationEngine;
  private memorySystem: AgentMemorySystem;
  private learningModule: AgentLearningModule;

  constructor(config: CognitiveAgentConfig) {
    this.id = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.name = config.name;
    
    this.perceptionEngine = config.perceptionEngine || new PerceptionEngine();
    this.memorySystem = config.memorySystem || new AgentMemorySystem();
    this.learningModule = config.learningModule || new AgentLearningModule();
    
    this.abductiveEngine = new AbductiveReasoningEngine();
    this.goalDecompositionEngine = new GoalDecompositionEngine();
    this.actionSequenceGenerator = new ActionSequenceGenerator();
    this.planEvaluationEngine = new PlanEvaluationEngine();

    this.state = {
      id: this.id,
      name: this.name,
      status: 'idle',
      lastActivity: new Date().toISOString(),
    };
  }

  perceive(environment: Environment): Perception {
    this.updateState('perceiving');

    const perceptionResult = this.perceptionEngine.perceiveAll(environment.entities);
    
    const perception: Perception = {
      entities: perceptionResult.entities,
      summary: perceptionResult.summary,
      anomalies: perceptionResult.entities.map(e => ({
        entityId: e.entityId,
        anomalies: e.anomalies,
      })),
      patterns: perceptionResult.entities.map(e => ({
        entityId: e.entityId,
        patterns: e.patterns,
      })),
    };

    this.memorySystem.store({
      type: MemoryType.EPISODIC,
      content: {
        type: 'perception',
        data: perception,
      },
      importance: perception.summary.criticalCount > 0 ? 0.8 : 0.5,
      timestamp: new Date().toISOString(),
    });

    this.state.perception = perception;
    this.updateState('idle');

    return perception;
  }

  remember(context: { type: string; query: string }): Memory[] {
    const query: MemoryQuery = {
      keywords: [context.query],
    };
    return this.memorySystem.retrieve(query);
  }

  reason(perception: Perception, _memory: Memory[]): ReasoningResult {
    this.updateState('reasoning');

    const observations: Observation[] = this.generateObservations(perception);
    
    const hypotheses: Hypothesis[] = [];
    for (const obs of observations) {
      const context = {
        observations: [obs],
        entities: [],
        historicalPatterns: [],
      };
      const hyps = this.abductiveEngine.inferBestExplanation(obs, context);
      hypotheses.push(...hyps);
    }

    const conclusions = hypotheses
      .filter(h => h.confidence > 0.6)
      .map(h => ({
        description: h.description,
        confidence: h.confidence,
      }));

    const reasoningChain: ReasoningChain = {
      conclusion: conclusions[0]?.description || '需要进一步调查',
      evidence: hypotheses.flatMap(h => h.evidence),
      confidence: hypotheses.length > 0 ? 
        hypotheses.reduce((sum, h) => sum + h.confidence, 0) / hypotheses.length : 0.5,
      alternativeHypotheses: hypotheses.slice(1, 4).map(h => ({
        hypothesis: h.description,
        confidence: h.confidence,
      })),
      suggestedActions: hypotheses.flatMap(h => h.testablePredictions).slice(0, 5).map(p => ({
        actionName: p,
        priority: 'medium' as const,
        reason: '基于推理结果',
      })),
    };

    const result: ReasoningResult = {
      observations,
      hypotheses,
      conclusions,
      reasoningChain,
    };

    this.memorySystem.store({
      type: MemoryType.SEMANTIC,
      content: {
        type: 'reasoning',
        conclusions,
      },
      importance: 0.7,
      timestamp: new Date().toISOString(),
    });

    this.state.reasoning = result;
    this.updateState('idle');

    return result;
  }

  plan(goal: Goal, _reasoning: ReasoningResult): Plan {
    this.updateState('planning');

    const subGoals = this.goalDecompositionEngine.decomposeGoal(goal);
    const dependencyGraph = this.goalDecompositionEngine.buildDependencyGraph(subGoals);
    
    const actionSequence = this.actionSequenceGenerator.generateSequence({
      goal: subGoals[0],
      entities: [],
      constraints: [],
      preferences: [],
    });

    const evaluation = this.planEvaluationEngine.evaluatePlan(actionSequence);

    const plan: Plan = {
      id: `plan_${Date.now()}`,
      goal,
      subGoals,
      dependencyGraph,
      actionSequence,
      evaluation,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.memorySystem.store({
      type: MemoryType.EPISODIC,
      content: {
        type: 'plan',
        plan,
      },
      importance: 0.8,
      timestamp: new Date().toISOString(),
    });

    this.state.currentPlan = plan;
    this.updateState('idle');

    return plan;
  }

  async execute(plan: Plan): Promise<ExecutionResult> {
    this.updateState('executing');

    const actionResults: { action: Action; status: 'success' | 'partial' | 'failed'; result: string }[] = [];
    
    for (const action of plan.actionSequence.actions) {
      const result = await this.executeAction(action);
      actionResults.push(result);
    }

    const successCount = actionResults.filter(r => r.status === 'success').length;
    const overallStatus: 'success' | 'partial' | 'failed' = 
      successCount === actionResults.length ? 'success' :
      successCount > actionResults.length / 2 ? 'partial' : 'failed';

    const lessons = this.extractLessons(actionResults);

    const executionResult: ExecutionResult = {
      planId: plan.id,
      actions: actionResults,
      overallStatus,
      lessons,
      timestamp: new Date().toISOString(),
    };

    this.memorySystem.store({
      type: MemoryType.EPISODIC,
      content: {
        type: 'execution',
        result: executionResult,
      },
      importance: overallStatus === 'success' ? 0.9 : 0.7,
      timestamp: new Date().toISOString(),
    });

    plan.status = overallStatus === 'success' ? 'completed' : 
                   overallStatus === 'partial' ? 'completed' : 'failed';
    plan.updatedAt = new Date().toISOString();

    this.updateState('idle');

    return executionResult;
  }

  learn(experience: LearningExperience): LearningResult {
    this.updateState('learning');

    const result = this.learningModule.learn(experience);

    this.memorySystem.store({
      type: MemoryType.SEMANTIC,
      content: {
        type: 'learning',
        result,
      },
      importance: 0.8,
      timestamp: new Date().toISOString(),
    });

    this.updateState('idle');

    return result;
  }

  getState(): AgentState {
    return { ...this.state };
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  private updateState(status: AgentState['status']): void {
    this.state.status = status;
    this.state.lastActivity = new Date().toISOString();
  }

  private generateObservations(perception: Perception): Observation[] {
    const observations: Observation[] = [];

    for (const entity of perception.entities) {
      if (entity.state === 'critical') {
        observations.push({
          id: `obs_${entity.entityId}_critical_${Date.now()}`,
          type: 'anomaly',
          description: `${entity.entityName} 处于危急状态`,
          entityId: entity.entityId,
          entityName: entity.entityName,
          entityType: entity.entityType,
          timestamp: new Date().toISOString(),
          properties: { state: entity.state },
          severity: 'high',
        });
      }

      for (const anomaly of entity.anomalies) {
        if (anomaly.severity === 'high') {
          observations.push({
            id: `obs_${entity.entityId}_${anomaly.type}_${Date.now()}`,
            type: 'anomaly',
            description: anomaly.description,
            entityId: entity.entityId,
            entityName: entity.entityName,
            entityType: entity.entityType,
            timestamp: new Date().toISOString(),
            properties: anomaly,
            severity: anomaly.severity,
          });
        }
      }
    }

    return observations;
  }

  private async executeAction(action: Action): Promise<{ action: Action; status: 'success' | 'partial' | 'failed'; result: string }> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return { action, status: 'failed', result: `未认证，无法执行 ${action.name}` };
      }

      const object_type = action.targetEntityType || 'Object';
      const object_id = action.targetEntity || 'unknown';

      const response = await fetch(`/api/ontology/${object_type}/${object_id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: action.name,
          params: action.metadata || {},
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          action,
          status: data.success ? 'success' : 'partial',
          result: data.success ? `成功完成 ${action.name}` : `部分完成 ${action.name}`,
        };
      } else {
        return { action, status: 'failed', result: `执行失败 ${action.name}：HTTP ${response.status}` };
      }
    } catch (error) {
      return {
        action,
        status: 'partial',
        result: `本地执行 ${action.name}（后端不可用）`,
      };
    }
  }

  private extractLessons(results: { action: Action; status: string; result: string }[]): string[] {
    const lessons: string[] = [];

    const failedActions = results.filter(r => r.status === 'failed');
    if (failedActions.length > 0) {
      lessons.push(`有 ${failedActions.length} 个行动执行失败，需要分析原因`);
    }

    const highPriorityActions = results.filter(r => r.action.priority === 'high');
    const successHighPriority = highPriorityActions.filter(r => r.status === 'success');
    if (successHighPriority.length < highPriorityActions.length) {
      lessons.push('高优先级任务完成率不足，建议优化执行策略');
    }

    return lessons;
  }
}

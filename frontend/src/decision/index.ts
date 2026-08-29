// 决策模块导出

export {
  // 枚举
  DecisionType,
  DecisionDomain,
  DecisionStatus,
  TimeHorizon,
  SpatialScope,
  ExecutionStatus,
} from './DecisionOntology';

export type {
  SpatialScope as SpatialScopeType,
} from './DecisionOntology';

export type {
  // 决策上下文
  DecisionContext,
  Stakeholder,
  Constraint,
  Objective,
  ContextMetadata,
  
  // 决策场景
  DecisionScenario,
  DecisionAlternative,
  ActionProposal,
  ExpectedOutcome,
  Risk,
  ResourceRequirement,
  Criterion,
  
  // 决策推荐
  DecisionRecommendation,
  ImpactAssessment,
  FinancialImpact,
  OperationalImpact,
  StrategicImpact,
  RiskImpact,
  ImplementationStep,
  Milestone,
  
  // 决策执行
  DecisionExecution,
  ExecutedAction,
  ExecutionProgress,
  ExecutionIssue,
  
  // 决策记录与学习
  DecisionRecord,
  ActualImpact,
  ImpactVariance,
  Lesson,
  DecisionFeedback,
  LearningResult,
  DecisionPattern,
  Heuristic,
  ModelUpdate,
  
  // 解释
  Explanation,
  ReasoningStep,
  Evidence,
} from './DecisionOntology';

export {
  DecisionRecommendationEngine,
} from './DecisionRecommendationEngine';

export type {
  EvaluationResult,
} from './DecisionRecommendationEngine';

export {
  DecisionExecutionTracker,
} from './DecisionExecutionTracker';
